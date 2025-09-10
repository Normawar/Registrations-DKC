
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, writeBatch, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, XCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MasterPlayer } from '@/lib/data/full-master-player-data';
import { cn } from '@/lib/utils';
import { schoolData } from '@/lib/data/school-data';
import { generateTeamCode } from '@/lib/school-utils';
import Papa from 'papaparse';
import { isSameDay, parseISO } from 'date-fns';
import { useEvents, type Event } from '@/hooks/use-events';
import { recreateInvoiceFromRoster } from '@/ai/flows/recreate-invoice-from-roster-flow';


interface LogEntry {
  type: 'success' | 'error' | 'info';
  message: string;
}

// Temporary debug export - remove after use
if (typeof window !== 'undefined') {
  (window as any).debugDB = { db, getDocs, collection };
  // Get all invoices with just basic info first
  (window as any).debugDB.getDocs(window.debugDB.collection(window.debugDB.db, 'invoices')).then((snapshot: any) => {
    const invoices: any[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      invoices.push({
        id: doc.id,
        invoiceNumber: data.invoiceNumber || 'Unknown',
        schoolName: data.schoolName || 'Unknown',
        status: data.status || data.invoiceStatus || 'Unknown',
        playerCount: data.selections ? Object.keys(data.selections).length : 0,
        hasPlayerNames: data.selections ? Object.keys(data.selections).some((key: string) => key.includes('_') || isNaN(parseInt(key))) : false
      });
    });
    console.log('=== INVOICE SUMMARY ===');
    invoices.forEach((inv: any) => {
      console.log(`#${inv.invoiceNumber} | ${inv.schoolName} | Players: ${inv.playerCount} | Names: ${inv.hasPlayerNames ? 'YES' : 'NO'} | Status: ${inv.status}`);
    });
    console.log(`\nTotal invoices: ${invoices.length}`);
  });
}


// School mapping based on the team codes in the raw data
const SCHOOL_MAPPINGS = {
  'PHPCOHPROF': 'PSJA COLLEGIATE SCHOOL OF HEALTH PROFESSIONS',
  'PHKENN': 'KENNEDY MIDDLE',
  'PHASORE': 'ALFRED SORENSEN EL',
  'PHJMCKE': 'JOHN MCKEEVER EL',
  'PHGPALM': 'GERALDINE PALMER EL',
  'PHDWLONG': 'DR WILLIAM LONG EL',
  'PHACESCO': 'AIDA C ESCOBAR EL',
  'PHGGARC': 'GRACIELA GARCIA EL',
  'PHAMURP': 'AUDIE MURPHY MIDDLE',
  'PHAUST': 'AUSTIN MIDDLE',
  'PHAGARZ': 'AMANDA GARZA-PENA EL',
  'PHPTJTECOLL': 'PSJA THOMAS JEFFERSON T-STEM EARLY COLLEGE H S',
  'PHACANT': 'ARNOLDO CANTU SR EL'
};

const DISTRICT_NAME = 'PHARR-SAN JUAN-ALAMO ISD';

// Add this component to your data repair page.tsx

interface UpdateStats {
  totalInvoices: number;
  updatedInvoices: number;
  updatedSelections: number;
  totalPlayers: number;
}

interface VerificationStats {
  gt: number;
  independent: number;
  regular: number;
  missing: number;
  totalSelections: number;
}

