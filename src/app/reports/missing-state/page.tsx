
'use client';

import { useState, useMemo } from 'react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/app/auth-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Printer, MapPin, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';

type FilterType = 'all' | 'missing' | 'non-tx';

function MissingStateReportPageContent() {
  const { database: allPlayers, dbDistricts, dbSchools, isDbLoaded } = useMasterDb();
  const [districtFilter, setDistrictFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const schoolsForDistrict = useMemo(() => {
    if (districtFilter === 'all') return dbSchools;
    return allPlayers
      .filter(p => p.district === districtFilter)
      .map(p => p.school)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
  }, [districtFilter, allPlayers, dbSchools]);

  const playersToReview = useMemo(() => {
    return allPlayers.filter(player => {
        const state = player.state?.trim().toUpperCase();
        if (filterType === 'missing') {
            return !state;
        }
        if (filterType === 'non-tx') {
            return state && state !== 'TX';
        }
        // 'all' case
        return !state || state !== 'TX';
    });
  }, [allPlayers, filterType]);

  const filteredPlayers = useMemo(() => {
    return playersToReview.filter(player => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const nameMatch = `${player.firstName} ${player.lastName}`.toLowerCase().includes(lowerSearchTerm);
      const schoolMatch = player.school?.toLowerCase().includes(lowerSearchTerm);
      const districtMatch = player.district?.toLowerCase().includes(lowerSearchTerm);
      
      return (districtFilter === 'all' || player.district === districtFilter) &&
             (schoolFilter === 'all' || player.school === schoolFilter) &&
             (searchTerm === '' || nameMatch || schoolMatch || districtMatch);
    });
  }, [playersToReview, districtFilter, schoolFilter, searchTerm]);

  const handleExport = () => {
    const dataToExport = filteredPlayers.map(p => ({
      'First Name': p.firstName,
      'Last Name': p.lastName,
      'USCF ID': p.uscfId,
      'School': p.school,
      'District': p.district,
      'Current State': p.state || 'EMPTY',
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `players_without_tx_state_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
          <h1 className="text-3xl font-bold font-headline">Player State Verification Report</h1>
          <p className="text-muted-foreground">
            Find players who may require a state correction.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4"/>Print</Button>
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4"/>Export</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="no-print">
          <CardTitle>Filters ({filteredPlayers.length} results)</CardTitle>
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
           <div className="pt-4">
              <Label>View Options</Label>
              <RadioGroup value={filterType} onValueChange={(v) => setFilterType(v as FilterType)} className="flex items-center space-x-4 pt-2">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="all" /><Label htmlFor="all">All (Missing & Non-TX)</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="missing" id="missing" /><Label htmlFor="missing">Missing State Only</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="non-tx" id="non-tx" /><Label htmlFor="non-tx">Non-TX State Only</Label></div>
              </RadioGroup>
            </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>USCF ID</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Current State</TableHead>
                  <TableHead className="no-print">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isDbLoaded ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Loading player data...</TableCell></TableRow>
                ) : filteredPlayers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center">No players found matching your criteria.</TableCell></TableRow>
                ) : (
                  filteredPlayers.map(player => (
                    <TableRow key={player.id}>
                      <TableCell>{player.firstName} {player.lastName}</TableCell>
                      <TableCell>{player.uscfId}</TableCell>
                      <TableCell>{player.school}</TableCell>
                      <TableCell>{player.district}</TableCell>
                      <TableCell>
                        {player.state ? (
                            <span className="font-mono text-red-600">{player.state}</span>
                        ) : (
                            <span className="text-red-600 italic">EMPTY</span>
                        )}
                      </TableCell>
                      <TableCell className="no-print">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/players?edit=${player.id}`}>
                                <Edit className="h-3 w-3 mr-2" /> Edit
                            </Link>
                        </Button>
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
        <MissingStateReportPageContent />
      </AppLayout>
    </OrganizerGuard>
  );
}
