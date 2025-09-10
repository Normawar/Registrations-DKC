
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import Papa from 'papaparse';
import { format } from 'date-fns';

import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search } from 'lucide-react';
import { useEvents, type Event } from '@/hooks/use-events';
import { generateTeamCode } from '@/lib/school-utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type SponsorUser = {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  school?: string;
  district?: string;
  role: string;
  isDistrictCoordinator?: boolean;
};

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

function ReportsPageContent() {
  const { events } = useEvents();
  const [sponsors, setSponsors] = useState<SponsorUser[]>([]);
  const [tournamentReport, setTournamentReport] = useState<TournamentReportData>({});
  const [sponsorSearchTerm, setSponsorSearchTerm] = useState('');
  const [tournamentSearchTerm, setTournamentSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    if (!db) return;

    // Load Sponsors
    const usersQuery = query(collection(db, 'users'), where('role', 'in', ['sponsor', 'district_coordinator']));
    const usersSnapshot = await getDocs(usersQuery);
    const sponsorList = usersSnapshot.docs.map(doc => doc.data() as SponsorUser);
    setSponsors(sponsorList);

    // Load Invoices for Tournament Report
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

  }, [events]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const filteredSponsors = useMemo(() => {
    const term = sponsorSearchTerm.toLowerCase();
    return sponsors.filter(s => 
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.school?.toLowerCase().includes(term) ||
      s.district?.toLowerCase().includes(term)
    );
  }, [sponsors, sponsorSearchTerm]);
  
  const filteredTournaments = useMemo(() => {
    const term = tournamentSearchTerm.toLowerCase();
    return Object.values(tournamentReport).filter(t => 
      t.event.name.toLowerCase().includes(term) ||
      t.event.location.toLowerCase().includes(term)
    ).sort((a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime());
  }, [tournamentReport, tournamentSearchTerm]);

  const handleExportSponsors = () => {
    const dataToExport = filteredSponsors.map(s => ({
      'Team Code': generateTeamCode({ schoolName: s.school, district: s.district }),
      'First Name': s.firstName,
      'Last Name': s.lastName,
      'Email': s.email,
      'Phone': s.phone,
      'School': s.school,
      'District': s.district,
      'Role': s.isDistrictCoordinator ? 'District Coordinator' : s.role,
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `sponsors_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Reports</h1>
        <p className="text-muted-foreground">
          Generate reports on sponsors and tournament registrations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Sponsors Report</CardTitle>
              <CardDescription>A list of all sponsors, their schools, and contact information.</CardDescription>
            </div>
            <Button onClick={handleExportSponsors} variant="outline"><Download className="mr-2 h-4 w-4"/>Export</Button>
          </div>
          <div className="relative mt-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Search sponsors..."
                  className="pl-8"
                  value={sponsorSearchTerm}
                  onChange={(e) => setSponsorSearchTerm(e.target.value)}
              />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>School / District</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSponsors.map(sponsor => (
                  <TableRow key={sponsor.email}>
                    <TableCell className="font-mono">{generateTeamCode({ schoolName: sponsor.school, district: sponsor.district })}</TableCell>
                    <TableCell>{sponsor.firstName} {sponsor.lastName}</TableCell>
                    <TableCell>{sponsor.email}<br/>{sponsor.phone}</TableCell>
                    <TableCell>{sponsor.school}<br/>{sponsor.district}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Tournament Registrations Report</CardTitle>
              <CardDescription>An overview of registrations for each tournament.</CardDescription>
            </div>
          </div>
           <div className="relative mt-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Search tournaments..."
                  className="pl-8"
                  value={tournamentSearchTerm}
                  onChange={(e) => setTournamentSearchTerm(e.target.value)}
              />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {filteredTournaments.map(reportData => (
              <Card key={reportData.event.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">{reportData.event.name}</CardTitle>
                      <CardDescription>{format(new Date(reportData.event.date), 'PPP')} • {reportData.totalPlayers} Players</CardDescription>
                    </div>
                    <Button onClick={() => handleExportTournament(reportData)} variant="outline" size="sm"><Download className="mr-2 h-4 w-4"/>Export</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
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
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

export default function ReportsPage() {
    return (
        <OrganizerGuard>
            <ReportsPageContent />
        </OrganizerGuard>
    )
}
