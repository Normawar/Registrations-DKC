'use client';

import { useState, useMemo, useRef, type ChangeEvent, Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { 
  PlusCircle, 
  MoreHorizontal,
  CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Search,
  Info
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { generateTeamCode } from '@/lib/school-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];

const gradeToNumber: { [key: string]: number } = {
  'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3,
  '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7,
  '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11,
  '12th Grade': 12,
};

const sectionMaxGrade: { [key: string]: number } = {
  'Kinder-1st': 1,
  'Primary K-3': 3,
  'Elementary K-5': 5,
  'Middle School K-8': 8,
  'High School K-12': 12,
  'Championship': 12,
};

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, { message: "First Name is required." }),
  middleName: z.string().optional(),
  lastName: z.string().min(1, { message: "Last Name is required." }),
  uscfId: z.string().min(1, { message: "USCF ID is required." }),
  uscfExpiration: z.preprocess((arg) => {
    if (typeof arg === "string" && arg.trim() !== '') {
      const parsed = parse(arg, 'MM/dd/yyyy', new Date());
      if (isValid(parsed)) return parsed;
    }
    if (arg instanceof Date) return arg;
    return undefined;
  }, z.date().optional()),
  regularRating: z.preprocess(
    (val) => (String(val).toUpperCase() === 'UNR' || val === '' ? undefined : val),
    z.coerce.number({invalid_type_error: "Rating must be a number or UNR."}).optional()
  ),
  quickRating: z.string().optional(),
  grade: z.string().min(1, { message: "Please select a grade." }),
  section: z.string().min(1, { message: "Please select a section." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phone: z.string().optional(),
  dob: z.preprocess((arg) => {
    if (typeof arg === "string" && arg.trim() !== '') {
      const parsed = parse(arg, 'MM/dd/yyyy', new Date());
      if (isValid(parsed)) return parsed;
      return arg;
    }
    if (arg instanceof Date) return arg;
    return undefined;
  }, z.date({ required_error: "Date of birth is required."})),
  zipCode: z.string().min(5, { message: "Please enter a valid 5-digit zip code." }),
  studentType: z.string().optional(),
  state: z.string().optional(),
})
.refine(data => {
    if (data.uscfId.toUpperCase() !== 'NEW') {
      return data.uscfExpiration !== undefined;
    }
    return true;
}, {
  message: "USCF Expiration is required unless ID is NEW.",
  path: ["uscfExpiration"],
})
.refine((data) => {
    if (!data.grade || !data.section) {
      return true;
    }
    if (data.section === 'Championship') {
      return true;
    }
    const playerGradeLevel = gradeToNumber[data.grade];
    const sectionMaxLevel = sectionMaxGrade[data.section];
    
    if (playerGradeLevel === undefined || sectionMaxLevel === undefined) {
      return true; 
    }

    return playerGradeLevel <= sectionMaxLevel;
  }, {
    message: "Player's grade is too high for this section.",
    path: ["section"],
  });

type PlayerFormValues = z.infer<typeof playerFormSchema>;
type SortableColumnKey = 'lastName' | 'teamCode' | 'uscfId' | 'regularRating' | 'grade' | 'section';

function RosterPageContent() {
  const { toast } = useToast();
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>(null);
  
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchUscfId, setSearchUscfId] = useState('');
  const [searchState, setSearchState] = useState('TX');

  const { profile, isProfileLoaded } = useSponsorProfile();
  const { database: allPlayers, addPlayer, updatePlayer, deletePlayer, isDbLoaded, dbStates } = useMasterDb();
  
  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;

  const rosterPlayers = useMemo(() => {
    if (!isProfileLoaded || !isDbLoaded || !profile) {
        return [];
    }
    if (!Array.isArray(allPlayers)) {
        console.warn('Master database is not an array:', allPlayers);
        return [];
    }
    return allPlayers.filter(player => {
        if (!player || typeof player !== 'object') {
            return false;
        }
        const playerDistrict = (player.district || '').toString().trim();
        const playerSchool = (player.school || '').toString().trim();
        const profileDistrict = (profile.district || '').toString().trim();
        const profileSchool = (profile.school || '').toString().trim();
        
        const districtMatch = playerDistrict.toLowerCase() === profileDistrict.toLowerCase();
        const schoolMatch = playerSchool.toLowerCase() === profileSchool.toLowerCase();
        
        return districtMatch && schoolMatch;
    });
  }, [allPlayers, profile, isProfileLoaded, isDbLoaded]);

  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      firstName: '', middleName: '', lastName: '', uscfId: '',
      regularRating: undefined, quickRating: '', uscfExpiration: undefined,
      dob: undefined, grade: '', section: '', email: '', phone: '',
      zipCode: '', studentType: undefined, state: '',
    }
  });

  const watchUscfId = form.watch('uscfId');

  const searchResults = useMemo(() => {
    if (!isDbLoaded || !allPlayers) return [];

    const lowerFirstName = searchFirstName.toLowerCase().trim();
    const lowerLastName = searchLastName.toLowerCase().trim();
    const lowerUscfId = searchUscfId.toLowerCase().trim();

    const hasSearchCriteria = lowerFirstName || lowerLastName || lowerUscfId;
    
    if (!hasSearchCriteria && searchState === 'ALL') {
        return [];
    }

    const rosterPlayerIds = new Set(rosterPlayers.map(p => p.id));
    
    let results = allPlayers.filter(p => {
        if (rosterPlayerIds.has(p.id)) return false;

        let stateMatch = false;
        if (searchState === 'ALL') {
            stateMatch = true;
        } else if (searchState === 'NO_STATE') {
            stateMatch = !p.state || p.state.trim() === '';
        } else {
            stateMatch = (p.state || '').trim().toUpperCase() === searchState.toUpperCase();
        }
        
        if (!hasSearchCriteria && searchState === 'TX') {
            return stateMatch;
        }
        
        const firstNameMatch = !lowerFirstName || String(p.firstName || '').toLowerCase().includes(lowerFirstName);
        const lastNameMatch = !lowerLastName || String(p.lastName || '').toLowerCase().includes(lowerLastName);
        const uscfIdMatch = !lowerUscfId || String(p.uscfId || '').toLowerCase().includes(lowerUscfId);
        
        return stateMatch && firstNameMatch && lastNameMatch && uscfIdMatch;
    });

    results.sort((a, b) => {
        const lastNameComp = (a.lastName || '').localeCompare(b.lastName || '');
        if (lastNameComp !== 0) return lastNameComp;
        return (a.firstName || '').localeCompare(b.firstName || '');
    });

    return results.slice(0, 100);
  }, [searchFirstName, searchLastName, searchUscfId, searchState, allPlayers, isDbLoaded, rosterPlayers]);

  useEffect(() => {
    if (isPlayerDialogOpen) {
      if (!editingPlayer) {
        setSearchFirstName('');
        setSearchLastName('');
        setSearchUscfId('');
        setSearchState('TX');
      }
      
      const resetValues = (player: MasterPlayer | null) => {
        form.reset({
          id: player?.id,
          firstName: player?.firstName || '', 
          middleName: player?.middleName || '', 
          lastName: player?.lastName || '', 
          uscfId: player?.uscfId || '',
          regularRating: player?.regularRating, 
          quickRating: player?.quickRating || '',
          uscfExpiration: player?.uscfExpiration ? parse(player.uscfExpiration, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", new Date()) : undefined,
          dob: player?.dob ? parse(player.dob, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", new Date()) : undefined,
          grade: player?.grade || '', 
          section: player?.section || '', 
          email: player?.email || '', 
          phone: player?.phone || '',
          zipCode: player?.zipCode || '', 
          studentType: player?.studentType, 
          state: player?.state || '',
        });
      }
      resetValues(editingPlayer);
    }
  }, [isPlayerDialogOpen, editingPlayer, form]);

  const sortedPlayers = useMemo(() => {
    const sortablePlayers = [...rosterPlayers];
    if (sortConfig) {
      sortablePlayers.sort((a, b) => {
        const key = sortConfig.key;
        let aVal: any;
        let bVal: any;
        let result = 0;

        if (key === 'teamCode') {
            if (!profile) return 0;
            const codeA = generateTeamCode({ schoolName: profile.school, district: profile.district, studentType: a.studentType });
            const codeB = generateTeamCode({ schoolName: profile.school, district: profile.district, studentType: b.studentType });
            if (codeA < codeB) result = -1;
            if (codeA > codeB) result = 1;
        } else {
            aVal = a[key as keyof MasterPlayer];
            bVal = b[key as keyof MasterPlayer];

            if (key === 'grade' && typeof a.grade === 'string' && typeof b.grade === 'string') {
              aVal = gradeToNumber[a.grade] ?? -1;
              bVal = gradeToNumber[b.grade] ?? -1;
            } else if (key === 'regularRating') {
              aVal = a.regularRating ?? -Infinity;
              bVal = b.regularRating ?? -Infinity;
            } else if (key === 'lastName') {
                aVal = a.lastName;
                bVal = b.lastName;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                result = aVal.localeCompare(bVal);
            } else {
                if (aVal < bVal) result = -1;
                if (aVal > bVal) result = 1;
            }
        }

        if (result === 0 && key === 'lastName') {
            result = (a.firstName || '').localeCompare(b.firstName || '');
        }

        return sortConfig.direction === 'ascending' ? result : -result;
      });
    } else {
        sortablePlayers.sort((a, b) => {
            const lastNameComparison = (a.lastName || '').localeCompare(b.lastName || '');
            if (lastNameComparison !== 0) return lastNameComparison;
            return (a.firstName || '').localeCompare(b.firstName || '');
        });
    }
    return sortablePlayers;
  }, [rosterPlayers, sortConfig, profile]);

  const requestSort = (key: SortableColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    } else {
      return <ArrowDown className="ml-2 h-4 w-4" />;
    }
  };
  
  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setIsPlayerDialogOpen(true);
  };

  const handleEditPlayer = (player: MasterPlayer) => {
    setEditingPlayer(player);
    setIsPlayerDialogOpen(true);
  };
  
  const handleDeletePlayer = (player: MasterPlayer) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };
  
  const confirmDelete = () => {
    if (playerToDelete) {
      deletePlayer(playerToDelete.id);
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from the roster.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  const handleSelectSearchedPlayer = (player: MasterPlayer) => {
    setEditingPlayer(player);
    
    form.reset({
      ...player,
      uscfExpiration: player.uscfExpiration ? parse(player.uscfExpiration, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", new Date()) : undefined,
      dob: player.dob ? parse(player.dob, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", new Date()) : undefined,
    });
    
    setSearchFirstName('');
    setSearchLastName('');
    setSearchUscfId('');
    
    toast({ title: "Player Loaded", description: "Player information has been pre-filled. Update district/school and save to add to your roster." });
  };

  function onSubmit(values: PlayerFormValues) {
    if (!profile) return;
    
    const idToUpdate = editingPlayer?.id || values.id;
    
    if (values.uscfId.toUpperCase() !== 'NEW') {
        const existingPlayerInDb = allPlayers.find(p => p.uscfId.toLowerCase() === values.uscfId.toLowerCase());
        if (existingPlayerInDb && existingPlayerInDb.id !== idToUpdate) {
            form.setError("uscfId", { type: "manual", message: `USCF ID already assigned to ${existingPlayerInDb.firstName} ${existingPlayerInDb.lastName}.` });
            return;
        }
    }
    
    const { uscfExpiration, dob, regularRating, ...formValues } = values;
    
    let ratingValue;
    if (typeof regularRating === 'string' && regularRating.toUpperCase() === 'UNR') {
        ratingValue = undefined;
    } else if (typeof regularRating === 'number') {
        ratingValue = regularRating;
    } else {
        ratingValue = undefined;
    }

    const playerData: MasterPlayer = {
      ...formValues,
      id: idToUpdate || `p-${Date.now()}`,
      regularRating: ratingValue,
      uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
      dob: dob ? dob.toISOString() : undefined,
      district: profile.district, 
      school: profile.school,     
    };

    if (editingPlayer) {
      updatePlayer(playerData);
      toast({ title: "Player updated successfully", description: `${playerData.firstName} ${playerData.lastName} has been updated.` });
    } else {
      addPlayer(playerData);
      toast({ title: "Player added successfully", description: `${playerData.firstName} ${playerData.lastName} has been added to your roster.` });
    }

    setIsPlayerDialogOpen(false);
    setEditingPlayer(null);
  }
  
  if (!isProfileLoaded || !isDbLoaded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading roster data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Team Roster</h1>
            <p className="text-muted-foreground">
              Manage your team players and their information. ({rosterPlayers.length} players)
            </p>
          </div>
          <Button onClick={handleAddPlayer} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Add New Player
          </Button>
        </div>

        {profile && teamCode && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Team Information</AlertTitle>
            <AlertDescription>
              <strong>School:</strong> {profile.school}<br/>
              <strong>District:</strong> {profile.district}<br/>
              <strong>Team Code:</strong> {teamCode}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Current Roster</CardTitle>
            <CardDescription>
              Players registered under your school and district
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rosterPlayers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No players in your roster yet.</p>
                <p className="text-sm text-muted-foreground mt-2">Click "Add New Player" to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('lastName')}>
                        Player Name {getSortIcon('lastName')}
                      </Button>
                    </TableHead>
                    <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('teamCode')}>
                        Team Code {getSortIcon('teamCode')}
                      </Button>
                    </TableHead>
                    <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('uscfId')}>
                        USCF ID {getSortIcon('uscfId')}
                      </Button>
                    </TableHead>
                    <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('regularRating')}>
                        Rating {getSortIcon('regularRating')}
                      </Button>
                    </TableHead>
                    <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('grade')}>
                        Grade {getSortIcon('grade')}
                      </Button>
                    </TableHead>
                    <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('section')}>
                        Section {getSortIcon('section')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlayers.map((player) => {
                    const playerTeamCode = profile ? generateTeamCode({ 
                      schoolName: profile.school, 
                      district: profile.district, 
                      studentType: player.studentType 
                    }) : '';
                    
                    return (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{player.firstName} {player.lastName}</div>
                              <div className="text-sm text-muted-foreground">{player.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{playerTeamCode}</TableCell>
                        <TableCell>{player.uscfId}</TableCell>
                        <TableCell>{player.regularRating || 'UNR'}</TableCell>
                        <TableCell>{player.grade}</TableCell>
                        <TableCell>{player.section}</TableCell>
                         <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEditPlayer(player)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeletePlayer(player)} className="text-destructive">
                                Remove from Roster
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {editingPlayer ? 'Edit Player' : 'Add New Player'}
              </DialogTitle>
              <DialogDescription>
                {editingPlayer ? 'Update player information' : 'Search for existing players or create a new one'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              {!editingPlayer && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Search Master Database</CardTitle>
                    <CardDescription>
                      Search for existing players to add to your roster. Players already in your roster are excluded.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="search-first">First Name</Label>
                        <Input
                          id="search-first"
                          placeholder="Search first name..."
                          value={searchFirstName}
                          onChange={(e) => setSearchFirstName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="search-last">Last Name</Label>
                        <Input
                          id="search-last"
                          placeholder="Search last name..."
                          value={searchLastName}
                          onChange={(e) => setSearchLastName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="search-uscf">USCF ID</Label>
                        <Input
                          id="search-uscf"
                          placeholder="Search USCF ID..."
                          value={searchUscfId}
                          onChange={(e) => setSearchUscfId(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="search-state">State</Label>
                        <Select value={searchState} onValueChange={setSearchState}>
                          <SelectTrigger id="search-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {dbStates.map(state => (
                              <SelectItem key={state} value={state}>
                                {state === 'ALL' ? 'All States' : 
                                 state === 'NO_STATE' ? 'No State' : state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {searchResults.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium mb-2 block">
                          Search Results ({searchResults.length} found)
                        </Label>
                        <ScrollArea className="h-64 w-full border rounded-md">
                          <div className="p-4">
                            {searchResults.map((player) => (
                              <div
                                key={player.id}
                                className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                                onClick={() => handleSelectSearchedPlayer(player)}
                              >
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {player.firstName} {player.lastName}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    USCF: {player.uscfId} • Rating: {player.regularRating || 'UNR'} • 
                                    State: {player.state || 'None'} • School: {player.school || 'None'}
                                  </div>
                                </div>
                                <Button variant="outline" size="sm">
                                  Select
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click on a player to pre-fill the form. The player will be assigned to your district and school when saved.
                        </p>
                      </div>
                    )}

                    {searchState === 'TX' && !searchFirstName && !searchLastName && !searchUscfId && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Showing all Texas players not in your roster. Use the search fields above to narrow results, 
                          or change the state filter to search other regions.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Player Information</CardTitle>
                      <CardDescription>
                        {editingPlayer ? 'Update the player details below' : 'Enter player details or search above to pre-fill'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Form fields... */}
                    </CardContent>
                  </Card>
                </form>
              </Form>
            </div>

            <DialogFooter className="flex-shrink-0">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button 
                type="submit" 
                onClick={form.handleSubmit(onSubmit)}
                disabled={!form.formState.isValid}
              >
                {editingPlayer ? 'Update Player' : 'Add Player'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Player from Roster</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {playerToDelete?.firstName} {playerToDelete?.lastName} from your roster? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
                Remove Player
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    }>
      <RosterPageContent />
    </Suspense>
  );
}