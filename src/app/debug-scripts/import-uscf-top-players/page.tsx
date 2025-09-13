
'use client';

import { useState } from 'react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { AppLayout } from '@/components/app-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const allTopPlayersData: Omit<MasterPlayer, 'id'>[] = [
  { uscfId: '13999045', firstName: 'AWONDER', lastName: 'LIANG', state: 'WI', regularRating: 2762, uscfExpiration: '2099-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '17084025', firstName: 'GRIGORIY', lastName: 'OPARIN', state: 'MO', regularRating: 2727, uscfExpiration: '2099-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '16863605', firstName: 'ARAM', lastName: 'HAKOBYAN', state: 'ARM', regularRating: 2710, uscfExpiration: '2023-11-30T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '16429168', firstName: 'BENJAMIN', lastName: 'GLEDURA', state: 'MO', regularRating: 2702, uscfExpiration: '2023-01-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '16770955', firstName: 'NIKOLAS', lastName: 'THEODOROU', state: 'MO', regularRating: 2694, uscfExpiration: '2023-11-30T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '17346301', firstName: 'SEMEN', lastName: 'KHANIN', state: 'TX', regularRating: 2682, uscfExpiration: '2026-07-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30034391', firstName: 'MIKHAIL', lastName: 'ANTIPOV', state: 'MO', regularRating: 2666, uscfExpiration: '2099-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '14941904', firstName: 'ANDREW', lastName: 'HONG', state: 'CA', regularRating: 2662, uscfExpiration: '2099-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30957643', firstName: 'GLEB', lastName: 'DUDIN', state: 'HUN', regularRating: 2646, uscfExpiration: '2025-10-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '17003082', firstName: 'ALEKSEY', lastName: 'SOROKIN', state: 'TX', regularRating: 2644, uscfExpiration: '2022-07-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '13768313', firstName: 'RUIFENG', lastName: 'LI', state: 'TX', regularRating: 2641, uscfExpiration: '2099-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '16730901', firstName: 'BENJAMIN', lastName: 'BOK', state: 'MO', regularRating: 2630, uscfExpiration: '2023-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '17073486', firstName: 'YASSER', lastName: 'QUESADA PEREZ', state: 'MO', regularRating: 2626, uscfExpiration: '2023-11-30T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '14230627', firstName: 'BRYCE', lastName: 'TIGLON', state: 'WA', regularRating: 2624, uscfExpiration: '2099-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30277832', firstName: 'VIKTOR', lastName: 'GAZIK', state: 'TX', regularRating: 2617, uscfExpiration: '2025-11-30T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '14930904', firstName: 'JUSTIN', lastName: 'WANG', state: 'TX', regularRating: 2615, uscfExpiration: '2026-07-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '14380771', firstName: 'DAVID', lastName: 'BRODSKY', state: 'NY', regularRating: 2613, uscfExpiration: '2099-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30695417', firstName: 'GERGELY', lastName: 'KANTOR', state: 'HUN', regularRating: 2610, uscfExpiration: '2023-11-30T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '16863611', firstName: 'ROBBY', lastName: 'KEVLISHVILI', state: 'NED', regularRating: 2606, uscfExpiration: '2025-06-30T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30176249', firstName: 'VIKTOR', lastName: 'MATVIISHEN', state: 'TX', regularRating: 2602, uscfExpiration: '2023-12-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30682963', firstName: 'KOUSTAV', lastName: 'CHATTERJEE', state: '', regularRating: 2554, uscfExpiration: '2026-08-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '16110091', firstName: 'RAHUL', lastName: 'SRIVATSHAV P', state: '', regularRating: 2537, uscfExpiration: '2026-08-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '14867716', firstName: 'SHAWN', lastName: 'RODRIGUE-LEMIEUX', state: '', regularRating: 2529, uscfExpiration: '2023-02-28T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30265182', firstName: 'IVAN', lastName: 'SCHITCO', state: '', regularRating: 2516, uscfExpiration: '2025-08-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30690953', firstName: 'KAROLIS', lastName: 'JUKSTA', state: '', regularRating: 2471, uscfExpiration: '2026-08-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
  { uscfId: '30690965', firstName: 'GERGANA', lastName: 'PEYCHEVA', state: '', regularRating: 2324, uscfExpiration: '2026-08-31T00:00:00.000Z', grade: '', section: '', email: '', school: '', district: '', events: 1, eventIds: [] },
];

const playersToImport = allTopPlayersData.filter(p => !p.state || p.state.length > 2);

export default function ImportMissingStatePlayersPage() {
  const { addBulkPlayers, toast } = useMasterDb();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  const handleImport = async () => {
    setIsImporting(true);
    setProgress({ current: 0, total: playersToImport.length, message: 'Starting import...' });

    try {
        const playersToUpload = playersToImport.map(p => ({
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
            description: `${playersToImport.length} players have been added or updated in the master database.`,
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
            <CardTitle>Import Players with Missing/Foreign State</CardTitle>
            <CardDescription>
              This tool will add or update players from the provided list who do not have a standard US state abbreviation.
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
                        {playersToImport.map(p => (
                            <TableRow key={p.uscfId}>
                                <TableCell>{p.firstName} {p.lastName}</TableCell>
                                <TableCell>{p.uscfId}</TableCell>
                                <TableCell>{p.regularRating}</TableCell>
                                <TableCell className="font-mono text-red-500">{p.state || 'EMPTY'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <Button onClick={handleImport} disabled={isImporting}>
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? `Importing... (${progress.current}/${progress.total})` : `Import ${playersToImport.length} Players`}
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

    