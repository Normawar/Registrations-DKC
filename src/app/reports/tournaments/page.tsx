
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
        const eventInvoices = allInvoices.filter(inv => {
            if (inv.status === 'CANCELED' || inv.invoiceStatus === 'CANCELED') return false;
            return inv.eventId === event.id;
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

    // --- Define Styles ---
    const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "E0E0E0" } }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const totalRowStyle = { font: { bold: true }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const cellBorder = { border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    const stripe1Style = { fill: { fgColor: { rgb: "FFFFFF" } }, ...cellBorder };
    const stripe2Style = { fill: { fgColor: { rgb: "F0F8FF" } }, ...cellBorder }; // AliceBlue for light blue stripe
    const yellowHighlightStyle = { ...totalRowStyle, fill: { fgColor: { rgb: "FFFF00" } } };
    
    // --- Sheet 1: School Totals ---
    const schoolTotalsHeaders = ['School', 'Total Players', 'GT Players', 'Independent Players'];
    const schoolTotalsData = registrations.map(r => ([
      r.schoolName,
      r.playerCount,
      r.gtCount,
      r.indCount,
    ]));

    // Add Grand Total row
    const grandTotalRow = [
      'Grand Total',
      totalPlayers,
      totalGt,
      totalInd,
    ];
    schoolTotalsData.push(grandTotalRow);
    
    const wsSchoolTotals = XLSX.utils.aoa_to_sheet([schoolTotalsHeaders, ...schoolTotalsData]);
    
    // Auto-fit columns
    const cols = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
    wsSchoolTotals['!cols'] = cols;

    // Apply styles
    schoolTotalsHeaders.forEach((_, C) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
        wsSchoolTotals[cellRef].s = headerStyle;
    });

    schoolTotalsData.forEach((row, R) => {
        const style = (R % 2 === 0) ? stripe1Style : stripe2Style;
        const isTotalRow = R === schoolTotalsData.length - 1;
        row.forEach((_, C) => {
            const cellRef = XLSX.utils.encode_cell({ r: R + 1, c: C });
            if (isTotalRow) {
                wsSchoolTotals[cellRef].s = (C === 1) ? yellowHighlightStyle : totalRowStyle;
            } else {
                wsSchoolTotals[cellRef].s = style;
            }
        });
    });

    wsSchoolTotals['!autofilter'] = { ref: `A1:D${registrations.length + 1}` };


    // --- Sheet 2: GT Players ---
    const gtPlayersData = registrations.flatMap(r =>
        r.players.filter(p => p.studentType === 'gt').map(p => ({
            'School': r.schoolName, 'Player Name': p.name, 'USCF ID': p.uscfId,
        }))
    );
    const wsGtPlayers = XLSX.utils.json_to_sheet(gtPlayersData);
    if (!wsGtPlayers['!cols']) wsGtPlayers['!cols'] = [];
    wsGtPlayers['!cols'] = [{wch:40}, {wch:25}, {wch:15}];

    // --- Sheet 3: Independent Players ---
    const indPlayersData = registrations.flatMap(r =>
        r.players.filter(p => p.studentType !== 'gt').map(p => ({
            'School': r.schoolName, 'Player Name': p.name, 'USCF ID': p.uscfId,
        }))
    );
    const wsIndPlayers = XLSX.utils.json_to_sheet(indPlayersData);
     if (!wsIndPlayers['!cols']) wsIndPlayers['!cols'] = [];
    wsIndPlayers['!cols'] = [{wch:40}, {wch:25}, {wch:15}];
    
    // --- Create Workbook ---
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSchoolTotals, 'School Totals');
    XLSX.utils.book_append_sheet(wb, wsGtPlayers, 'GT Players');
    XLSX.utils.book_append_sheet(wb, wsIndPlayers, 'Independent Players');

    XLSX.writeFile(wb, `${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.xlsx`);
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
