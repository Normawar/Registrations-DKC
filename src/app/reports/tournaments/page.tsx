
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import Papa from 'papaparse';
import { format } from 'date-fns';

import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Printer, Loader2 } from 'lucide-react';
import { useEvents, type Event } from '@/hooks/use-events';
import { ScrollArea } from '@/components/ui/scroll-area';

type TournamentRegistrationInfo = {
  schoolName: string;
  playerCount: number;
};

type TournamentReportData = {
  [eventId: string]: {
    event: Event;
    registrations: TournamentRegistrationInfo[];
    totalPlayers: number;
  };
};

function TournamentsReportPageContent() {
  const { events } = useEvents();
  const [tournamentReport, setTournamentReport] = useState<TournamentReportData>({});
  const [tournamentSearchTerm, setTournamentSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);

  const loadData = useCallback(async () => {
    if (Date.now() - lastLoadTime < 5 * 60 * 1000) return; // Cache for 5 minutes

    if (!db) return;
    setIsLoading(true);
    try {
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      const allInvoices = invoicesSnapshot.docs.map(doc => doc.data());
      
      const report: TournamentReportData = {};

      events.forEach(event => {
        const eventInvoices = allInvoices.filter(inv => inv.eventId === event.id);
        const schoolRegistrations: { [key: string]: number } = {};

        eventInvoices.forEach(invoice => {
          const school = invoice.schoolName || 'Unknown School';
          const playerCount = Object.keys(invoice.selections || {}).length;
          if (playerCount > 0) {
            schoolRegistrations[school] = (schoolRegistrations[school] || 0) + playerCount;
          }
        });
        
        const registrations = Object.entries(schoolRegistrations).map(([schoolName, playerCount]) => ({
          schoolName,
          playerCount,
        })).sort((a,b) => b.playerCount - a.playerCount);

        if (registrations.length > 0) {
          report[event.id] = {
            event,
            registrations,
            totalPlayers: registrations.reduce((sum, reg) => sum + reg.playerCount, 0),
          };
        }
      });
      setTournamentReport(report);
      setLastLoadTime(Date.now());
    } finally {
      setIsLoading(false);
    }
  }, [events, lastLoadTime]);

  useEffect(() => {
    if (events.length > 0) {
      loadData();
    }
  }, [loadData, events]);
  
  const filteredTournaments = useMemo(() => {
    const term = tournamentSearchTerm.toLowerCase();
    return Object.values(tournamentReport).filter(t => 
      t.event.name.toLowerCase().includes(term) ||
      t.event.location.toLowerCase().includes(term)
    ).sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime());
  }, [tournamentReport, tournamentSearchTerm]);

  const handleExportTournament = (reportData: any) => {
    const dataToExport = reportData.registrations.map((r: any) => ({
      'Tournament': reportData.event.name,
      'Event Date': format(new Date(reportData.event.date), 'yyyy-MM-dd'),
      'School': r.schoolName,
      'Registered Players': r.playerCount,
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${reportData.event.name.replace(/\s+/g, '_')}_report.csv`);
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
          {isLoading && (
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
                      <CardDescription>{format(new Date(reportData.event.date), 'PPP')} • {reportData.totalPlayers} Players</CardDescription>
                    </div>
                    <Button onClick={() => handleExportTournament(reportData)} variant="outline" size="sm" className="no-print"><Download className="mr-2 h-4 w-4"/>Export</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>School</TableHead>
                          <TableHead className="text-right"># Registered Players</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.registrations.map(reg => (
                          <TableRow key={reg.schoolName}>
                            <TableCell>{reg.schoolName}</TableCell>
                            <TableCell className="text-right">{reg.playerCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
             {filteredTournaments.length === 0 && !isLoading && (
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
