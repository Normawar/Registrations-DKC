
'use client';

import { useState } from 'react';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wrench, CheckCircle, FileWarning } from 'lucide-react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';

export default function DataRepairPage() {
  const { toast } = useToast();
  const { database: allPlayers, refreshDatabase, isDbLoaded } = useMasterDb();
  const [isProcessing, setIsProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({ scanned: 0, updated: 0, noAction: 0 });
  const [isLibertyProcessing, setIsLibertyProcessing] = useState(false);
  const [libertyLog, setLibertyLog] = useState<string[]>([]);
  const [libertyStats, setLibertyStats] = useState({ invoicesScanned: 0, playersUpdated: 0, playersSkipped: 0 });

  const runRepairScript = async () => {
    if (!db || !isDbLoaded) {
      toast({ variant: 'destructive', title: 'Database not ready', description: 'Please wait for the player database to finish loading.' });
      return;
    }

    setIsProcessing(true);
    setLog(['Starting data repair process...']);
    setStats({ scanned: 0, updated: 0, noAction: 0 });
    let localUpdatedCount = 0;

    try {
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      const batch = writeBatch(db);
      const playerUpdates = new Map<string, Partial<MasterPlayer>>();

      setLog(prev => [...prev, `Found ${invoicesSnapshot.size} invoices to scan.`]);

      for (const invoiceDoc of invoicesSnapshot.docs) {
        const invoice = invoiceDoc.data();
        if (!invoice.selections) continue;

        for (const playerId in invoice.selections) {
          const player = allPlayers.find(p => p.id === playerId);
          if (!player) continue;

          const selectionDetails = invoice.selections[playerId];
          let needsUpdate = false;
          let playerUpdate: Partial<MasterPlayer> = playerUpdates.get(playerId) || {};

          // Check and update grade if missing
          if (!player.grade && selectionDetails.grade) {
            playerUpdate.grade = selectionDetails.grade;
            needsUpdate = true;
          }

          // Check and update section if missing
          if (!player.section && selectionDetails.section) {
            playerUpdate.section = selectionDetails.section;
            needsUpdate = true;
          }

          if (needsUpdate) {
            playerUpdates.set(playerId, playerUpdate);
          }
        }
      }

      if (playerUpdates.size > 0) {
        setLog(prev => [...prev, `Found ${playerUpdates.size} players with missing data to update.`]);
        playerUpdates.forEach((update, playerId) => {
          const playerRef = doc(db, 'players', playerId);
          batch.update(playerRef, update);
          localUpdatedCount++;
          const player = allPlayers.find(p => p.id === playerId);
          setLog(prev => [
            ...prev,
            `  - Updating ${player?.firstName} ${player?.lastName}: ${Object.keys(update).join(', ')}`
          ]);
        });

        await batch.commit();
        toast({
          title: "Data Repair Complete!",
          description: `Successfully updated ${localUpdatedCount} player records.`,
        });
        refreshDatabase(); // Refresh the local context data
      } else {
        toast({
          title: "No Updates Needed",
          description: "All player records with associated invoices appear to have complete data.",
        });
      }

      setStats({
        scanned: invoicesSnapshot.size,
        updated: localUpdatedCount,
        noAction: allPlayers.length - localUpdatedCount,
      });

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

  const runLibertyFixScript = async () => {
    if (!db || !isDbLoaded) {
      toast({ variant: 'destructive', title: 'Database not ready', description: 'Please wait for the player database to finish loading.' });
      return;
    }

    setIsLibertyProcessing(true);
    setLibertyLog(['Starting Liberty MS tournament data fix...']);
    setLibertyStats({ invoicesScanned: 0, playersUpdated: 0, playersSkipped: 0 });

    try {
        const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
        const batch = writeBatch(db);
        const playerMap = new Map(allPlayers.map(p => [p.id, p]));
        let invoicesScanned = 0;
        let playersUpdated = 0;
        let playersSkipped = 0;

        for (const invoiceDoc of invoicesSnapshot.docs) {
            const invoice = invoiceDoc.data();
            
            if (invoice.eventName && invoice.eventName.toLowerCase().includes('liberty ms')) {
                invoicesScanned++;
                if (!invoice.selections) continue;

                let invoiceNeedsUpdate = false;
                const newSelections = { ...invoice.selections };

                for (const playerId in newSelections) {
                    const masterPlayer = playerMap.get(playerId);
                    
                    if (masterPlayer && (masterPlayer.grade || masterPlayer.section)) {
                        const registrationPlayer = newSelections[playerId];
                        const changes: string[] = [];

                        // Always overwrite grade if master has one
                        if (masterPlayer.grade && registrationPlayer.grade !== masterPlayer.grade) {
                            changes.push(`Grade: '${registrationPlayer.grade || 'none'}' -> '${masterPlayer.grade}'`);
                            registrationPlayer.grade = masterPlayer.grade;
                        }
                        
                        // Always overwrite section if master has one
                        if (masterPlayer.section && registrationPlayer.section !== masterPlayer.section) {
                             changes.push(`Section: '${registrationPlayer.section || 'none'}' -> '${masterPlayer.section}'`);
                            registrationPlayer.section = masterPlayer.section;
                        }

                        if(changes.length > 0) {
                            invoiceNeedsUpdate = true;
                            playersUpdated++;
                            setLibertyLog(prev => [...prev, `  - Updating ${masterPlayer.firstName} ${masterPlayer.lastName} on invoice #${invoice.invoiceNumber}: ${changes.join(', ')}`]);
                        } else {
                            playersSkipped++;
                        }
                    } else {
                        playersSkipped++;
                    }
                }

                if (invoiceNeedsUpdate) {
                    batch.update(invoiceDoc.ref, { selections: newSelections });
                }
            }
        }
        
        if (playersUpdated > 0) {
            await batch.commit();
            toast({ title: "Liberty MS Data Fixed!", description: `Updated ${playersUpdated} player records across relevant invoices.` });
        } else {
            toast({ title: "No Updates Needed", description: "All player data for the Liberty MS tournament appears to be up-to-date." });
        }

        setLibertyStats({ invoicesScanned, playersUpdated, playersSkipped });
        setLibertyLog(prev => [...prev, '...Liberty MS fix script finished.']);

    } catch (error) {
      console.error('Liberty MS fix failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Fix Script Failed', description: errorMessage });
      setLibertyLog(prev => [...prev, `ERROR: ${errorMessage}`]);
    } finally {
      setIsLibertyProcessing(false);
    }
  };


  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold font-headline">Player Data Repair Tool</h1>
          <p className="text-muted-foreground mt-2">
            Automatically fix missing player information or sync registration data with the master database.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fix Liberty MS Tournament Data</CardTitle>
            <CardDescription>
              This tool will find all registrations for the "Liberty MS" tournament and update each player's Grade and Section to match the data in the master player database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runLibertyFixScript} disabled={isLibertyProcessing || !isDbLoaded}>
              {isLibertyProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {isLibertyProcessing ? 'Fixing Liberty Data...' : 'Start Liberty MS Fix'}
            </Button>
             {!isDbLoaded && <p className="text-sm text-muted-foreground mt-2">Waiting for player database to load...</p>}
          </CardContent>
        </Card>

        {(isLibertyProcessing || libertyLog.length > 1) && (
            <Card>
                <CardHeader>
                    <CardTitle>Liberty MS Fix Log & Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 border rounded-lg"><p className="text-2xl font-bold">{libertyStats.invoicesScanned}</p><p className="text-sm text-muted-foreground">Invoices Scanned</p></div>
                        <div className="p-4 border rounded-lg"><p className="text-2xl font-bold text-green-600">{libertyStats.playersUpdated}</p><p className="text-sm text-muted-foreground">Players Updated</p></div>
                        <div className="p-4 border rounded-lg"><p className="text-2xl font-bold">{libertyStats.playersSkipped}</p><p className="text-sm text-muted-foreground">Players Unchanged</p></div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm mb-2">Detailed Log:</h4>
                        <pre className="bg-muted p-4 rounded-md text-xs max-h-60 overflow-y-auto">{libertyLog.join('\n')}</pre>
                    </div>
                </CardContent>
            </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Run General Player Data Repair</CardTitle>
            <CardDescription>
              This tool scans all invoices and updates player profiles in the master database if it finds missing information (like grade or section) that exists on a registration record. This process is safe to run multiple times.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runRepairScript} disabled={isProcessing || !isDbLoaded}>
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {isProcessing ? 'Repairing Data...' : 'Start General Player Data Repair'}
            </Button>
            {!isDbLoaded && <p className="text-sm text-muted-foreground mt-2">Waiting for player database to load...</p>}
          </CardContent>
        </Card>

        {(isProcessing || log.length > 1) && (
          <Card>
            <CardHeader>
              <CardTitle>General Repair Log & Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 border rounded-lg">
                  <FileWarning className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.scanned}</p>
                  <p className="text-sm text-muted-foreground">Invoices Scanned</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold text-green-600">{stats.updated}</p>
                  <p className="text-sm text-muted-foreground">Players Updated in DB</p>
                </div>
                 <div className="p-4 border rounded-lg">
                  <p className="text-2xl font-bold">{stats.noAction}</p>
                  <p className="text-sm text-muted-foreground">Players with No Action</p>
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
