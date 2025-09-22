

'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/app-layout';
import { AuthGuard, OrganizerGuard } from '@/components/auth-guard';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Download, ArrowUpDown, ArrowUp, ArrowDown, Check, MoreHorizontal, FilePenLine, Trash2, Edit, UserPlus, History } from 'lucide-react';
import { generateTeamCode } from '@/lib/school-utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Papa from 'papaparse';
import { format, isValid, parse } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type SortableColumnKey = 'lastName' | 'teamCode' | 'uscfId' | 'regularRating' | 'grade' | 'section';

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];

const playerFormSchema = z.object({
    id: z.string().optional(),
    firstName: z.string().min(1, { message: "First Name is required." }),
    lastName: z.string().min(1, { message: "Last Name is required." }),
    middleName: z.string().optional(),
    uscfId: z.string().min(1, { message: "USCF ID is required." }),
    regularRating: z.coerce.number().optional(),
    grade: z.string().optional(),
    section: z.string().optional(),
    email: z.string().email({ message: "Please enter a valid email." }).optional(),
    district: z.string().optional(),
    school: z.string().optional(),
    studentType: z.string().optional(),
});

type PlayerFormValues = z.infer<typeof playerFormSchema>;

// Shared Change History component
const ChangeHistorySection = ({ player }: { player: MasterPlayer | null }) => {
    if (!player) {
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Record Information
            </h3>
            <div className="p-6 text-center text-muted-foreground border rounded-md bg-muted/30">
              Record information will be available after the player is created.
            </div>
          </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Record Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/30">
                <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">RECORD CREATED</h4>
                    <p className="text-sm font-semibold">
                        {player.dateCreated 
                            ? format(new Date(player.dateCreated), 'PPP p') 
                            : 'Unknown Date'
                        }
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Created by: {player.createdBy || 'Unknown User'}
                    </p>
                </div>
                <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">LAST UPDATED</h4>
                    <p className="text-sm font-semibold">
                        {player.dateUpdated 
                            ? format(new Date(player.dateUpdated), 'PPP p') 
                            : (player.dateCreated ? format(new Date(player.dateCreated), 'PPP p') : 'Unknown Date')
                        }
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Updated by: {player.updatedBy || player.createdBy || 'Unknown User'}
                    </p>
                </div>
            </div>

            {player.changeHistory && player.changeHistory.length > 0 ? (
                <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">CHANGE HISTORY</h4>
                    <div className="space-y-3 border rounded-md p-4 max-h-64 overflow-y-auto bg-background">
                        {player.changeHistory.slice().reverse().map((entry, index) => (
                            <div key={entry.timestamp || index} className="text-sm border-l-2 border-muted-foreground pl-4 pb-3 last:pb-0">
                                <p className="font-medium text-foreground">
                                    {format(new Date(entry.timestamp), 'PPP p')} by {entry.userName}
                                </p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    {entry.changes.map((change, changeIndex) => (
                                        <li key={changeIndex} className="text-xs text-muted-foreground">
                                            Field <span className="font-semibold text-foreground">{change.field}</span> changed from 
                                            <span className="italic text-red-600 mx-1">'{String(change.oldValue)}'</span> to 
                                            <span className="italic text-green-600 mx-1">'{String(change.newValue)}'</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">CHANGE HISTORY</h4>
                    <div className="p-4 text-center text-xs text-muted-foreground border rounded-md bg-muted/20">
                        No changes recorded for this player.
                    </div>
                </div>
            )}
        </div>
    );
};

const DateInput = React.forwardRef<HTMLInputElement, {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}>(({ value, onChange, placeholder, className }, ref) => {
  const [displayValue, setDisplayValue] = useState('');
  
  useEffect(() => {
    const newDisplayValue = (value instanceof Date && !isNaN(value.getTime())) 
      ? format(value, 'yyyy-MM-dd') 
      : '';
    setDisplayValue(newDisplayValue);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    if (inputValue === '') {
      onChange?.(undefined);
      return;
    }

    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = inputValue.match(dateRegex);

    if (match) {
        const [, year, month, day] = match.map(Number);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            if (isValid(date)) {
                onChange?.(date);
            }
        }
    }
  };

  return (
    <Input
      ref={ref}
      type="date"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
});
DateInput.displayName = 'DateInput';


function DistrictRostersPageContent() {
  const { isDbLoaded, dbDistricts, database: allPlayers, getSchoolsForDistrict, deletePlayer, updatePlayer, addPlayer } = useMasterDb();
  const { profile } = useSponsorProfile();
  const { toast } = useToast();
  
  const [rosterType, setRosterType] = useState<'real' | 'test'>('real');
  const [selectedDistrict, setSelectedDistrict] = useState('PHARR-SAN JUAN-ALAMO ISD');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [playerType, setPlayerType] = useState('all');
  const [showOnlyWithPlayers, setShowOnlyWithPlayers] = useState(false);
  const [openSchools, setOpenSchools] = useState<Record<string, boolean>>({});
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' }>({ key: 'lastName', direction: 'ascending' });

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
  const [schoolsForEditDistrict, setSchoolsForEditDistrict] = useState<string[]>([]);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema)
  });
  
  const editDistrict = form.watch('district');

  useEffect(() => {
    if (editDistrict) {
      setSchoolsForEditDistrict(getSchoolsForDistrict(editDistrict));
    }
  }, [editDistrict, getSchoolsForDistrict]);

  useEffect(() => {
    if (playerToEdit) {
      form.reset({
        id: playerToEdit.id,
        firstName: playerToEdit.firstName,
        lastName: playerToEdit.lastName,
        middleName: playerToEdit.middleName,
        uscfId: playerToEdit.uscfId,
        regularRating: playerToEdit.regularRating,
        grade: playerToEdit.grade,
        section: playerToEdit.section,
        email: playerToEdit.email,
        district: playerToEdit.district,
        school: playerToEdit.school,
        studentType: playerToEdit.studentType
      });
      if (playerToEdit.district) {
        setSchoolsForEditDistrict(getSchoolsForDistrict(playerToEdit.district));
      }
    }
  }, [playerToEdit, form, getSchoolsForDistrict]);

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
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
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
  
  const handleExportAll = () => {
    let allFilteredPlayers: MasterPlayer[] = [];
    schoolRosters.forEach(roster => {
        allFilteredPlayers = allFilteredPlayers.concat(roster.players);
    });
    
    if (allFilteredPlayers.length === 0) return;

    const csv = Papa.unparse(allFilteredPlayers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${selectedDistrict}_full_roster_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditPlayer = (player: MasterPlayer) => {
    setPlayerToEdit(player);
    setIsEditOpen(true);
  };

  const handleCreateNewPlayer = () => {
    setPlayerToEdit(null);
    form.reset({
        id: `temp_${Date.now()}`,
        firstName: '',
        lastName: '',
        uscfId: 'NEW'
    });
    setIsEditOpen(true);
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

  const handleBulkDelete = async () => {
      if (selectedPlayers.length === 0) {
          toast({ title: "No players selected", variant: "destructive" });
          return;
      }
      if (window.confirm(`Are you sure you want to delete ${selectedPlayers.length} players? This action cannot be undone.`)) {
          for (const playerId of selectedPlayers) {
              await deletePlayer(playerId);
          }
          toast({ title: `${selectedPlayers.length} Players Deleted` });
          setSelectedPlayers([]);
      }
  };

  const togglePlayerSelection = (playerId: string) => {
      setSelectedPlayers(prev => 
          prev.includes(playerId) ? prev.filter(id => !id) : [...prev, playerId]
      );
  };

  const toggleSelectAllForSchool = (playersInSchool: MasterPlayer[], isChecked: boolean) => {
      const playerIds = playersInSchool.map(p => p.id);
      if (isChecked) {
          setSelectedPlayers(prev => [...new Set([...prev, ...playerIds])]);
      } else {
          setSelectedPlayers(prev => prev.filter(id => !playerIds.includes(id)));
      }
  };

  const onEditSubmit = async (values: PlayerFormValues) => {
    if (!profile) return;
    
    if (playerToEdit) { // Updating existing player
        const updatedPlayer: MasterPlayer = { ...playerToEdit, ...values };
        await updatePlayer(updatedPlayer, profile);
        toast({ title: "Player Updated" });
    } else { // Creating new player
        const newPlayer: MasterPlayer = {
            ...values,
            id: values.id || `temp_${Date.now()}`,
            events: 0,
            eventIds: [],
        } as MasterPlayer;
        await addPlayer(newPlayer);
        toast({ title: "Player Created" });
    }
    
    setIsEditOpen(false);
    setPlayerToEdit(null);
  };

  const handlePlayerSelectedFromSearch = (player: any) => {
    handleEditPlayer(player);
    setIsSearchOpen(false);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline">District Rosters</h1>
          <p className="text-muted-foreground">An overview of all player rosters for each school in all districts</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Roster Management</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsSearchOpen(true)}><UserPlus className="mr-2 h-4 w-4"/> Add Player</Button>
                <Button onClick={handleCreateNewPlayer}><UserPlus className="mr-2 h-4 w-4"/> Create New Player</Button>
              </div>
            </div>
          </CardHeader>
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
                <div className="flex gap-2">
                    <Button onClick={handleExportAll} disabled={schoolRosters.reduce((sum, r) => sum + r.players.length, 0) === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export All Rosters ({schoolRosters.reduce((sum, r) => sum + r.players.length, 0)})
                    </Button>
                    <Button variant="destructive" onClick={handleBulkDelete} disabled={selectedPlayers.length === 0}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected ({selectedPlayers.length})
                    </Button>
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
                        <TableHead className="w-12">
                          <Checkbox
                              onCheckedChange={(checked) => toggleSelectAllForSchool(players, !!checked)}
                              checked={players.length > 0 && players.every(p => selectedPlayers.includes(p.id))}
                          />
                        </TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('lastName')} className="px-0 flex items-center gap-1">Player Name {getSortIcon('lastName')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('teamCode')} className="px-0 flex items-center gap-1">Team Code {getSortIcon('teamCode')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('uscfId')} className="px-0 flex items-center gap-1">USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('regularRating')} className="px-0 flex items-center gap-1">Rating {getSortIcon('regularRating')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('grade')} className="px-0 flex items-center gap-1">Grade {getSortIcon('grade')}</Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => requestSort('section')} className="px-0 flex items-center gap-1">Section {getSortIcon('section')}</Button></TableHead>
                        <TableHead>GT</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortPlayers(players).map(p => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Checkbox
                                checked={selectedPlayers.includes(p.id)}
                                onCheckedChange={() => togglePlayerSelection(p.id)}
                            />
                          </TableCell>
                          <TableCell>{p.lastName}, {p.firstName} {p.middleName || ''}</TableCell>
                          <TableCell>{generateTeamCode(p)}</TableCell>
                          <TableCell>{p.uscfId}</TableCell>
                          <TableCell>{p.regularRating || 'N/A'}</TableCell>
                          <TableCell>{p.grade}</TableCell>
                          <TableCell>{p.section}</TableCell>
                          <TableCell>{p.studentType === 'gt' && <Check className="text-green-600 h-5 w-5" />}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleEditPlayer(p)}>
                                        <FilePenLine className="mr-2 h-4 w-4" />
                                        Edit Player
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeletePlayer(p)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Player
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                  <DialogTitle>{playerToEdit ? 'Edit Player' : 'Create New Player'}</DialogTitle>
                  <DialogDescription>
                    {playerToEdit ? 'Modify the player\'s information below.' : 'Enter the details for the new player.'}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 overflow-y-auto">
                  <div className="p-6 space-y-6">
                    <Form {...form}>
                      <form id="edit-player-form" onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-6">
                        <ChangeHistorySection player={playerToEdit} />
                      </form>
                    </Form>
                  </div>
                </ScrollArea>
                <div className="p-6 pt-4 border-t bg-muted/30 shrink-0">
                  <div className="flex justify-between">
                    {playerToEdit ? (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        onClick={() => {
                          handleDeletePlayer(playerToEdit);
                          setIsEditOpen(false);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Player
                      </Button>
                    ) : (
                      <div></div>
                    )}
                    
                    <div className="flex gap-3">
                      <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" form="edit-player-form">
                        {playerToEdit ? 'Save Changes' : 'Create Player'}
                      </Button>
                    </div>
                  </div>
                </div>
            </DialogContent>
        </Dialog>
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
      </div>
      <EnhancedPlayerSearchDialog
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onPlayerSelected={handlePlayerSelectedFromSearch}
        userProfile={profile}
        preFilterByUserProfile={false}
      />
    </>
  );
}

// New component for Sponsor/Individual view
function UserRosterPageContent() {
    const { profile } = useSponsorProfile();
    const { database: allPlayers, isDbLoaded, addPlayer, updatePlayer } = useMasterDb();
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
    const { toast } = useToast();
    
    const roster = useMemo(() => {
        if (!profile || !isDbLoaded) return [];
        if (profile.role === 'sponsor' || profile.role === 'district_coordinator') {
            return allPlayers.filter(p => p.district === profile.district && p.school === profile.school);
        }
        if (profile.role === 'individual') {
             try {
              const storedParentStudents = localStorage.getItem(`parent_students_${profile.email}`);
              if (storedParentStudents) {
                const studentIds = JSON.parse(storedParentStudents);
                return allPlayers.filter(p => studentIds.includes(p.id));
              }
            } catch (e) { console.error(e); }
            return [];
        }
        return [];
    }, [profile, allPlayers, isDbLoaded]);

    const handleEditPlayer = (player: MasterPlayer) => {
        setPlayerToEdit(player);
        setIsEditOpen(true);
    };

    const handleCreateNewPlayer = () => {
        setPlayerToEdit(null);
        setIsEditOpen(true);
    };

    const handlePlayerSelectedFromSearch = (player: any) => {
        handleEditPlayer(player);
        setIsSearchOpen(false);
    };
    
    const onEditSubmit = async (values: PlayerFormValues) => {
        if (!profile) return;
        
        // Check if the player is already on the user's roster (for individuals)
        const isAlreadyOnRoster = playerToEdit && roster.some(p => p.id === playerToEdit.id);

        if (playerToEdit && isAlreadyOnRoster) { // Updating existing player on roster
            const updatedPlayer: MasterPlayer = { ...playerToEdit, ...values };
            await updatePlayer(updatedPlayer, profile);
            toast({ title: "Player Updated" });
        } else { // Adding a new player to roster
            const playerToAdd: MasterPlayer = {
                ...(playerToEdit || {}), // Start with existing data if available
                ...values,
                id: playerToEdit?.id || values.id || `temp_${Date.now()}`,
                events: playerToEdit?.events || 0,
                eventIds: playerToEdit?.eventIds || [],
            } as MasterPlayer;
            
            // For individual users, update local storage
            if (profile.role === 'individual') {
                const parentStudentsKey = `parent_students_${profile.email}`;
                const existingIds = JSON.parse(localStorage.getItem(parentStudentsKey) || '[]');
                if (!existingIds.includes(playerToAdd.id)) {
                    localStorage.setItem(parentStudentsKey, JSON.stringify([...existingIds, playerToAdd.id]));
                }
            }

            // Always update or add to the master database
            await addPlayer(playerToAdd);
            toast({ title: "Player Added to Roster" });
        }
        
        setIsEditOpen(false);
    };
    
    const isPlayerOnRoster = playerToEdit ? roster.some(p => p.id === playerToEdit.id) : false;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold font-headline">My Roster</h1>
                <p className="text-muted-foreground">Manage your players and students.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsSearchOpen(true)}><UserPlus className="mr-2 h-4 w-4"/> Add Player</Button>
                <Button onClick={handleCreateNewPlayer}><UserPlus className="mr-2 h-4 w-4"/> Create New Player</Button>
              </div>
            </div>
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>{profile?.role === 'individual' ? 'My Students' : 'School Roster'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>USCF ID</TableHead>
                                <TableHead>Grade</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                          {roster.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center h-24">No players on this roster yet. Click "Add Player" to start.</TableCell>
                            </TableRow>
                          ) : (
                            roster.map(player => (
                                <TableRow key={player.id}>
                                    <TableCell>{player.firstName} {player.lastName}</TableCell>
                                    <TableCell>{player.uscfId}</TableCell>
                                    <TableCell>{player.grade}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditPlayer(player)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                          )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{isPlayerOnRoster ? 'Edit Player' : 'Add Player to Roster'}</DialogTitle>
                </DialogHeader>
                {/* Simplified Form for non-organizers */}
                 <p className="text-sm text-muted-foreground">Fill in the player's details to add or update them on your roster.</p>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button onClick={() => {
                    // Logic to save the player would go here
                    // This is a simplified version
                    onEditSubmit(playerToEdit as any);
                  }}>
                    {isPlayerOnRoster ? 'Update Player' : 'Add to Roster'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <EnhancedPlayerSearchDialog
                isOpen={isSearchOpen}
                onOpenChange={setIsSearchOpen}
                onPlayerSelected={handlePlayerSelectedFromSearch}
                userProfile={profile}
                preFilterByUserProfile={true}
            />
        </div>
    );
}

export default function RosterPage() {
    const { profile, isProfileLoaded } = useSponsorProfile();

    if (!isProfileLoaded) {
        return (
            <AppLayout>
                <div>Loading...</div>
            </AppLayout>
        );
    }
    
    return (
        <AuthGuard>
            <AppLayout>
                {profile?.role === 'organizer' ? (
                    <DistrictRostersPageContent />
                ) : (
                    <UserRosterPageContent />
                )}
            </AppLayout>
        </AuthGuard>
    );
}

```