
'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Download, ArrowUpDown, ArrowUp, ArrowDown, Check, MoreHorizontal, FilePenLine, Trash2, Edit } from 'lucide-react';
import { generateTeamCode } from '@/lib/school-utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Papa from 'papaparse';
import { format } from 'date-fns';
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

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

const ChangeHistoryTab = ({ player }: { player: MasterPlayer | null }) => {
    if (!player?.changeHistory || player.changeHistory.length === 0) {
        return <div className="p-6 text-center text-muted-foreground">No change history available for this player.</div>;
    }

    return (
        <div className="p-6 space-y-4">
            {player.changeHistory.slice().reverse().map(entry => (
                <div key={entry.timestamp} className="text-sm border-l-2 pl-4">
                    <p className="font-medium">
                        {format(new Date(entry.timestamp), 'PPP p')} by {entry.userName}
                    </p>
                    <ul className="list-disc pl-5 mt-1 text-muted-foreground text-xs">
                        {entry.changes.map((change, index) => (
                            <li key={index}>
                                Field <span className="font-semibold text-foreground">{change.field}</span> changed from <span className="italic">'{String(change.oldValue)}'</span> to <span className="italic">'{String(change.newValue)}'</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};

function DistrictRostersPageContent() {
  const { isDbLoaded, dbDistricts, database: allPlayers, getSchoolsForDistrict, deletePlayer, updatePlayer } = useMasterDb();
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
          prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
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
    if (!playerToEdit || !profile) return;
    const updatedPlayer: MasterPlayer = {
      ...playerToEdit,
      ...values
    };
    await updatePlayer(updatedPlayer, profile);
    toast({ title: "Player Updated" });
    setIsEditOpen(false);
    setPlayerToEdit(null);
  };

  return (
    <>
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
      </div>
      
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-0 border-b shrink-0">
              <DialogTitle>Edit Player</DialogTitle>
              <DialogDescription>
                Modify the player's information below.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="details" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mt-4 px-6">
                <TabsTrigger value="details">Player Details</TabsTrigger>
                <TabsTrigger value="history">Change History</TabsTrigger>
              </TabsList>
              <ScrollArea className="flex-1 overflow-y-auto">
                <TabsContent value="details" className="mt-0">
                  <div className='p-6'>
                    <Form {...form}>
                      <form id="edit-player-form" onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="middleName" render={({ field }) => (<FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><Select onValueChange={(v) => { field.onChange(v); setSchoolsForEditDistrict(getSchoolsForDistrict(v)); form.setValue('school', ''); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl><SelectContent>{dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="school" render={({ field }) => (<FormItem><FormLabel>School</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl><SelectContent>{schoolsForEditDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                         {editDistrict === 'PHARR-SAN JUAN-ALAMO ISD' && (
                          <FormField
                            control={form.control}
                            name="studentType"
                            render={({ field }) => (
                              <FormItem className="space-y-3">
                                <FormLabel>Student Type</FormLabel>
                                <FormControl>
                                  <RadioGroup
                                    onValueChange={field.onChange}
                                    value={field.value || 'independent'}
                                    className="flex items-center space-x-4"
                                  >
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                      <FormControl><RadioGroupItem value="independent" /></FormControl>
                                      <FormLabel className="font-normal">Independent</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                      <FormControl><RadioGroupItem value="gt" /></FormControl>
                                      <FormLabel className="font-normal">GT (Gifted & Talented)</FormLabel>
                                    </FormItem>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <FormField control={form.control} name="uscfId" render={({ field }) => (<FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Enter USCF ID number or "NEW" for new players.</FormDescription><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="regularRating" render={({ field }) => (<FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="e.g., 1500, UNR, or NEW" value={field.value?.toString() || ''} onChange={(e) => { const value = e.target.value; if (value === '' || value.toUpperCase() === 'UNR' || value.toUpperCase() === 'NEW') { field.onChange(undefined); } else { field.onChange(value); } }} /></FormControl><FormDescription>Enter rating, UNR, or NEW</FormDescription><FormMessage /></FormItem>)} />
                      </form>
                    </Form>
                  </div>
                </TabsContent>
                <TabsContent value="history" className="mt-0 flex-1 overflow-y-auto">
                  <ChangeHistoryTab player={playerToEdit} />
                </TabsContent>
              </ScrollArea>
              <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" form="edit-player-form">Save Changes</Button>
              </DialogFooter>
            </Tabs>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {playerToDelete?.firstName} {playerToDelete?.lastName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function GuardedDistrictRostersPage() {
    return (
        <AppLayout>
            <OrganizerGuard>
                <DistrictRostersPageContent />
            </OrganizerGuard>
        </AppLayout>
    )
}
