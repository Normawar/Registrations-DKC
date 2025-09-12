
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, writeBatch, collection, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, XCircle, Info, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MasterPlayer } from '@/lib/data/full-master-player-data';
import { cn } from '@/lib/utils';
import { schoolData } from '@/lib/data/school-data';
import { generateTeamCode } from '@/lib/school-utils';
import Papa from 'papaparse';
import { isSameDay, parseISO, isBefore } from 'date-fns';
import { useEvents, type Event } from '@/hooks/use-events';
import { createPsjaSplitInvoice } from '@/ai/flows/create-psja-split-invoice-flow';
import { cancelInvoice } from '@/ai/flows/cancel-invoice-flow';
import { useMasterDb } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { processBatchedRequests } from '@/ai/flows/process-batched-requests-flow';
import { randomUUID } from 'crypto';
import { getSquareClient } from '@/lib/square-client';
import { ApiError } from 'square';


interface LogEntry {
  type: 'success' | 'error' | 'info';
  message: string;
}

// --- New Orphaned Approval Cleanup Utility ---

interface OrphanedApproval {
  requestId: string;
  id: string;
  confirmationId: string;
  playerName: string;
  type: 'Withdrawal' | 'Substitution';
  approvedAt: string;
  status: 'Approved';
}

async function findAndFixOrphanedApprovals(allPlayers: MasterPlayer[]) {
  console.log('🔍 Scanning for approved requests that were never processed...');
  
  // 1. Find all approved requests
  const requestsSnapshot = await getDocs(
    query(collection(db, 'requests'), where('status', '==', 'Approved'))
  );
  
  const approvedRequests = requestsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as OrphanedApproval[];

  console.log(`Found ${approvedRequests.length} approved requests to verify`);

  const orphanedApprovals: OrphanedApproval[] = [];

  // 2. Check each approved request against actual invoice state
  for (const request of approvedRequests) {
    if (request.processedAsOrphan) continue; // Skip already processed ones
    
    const confirmationDoc = await getDoc(doc(db, 'invoices', request.confirmationId));
    
    if (!confirmationDoc.exists()) {
      console.log(`⚠️ Confirmation ${request.confirmationId} not found for request ${request.id}`);
      continue;
    }

    const confirmationData = confirmationDoc.data();
    
    // Check if player is still in selections (meaning withdrawal wasn't processed)
    if (request.type === 'Withdrawal') {
      const playerStillExists = Object.keys(confirmationData.selections || {}).some(playerId => {
        const player = allPlayers.find(p => p.id === playerId);
        if (!player) return false;
        
        const playerFullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        return playerFullName === request.playerName.toLowerCase();
      });

      if (playerStillExists) {
        orphanedApprovals.push(request);
        console.log(`❌ ORPHANED: ${request.playerName} withdrawal was approved but player still on invoice`);
      }
    }
  }

  console.log(`🎯 Found ${orphanedApprovals.length} orphaned approvals that need processing`);
  return orphanedApprovals;
}

async function processOrphanedApprovals(orphanedApprovals: OrphanedApproval[], allPlayers: MasterPlayer[]) {
  console.log('🔧 Processing orphaned approvals...');
  
  // Group by confirmation ID for batch processing
  const groupedByConfirmation = orphanedApprovals.reduce((acc, request) => {
    if (!acc[request.confirmationId]) {
      acc[request.confirmationId] = [];
    }
    acc[request.confirmationId].push(request);
    return acc;
  }, {} as Record<string, OrphanedApproval[]>);

  const results = [];

  for (const [confirmationId, requests] of Object.entries(groupedByConfirmation)) {
    console.log(`Processing ${requests.length} orphaned requests for confirmation ${confirmationId}`);
    
    try {
      const result = await processOrphanedBatch(confirmationId, requests, allPlayers);
      results.push(result);
    } catch (error: any) {
      console.error(`Failed to process orphaned batch for ${confirmationId}:`, error);
      results.push({
        confirmationId,
        success: false,
        error: error.message,
        requests: requests.map(r => r.id)
      });
    }
  }

  return results;
}

