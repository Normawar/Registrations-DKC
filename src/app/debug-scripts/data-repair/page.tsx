
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
import { isSameDay, parseISO, isBefore } from 'date-fns';
import { useEvents, type Event } from '@/hooks/use-events';
import { createPsjaSplitInvoice } from '@/ai/flows/create-psja-split-invoice-flow';
import { cancelInvoice } from '@/ai/flows/cancel-invoice-flow';
import { useMasterDb } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';


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


export function StudentTypeUpdater() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [stats, setStats] = useState<UpdateStats | null>(null);
  const [verificationStats, setVerificationStats] = useState<VerificationStats | null>(null);
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
      
      const finalStats: UpdateStats = {
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
      
      const verifyStats: VerificationStats = {
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


export default function DataRepairPage() {
  const [inputText, setInputText] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const [isEventIdRepairing, setIsEventIdRepairing] = useState(false);
  const { events } = useEvents();
  const { profile } = useSponsorProfile();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).debugDB) {
      // Your debug script can be added here inside useEffect
      // to ensure it runs only on the client side.
    }
  }, []);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message }]);
  };
  
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
        
      </div>
    </AppLayout>
  );
}
