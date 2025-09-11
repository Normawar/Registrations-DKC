
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import * as XLSX from 'xlsx';
import { format, isSameDay, parseISO } from 'date-fns';

import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Printer, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useEvents, type Event } from '@/hooks/use-events';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

type PlayerDetail = {
  id: string;
  name: string;
  uscfId: string;
  studentType?: 'gt' | 'independent' | 'regular';
};

type TournamentRegistrationInfo = {
  schoolName: string;
  playerCount: number;
  gtCount: number;
  indCount: number;
  players: PlayerDetail[];
};

type TournamentReportData = {
  [eventId: string]: {
    event: Event;
    registrations: TournamentRegistrationInfo[];
    totalPlayers: number;
    totalGt: number;
    totalInd: number;
  };
};

function TournamentsReportPageContent() {
  const { events } = useEvents();
  const { database: allPlayers, isDbLoaded } = useMasterDb();
  const [tournamentReport, setTournamentReport] = useState<TournamentReportData>({});
  const [tournamentSearchTerm, setTournamentSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openCollapsibles, setOpenCollapsibles] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    if (!db || !isDbLoaded || events.length === 0) return;
    
    setIsLoading(true);
    try {
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      const allInvoices = invoicesSnapshot.docs.map(doc => doc.data());
      
      const report: TournamentReportData = {};
      const playerMap = new Map(allPlayers.map(p => [p.id, p]));

      for (const event of events) {
        const eventDate = parseISO(event.date);
        
        const eventInvoices = allInvoices.filter(inv => {
            if (inv.status === 'CANCELED' || inv.invoiceStatus === 'CANCELED') return false;

            if (inv.eventId === event.id) return true;
            try {
                const invDate = inv.eventDate ? parseISO(inv.eventDate) : null;
                return inv.eventName === event.name && invDate && isSameDay(invDate, eventDate);
            } catch { return false; }
        });
        
        const schoolPlayerMap: Map<string, Map<string, PlayerDetail>> = new Map();
        
        eventInvoices.forEach(invoice => {
            if (!invoice.selections) return;

            const schoolName = invoice.schoolName || 'Unknown School';
            if (!schoolPlayerMap.has(schoolName)) {
                schoolPlayerMap.set(schoolName, new Map());
            }
            const schoolPlayers = schoolPlayerMap.get(schoolName)!;

            for (const playerId in invoice.selections) {
                if (schoolPlayers.has(playerId)) continue;
        
                const player = playerMap.get(playerId);
                
                schoolPlayers.set(playerId, {
                    id: playerId,
                    name: player ? `${player.firstName} ${player.lastName}`.trim() : 'Unknown Player',
                    uscfId: player ? player.uscfId : 'N/A',
                    studentType: player ? player.studentType : 'independent'
                });
            }
        });
        
        if (schoolPlayerMap.size > 0) {
            const registrations = Array.from(schoolPlayerMap.entries()).map(([schoolName, playersMap]) => {
                const players = Array.from(playersMap.values());
                const gtCount = players.filter(p => p.studentType === 'gt').length;
                const indCount = players.filter(p => p.studentType !== 'gt').length;
                
                return {
                    schoolName,
                    playerCount: players.length,
                    gtCount,
                    indCount,
                    players: players.sort((a, b) => a.name.localeCompare(b.name)),
                };
            }).sort((a, b) => b.playerCount - a.playerCount);

            const totalPlayers = registrations.reduce((sum, reg) => sum + reg.playerCount, 0);
            const totalGt = registrations.reduce((sum, reg) => sum + reg.gtCount, 0);
            const totalInd = registrations.reduce((sum, reg) => sum + reg.indCount, 0);
          
            report[event.id] = {
                event,
                registrations,
                totalPlayers,
                totalGt,
                totalInd,
            };
        }
      }
      setTournamentReport(report);
    } finally {
      setIsLoading(false);
    }
  }, [events, allPlayers, isDbLoaded]);

  useEffect(() => {
    if (events.length > 0 && isDbLoaded) {
      loadData();
    }
  }, [loadData, events, isDbLoaded]);
  
  const filteredTournaments = useMemo(() => {
    const term = tournamentSearchTerm.toLowerCase();
    return Object.values(tournamentReport).filter(t => 
      t.event.name.toLowerCase().includes(term) ||
      t.event.location.toLowerCase().includes(term)
    ).sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime());
  }, [tournamentReport, tournamentSearchTerm]);

  const handleExportTournament = (reportData: TournamentReportData[string]) => {
    const { event, registrations, totalPlayers, totalGt, totalInd } = reportData;

    // 1. School Totals Sheet
    const schoolTotalsData = registrations.map(r => ({
      'School': r.schoolName,
      'Total Players': r.playerCount,
      'GT Players': r.gtCount,
      'Independent Players': r.indCount,
    }));
    
    // Add Grand Total row for calculation, but it won't be part of the main table data
    const grandTotalRow = {
      'School': 'Grand Total',
      'Total Players': totalPlayers,
    };
    const wsSchoolTotals = XLSX.utils.json_to_sheet(schoolTotalsData, { skipHeader: false });
    // Append the Grand Total row separately after the table data
    XLSX.utils.sheet_add_json(wsSchoolTotals, [grandTotalRow], { skipHeader: true, origin: -1 });

    // 2. GT Players Sheet
    const gtPlayersData = registrations.flatMap(r =>
        r.players.filter(p => p.studentType === 'gt').map(p => ({
            'Tournament': event.name,
            'Event Date': format(new Date(event.date), 'yyyy-MM-dd'),
            'School': r.schoolName,
            'Player Name': p.name,
            'USCF ID': p.uscfId,
        }))
    );

    // 3. Independent Players Sheet
    const indPlayersData = registrations.flatMap(r =>
        r.players.filter(p => p.studentType !== 'gt').map(p => ({
            'Tournament': event.name,
            'Event Date': format(new Date(event.date), 'yyyy-MM-dd'),
            'School': r.schoolName,
            'Player Name': p.name,
            'USCF ID': p.uscfId,
        }))
    );

    // Create worksheets
    const wsGtPlayers = XLSX.utils.json_to_sheet(gtPlayersData);
    const wsIndPlayers = XLSX.utils.json_to_sheet(indPlayersData);
    
    // --- Professional Table Formatting for School Totals sheet ---
    const wb = XLSX.utils.book_new();
    
    const range = XLSX.utils.decode_range(wsSchoolTotals['!ref']!);
    // Define the table range to NOT include the Grand Total row
    const tableRange = { s: range.s, e: { r: range.e.r - 1, c: range.e.c } };

    wsSchoolTotals['!table'] = {
        ref: XLSX.utils.encode_range(tableRange),
        name: "SchoolTotals",
        displayName: "SchoolTotals",
        styleInfo: {
            name: "TableStyleMedium9",
            showFirstColumn: false,
            showLastColumn: false,
            showRowStripes: true,
            showColumnStripes: false,
        },
        totalsRow: true, // Enable the totals row feature
        totalsRowLabel: 'Totals',
    };

    // Auto-fit columns for all sheets
    [wsSchoolTotals, wsGtPlayers, wsIndPlayers].forEach(ws => {
      if (!ws['!cols']) ws['!cols'] = [];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (data && data.length > 0) {
        const colWidths = data[0].map((_, i) => ({
          wch: Math.max(...data.map(row => row[i] ? String(row[i]).length : 0)) + 2 // Add padding
        }));
        ws['!cols'] = colWidths;
      }
    });

    XLSX.utils.book_append_sheet(wb, wsSchoolTotals, 'School Totals');
    XLSX.utils.book_append_sheet(wb, wsGtPlayers, 'GT Players');
    XLSX.utils.book_append_sheet(wb, wsIndPlayers, 'Independent Players');

    XLSX.writeFile(wb, `${event.name.replace(/\s+/g, '_')}_report.xlsx`);
  };
  
  const handlePrint = () => {
    window.print();
  };

  const toggleCollapsible = (id: string) => {
      setOpenCollapsibles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8 printable-invoice">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold font-headline">Tournament Registrations Report</h1>
          <p className="text-muted-foreground">
            An overview of registrations for each tournament.
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader className="no-print">
           <div className="flex justify-between items-center">
              <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Search tournaments by name or location..."
                      className="pl-8"
                      value={tournamentSearchTerm}
                      onChange={(e) => setTournamentSearchTerm(e.target.value)}
                  />
              </div>
              <Button onClick={handlePrint} variant="outline" className="ml-4"><Printer className="mr-2 h-4 w-4"/>Print Report</Button>
            </div>
        </CardHeader>
        <CardContent>
          {(isLoading || !isDbLoaded) && (
            <div className="flex items-center gap-2 p-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading report data...
            </div>
          )}
          <div className="space-y-6">
            {filteredTournaments.map(reportData => (
              <Card key={reportData.event.id} className="break-inside-avoid">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">{reportData.event.name}</CardTitle>
                      <CardDescription>
                        {format(new Date(reportData.event.date), 'PPP')} • {reportData.totalPlayers} Players ({reportData.totalGt} GT, {reportData.totalInd} IND)
                      </CardDescription>
                    </div>
                    <Button onClick={() => handleExportTournament(reportData)} variant="outline" size="sm" className="no-print"><Download className="mr-2 h-4 w-4"/>Export</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/2">School</TableHead>
                          <TableHead className="text-right">GT</TableHead>
                          <TableHead className="text-right">IND</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      {reportData.registrations.map(reg => (
                        <Collapsible asChild key={reg.schoolName} open={openCollapsibles[reportData.event.id + reg.schoolName]} onOpenChange={() => toggleCollapsible(reportData.event.id + reg.schoolName)}>
                          <tbody>
                            <CollapsibleTrigger asChild>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell className="font-medium flex items-center">
                                    {openCollapsibles[reportData.event.id + reg.schoolName] ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                                    {reg.schoolName}
                                </TableCell>
                                <TableCell className="text-right">{reg.gtCount}</TableCell>
                                <TableCell className="text-right">{reg.indCount}</TableCell>
                                <TableCell className="text-right font-semibold">{reg.playerCount}</TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                                <tr className="bg-muted/20">
                                    <TableCell colSpan={4} className="p-0">
                                        <div className="p-4">
                                            <h4 className="font-semibold mb-2 text-sm">Player Details</h4>
                                            <ScrollArea className="h-40 border rounded-md">
                                              <Table>
                                                  <TableHeader>
                                                      <TableRow>
                                                          <TableHead>Player Name</TableHead>
                                                          <TableHead>USCF ID</TableHead>
                                                          <TableHead>Type</TableHead>
                                                      </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                  {reg.players.map(p => (
                                                      <TableRow key={p.id}>
                                                          <TableCell>{p.name}</TableCell>
                                                          <TableCell>{p.uscfId}</TableCell>
                                                          <TableCell>
                                                              {p.studentType === 'gt' 
                                                                  ? <Badge variant="secondary">GT</Badge> 
                                                                  : <Badge variant="outline">IND</Badge>
                                                              }
                                                          </TableCell>
                                                      </TableRow>
                                                  ))}
                                                  </TableBody>
                                              </Table>
                                            </ScrollArea>
                                        </div>
                                    </TableCell>
                                </tr>
                            </CollapsibleContent>
                          </tbody>
                        </Collapsible>
                      ))}
                    </Table>
                </CardContent>
              </Card>
            ))}
             {filteredTournaments.length === 0 && !isLoading && isDbLoaded && (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No tournaments match your search criteria.</p>
                </div>
             )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

export default function TournamentsReportPage() {
    return (
        <OrganizerGuard>
            <AppLayout>
                <TournamentsReportPageContent />
            </AppLayout>
        </OrganizerGuard>
    )
}