async function updateSquareInvoiceForOrphaned(invoiceId: string, changesSummary: string[]) {
  const squareClient = await getSquareClient();
  
  try {
    const { result: { invoice } } = await squareClient.invoicesApi.getInvoice(invoiceId);
    
    if (!invoice || !invoice.version) {
      throw new Error('Invoice not found in Square or has no version.');
    }

    // For any invoice status, we can at least update the description
    const updatedDescription = `${invoice.description || ''}\n\nCORRECTION: ${changesSummary.join(', ')}`;
    
    await squareClient.invoicesApi.updateInvoice(invoiceId, {
      invoice: {
        version: invoice.version,
        description: updatedDescription
      },
      idempotencyKey: randomUUID()
    });

    console.log(`✅ Updated Square invoice ${invoiceId} description with correction note`);
    
  } catch (error: any) {
    console.error(`Failed to update Square invoice ${invoiceId}:`, error);
    throw error;
  }
}

async function processOrphanedBatch(confirmationId: string, requests: OrphanedApproval[], allPlayers: MasterPlayer[]) {
  // Get current confirmation data
  const confirmationDoc = await getDoc(doc(db, 'invoices', confirmationId));
  const currentData = confirmationDoc.data();
  
  if (!currentData) {
    throw new Error(`Confirmation ${confirmationId} not found`);
  }

  console.log(`Processing orphaned batch for ${currentData.schoolName}`);

  // Apply the approved changes that never got processed
  let updatedSelections = { ...currentData.selections };
  const changesSummary: string[] = [];

  for (const request of requests) {
    if (request.type === 'Withdrawal') {
      // Find and remove the player
      const playerToRemove = Object.keys(updatedSelections).find(playerId => {
        const player = allPlayers.find(p => p.id === playerId);
        if (!player) return false;
        
        const playerFullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        return playerFullName === request.playerName.toLowerCase();
      });

      if (playerToRemove) {
        delete updatedSelections[playerToRemove];
        changesSummary.push(`Processed orphaned withdrawal: ${request.playerName}`);
        console.log(`✅ Removed ${request.playerName} from invoice ${confirmationId}`);
      } else {
        console.log(`⚠️ Could not find ${request.playerName} to remove from ${confirmationId}`);
      }
    }
  }

  if (changesSummary.length === 0) {
    console.log('No changes needed - requests may have been processed already');
    return {
      confirmationId,
      success: true,
      message: 'No changes needed',
      requests: requests.map(r => r.id)
    };
  }

  // Update the confirmation record with corrected selections
  await updateDoc(doc(db, 'invoices', confirmationId), {
    selections: updatedSelections,
    lastModified: new Date().toISOString(),
    changeHistory: [
      ...(currentData.changeHistory || []),
      {
        timestamp: new Date().toISOString(),
        changes: changesSummary,
        type: 'orphaned_approval_processing',
        requestIds: requests.map(r => r.id)
      }
    ]
  });

  // Try to update the actual Square invoice if possible
  try {
    if(currentData.invoiceId) {
      await updateSquareInvoiceForOrphaned(currentData.invoiceId, changesSummary);
    }
  } catch (error: any) {
    console.warn(`Could not update Square invoice ${currentData.invoiceId}:`, error.message);
    // Continue anyway - the important thing is our data is consistent
  }

  // Mark requests as actually processed
  const batch = writeBatch(db);
  requests.forEach(request => {
    const requestRef = doc(db, 'requests', request.id);
    batch.update(requestRef, {
      status: 'Approved',
      actuallyProcessed: true,
      processedAt: new Date().toISOString(),
      processedAsOrphan: true
    });
  });
  await batch.commit();

  return {
    confirmationId,
    success: true,
    changesApplied: changesSummary,
    playersRemaining: Object.keys(updatedSelections).length,
    requests: requests.map(r => r.id)
  };
}

