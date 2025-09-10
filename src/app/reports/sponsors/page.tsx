
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Download, Search, Printer } from 'lucide-react';
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

function SponsorsReportPageContent() {
  const [sponsors, setSponsors] = useState<SponsorUser[]>([]);
  const [sponsorSearchTerm, setSponsorSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    if (!db) return;
    const usersQuery = query(collection(db, 'users'), where('role', 'in', ['sponsor', 'district_coordinator']));
    const usersSnapshot = await getDocs(usersQuery);
    const sponsorList = usersSnapshot.docs.map(doc => doc.data() as SponsorUser);
    setSponsors(sponsorList);
  }, []);

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
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 printable-invoice">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold font-headline">Sponsors Report</h1>
          <p className="text-muted-foreground">
            A list of all sponsors, their schools, and contact information.
          </p>
        </div>
        <div className="flex gap-2">
            <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4"/>Print</Button>
            <Button onClick={handleExportSponsors}><Download className="mr-2 h-4 w-4"/>Export</Button>
        </div>
      </div>
      
      <Card>
        <CardHeader className="no-print">
          <div className="relative mt-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Search sponsors by name, email, school, or district..."
                  className="pl-8"
                  value={sponsorSearchTerm}
                  onChange={(e) => setSponsorSearchTerm(e.target.value)}
              />
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <ScrollArea className="h-[60vh]">
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
                  {filteredSponsors.map((sponsor, index) => (
                    <TableRow key={`${sponsor.email}-${index}`}>
                      <TableCell className="font-mono">{generateTeamCode({ schoolName: sponsor.school, district: sponsor.district })}</TableCell>
                      <TableCell>{sponsor.firstName} {sponsor.lastName}</TableCell>
                      <TableCell>{sponsor.email}<br/>{sponsor.phone}</TableCell>
                      <TableCell>{sponsor.school}<br/>{sponsor.district}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SponsorsReportPage() {
    return (
        <OrganizerGuard>
            <AppLayout>
                <SponsorsReportPageContent />
            </AppLayout>
        </OrganizerGuard>
    )
}
