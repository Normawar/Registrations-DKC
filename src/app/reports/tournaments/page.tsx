
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import Papa from 'papaparse';
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
  studentType?: 'gt' | 'independent';
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
            if (inv.eventId === event.id) return true;
            try {
                const invDate = inv.eventDate ? parseISO(inv.eventDate) : null;
                return inv.eventName === event.name && invDate && isSameDay(invDate, eventDate);
            } catch { return false; }
        });

        const schoolPlayerMap: Map<string, Map<string, PlayerDetail>> = new Map();

        // Process active invoices first to ensure they take precedence
        eventInvoices
            .filter(inv => inv.invoiceStatus !== 'CANCELED' && inv.status !== 'CANCELED')
            .forEach(invoice => {
                if (!invoice.selections) return;
                const schoolName = invoice.schoolName || 'Unknown School';

                if (!schoolPlayerMap.has(schoolName)) {
                    schoolPlayerMap.set(schoolName, new Map());
                }
                const schoolPlayers = schoolPlayerMap.get(schoolName)!;

                for (const playerId in invoice.selections) {
                    if (schoolPlayers.has(playerId)) continue;

                    const player = playerMap.get(playerId);
                    if (player) {
                        schoolPlayers.set(playerId, {
                            id: player.id,
                            name: `${player.firstName} ${player.lastName}`,
                            uscfId: player.uscfId,
                            studentType: player.studentType
                        });
                    }
                }
            });
        
        if (schoolPlayerMap.size > 0) {
            const registrations = Array.from(schoolPlayerMap.entries()).map(([schoolName, playersMap]) => {
                const players = Array.from(playersMap.values());
                const gtCount = players.filter(p => p.studentType === 'gt').length;
                const indCount = players.length - gtCount;
                
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

  const handleExportTournament = (reportData: any) => {
    const dataToExport = reportData.registrations.flatMap((r: any) => 
        r.players.map((p: PlayerDetail) => ({
            'Tournament': reportData.event.name,
            'Event Date': format(new Date(reportData.event.date), 'yyyy-MM-dd'),
            'School': r.schoolName,
            'Player Name': p.name,
            'USCF ID': p.uscfId,
            'Student Type': p.studentType === 'gt' ? 'GT' : 'Independent'
        }))
    );
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${reportData.event.name.replace(/\s+/g, '_')}_detailed_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                          <tbody key={reg.schoolName}>
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