// Utility to run the full cleanup process
export async function runJosueCleanup(allPlayers: MasterPlayer[]) {
  console.log('🚀 Starting Josue cleanup process...');
  
  try {
    // 1. Find all orphaned approvals
    const orphanedApprovals = await findAndFixOrphanedApprovals(allPlayers);
    
    if (orphanedApprovals.length === 0) {
      console.log('✅ No orphaned approvals found. Data is consistent.');
      return { success: true, message: 'No cleanup needed' };
    }

    // 2. Process them
    const results = await processOrphanedApprovals(orphanedApprovals, allPlayers);
    
    console.log('🎉 Cleanup complete!');
    console.log('Results:', results);
    
    return {
      success: true,
      orphanedCount: orphanedApprovals.length,
      results
    };
    
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// StudentTypeUpdater Component (existing)
export function StudentTypeUpdater() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [verificationStats, setVerificationStats] = useState<any | null>(null);
  const { database: allPlayers } = useMasterDb();

  const addLog = (message: string) => {
    setUpdateLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const updateInvoiceStudentTypes = async () => {
    setIsUpdating(true);
    setUpdateLog([]);
    setStats(null);
    setVerificationStats(null);

    try {
      addLog('🚀 Starting Invoice StudentType Update Process...');
      
      const playerLookup: Record<string, { studentType: string; name: string; school: string }> = {};
      allPlayers.forEach(player => {
        if (player.id) {
          playerLookup[player.id] = {
            studentType: player.studentType || 'regular',
            name: `${player.firstName} ${player.lastName}`,
            school: player.school || 'Unknown'
          };
        }
      });
      addLog(`✅ Loaded ${allPlayers.length} players for lookup`);
      
      addLog('📥 Loading invoice collection...');
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      
      let invoiceCount = 0;
      let updatedInvoices = 0;
      let updatedSelectionsCount = 0;
      const updatePromises: Promise<void>[] = [];
      
      invoicesSnapshot.forEach(docSnap => {
        const invoiceData = docSnap.data();
        const invoiceId = docSnap.id;
        invoiceCount++;
        
        if (!invoiceData.selections || Object.keys(invoiceData.selections).length === 0) {
          if (invoiceData.lineItems) {
            addLog(`ⓘ Skipping organizer invoice ${invoiceData.invoiceNumber || invoiceId}.`);
          } else {
            addLog(`⏭️  Skipping invoice ${invoiceData.invoiceNumber || invoiceId} - no selections`);
          }
          return;
        }
        
        let selectionUpdated = false;
        const updatedSelections = { ...invoiceData.selections };
        
        Object.entries(invoiceData.selections).forEach(([playerId, playerData]: [string, any]) => {
          if (playerData.studentType) {
            return;
          }
          
          if (playerLookup[playerId]) {
            const playerInfo = playerLookup[playerId];
            updatedSelections[playerId] = {
              ...playerData,
              studentType: playerInfo.studentType
            };
            selectionUpdated = true;
            updatedSelectionsCount++;
            
            addLog(`🔄 ${invoiceData.invoiceNumber || invoiceId}: ${playerInfo.name} → ${playerInfo.studentType}`);
          } else {
            updatedSelections[playerId] = {
              ...playerData,
              studentType: 'regular'
            };
            selectionUpdated = true;
            updatedSelectionsCount++;
            addLog(`❓ ${invoiceData.invoiceNumber || invoiceId}: Player ID ${playerId} → regular (not found in players)`);
          }
        });
        
        if (selectionUpdated) {
          const updatePromise = updateDoc(
            doc(db, 'invoices', invoiceId),
            { selections: updatedSelections }
          ).then(() => {
            addLog(`✅ Updated invoice ${invoiceData.invoiceNumber || invoiceId}`);
          }).catch(error => {
            addLog(`❌ Failed to update invoice ${invoiceData.invoiceNumber || invoiceId}: ${error.message}`);
          });
          
          updatePromises.push(updatePromise);
          updatedInvoices++;
        }
      });
      
      addLog(`\n🔄 Updating ${updatedInvoices} invoices with studentType data...`);
      await Promise.all(updatePromises);
      
      const finalStats: any = {
        totalInvoices: invoiceCount,
        updatedInvoices,
        updatedSelections: updatedSelectionsCount,
        totalPlayers: allPlayers.length
      };
      
      setStats(finalStats);
      addLog('\n🎉 UPDATE COMPLETE!');
      addLog(`📊 Summary:`);
      addLog(`   • Total invoices processed: ${finalStats.totalInvoices}`);
      addLog(`   • Invoices updated: ${finalStats.updatedInvoices}`);
      addLog(`   • Player selections updated: ${finalStats.updatedSelections}`);
      
      setTimeout(() => {
        verifyStudentTypeUpdate();
      }, 2000);
      
    } catch (error) {
      addLog(`❌ Error during update process: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const verifyStudentTypeUpdate = async () => {
    try {
      addLog('\n🔍 Running verification query...');
      
      const snapshot = await getDocs(collection(db, 'invoices'));
      
      const verifyStats: any = {
        gt: 0,
        independent: 0,
        regular: 0,
        missing: 0,
        totalSelections: 0
      };
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if(data.lineItems && !data.selections) {
            addLog(`ⓘ Skipping organizer invoice ${data.invoiceNumber || docSnap.id}.`);
            return;
        }

        if (data.selections) {
          Object.values(data.selections).forEach((selection: any) => {
            verifyStats.totalSelections++;
            const studentType = selection.studentType;
            
            if (!studentType) {
              verifyStats.missing++;
            } else if (studentType === 'gt') {
              verifyStats.gt++;
            } else if (studentType === 'independent') {
              verifyStats.independent++;
            } else {
              verifyStats.regular++;
            }
          });
        }
      });
      
      setVerificationStats(verifyStats);
      
      addLog('\n=== VERIFICATION: Student Type Distribution ===');
      addLog(`GT Students: ${verifyStats.gt}`);
      addLog(`Independent Students: ${verifyStats.independent}`);
      addLog(`Regular Students: ${verifyStats.regular}`);
      addLog(`Missing StudentType: ${verifyStats.missing}`);
      addLog(`Total Selections: ${verifyStats.totalSelections}`);
      
      if (verifyStats.missing === 0) {
        addLog('✅ All selections now have studentType!');
      } else {
        addLog(`⚠️  ${verifyStats.missing} selections still missing studentType`);
      }
      
    } catch (error) {
      addLog(`❌ Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Invoice StudentType Updater
        </h3>
        <p className="text-blue-700 text-sm mb-4">
          This tool updates all invoice selections with the correct studentType from the player collection. 
          This is needed for invoices created before the studentType functionality was incorporated.
        </p>
        
        <button
          onClick={updateInvoiceStudentTypes}
          disabled={isUpdating}
          className={`px-4 py-2 rounded-md font-medium ${
            isUpdating
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isUpdating ? 'Updating...' : 'Update StudentTypes from Player Collection'}
        </button>
      </div>

      {(stats || verificationStats) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">Update Results</h4>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <div className="font-medium text-green-800">Total Invoices</div>
                <div className="text-2xl font-bold text-green-600">{stats.totalInvoices}</div>
              </div>
              <div>
                <div className="font-medium text-green-800">Updated Invoices</div>
                <div className="text-2xl font-bold text-green-600">{stats.updatedInvoices}</div>
              </div>
              <div>
                <div className="font-medium text-green-800">Updated Selections</div>
                <div className="text-2xl font-bold text-green-600">{stats.updatedSelections}</div>
              </div>
              <div>
                <div className="font-medium text-green-800">Total Players</div>
                <div className="text-2xl font-bold text-green-600">{stats.totalPlayers}</div>
              </div>
            </div>
          )}
          
          {verificationStats && (
            <div className="border-t border-green-200 pt-4">
              <h5 className="font-medium text-green-800 mb-2">Student Type Distribution</h5>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <div className="font-medium text-green-700">GT Students</div>
                  <div className="text-xl font-bold text-blue-600">{verificationStats.gt}</div>
                </div>
                <div>
                  <div className="font-medium text-green-700">Independent</div>
                  <div className="text-xl font-bold text-purple-600">{verificationStats.independent}</div>
                </div>
                <div>
                  <div className="font-medium text-green-700">Regular</div>
                  <div className="text-xl font-bold text-gray-600">{verificationStats.regular}</div>
                </div>
                <div>
                  <div className="font-medium text-green-700">Missing</div>
                  <div className="text-xl font-bold text-red-600">{verificationStats.missing}</div>
                </div>
                <div>
                  <div className="font-medium text-green-700">Total</div>
                  <div className="text-xl font-bold text-green-600">{verificationStats.totalSelections}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {updateLog.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Update Log</h4>
          <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-96 overflow-y-auto">
            {updateLog.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function OrphanedApprovalFixer() {
    const { toast } = useToast();
    const { database: allPlayers } = useMasterDb();
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [foundOrphans, setFoundOrphans] = useState<OrphanedApproval[]>([]);

    const handleRunCleanup = async () => {
        setIsProcessing(true);
        setLogs([]);
        setFoundOrphans([]);
        const addLog = (message: string) => setLogs(prev => [...prev, message]);
        
        try {
            addLog('🚀 Starting cleanup process...');
            const orphans = await findAndFixOrphanedApprovals(allPlayers);
            setFoundOrphans(orphans);

            if (orphans.length === 0) {
                addLog('✅ No orphaned approvals found. Data is consistent.');
                toast({ title: 'Cleanup Complete', description: 'No orphaned approvals found.' });
            } else {
                addLog(`🎯 Found ${orphans.length} orphaned approvals. Now processing...`);
                const results = await processOrphanedApprovals(orphans, allPlayers);
                addLog('🎉 Cleanup processing finished!');
                results.forEach(result => {
                    if(result.success) {
                        addLog(`✅ Conf ID ${result.confirmationId}: ${result.message || 'Successfully processed.'}`);
                    } else {
                         addLog(`❌ Conf ID ${result.confirmationId}: FAILED - ${result.error}`);
                    }
                });
                toast({ title: 'Cleanup Complete', description: `Processed ${orphans.length} orphaned approvals.` });
            }
        } catch(error: any) {
            addLog(`❌ FATAL ERROR during cleanup: ${error.message}`);
            toast({ variant: 'destructive', title: 'Cleanup Failed', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Fix Orphaned Approvals</CardTitle>
                <CardDescription>This tool finds "Approved" change requests that were never actually processed and corrects the corresponding invoices.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleRunCleanup} disabled={isProcessing}>
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isProcessing ? 'Scanning & Fixing...' : 'Run Cleanup Now'}
                </Button>
            </CardContent>
            {logs.length > 0 && (
                <CardFooter>
                     <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Cleanup Log</h4>
                        <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-60 overflow-y-auto">
                            {logs.map((line, index) => (
                            <div key={index}>{line}</div>
                            ))}
                        </div>
                    </div>
                </CardFooter>
            )}
        </Card>
    );
}

export default function DataRepairPage() {
  const { profile } = useSponsorProfile();
  
  if (profile?.role !== 'organizer') {
    return (
        <AppLayout>
            <div className="text-center py-8">
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground">This page is only available to organizers.</p>
            </div>
        </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Data Repair Tool</h1>
          <p className="text-muted-foreground mt-2">
            One-time tools to fix or migrate data in the Firestore database.
          </p>
        </div>
        
        <StudentTypeUpdater />
        <OrphanedApprovalFixer />
        
      </div>
    </AppLayout>
  );
}
