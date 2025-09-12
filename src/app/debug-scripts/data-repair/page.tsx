
'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDocs, writeBatch, collection, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, XCircle, Info, RefreshCw, FilePenLine, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import Papa from 'papaparse';


interface LogEntry {
  type: 'success' | 'error' | 'info';
  message: string;
}

// --- Player Name & Data Repair Utility ---
function PlayerDataRepairer() {
    const { toast } = useToast();
    const { database: allPlayers, refreshDatabase } = useMasterDb();
    const [isRepairing, setIsRepairing] = useState(false);
    const [repairLogs, setRepairLogs] = useState<LogEntry[]>([]);
    const [file, setFile] = useState<File | null>(null);
    
    const addLog = (type: LogEntry['type'], message: string) => {
        setRepairLogs(prev => [...prev, { type, message }]);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setFile(event.target.files[0]);
        }
    };

    const handleRunMigration = async () => {
        if (!file) {
            toast({ title: 'No file selected', description: 'Please upload a CSV file to start the migration.', variant: 'destructive' });
            return;
        }

        setIsRepairing(true);
        setRepairLogs([]);
        addLog('info', '🚀 Starting Square data migration process...');

        if (!db) {
            addLog('error', '❌ Firestore not initialized. Aborting.');
            setIsRepairing(false);
            return;
        }

        try {
            const fileData = await file.text();
            const { data: records } = Papa.parse(fileData, { header: true, skipEmptyLines: true });

            if (records.length === 0) {
                addLog('error', 'CSV file is empty or invalid.');
                setIsRepairing(false);
                return;
            }

            addLog('info', `📄 Parsed ${records.length} records from the CSV file.`);
            
            const playersQuery = query(collection(db, 'players'), where('email', '==', ''));
            const querySnapshot = await getDocs(playersQuery);
            const playersToFix = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as MasterPlayer}));

            addLog('info', `🔍 Found ${playersToFix.length} players with no email to potentially update.`);

            const batch = writeBatch(db);
            let updatedCount = 0;
            let noMatchCount = 0;

            for (const record of records) {
                const csvRecord = record as any;
                const firstName = csvRecord['First Name']?.trim().toLowerCase();
                const lastName = csvRecord['Last Name']?.trim().toLowerCase();
                const email = csvRecord['Email']?.trim().toLowerCase();

                if (!firstName || !lastName || !email) {
                    addLog('error', `Skipping invalid row in CSV: ${JSON.stringify(record)}`);
                    continue;
                }

                const matchedPlayer = playersToFix.find(p => 
                    p.firstName?.toLowerCase() === firstName && p.lastName?.toLowerCase() === lastName
                );

                if (matchedPlayer) {
                    const playerRef = doc(db, 'players', matchedPlayer.id);
                    batch.update(playerRef, { email: email });
                    updatedCount++;
                    addLog('success', `✅ Matched ${firstName} ${lastName}. Updating email to ${email}.`);
                } else {
                    noMatchCount++;
                }
            }

            if (updatedCount > 0) {
                await batch.commit();
                addLog('info', `🎉 --- MIGRATION COMPLETE: ${updatedCount} player records updated. ---`);
                toast({ title: 'Migration Complete', description: `${updatedCount} player emails have been corrected in the database.` });
                await refreshDatabase();
            } else {
                addLog('info', '🤷 No matching players found to update.');
                toast({ title: 'Migration Finished', description: 'No players could be matched and updated.' });
            }

            if (noMatchCount > 0) {
                addLog('info', `${noMatchCount} records from the CSV did not find a matching player in the database.`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLog('error', `❌ FATAL ERROR during migration: ${errorMessage}`);
            toast({ variant: 'destructive', title: 'Migration Failed', description: errorMessage });
        } finally {
            setIsRepairing(false);
            setFile(null);
            // Reset file input
            const fileInput = document.getElementById('square-migration-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Square Migration Tool</CardTitle>
                <CardDescription>
                    Upload a CSV with corrected data to fix player records in the database. This tool is designed to update player emails based on their name.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <Input
                        id="square-migration-file-input"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        disabled={isRepairing}
                    />
                    <Button onClick={handleRunMigration} disabled={isRepairing || !file}>
                        {isRepairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRepairing ? 'Running Migration...' : 'Run Square Migration Tool'}
                    </Button>
                </div>
            </CardContent>
            {repairLogs.length > 0 && (
                <CardFooter>
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Repair Log</h4>
                        <div className="bg-black text-white p-3 rounded text-xs font-mono max-h-60 overflow-y-auto">
                            {repairLogs.map((log, index) => (
                                <div key={index} className={`flex items-start gap-2 ${
                                    log.type === 'error' ? 'text-red-400' : 
                                    log.type === 'success' ? 'text-green-400' : 'text-gray-300'
                                }`}>
                                    <span>{log.type === 'error' ? '❌' : log.type === 'success' ? '✅' : 'ℹ️'}</span>
                                    <span>{log.message}</span>
                                </div>
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
        
        <PlayerDataRepairer />
        
      </div>
    </AppLayout>
  );
}
