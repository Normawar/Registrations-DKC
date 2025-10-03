
'use client';

import { useState } from 'react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { allTopPlayersData } from '@/lib/data/uscf-top-players';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ImportUscfTopPlayersPage() {
  const { addBulkPlayers, toast } = useMasterDb();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  const handleImport = async () => {
    setIsImporting(true);
    setProgress({ current: 0, total: allTopPlayersData.length, message: 'Starting import...' });

    try {
        const playersToUpload = allTopPlayersData.map(p => ({
            ...p,
            id: p.uscfId,
        }));
        
        await addBulkPlayers(playersToUpload as MasterPlayer[], (update) => {
            setProgress({
                current: update.current,
                total: update.total,
                message: update.message,
            });
        });

        toast({
            title: 'Import Complete!',
            description: `${allTopPlayersData.length} players have been added or updated in the master database.`,
        });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Import Failed', description: errorMessage });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Import USCF Top Players</CardTitle>
            <CardDescription>
              This tool will import over 3,000 top players from the USCF list into your master database. This is a one-time operation to populate your system with high-rated players.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>USCF ID</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>State</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allTopPlayersData.slice(0, 50).map(p => (
                            <TableRow key={p.uscfId}>
                                <TableCell>{p.firstName} {p.lastName}</TableCell>
                                <TableCell>{p.uscfId}</TableCell>
                                <TableCell>{p.regularRating}</TableCell>
                                <TableCell>{p.state}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <Button onClick={handleImport} disabled={isImporting}>
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? `Importing... (${progress.current}/${progress.total})` : `Import ${allTopPlayersData.length} Players`}
            </Button>
          </CardFooter>
        </Card>
        {isImporting && (
            <Card>
                <CardContent className="pt-6">
                    <p>{progress.message}</p>
                </CardContent>
            </Card>
        )}
      </div>
    </AppLayout>
  );
}
