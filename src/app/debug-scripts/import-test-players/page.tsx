
'use client';

import { useState } from 'react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { fullMasterPlayerData } from '@/lib/data/full-master-player-data';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OrganizerGuard } from '@/components/auth-guard';
import { useToast } from '@/hooks/use-toast';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

// Filter for the specific test players we want to import
const testPlayersToImport = fullMasterPlayerData.filter(p => p.id.startsWith('900000'));

function ImportTestPlayersPage() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  const handleImport = async () => {
    if (!db) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Firestore is not initialized.',
        });
        return;
    }

    setIsImporting(true);
    setProgressMessage('Starting import...');

    try {
      const batch = writeBatch(db);
      
      testPlayersToImport.forEach(player => {
        const playerRef = doc(db, 'players', player.id);
        batch.set(playerRef, player);
      });

      await batch.commit();

      toast({
        title: 'Import Complete!',
        description: `${testPlayersToImport.length} test players have been added or updated in the database.`,
      });
      setProgressMessage(`Successfully imported ${testPlayersToImport.length} players.`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Import Failed', description: errorMessage });
      setProgressMessage(`Error: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Import Test Players</CardTitle>
            <CardDescription>
              This tool will add or update the 10 sample test players (ID 90000001-90000010) in your Firestore database. This is necessary for the search functionality to find them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Player ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>School</TableHead>
                            <TableHead>District</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {testPlayersToImport.map(p => (
                            <TableRow key={p.id}>
                                <TableCell>{p.id}</TableCell>
                                <TableCell>{p.firstName} {p.lastName}</TableCell>
                                <TableCell>{p.school}</TableCell>
                                <TableCell>{p.district}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <div className="flex flex-col gap-4">
                <Button onClick={handleImport} disabled={isImporting}>
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? `Importing...` : `Import ${testPlayersToImport.length} Test Players`}
                </Button>
                {isImporting && (
                    <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {progressMessage}
                    </div>
                )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function GuardedImportTestPlayersPage() {
    return (
        <OrganizerGuard>
            <ImportTestPlayersPage />
        </OrganizerGuard>
    )
}
