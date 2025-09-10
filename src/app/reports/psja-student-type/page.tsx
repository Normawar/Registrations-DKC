
'use client';

import { useState, useMemo } from 'react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Printer, BadgeCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Papa from 'papaparse';
import { format } from 'date-fns';

function PsjaStudentTypeReportPageContent() {
  const { database: allPlayers, dbSchools, isDbLoaded } = useMasterDb();
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const psjaPlayers = useMemo(() => {
    return allPlayers.filter(p => p.district === 'PHARR-SAN JUAN-ALAMO ISD');
  }, [allPlayers]);

  const schoolsForPsja = useMemo(() => {
    return psjaPlayers
      .map(p => p.school)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
  }, [psjaPlayers]);

  const playersWithoutType = useMemo(() => {
    return psjaPlayers.filter(player => !player.studentType);
  }, [psjaPlayers]);

  const filteredPlayers = useMemo(() => {
    return playersWithoutType.filter(player => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const nameMatch = `${player.firstName} ${player.lastName}`.toLowerCase().includes(lowerSearchTerm);
      const schoolMatch = player.school?.toLowerCase().includes(lowerSearchTerm);
      
      return (schoolFilter === 'all' || player.school === schoolFilter) &&
             (searchTerm === '' || nameMatch || schoolMatch);
    });
  }, [playersWithoutType, schoolFilter, searchTerm]);

  const handleExport = () => {
    const dataToExport = filteredPlayers.map(p => ({
      'First Name': p.firstName,
      'Last Name': p.lastName,
      'USCF ID': p.uscfId,
      'School': p.school,
      'Grade': p.grade,
      'Section': p.section,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `psja_missing_student_type_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
          <h1 className="text-3xl font-bold font-headline">PSJA Student Type Report</h1>
          <p className="text-muted-foreground">
            PSJA players who need their "Student Type" (GT or Independent) assigned.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4"/>Print</Button>
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4"/>Export</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="no-print">
          <CardTitle>Filters</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <Input
              placeholder="Search by name or school..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              prefix={<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />}
            />
            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by school" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PSJA Schools</SelectItem>
                {schoolsForPsja.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>USCF ID</TableHead>
                  <TableHead>Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isDbLoaded ? (
                  <TableRow><TableCell colSpan={4} className="text-center">Loading player data...</TableCell></TableRow>
                ) : filteredPlayers.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center">No PSJA players found missing a student type.</TableCell></TableRow>
                ) : (
                  filteredPlayers.map(player => (
                    <TableRow key={player.id}>
                      <TableCell>{player.firstName} {player.lastName}</TableCell>
                      <TableCell>{player.school}</TableCell>
                      <TableCell>{player.uscfId}</TableCell>
                      <TableCell>{player.grade}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PsjaStudentTypeReport() {
  return (
    <OrganizerGuard>
      <AppLayout>
        <PsjaStudentTypeReportPageContent />
      </AppLayout>
    </OrganizerGuard>
  );
}
