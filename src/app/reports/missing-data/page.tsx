
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Printer, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Papa from 'papaparse';
import { format } from 'date-fns';

function MissingDataReportPageContent() {
  const { database: allPlayers, dbDistricts, dbSchools, isDbLoaded } = useMasterDb();
  const [districtFilter, setDistrictFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const schoolsForDistrict = useMemo(() => {
    if (districtFilter === 'all') return dbSchools;
    return allPlayers
      .filter(p => p.district === districtFilter)
      .map(p => p.school)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
  }, [districtFilter, allPlayers, dbSchools]);

  const playersWithMissingData = useMemo(() => {
    return allPlayers.filter(player => {
      const hasMissingGrade = !player.grade;
      const hasMissingSection = !player.section;
      return hasMissingGrade || hasMissingSection;
    });
  }, [allPlayers]);

  const filteredPlayers = useMemo(() => {
    return playersWithMissingData.filter(player => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const nameMatch = `${player.firstName} ${player.lastName}`.toLowerCase().includes(lowerSearchTerm);
      const schoolMatch = player.school?.toLowerCase().includes(lowerSearchTerm);
      const districtMatch = player.district?.toLowerCase().includes(lowerSearchTerm);
      
      return (districtFilter === 'all' || player.district === districtFilter) &&
             (schoolFilter === 'all' || player.school === schoolFilter) &&
             (searchTerm === '' || nameMatch || schoolMatch || districtMatch);
    });
  }, [playersWithMissingData, districtFilter, schoolFilter, searchTerm]);

  const handleExport = () => {
    const dataToExport = filteredPlayers.map(p => ({
      'First Name': p.firstName,
      'Last Name': p.lastName,
      'USCF ID': p.uscfId,
      'School': p.school,
      'District': p.district,
      'Missing Grade': !p.grade ? 'YES' : 'No',
      'Missing Section': !p.section ? 'YES' : 'No',
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `missing_data_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
          <h1 className="text-3xl font-bold font-headline">Missing Player Data Report</h1>
          <p className="text-muted-foreground">
            Players with missing Grade or Section information.
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <Input
              placeholder="Search by name, school, district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              prefix={<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />}
            />
            <Select value={districtFilter} onValueChange={setDistrictFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by district" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Districts</SelectItem>
                {dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={schoolFilter} onValueChange={setSchoolFilter} disabled={districtFilter === 'all'}>
              <SelectTrigger><SelectValue placeholder="Filter by school" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schoolsForDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                  <TableHead>District</TableHead>
                  <TableHead>Missing Information</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isDbLoaded ? (
                  <TableRow><TableCell colSpan={4} className="text-center">Loading player data...</TableCell></TableRow>
                ) : filteredPlayers.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center">No players found with missing data matching your criteria.</TableCell></TableRow>
                ) : (
                  filteredPlayers.map(player => (
                    <TableRow key={player.id}>
                      <TableCell>{player.firstName} {player.lastName}</TableCell>
                      <TableCell>{player.school}</TableCell>
                      <TableCell>{player.district}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {!player.grade && <div className="flex items-center text-red-600"><AlertTriangle className="h-4 w-4 mr-2" /> Missing Grade</div>}
                          {!player.section && <div className="flex items-center text-red-600"><AlertTriangle className="h-4 w-4 mr-2" /> Missing Section</div>}
                        </div>
                      </TableCell>
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

export default function MissingDataReport() {
  return (
    <OrganizerGuard>
      <AppLayout>
        <MissingDataReportPageContent />
      </AppLayout>
    </OrganizerGuard>
  );
}
