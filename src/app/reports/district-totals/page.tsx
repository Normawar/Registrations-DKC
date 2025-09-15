
'use client';

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMasterDb } from '@/context/master-db-context';
import { Download, Printer } from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';

function DistrictTotalsReportContent() {
  const { isDbLoaded, dbDistricts, database: allPlayers } = useMasterDb();

  const districtData = useMemo(() => {
    if (!isDbLoaded) return [];

    return dbDistricts.map(district => {
      const playersInDistrict = allPlayers.filter(p => p.district === district);
      const schoolsInDistrict = new Set(playersInDistrict.map(p => p.school));
      const gtPlayers = playersInDistrict.filter(p => p.studentType === 'gt').length;
      const independentPlayers = playersInDistrict.filter(p => p.studentType !== 'gt').length;

      return {
        name: district,
        playerCount: playersInDistrict.length,
        schoolCount: schoolsInDistrict.size,
        gtCount: gtPlayers,
        indCount: independentPlayers,
      };
    }).sort((a, b) => b.playerCount - a.playerCount);

  }, [isDbLoaded, dbDistricts, allPlayers]);
  
  const handleExport = () => {
    const dataToExport = districtData.map(d => ({
      'District': d.name,
      'Total Players': d.playerCount,
      'Total Schools': d.schoolCount,
      'GT Players': d.gtCount,
      'Independent Players': d.indCount,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `district_totals_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
          <h1 className="text-3xl font-bold font-headline">District Totals Report</h1>
          <p className="text-muted-foreground">
            A high-level summary of player and school counts across all districts.
          </p>
        </div>
         <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4"/>Print</Button>
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4"/>Export</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>District Summary</CardTitle>
          <CardDescription>
            Showing aggregate data for all {districtData.length} districts in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>District</TableHead>
                  <TableHead className="text-right">Total Schools</TableHead>
                  <TableHead className="text-right">Total Players</TableHead>
                  <TableHead className="text-right">GT Players</TableHead>
                  <TableHead className="text-right">Independent Players</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isDbLoaded ? (
                  <TableRow><TableCell colSpan={5} className="text-center">Loading data...</TableCell></TableRow>
                ) : districtData.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center">No district data found.</TableCell></TableRow>
                ) : (
                  districtData.map(district => (
                    <TableRow key={district.name}>
                      <TableCell className="font-medium">{district.name}</TableCell>
                      <TableCell className="text-right">{district.schoolCount}</TableCell>
                      <TableCell className="text-right font-semibold">{district.playerCount}</TableCell>
                      <TableCell className="text-right">{district.gtCount}</TableCell>
                      <TableCell className="text-right">{district.indCount}</TableCell>
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

export default function DistrictTotalsReport() {
  return (
    <OrganizerGuard>
      <AppLayout>
        <DistrictTotalsReportPageContent />
      </AppLayout>
    </OrganizerGuard>
  );
}
