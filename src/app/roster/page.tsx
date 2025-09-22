
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { generateTeamCode } from '@/lib/school-utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Papa from 'papaparse';
import { format } from 'date-fns';

type SortableColumnKey = 'lastName' | 'teamCode' | 'uscfId' | 'regularRating' | 'grade' | 'section';

function DistrictRostersPageContent() {
  const { isDbLoaded, dbDistricts, database: allPlayers, getSchoolsForDistrict } = useMasterDb();
  
  const [rosterType, setRosterType] = useState<'real' | 'test'>('real');
  const [selectedDistrict, setSelectedDistrict] = useState('PHARR-SAN JUAN-ALAMO ISD');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [playerType, setPlayerType] = useState('all');
  const [showOnlyWithPlayers, setShowOnlyWithPlayers] = useState(false);
  const [openSchools, setOpenSchools] = useState<Record<string, boolean>>({});
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' }>({ key: 'lastName', direction: 'ascending' });

  const schoolsForDistrict = useMemo(() => {
    return getSchoolsForDistrict(selectedDistrict);
  }, [selectedDistrict, getSchoolsForDistrict]);

  const schoolRosters = useMemo(() => {
    if (!isDbLoaded) return [];

    let districtPlayers = allPlayers.filter(p => p.district === selectedDistrict);

    if (playerType !== 'all') {
      districtPlayers = districtPlayers.filter(p => p.studentType === playerType);
    }

    const isTestDistrict = selectedDistrict.toLowerCase().startsWith('test');
    if (rosterType === 'test' && !isTestDistrict) return [];
    if (rosterType === 'real' && isTestDistrict) return [];

    const groupedBySchool = districtPlayers.reduce((acc, player) => {
      const schoolName = player.school || 'Unassigned';
      if (!acc[schoolName]) {
        acc[schoolName] = [];
      }
      acc[schoolName].push(player);
      return acc;
    }, {} as Record<string, MasterPlayer[]>);

    let schoolNames = Object.keys(groupedBySchool);
    if(selectedSchool !== 'all') {
        schoolNames = schoolNames.filter(s => s === selectedSchool);
    }
    
    if (showOnlyWithPlayers) {
        schoolNames = schoolNames.filter(name => groupedBySchool[name]?.length > 0);
    }

    return schoolNames.sort().map(schoolName => ({
      schoolName,
      players: groupedBySchool[schoolName] || [],
    }));
  }, [allPlayers, isDbLoaded, selectedDistrict, selectedSchool, playerType, showOnlyWithPlayers, rosterType]);

  const districtPlayerCounts = useMemo(() => {
    const playersInDistrict = allPlayers.filter(p => p.district === selectedDistrict);
    const gt = playersInDistrict.filter(p => p.studentType === 'gt').length;
    const independent = playersInDistrict.filter(p => p.studentType !== 'gt').length;
    return { all: playersInDistrict.length, gt, independent };
  }, [allPlayers, selectedDistrict]);
  
  const sortPlayers = (players: MasterPlayer[]) => {
    return [...players].sort((a, b) => {
        const key = sortConfig.key;
        let aVal: any = a[key as keyof MasterPlayer] ?? '';
        let bVal: any = b[key as keyof MasterPlayer] ?? '';
        
        if (key === 'lastName') {
            aVal = `${a.lastName || ''}, ${a.firstName || ''}`;
            bVal = `${b.lastName || ''}, ${b.firstName || ''}`;
        }
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortConfig.direction === 'ascending' ? result : -result;
    });
  };

  const requestSort = (key: SortableColumnKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };
  
  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };
  
  const exportRoster = (playerTypeToExport: 'gt' | 'independent') => {
    const playersToExport = allPlayers.filter(p => p.district === selectedDistrict && p.studentType === playerTypeToExport);
    const csv = Papa.unparse(playersToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${selectedDistrict}_${playerTypeToExport}_roster_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline">District Rosters</h1>
          <p className="text-muted-foreground">An overview of all player rosters for each school in all districts</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>Roster Type</Label>
                <RadioGroup value={rosterType} onValueChange={(v) => setRosterType(v as 'real' | 'test')} className="flex items-center space-x-2 pt-2">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="real" id="real" /><Label htmlFor="real">Real</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="test" id="test" /><Label htmlFor="test">Test</Label></div>
                </RadioGroup>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label>Filter by District</Label>
                <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label>Filter by School</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schools</SelectItem>
                    {schoolsForDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedDistrict === 'PHARR-SAN JUAN-ALAMO ISD' && (
                <div>
                  <Label>Filter by Player Type</Label>
                  <RadioGroup value={playerType} onValueChange={setPlayerType} className="flex items-center space-x-2 pt-2">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="all-players" /><Label htmlFor="all-players">All ({districtPlayerCounts.all})</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="gt" id="gt-players" /><Label htmlFor="gt-players">GT ({districtPlayerCounts.gt})</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="independent" id="independent-players" /><Label htmlFor="independent-players">Independent ({districtPlayerCounts.independent})</Label></div>
                  </RadioGroup>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
                 {selectedDistrict === 'PHARR-SAN JUAN-ALAMO ISD' && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportRoster('gt')}><Download className="h-4 w-4 mr-2" />Export GT Roster</Button>
                        <Button variant="outline" size="sm" onClick={() => exportRoster('independent')}><Download className="h-4 w-4 mr-2" />Export Independent Roster</Button>
                    </div>
                )}
                <div className="flex items-center space-x-2">
                    <Checkbox id="show-with-players" checked={showOnlyWithPlayers} onCheckedChange={(checked) => setShowOnlyWithPlayers(!!checked)} />
                    <Label htmlFor="show-with-players" className="text-sm font-medium">Show only schools with players</Label>
                </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!isDbLoaded && <p>Loading rosters...</p>}
          {isDbLoaded && schoolRosters.length === 0 && <p className="text-muted-foreground text-center py-8">No players found for the selected criteria.</p>}
          {schoolRosters.map(({ schoolName, players }) => (
            <Collapsible key={schoolName} open={openSchools[schoolName] ?? true} onOpenChange={() => setOpenSchools(prev => ({...prev, [schoolName]: !prev[schoolName]}))}>
              <CollapsibleTrigger asChild>
                <div className="w-full bg-muted p-3 rounded-t-lg border flex justify-between items-center cursor-pointer">
                  <h3 className="font-bold text-lg">{schoolName}</h3>
                  <p className="text-sm text-muted-foreground">{players.length} player(s) found</p>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"><Checkbox /></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('lastName')} className="px-0">Player Name {getSortIcon('lastName')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('teamCode')} className="px-0">Team Code {getSortIcon('teamCode')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('uscfId')} className="px-0">USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('regularRating')} className="px-0">Rating {getSortIcon('regularRating')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('grade')} className="px-0">Grade {getSortIcon('grade')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('section')} className="px-0">Section {getSortIcon('section')}</Button></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortPlayers(players).map(p => (
                        <TableRow key={p.id}>
                          <TableCell><Checkbox /></TableCell>
                          <TableCell>{p.lastName}, {p.firstName} {p.middleName || ''}</TableCell>
                          <TableCell>{generateTeamCode(p)}</TableCell>
                          <TableCell>{p.uscfId}</TableCell>
                          <TableCell>{p.regularRating || 'N/A'}</TableCell>
                          <TableCell>{p.grade}</TableCell>
                          <TableCell>{p.section}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

export default function GuardedDistrictRostersPage() {
    return (
        <OrganizerGuard>
            <DistrictRostersPageContent />
        </OrganizerGuard>
    )
}
