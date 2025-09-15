
'use client';

import { useState } from 'react';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wrench, CheckCircle, FileWarning } from 'lucide-react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';

const testPlayerIds = [
    '90000001', '90000002', '90000003', '90000004', '90000005',
    '90000006', '90000007', '90000008', '90000009', '90000010'
];

// Sample data to be applied
const sampleData: { [key: string]: { grade: string, section: string } } = {
  '90000001': { grade: 'Kindergarten', section: 'Kinder-1st' },
  '90000002': { grade: '1st Grade', section: 'Kinder-1st' },
  '90000003': { grade: '2nd Grade', section: 'Primary K-3' },
  '90000004': { grade: '3rd Grade', section: 'Primary K-3' },
  '90000005': { grade: '4th Grade', section: 'Elementary K-5' },
  '90000006': { grade: '5th Grade', section: 'Elementary K-5' },
  '90000007': { grade: '6th Grade', section: 'Middle School K-8' },
  '90000008': { grade: '7th Grade', section: 'Middle School K-8' },
  '90000009': { grade: '8th Grade', section: 'Middle School K-8' },
  '90000010': { grade: '9th Grade', section: 'High School K-12' },
};


export default function DataRepairPage() {
  const { toast } = useToast();
  const { isDbLoaded, refreshDatabase } = useMasterDb();
  const [isProcessing, setIsProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({ scanned: 0, updated: 0, noAction: 0, failed: 0 });

  const runRepairScript = async () => {
    if (!db || !isDbLoaded) {
      toast({ variant: 'destructive', title: 'Database not ready', description: 'Please wait for the player database to finish loading.' });
      return;
    }

    setIsProcessing(true);
    setLog(['Starting test player data repair process...']);
    setStats({ scanned: 0, updated: 0, noAction: 0, failed: 0 });
    let localUpdatedCount = 0;

    try {
        const playersRef = collection(db, 'players');
        const q = query(playersRef, where('uscfId', 'in', testPlayerIds));
        
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        const foundPlayerIds = new Set<string>();

        setLog(prev => [...prev, `Found ${querySnapshot.size} test players in the database.`]);
        setStats(prev => ({ ...prev, scanned: querySnapshot.size }));
        
        querySnapshot.forEach((playerDoc) => {
            const player = playerDoc.data() as MasterPlayer;
            foundPlayerIds.add(player.uscfId);
            
            const updates = sampleData[player.uscfId];
            if (updates) {
                // This ensures all existing fields are preserved, and new ones are added
                const fullPlayerData: Partial<MasterPlayer> = {
                    ...player, // Carry over existing data
                    ...updates, // Apply new grade/section
                    school: "", // Explicitly unassign
                    district: "", // Explicitly unassign
                    
                    // Provide default values for all optional fields to prevent 'undefined' errors
                    middleName: player.middleName || '',
                    state: player.state || 'TX',
                    uscfExpiration: player.uscfExpiration || null,
                    regularRating: player.regularRating || null,
                    quickRating: player.quickRating || '',
                    dob: player.dob || null,
                    email: player.email || '',
                    phone: player.phone || '',
                    zipCode: player.zipCode || '',
                    studentType: player.studentType || 'independent',
                    events: player.events || 0,
                    eventIds: player.eventIds || [],
                };
                
                batch.update(playerDoc.ref, fullPlayerData);
                localUpdatedCount++;
                setLog(prev => [...prev, `  - Staged update for ${player.firstName} ${player.lastName} (ID: ${player.uscfId})`]);
            }
        });

        const notFoundIds = testPlayerIds.filter(id => !foundPlayerIds.has(id));
        if (notFoundIds.length > 0) {
            setLog(prev => [...prev, `Warning: ${notFoundIds.length} test player(s) not found in the database: ${notFoundIds.join(', ')}`]);
            setLog(prev => [...prev, 'Please run the "Import Test Players" tool first.']);
            setStats(prev => ({ ...prev, failed: notFoundIds.length }));
        }

        if (localUpdatedCount > 0) {
            await batch.commit();
            toast({
              title: "Test Player Data Repaired!",
              description: `Successfully updated ${localUpdatedCount} test player records.`,
            });
            refreshDatabase(); // Refresh local data context
        } else {
            toast({
              title: "No Updates Needed",
              description: "The found test players already seem to have data.",
            });
        }

        setStats(prev => ({ ...prev, updated: localUpdatedCount, noAction: prev.scanned - localUpdatedCount }));
        setLog(prev => [...prev, '...Data repair process finished.']);

    } catch (error) {
        console.error('Data repair failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        toast({ variant: 'destructive', title: 'Data Repair Failed', description: errorMessage });
        setLog(prev => [...prev, `ERROR: ${errorMessage}`]);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Test Player Data Setup</h1>
          <p className="text-muted-foreground mt-2">
            This is a developer utility to populate test players (90000001-90000010) with sample data.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Run Setup Script</CardTitle>
            <CardDescription>
              This tool will find players with USCF IDs from 90000001 to 90000010 and update them with sample Grade and Section data, ensuring they are unassigned to any school or district. It is not part of the normal registration or invoicing flow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runRepairScript} disabled={isProcessing || !isDbLoaded}>
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {isProcessing ? 'Updating Test Players...' : 'Update Test Players'}
            </Button>
            {!isDbLoaded && <p className="text-sm text-muted-foreground mt-2">Waiting for player database to load...</p>}
          </CardContent>
        </Card>

        {(isProcessing || log.length > 1) && (
          <Card>
            <CardHeader>
              <CardTitle>Log & Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 border rounded-lg">
                  <FileWarning className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.scanned}</p>
                  <p className="text-sm text-muted-foreground">Players Found</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold text-green-600">{stats.updated}</p>
                  <p className="text-sm text-muted-foreground">Players Updated</p>
                </div>
                 <div className="p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                  <p className="text-sm text-muted-foreground">Players Not Found</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">Detailed Log:</h4>
                <pre className="bg-muted p-4 rounded-md text-xs max-h-60 overflow-y-auto">
                  {log.join('\n')}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
