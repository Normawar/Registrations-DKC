
'use client';

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Download, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


type SchoolStats = {
  name: string;
  playerCount: number;
  gtCount: number;
  indCount: number;
};

type DistrictStats = {
  name: string;
  playerCount: number;
  schoolCount: number;
  gtCount: number;
  indCount: number;
  schools: SchoolStats[];
};

function DistrictTotalsReportContent() {
  const { isDbLoaded, dbDistricts, database: allPlayers } = useMasterDb();
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});

  const districtData: DistrictStats[] = useMemo(() => {
    if (!isDbLoaded) return [];

    return dbDistricts
      .map(district => {
        const playersInDistrict = allPlayers.filter(p => p.district === district);
        if (playersInDistrict.length === 0) return null;

        const schoolsMap = new Map<string, MasterPlayer[]>();
        playersInDistrict.forEach(p => {
          const schoolName = p.school || 'Unassigned';
          if (!schoolsMap.has(schoolName)) {
            schoolsMap.set(schoolName, []);
          }
          schoolsMap.get(schoolName)!.push(p);
        });

        const schools: SchoolStats[] = Array.from(schoolsMap.entries()).map(([name, players]) => {
          const gtCount = players.filter(p => p.studentType === 'gt').length;
          return {
            name,
            playerCount: players.length,
            gtCount,
            indCount: players.length - gtCount,
          };
        }).sort((a,b) => b.playerCount - a.playerCount);

        const gtCount = playersInDistrict.filter(p => p.studentType === 'gt').length;

        return {
          name: district,
          playerCount: playersInDistrict.length,
          schoolCount: schools.length,
          gtCount,
          indCount: playersInDistrict.length - gtCount,
          schools,
        };
      })
      .filter((district): district is DistrictStats => district !== null)
      .sort((a, b) => b.playerCount - a.playerCount);

  }, [isDbLoaded, dbDistricts, allPlayers]);
  
  const handleExport = () => {
    const dataToExport = districtData.flatMap(d => 
      d.schools.map(s => ({
        'District': d.name,
        'School': s.name,
        'Total Players': s.playerCount,
        'GT Players': s.gtCount,
        'Independent Players': s.indCount,
      }))
    );

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `district_school_totals_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handlePrint = () => {
    window.print();
  };

  const toggleOpen = (districtName: string) => {
    setOpenStates(prev => ({ ...prev, [districtName]: !prev[districtName] }));
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
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4"/>Export Detailed CSV</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>District Summary</CardTitle>
          <CardDescription>
            Showing aggregate data for all {districtData.length} districts in the database. Click on a row to see school details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-2/5">District</TableHead>
                  <TableHead className="text-right">Total Schools</TableHead>
                  <TableHead className="text-right">Total Players</TableHead>
                  <TableHead className="text-right">GT Players</TableHead>
                  <TableHead className="text-right">Independent Players</TableHead>
                </TableRow>
              </TableHeader>
                {!isDbLoaded ? (
                  <TableBody>
                    <TableRow><TableCell colSpan={5} className="text-center">Loading data...</TableCell></TableRow>
                  </TableBody>
                ) : districtData.length === 0 ? (
                  <TableBody>
                    <TableRow><TableCell colSpan={5} className="text-center">No district data found.</TableCell></TableRow>
                  </TableBody>
                ) : (
                  districtData.map(district => (
                    <Collapsible asChild key={district.name} open={openStates[district.name]} onOpenChange={() => toggleOpen(district.name)}>
                      <TableBody>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium flex items-center">
                              {openStates[district.name] ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                              {district.name}
                            </TableCell>
                            <TableCell className="text-right">{district.schoolCount}</TableCell>
                            <TableCell className="text-right font-semibold">{district.playerCount}</TableCell>
                            <TableCell className="text-right">{district.gtCount}</TableCell>
                            <TableCell className="text-right">{district.indCount}</TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={5} className="p-0">
                              <div className="p-4 bg-muted/50">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="pl-10">School</TableHead>
                                      <TableHead className="text-right">Total Players</TableHead>
                                      <TableHead className="text-right">GT Players</TableHead>
                                      <TableHead className="text-right">Independent Players</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {district.schools.map(school => (
                                      <TableRow key={school.name}>
                                        <TableCell className="pl-10">{school.name}</TableCell>
                                        <TableCell className="text-right font-medium">{school.playerCount}</TableCell>
                                        <TableCell className="text-right">{school.gtCount}</TableCell>
                                        <TableCell className="text-right">{school.indCount}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </TableBody>
                    </Collapsible>
                  ))
                )}
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
        <DistrictTotalsReportContent />
      </AppLayout>
    </OrganizerGuard>
  );
}
