
'use client';

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/app/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMasterDb } from '@/context/master-db-context';
import { Download, Printer, Filter } from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function PlayerIdRangeReportContent() {
  const { database: allPlayers, isDbLoaded } = useMasterDb();
  const [startId, setStartId] = useState('');
  const [endId, setEndId] = useState('');

  const filteredPlayers = useMemo(() => {
    if (!startId || !endId) {
      return [];
    }

    const start = parseInt(startId, 10);
    const end = parseInt(endId, 10);

    if (isNaN(start) || isNaN(end) || start > end) {
      return [];
    }

    return allPlayers.filter(player => {
      const playerIdNum = parseInt(player.uscfId, 10);
      return !isNaN(playerIdNum) && playerIdNum >= start && playerIdNum <= end;
    }).sort((a, b) => parseInt(a.uscfId, 10) - parseInt(b.uscfId, 10));
  }, [allPlayers, startId, endId]);

  const handleExport = () => {
    if (filteredPlayers.length === 0) {
      return;
    }
    const dataToExport = filteredPlayers.map(p => ({
      'USCF ID': p.uscfId,
      'First Name': p.firstName,
      'Last Name': p.lastName,
      'School': p.school,
      'District': p.district,
      'Rating': p.regularRating || 'UNR',
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `player_id_range_${startId}-${endId}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 printable-invoice">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold font-headline">Player ID Range Report</h1>
          <p className="text-muted-foreground">
            Pull a list of players within a specific USCF ID number range.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline" disabled={filteredPlayers.length === 0}><Printer className="mr-2 h-4 w-4"/>Print</Button>
          <Button onClick={handleExport} disabled={filteredPlayers.length === 0}><Download className="mr-2 h-4 w-4"/>Export</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="no-print">
          <CardTitle>Filter by ID Range</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="startId">Start USCF ID</Label>
                <Input
                  id="startId"
                  placeholder="e.g., 70000001"
                  value={startId}
                  onChange={(e) => setStartId(e.target.value.replace(/\D/g, ''))}
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="endId">End USCF ID</Label>
                <Input
                  id="endId"
                  placeholder="e.g., 90001000"
                  value={endId}
                  onChange={(e) => setEndId(e.target.value.replace(/\D/g, ''))}
                />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>USCF ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isDbLoaded ? (
                  <TableRow><TableCell colSpan={5} className="text-center">Loading player data...</TableCell></TableRow>
                ) : filteredPlayers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center">Enter a valid ID range to see results.</TableCell></TableRow>
                ) : (
                  filteredPlayers.map(player => (
                    <TableRow key={player.id}>
                      <TableCell className="font-mono">{player.uscfId}</TableCell>
                      <TableCell>{player.firstName} {player.lastName}</TableCell>
                      <TableCell>{player.school}</TableCell>
                      <TableCell>{player.district}</TableCell>
                      <TableCell className="text-right">{player.regularRating || 'UNR'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Showing {filteredPlayers.length} players.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlayerIdRangeReport() {
  return (
    <OrganizerGuard>
      <AppLayout>
        <PlayerIdRangeReportContent />
      </AppLayout>
    </OrganizerGuard>
  );
}
