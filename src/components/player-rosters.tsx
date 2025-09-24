'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { PlayerDetailsDialog } from '@/components/player-details-dialog';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';
import { useToast } from '@/hooks/use-toast';
import { Search, PlusCircle, Trash2, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, FilePenLine } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { generateTeamCode } from '@/lib/school-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import Papa from 'papaparse';
import { format } from 'date-fns';

type SortableColumnKey = 'lastName' | 'teamCode' | 'uscfId' | 'regularRating' | 'grade' | 'section';

export function PlayerRosters({ onEditPlayer, onAddToRoster }: { onEditPlayer: (player: MasterPlayer) => void, onAddToRoster?: (player: MasterPlayer) => void }) {
  const { isDbLoaded, dbDistricts, database: allPlayers, getSchoolsForDistrict, deletePlayer, addPlayer } = useMasterDb();
  const { profile } = useSponsorProfile();
  const { toast } = useToast();
  
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [openSchools, setOpenSchools] = useState<Record<string, boolean>>({});
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' }>({ key: 'lastName', direction: 'ascending' });

  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (profile && !selectedDistrict) {
      if (profile.role === 'organizer') {
        setSelectedDistrict('all');
      } else {
        setSelectedDistrict(profile.district || 'all');
      }
    }
  }, [profile, selectedDistrict]);

  const schoolsForFilter = useMemo(() => {
    if (profile?.role === 'individual') {
        const studentSchools = allPlayers
            .filter(p => profile.studentIds?.includes(p.id))
            .map(p => p.school)
            .filter(Boolean);
        return [...new Set(studentSchools)].sort();
    }
    if(profile?.role === 'sponsor' && profile.school){
        return [profile.school];
    }
    return getSchoolsForDistrict(selectedDistrict);
  }, [selectedDistrict, getSchoolsForDistrict, profile, allPlayers]);

  const schoolRosters = useMemo(() => {
    if (!isDbLoaded) return [];

    let playersToDisplay: MasterPlayer[] = [];

    switch (profile?.role) {
      case 'organizer':
        playersToDisplay = allPlayers;
        break;
      case 'district_coordinator':
        playersToDisplay = allPlayers.filter(p => p.district === profile.district);
        break;
      case 'sponsor':
        playersToDisplay = allPlayers.filter(p => p.school === profile.school && p.district === profile.district);
        break;
      case 'individual':
        playersToDisplay = allPlayers.filter(p => profile.studentIds?.includes(p.id));
        break;
      default:
        return [];
    }

    if (profile?.role === 'organizer' && selectedDistrict !== 'all') {
      playersToDisplay = playersToDisplay.filter(p => p.district === selectedDistrict);
    }
    
    if (selectedSchool !== 'all') {
        playersToDisplay = playersToDisplay.filter(p => p.school === selectedSchool);
    }

    const groupedBySchool = playersToDisplay.reduce((acc, player) => {
      const schoolName = player.school || 'Unassigned';
      if (!acc[schoolName]) {
        acc[schoolName] = [];
      }
      acc[schoolName].push(player);
      return acc;
    }, {} as Record<string, MasterPlayer[]>);

    return Object.keys(groupedBySchool).sort().map(schoolName => ({
      schoolName,
      players: groupedBySchool[schoolName] || [],
    }));
  }, [allPlayers, isDbLoaded, selectedDistrict, selectedSchool, profile]);
  
  const sortPlayers = (players: MasterPlayer[]) => {
    return [...players].sort((a, b) => {
        const key = sortConfig.key;
        let aVal: any = a[key as keyof MasterPlayer] ?? '';
        let bVal: any = b[key as keyof MasterPlayer] ?? '';
        
        if (key === 'lastName') {
            aVal = `${a.lastName || ''}, ${a.firstName || ''}`;
            bVal = `${b.lastName || ''}, ${b.firstName || ''}`;
        }
        
        const result = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
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
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const handleCreateNewPlayer = () => {
    onEditPlayer({} as MasterPlayer); // Pass empty object to signify creation
  };

  const handleDeletePlayer = (player: MasterPlayer) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (playerToDelete) {
      await deletePlayer(playerToDelete.id);
      toast({ title: 'Player Deleted', description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from the database.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  const handlePlayerSelectedFromSearch = (player: any) => {
      const isMasterPlayer = 'uscfId' in player;
      let playerToEdit: MasterPlayer;

      if(isMasterPlayer) {
          playerToEdit = player as MasterPlayer;
      } else {
          const nameParts = player.name ? player.name.split(', ') : ['Unknown', 'Player'];
          playerToEdit = {
            id: player.uscf_id,
            uscfId: player.uscf_id,
            firstName: nameParts[1] || '',
            lastName: nameParts[0] || '',
            middleName: nameParts.length > 2 ? nameParts[2] : '',
            regularRating: player.rating_regular || undefined,
            uscfExpiration: player.expiration_date ? new Date(player.expiration_date).toISOString() : undefined,
            state: player.state || 'TX',
            school: '', district: '', grade: '', section: '', email: '', zipCode: '',
            events: 0, eventIds: [],
          };
      }
      onEditPlayer(playerToEdit);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline">Player Rosters</h1>
          <p className="text-muted-foreground">
            An overview of all player rosters.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Roster Management</CardTitle>
              <div className="flex gap-2">
                <Button onClick={() => setIsSearchOpen(true)}><Search className="mr-2 h-4 w-4"/> Search & Add</Button>
                <Button onClick={handleCreateNewPlayer}><PlusCircle className="mr-2 h-4 w-4"/> Create New Player</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              {(profile?.role === 'organizer') && (
                  <div className="flex-1 min-w-[200px]">
                      <Label>Filter by District</Label>
                      <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                      </Select>
                  </div>
              )}
              {(profile?.role === 'organizer' || profile?.role === 'district_coordinator' || profile?.role === 'individual') && schoolsForFilter.length > 1 && (
                  <div className="flex-1 min-w-[200px]">
                    <Label>Filter by School</Label>
                    <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Schools</SelectItem>
                        {schoolsForFilter.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
              )}
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
                        <TableHead><Button variant="ghost" onClick={() => requestSort('lastName')} className="px-0 flex items-center gap-1">Player Name {getSortIcon('lastName')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('uscfId')} className="px-0 flex items-center gap-1">USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('regularRating')} className="px-0 flex items-center gap-1">Rating {getSortIcon('regularRating')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('grade')} className="px-0 flex items-center gap-1">Grade {getSortIcon('grade')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('section')} className="px-0 flex items-center gap-1">Section {getSortIcon('section')}</Button></TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortPlayers(players).map(p => (
                        <TableRow key={p.id}>
                          <TableCell>{p.lastName}, {p.firstName} {p.middleName || ''}</TableCell>
                          <TableCell>{p.uscfId}</TableCell>
                          <TableCell>{p.regularRating || 'N/A'}</TableCell>
                          <TableCell>{p.grade}</TableCell>
                          <TableCell>{p.section}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => onEditPlayer(p)}>Edit</Button>
                          </TableCell>
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

      <PlayerSearchDialog
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onPlayerSelected={handlePlayerSelectedFromSearch}
        portalType={profile?.role || 'individual'}
      />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete {playerToDelete?.firstName} {playerToDelete?.lastName}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