function GtInvoiceFixer() {
  const [fixLog, setFixLog] = useState<string[]>([]);
  const [isFixing, setIsFixing] = useState(false);
  const [invoicesToFix, setInvoicesToFix] = useState<any[]>([]);
  const { database: allPlayers } = useMasterDb();
  const { toast } = useToast();

  const addLog = (message: string) => setFixLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);

  const findInvoicesToFix = async () => {
    setIsFixing(true);
    addLog('🔍 Searching for invoices...');
    const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
    const allInvoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const psjaUnpaidInvoices = allInvoices.filter(inv => 
      inv.district === 'PHARR-SAN JUAN-ALAMO ISD' &&
      inv.status === 'UNPAID' &&
      inv.selections
    );
    
    addLog(`Found ${psjaUnpaidInvoices.length} unpaid PSJA invoices.`);

    const flaggedInvoices = psjaUnpaidInvoices.filter(inv => {
      return Object.entries(inv.selections).some(([playerId, selection]: [string, any]) => {
        if (selection.uscfStatus === 'new' || selection.uscfStatus === 'renewing') {
          const player = allPlayers.find(p => p.id === playerId);
          return player?.studentType === 'gt';
        }
        return false;
      });
    });

    setInvoicesToFix(flaggedInvoices);
    addLog(`Found ${flaggedInvoices.length} invoices with GT players who were charged USCF fees.`);
    if (flaggedInvoices.length === 0) {
      toast({ title: "No Invoices to Fix", description: "All unpaid PSJA invoices are correct." });
    }
    setIsFixing(false);
  };
  
  const runFix = async () => {
      setIsFixing(true);
      addLog(`🚀 Starting fix for ${invoicesToFix.length} invoices...`);
      let successCount = 0;

      for (const invoice of invoicesToFix) {
          try {
              addLog(`--- Processing Invoice #${invoice.invoiceNumber} (${invoice.id}) ---`);
              
              const playerIds = Object.keys(invoice.selections);
              const playersData = playerIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as MasterPlayer[];
              const eventInfo = await getDoc(doc(db, 'events', invoice.eventId));
              if (!eventInfo.exists()) {
                  throw new Error(`Event ${invoice.eventId} not found.`);
              }
              const eventDetails = eventInfo.data() as Event;

              // Recreate the player list for the recreation flow
              const playersToInvoice = playersData.map(player => {
                  const selection = invoice.selections[player.id];
                  const lateFeeAmount = (invoice.totalInvoiced / playersData.length) - eventDetails.regularFee - (selection.uscfStatus !== 'current' ? 24 : 0);
                  
                  return {
                      playerName: `${player.firstName} ${player.lastName}`,
                      uscfId: player.uscfId,
                      baseRegistrationFee: eventDetails.regularFee,
                      lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
                      uscfAction: selection.uscfStatus !== 'current',
                      isGtPlayer: player.studentType === 'gt',
                  };
              });
              
              addLog(`Recreating invoice for ${playersToInvoice.length} players...`);
              
              const result = await recreateInvoiceFromRoster({
                  originalInvoiceId: invoice.invoiceId,
                  players: playersToInvoice,
                  uscfFee: 24, // The flow will correctly ignore this for GT players
                  sponsorName: invoice.purchaserName,
                  sponsorEmail: invoice.sponsorEmail,
                  bookkeeperEmail: invoice.bookkeeperEmail,
                  gtCoordinatorEmail: invoice.gtCoordinatorEmail,
                  schoolName: invoice.schoolName,
                  schoolAddress: invoice.schoolAddress,
                  schoolPhone: invoice.schoolPhone,
                  district: invoice.district,
                  teamCode: invoice.teamCode,
                  eventName: invoice.eventName,
                  eventDate: invoice.eventDate,
              });

              addLog(`✅ Successfully recreated invoice. New ID: ${result.newInvoiceId}, New #: ${result.newInvoiceNumber}`);
              successCount++;
          } catch (error: any) {
              addLog(`❌ ERROR processing invoice ${invoice.id}: ${error.message}`);
          }
      }
      
      addLog(`--- FIX COMPLETE: ${successCount} of ${invoicesToFix.length} invoices processed successfully. ---`);
      toast({ title: 'Invoice Fix Complete', description: `${successCount} invoices were successfully recreated.` });
      setInvoicesToFix([]); // Clear list after running
      setIsFixing(false);
  };


  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-orange-900 mb-2">Fix PSJA GT Player Invoices</h3>
      <p className="text-orange-700 text-sm mb-4">
        This tool finds unpaid invoices for the PSJA district where GT players were incorrectly charged for USCF memberships and recreates them with the correct totals.
      </p>
      
      <div className="flex gap-4">
        <Button onClick={findInvoicesToFix} disabled={isFixing || invoicesToFix.length > 0}>
          {isFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {invoicesToFix.length > 0 ? 'Invoices Found' : '1. Find Invoices to Fix'}
        </Button>
        {invoicesToFix.length > 0 && (
          <Button onClick={runFix} disabled={isFixing}>
            {isFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            2. Recreate {invoicesToFix.length} Invoice(s)
          </Button>
        )}
      </div>

      {fixLog.length > 0 && (
        <div className="mt-4 bg-black text-green-400 p-3 rounded text-xs font-mono max-h-96 overflow-y-auto">
          {fixLog.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}



export function StudentTypeUpdater() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [stats, setStats] = useState<UpdateStats | null>(null);
  const [verificationStats, setVerificationStats] = useState<VerificationStats | null>(null);

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
      
      // Step 1: Load all players into memory for fast lookup
      addLog('📥 Loading player collection...');
      const playersSnapshot = await getDocs(collection(db, 'players'));
      
      const playerLookup: Record<string, { studentType: string; name: string; school: string }> = {};
      let playerCount = 0;
      
      playersSnapshot.forEach(doc => {
        const playerData = doc.data();
        const uscfId = playerData.uscfId || doc.id;
        
        if (uscfId) {
          playerLookup[uscfId] = {
            studentType: playerData.studentType || 'regular',
            name: playerData.name || 'Unknown',
            school: playerData.school || 'Unknown'
          };
          playerCount++;
        }
      });
      
      addLog(`✅ Loaded ${playerCount} players for lookup`);
      
      // Step 2: Load all invoices
      addLog('📥 Loading invoice collection...');
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      
      let invoiceCount = 0;
      let updatedInvoices = 0;
      let updatedSelectionsCount = 0;
      const updatePromises: Promise<void>[] = [];
      
      // Step 3: Process each invoice
      invoicesSnapshot.forEach(docSnap => {
        const invoiceData = docSnap.data();
        const invoiceId = docSnap.id;
        invoiceCount++;
        
        if (!invoiceData.selections || Object.keys(invoiceData.selections).length === 0) {
          addLog(`⏭️  Skipping invoice ${invoiceData.invoiceNumber || invoiceId} - no selections`);
          return;
        }
        
        let selectionUpdated = false;
        const updatedSelections = { ...invoiceData.selections };
        
        // Process each selection in the invoice
        Object.entries(invoiceData.selections).forEach(([playerId, playerData]: [string, any]) => {
          // Skip if already has studentType
          if (playerData.studentType) {
            return;
          }
          
          // Extract USCF ID from various formats
          let uscfId: string | null = null;
          
          if (/^\d+$/.test(playerId)) {
            // Direct USCF ID (like "31487795")
            uscfId = playerId;
          } else if (playerId.startsWith('NEW_')) {
            // NEW players don't have USCF IDs yet, keep as regular
            updatedSelections[playerId] = {
              ...playerData,
              studentType: 'regular'
            };
            selectionUpdated = true;
            return;
          } else if (playerId.startsWith('temp_')) {
            // temp players, keep as regular
            updatedSelections[playerId] = {
              ...playerData,
              studentType: 'regular'
            };
            selectionUpdated = true;
            return;
          }
          
          // Look up student type from player collection
          if (uscfId && playerLookup[uscfId]) {
            const playerInfo = playerLookup[uscfId];
            updatedSelections[playerId] = {
              ...playerData,
              studentType: playerInfo.studentType
            };
            selectionUpdated = true;
            updatedSelectionsCount++;
            
            addLog(`🔄 ${invoiceData.invoiceNumber || invoiceId}: ${uscfId} → ${playerInfo.studentType} (${playerInfo.name})`);
          } else if (uscfId) {
            // USCF ID not found in player collection, default to regular
            updatedSelections[playerId] = {
              ...playerData,
              studentType: 'regular'
            };
            selectionUpdated = true;
            updatedSelectionsCount++;
            
            addLog(`❓ ${invoiceData.invoiceNumber || invoiceId}: ${uscfId} → regular (not found in players)`);
          }
        });
        
        // Update the invoice if any selections were modified
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
      
      // Step 4: Execute all updates
      addLog(`\n🔄 Updating ${updatedInvoices} invoices with studentType data...`);
      await Promise.all(updatePromises);
      
      // Step 5: Summary
      const finalStats: UpdateStats = {
        totalInvoices: invoiceCount,
        updatedInvoices,
        updatedSelections: updatedSelectionsCount,
        totalPlayers: playerCount
      };
      
      setStats(finalStats);
      addLog('\n🎉 UPDATE COMPLETE!');
      addLog(`📊 Summary:`);
      addLog(`   • Total invoices processed: ${finalStats.totalInvoices}`);
      addLog(`   • Invoices updated: ${finalStats.updatedInvoices}`);
      addLog(`   • Player selections updated: ${finalStats.updatedSelections}`);
      addLog(`   • Players in lookup table: ${finalStats.totalPlayers}`);
      
      // Step 6: Run verification
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
      
      const verifyStats: VerificationStats = {
        gt: 0,
        independent: 0,
        regular: 0,
        missing: 0,
        totalSelections: 0
      };
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
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


export default function DataRepairPage() {
  const [inputText, setInputText] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const [isEventIdRepairing, setIsEventIdRepairing] = useState(false);
  const { events } = useEvents();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).debugDB) {
      // Your debug script can be added here inside useEffect
      // to ensure it runs only on the client side.
    }
  }, []);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message }]);
  };

  const repairMissingEventIds = async () => {
    setIsEventIdRepairing(true);
    addLog('info', 'Starting Event ID Repair Process...');
    const libertyEventId = 'evt-1757125186611-0.8707914537148768';

    try {
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      let updatedCount = 0;
      const batch = writeBatch(db);

      invoicesSnapshot.forEach(docSnap => {
        const invoice = docSnap.data();
        // Force update ALL invoices with the hardcoded eventId
        batch.update(doc(db, 'invoices', docSnap.id), { eventId: libertyEventId });
        updatedCount++;
        addLog('success', `Staging update for invoice #${invoice.invoiceNumber || docSnap.id} to ensure correct eventId.`);
      });
      
      if (updatedCount > 0) {
        await batch.commit();
        addLog('success', `Successfully updated ${updatedCount} invoices with the Liberty event ID.`);
        toast({ title: 'Repair Complete', description: `${updatedCount} invoices were fixed.` });
      } else {
        addLog('info', 'No invoices found to repair.');
        toast({ title: 'No Repairs Needed' });
      }
    } catch (e: any) {
      addLog('error', `Event ID repair failed: ${e.message}`);
      toast({ variant: 'destructive', title: 'Repair Failed', description: e.message });
    }

    setIsEventIdRepairing(false);
  };
  
  const repairInvoiceEmailFields = async () => {
    setIsProcessing(true);
    addLog('info', 'Starting email field repair process...');
    
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersMap = new Map();
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            usersMap.set(userData.email, userData);
        });
        addLog('info', `Loaded ${usersMap.size} user profiles.`);

        const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
        const batch = writeBatch(db);
        let updatedCount = 0;

        invoicesSnapshot.forEach(doc => {
            const invoice = doc.data();
            const sponsorEmail = invoice.sponsorEmail || invoice.purchaserEmail;

            if (sponsorEmail && usersMap.has(sponsorEmail)) {
                const userProfile = usersMap.get(sponsorEmail);
                let needsUpdate = false;
                const updateData: any = {};

                if (!invoice.bookkeeperEmail && userProfile.bookkeeperEmail) {
                    updateData.bookkeeperEmail = userProfile.bookkeeperEmail;
                    needsUpdate = true;
                }
                if (!invoice.gtCoordinatorEmail && userProfile.gtCoordinatorEmail) {
                    updateData.gtCoordinatorEmail = userProfile.gtCoordinatorEmail;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    batch.update(doc.ref, updateData);
                    updatedCount++;
                    addLog('info', `Staged update for invoice ${doc.id} to add missing email fields.`);
                }
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            addLog('success', `Email Repair Complete: Successfully updated ${updatedCount} invoices.`);
            toast({ title: 'Repair Complete', description: `${updatedCount} invoices were updated with missing email fields.` });
        } else {
            addLog('info', 'No invoices needed email field repairs.');
            toast({ title: 'No Repairs Needed', description: 'All invoices already have the necessary email fields.' });
        }

    } catch (e: any) {
        addLog('error', `Email repair failed: ${e.message}`);
        toast({ variant: 'destructive', title: 'Repair Failed', description: e.message });
    }

    setIsProcessing(false);
  };
  
  const extractSchoolFromTeamCode = (invoiceText: string): { school: string; district: string } => {
    // Look for team code pattern in the invoice text
    for (const [teamCode, schoolName] of Object.entries(SCHOOL_MAPPINGS)) {
      if (invoiceText.includes(teamCode)) {
        return { school: schoolName, district: DISTRICT_NAME };
      }
    }
    
    // Fallback: try to extract from customer info
    const customerMatch = invoiceText.match(/Customer\s+([^\n]+)\n([^\/\n]+)/);
    if (customerMatch && customerMatch[2]) {
      const schoolLine = customerMatch[2].trim();
      if (schoolLine.includes('/')) {
        const parts = schoolLine.split('/');
        return { 
          school: parts[0].trim(), 
          district: parts[1] ? parts[1].trim() : DISTRICT_NAME 
        };
      }
      return { school: schoolLine, district: DISTRICT_NAME };
    }
    
    return { school: 'Unknown School', district: DISTRICT_NAME };
  };

  const parseAndProcessData = async () => {
    if (!inputText.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Input text cannot be empty.' });
      return;
    }
    
    setIsProcessing(true);
    setLogs([]);
    addLog('info', 'Starting data processing...');

    // Updated regex to handle both "for inv:" and "inv:" patterns
    const invoiceRegex = /(?:for\s+)?inv:([\w:-]+)/gi;
    const matches = [...inputText.matchAll(invoiceRegex)];
    
    if (matches.length === 0) {
      addLog('error', 'No invoice IDs found in the input text. Check the format.');
      setIsProcessing(false);
      return;
    }

    const batch = writeBatch(db);
    let processedCount = 0;
    
    // Load existing players once
    const existingPlayers = new Map<string, MasterPlayer>();
    try {
      const playersCol = collection(db, 'players');
      const playerSnapshot = await getDocs(playersCol);
      playerSnapshot.forEach(doc => {
        existingPlayers.set(doc.id, doc.data() as MasterPlayer);
      });
      addLog('info', `Loaded ${existingPlayers.size} existing players from database.`);
    } catch (error) {
      addLog('error', `Failed to load existing players: ${error}`);
      setIsProcessing(false);
      return;
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const invoiceId = `inv:${match[1]}`;
      
      // Extract text for this invoice (from this match to the next match or end of text)
      const startIndex = match.index! + match[0].length;
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index! : inputText.length;
      const invoiceText = inputText.substring(startIndex, endIndex);

      addLog('info', `Processing Invoice ID: ${invoiceId}`);
      
      try {
        const docRef = doc(db, 'invoices', invoiceId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          addLog('error', `Invoice ${invoiceId} not found in database. Skipping.`);
          continue;
        }

        const invoiceData = docSnap.data();
        const selections: Record<string, any> = {};
        const players: { name: string, uscfId: string }[] = [];
        
        // Extract school and district information
        const { school, district } = extractSchoolFromTeamCode(invoiceText);
        addLog('info', `Detected school: ${school}, district: ${district}`);
        
        // Updated regex to handle various player formats including numbers with parentheses
        const playerRegex = /(\d+)\.\s+([\w\s.\-ÁÉÍÓÚÑáéíóúñ'JRIII]+?)\s+\(([^)]+)\)/g;
        let regexMatch;
        while ((regexMatch = playerRegex.exec(invoiceText)) !== null) {
          const name = regexMatch[2].trim();
          const uscfIdRaw = regexMatch[3].trim();
          
          // Handle various USCF ID formats
          let uscfId = uscfIdRaw;
          if (uscfIdRaw.toLowerCase() === 'new' || uscfIdRaw.toLowerCase() === 'new)') {
            uscfId = 'NEW';
          }
          
          players.push({ name, uscfId });
        }

        if (players.length === 0) {
          addLog('error', `No players found in text for invoice ${invoiceId}. Raw text sample: ${invoiceText.substring(0, 200)}...`);
          continue;
        }

        addLog('info', `Found ${players.length} players for invoice ${invoiceId}: ${players.map(p => `${p.name} (${p.uscfId})`).join(', ')}`);

        // Process each player
        for (const { name, uscfId } of players) {
          const isNew = uscfId === 'NEW';
          const playerId = isNew ? `temp_${name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}` : uscfId;

          const existingPlayer = existingPlayers.get(playerId);
          
          // Determine section - default to High School K-12 for existing players, or use existing section
          const section = existingPlayer?.section || 'High School K-12';
          
          // Determine USCF status based on membership purchase
          const uscfStatus = isNew
            ? 'new'
            : (invoiceText.includes('USCF Membership') && invoiceText.toLowerCase().includes(name.toLowerCase()))
              ? 'renewing'
              : 'current';

          selections[playerId] = { 
            section, 
            status: 'active', 
            uscfStatus 
          };

          // Create placeholder for new players
          if (isNew && !existingPlayer) {
            const [firstName, ...lastNameParts] = name.split(' ');
            const lastName = lastNameParts.join(' ') || '';
            const schoolSection = 'High School K-12';

            const placeholderPlayer: Partial<MasterPlayer> = {
              id: playerId,
              uscfId: 'NEW',
              firstName,
              lastName,
              school,
              district,
              grade: 'N/A',
              section: schoolSection, // Use school-inferred section
              email: 'placeholder@example.com',
              zipCode: '00000',
              events: 0,
              eventIds: []
            };
            
            batch.set(doc(db, 'players', playerId), placeholderPlayer);
            existingPlayers.set(playerId, placeholderPlayer as MasterPlayer); // Add to cache
            addLog('info', `Created placeholder for new player: ${name} (${playerId})`);
          }
        }

        // Update invoice with selections and school/district info
        const updateData: any = { selections };
        
        // Only update school/district if they're missing or different
        if (!invoiceData.schoolName || invoiceData.schoolName !== school) {
          updateData.schoolName = school;
          addLog('info', `Updated school name to: ${school}`);
        }
        
        if (!invoiceData.district || invoiceData.district !== district) {
          updateData.district = district;
          addLog('info', `Updated district to: ${district}`);
        }

        batch.update(docRef, updateData);
        addLog('success', `Successfully staged updates for invoice ${invoiceId} with ${players.length} players.`);
        processedCount++;

      } catch (e: any) {
        addLog('error', `Failed to process invoice ${invoiceId}: ${e.message}`);
        console.error(`Error processing invoice ${invoiceId}:`, e);
      }
    }

    // Commit all changes
    if (processedCount > 0) {
      try {
        await batch.commit();
        addLog('success', `BATCH COMMIT COMPLETE: Successfully updated ${processedCount} invoices in the database.`);
        toast({ 
          title: 'Update Complete', 
          description: `${processedCount} invoices have been updated with player selections and school information.`
        });
      } catch (e: any) {
        addLog('error', `FATAL: Batch commit failed: ${e.message}`);
        toast({ 
          variant: 'destructive', 
          title: 'Batch Commit Failed', 
          description: 'Could not save updates to the database.'
        });
      }
    } else {
      addLog('info', 'No valid invoices were processed or updated.');
      toast({ 
        variant: 'destructive', 
        title: 'No Updates', 
        description: 'No invoices were successfully processed.'
      });
    }

    setIsProcessing(false);
  };
  
    const exportCollectionData = async (collectionName: 'invoices' | 'players') => {
    setIsProcessing(true);
    addLog('info', `Exporting ${collectionName} collection...`);
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      const data: any[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collectionName}_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog('success', `Successfully exported ${data.length} documents from ${collectionName}.`);
    } catch (e: any) {
      addLog('error', `Export failed: ${e.message}`);
    }
    setIsProcessing(false);
  };

  const exportEnhancedInvoiceData = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'invoices'));
      const data: any[] = [];
      
      snapshot.forEach(doc => {
        data.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], 
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_invoices_complete_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      console.log(`Exported ${data.length} complete invoices`);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };


  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Data Repair Tool</h1>
          <p className="text-muted-foreground mt-2">
            Paste raw invoice data from Square to reconcile player registrations in Firestore.
            This tool will automatically extract school information, player names, and USCF IDs.
          </p>
        </div>
        
        <GtInvoiceFixer />
        <StudentTypeUpdater />
        
        <Card>
          <CardHeader>
            <CardTitle>Event ID Repair</CardTitle>
            <CardDescription>
              This tool finds invoices that are missing an Event ID and assigns the correct one by matching the event name and date. This is crucial for linking invoices to events correctly.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button 
              onClick={repairMissingEventIds} 
              disabled={isEventIdRepairing}
              variant="secondary"
            >
              {isEventIdRepairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEventIdRepairing ? 'Repairing...' : 'Fix Missing Event IDs'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Field Repair</CardTitle>
            <CardDescription>
              Repair missing bookkeeper and GT coordinator emails by pulling them from user profiles.
              This fixes invoices created when the automatic population wasn't working.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This will match sponsor emails to user profiles and populate missing:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc">
              <li>bookkeeperEmail from user profile</li>
              <li>gtCoordinatorEmail from user profile</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={repairInvoiceEmailFields} 
              disabled={isProcessing}
              variant="secondary"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? 'Repairing...' : 'Repair Email Fields'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paste Invoice Data</CardTitle>
            <CardDescription>
              Copy the complete, raw text for one or more Square invoices into the text area below. 
              The tool will automatically find and process each invoice, extract school information,
              and create player selections with proper USCF status tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste raw text data here..."
              className="h-64 font-mono text-xs"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
            />
          </CardContent>
          <CardFooter className="flex gap-2 flex-wrap">
            <Button onClick={parseAndProcessData} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? 'Processing...' : 'Process Pasted Data'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => exportCollectionData('invoices')}
              disabled={isProcessing}
            >
              Export Invoices (CSV)
            </Button>
            <Button 
              variant="outline" 
              onClick={() => exportCollectionData('players')}
              disabled={isProcessing}
            >
              Export Players (CSV)
            </Button>
            <Button 
              variant="outline" 
              onClick={exportEnhancedInvoiceData}
              disabled={isProcessing}
            >
              Enhanced Invoice Export (JSON)
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing Log</CardTitle>
            <CardDescription>
              Review the logs below to see the status of the data processing.
              This will show which invoices were processed, what players were found,
              and any issues encountered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 h-64 overflow-y-auto bg-muted p-4 rounded-md font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">Logs will appear here once processing starts.</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2">
                    {log.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                    {log.type === 'error' && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    {log.type === 'info' && <Info className="h-4 w-4 text-blue-500 shrink-0" />}
                    <p className={cn(
                      log.type === 'success' ? 'text-green-700' :
                      log.type === 'error' ? 'text-red-700' : 'text-blue-700'
                    )}>{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
