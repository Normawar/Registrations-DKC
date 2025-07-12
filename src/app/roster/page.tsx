

'use client';

import { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
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
  'Championship': 12, // Open to all, so it's always valid
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
  regularRating: z.union([z.string(), z.number()]).optional(),
  quickRating: z.string().optional(),
  grade: z.string().min(1, { message: "Please select a grade." }),
  section: z.string().min(1, { message: "Please select a section." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phone: z.string().optional(),
  dob: z.preprocess((arg) => {
    if (typeof arg === "string" && arg.trim() !== '') {
      const parsed = parse(arg, 'MM/dd/yyyy', new Date());
      if (isValid(parsed)) return parsed;
      return arg; // return invalid string for zod to catch
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
.refine(data => {
  if (data.uscfId.toUpperCase() !== 'NEW') {
    const rating = data.regularRating;
    // Allow UNR even if ID is not new.
    if (typeof rating === 'string' && rating.toUpperCase() === 'UNR') return true;
    return rating !== undefined && rating !== '';
  }
  return true;
}, {
  message: "Rating is required (or UNR) unless USCF ID is NEW.",
  path: ["regularRating"],
})
.refine((data) => {
    if (!data.grade || !data.section) {
      return true; // Let other validators handle if these are missing
    }
    // Championship section is open to all grades, so it's always valid.
    if (data.section === 'Championship') {
      return true;
    }
    const playerGradeLevel = gradeToNumber[data.grade];
    const sectionMaxLevel = sectionMaxGrade[data.section];
    
    // This can happen if the dropdown values are not in the map, but they should be.
    if (playerGradeLevel === undefined || sectionMaxLevel === undefined) {
      return true; 
    }

    // A player's grade level must be less than or equal to the section's max grade level.
    return playerGradeLevel <= sectionMaxLevel;
  }, {
    message: "Player's grade is too high for this section.",
    path: ["section"],
  });

type PlayerFormValues = z.infer<typeof playerFormSchema>;
type SortableColumnKey = 'lastName' | 'teamCode' | 'uscfId' | 'regularRating' | 'grade' | 'section';


export default function RosterPage() {
  const { toast } = useToast();
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>(null);
  
  // Search state for the dialog
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchUscfId, setSearchUscfId] = useState('');
  const [searchState, setSearchState] = useState('TX');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MasterPlayer[]>([]);

  const { profile } = useSponsorProfile();
  const { database: allPlayers, addPlayer, updatePlayer, isDbLoaded } = useMasterDb();
  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;

  const rosterPlayers = useMemo(() => {
    if (!profile || !isDbLoaded || profile.role !== 'sponsor') return [];
    return allPlayers.filter(p => p.district === profile.district && p.school === profile.school);
  }, [allPlayers, profile, isDbLoaded]);

  const dbStates = useMemo(() => {
    if (isDbLoaded) {
        const usStates = [ 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY' ];
        const allUniqueStatesFromDb = new Set(allPlayers.map(p => p.state).filter(Boolean) as string[]);
        const usStatesInDb = usStates.filter(s => allUniqueStatesFromDb.has(s));
        const nonUsRegionsInDb = [...allUniqueStatesFromDb].filter(s => !usStates.includes(s));
        const sortedUsStates = usStatesInDb.filter(s => s !== 'TX').sort();
        const sortedNonUsRegions = nonUsRegionsInDb.sort();
        return ['ALL', 'TX', 'NO_STATE', ...sortedUsStates, ...sortedNonUsRegions];
    }
    return ['ALL', 'TX', 'NO_STATE'];
  }, [isDbLoaded, allPlayers]);
  
  const formStates = useMemo(() => {
    if (isDbLoaded) {
        const states = new Set(allPlayers.map(p => p.state).filter(Boolean) as string[]);
        return Array.from(states).sort();
    }
    return [];
  }, [isDbLoaded, allPlayers]);
  
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

  // Debounced search effect
  useEffect(() => {
    if (!searchFirstName && !searchLastName && !searchUscfId && searchState === 'ALL') {
        setSearchResults([]);
        return;
    }
    setIsSearching(true);
    const handler = setTimeout(() => {
        const lowerFirstName = searchFirstName.toLowerCase();
        const lowerLastName = searchLastName.toLowerCase();
        const results = allPlayers.filter(p => {
            const stateMatch = searchState === 'ALL' || (searchState === 'NO_STATE' && !p.state) || p.state === searchState;
            const firstNameMatch = !lowerFirstName || p.firstName.toLowerCase().includes(lowerFirstName);
            const lastNameMatch = !lowerLastName || p.lastName.toLowerCase().includes(lowerLastName);
            const uscfIdMatch = !searchUscfId || p.uscfId.includes(searchUscfId);
            return stateMatch && firstNameMatch && lastNameMatch && uscfIdMatch;
        }).slice(0, 50); // Limit results to avoid performance issues
        setSearchResults(results);
        setIsSearching(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchFirstName, searchLastName, searchUscfId, searchState, allPlayers]);


  useEffect(() => {
    if (isPlayerDialogOpen) {
      // Reset search fields when dialog opens
      setSearchFirstName('');
      setSearchLastName('');
      setSearchUscfId('');
      setSearchState('TX');
      setSearchResults([]);
      
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
            result = a.firstName.localeCompare(b.firstName);
        }

        return sortConfig.direction === 'ascending' ? result : -result;
      });
    } else {
        sortablePlayers.sort((a, b) => {
            const lastNameComparison = a.lastName.localeCompare(b.lastName);
            if (lastNameComparison !== 0) return lastNameComparison;
            return a.firstName.localeCompare(b.firstName);
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

  const isUscfNew = watchUscfId.toUpperCase() === 'NEW';
  
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
      // Don't delete, just disassociate from the roster
      updatePlayer({
          ...playerToDelete,
          school: "Independent",
          district: "None"
      });
      toast({ title: "Player Removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from the roster.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  const handleSelectSearchedPlayer = (player: MasterPlayer) => {
    setSearchResults([]);
    setEditingPlayer(player); // Treat this as an edit of an existing player
    
    form.reset({
      ...player,
      uscfExpiration: player.uscfExpiration ? parse(player.uscfExpiration, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", new Date()) : undefined,
      dob: player.dob ? parse(player.dob, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", new Date()) : undefined,
    });
    toast({ title: "Player Loaded", description: "Player information has been pre-filled. Please complete any missing fields." });
  };

  function onSubmit(values: PlayerFormValues) {
    if (!profile) return;

    // Check for USCF ID uniqueness unless it's the same player being edited
    const idToUpdate = editingPlayer?.id;
    if (values.uscfId.toUpperCase() !== 'NEW') {
        const existingPlayerInDb = allPlayers.find(p => p.uscfId.toLowerCase() === values.uscfId.toLowerCase());
        if (existingPlayerInDb && existingPlayerInDb.id !== idToUpdate) {
            form.setError("uscfId", { type: "manual", message: `USCF ID already assigned to ${existingPlayerInDb.firstName} ${existingPlayerInDb.lastName}.` });
            return;
        }
    }
    
    const { uscfExpiration, dob, ...formValues } = values;
    const existingPlayerInDb = idToUpdate ? allPlayers.find(p => p.id === idToUpdate) : null;
    
    const baseRecord = existingPlayerInDb || {
        id: `p-${Date.now()}`,
        events: 0,
        eventIds: [],
    };

    let ratingValue;
    if (typeof values.regularRating === 'string' && values.regularRating.toUpperCase() === 'UNR') {
        ratingValue = undefined;
    } else {
        ratingValue = values.regularRating ? Number(values.regularRating) : undefined;
    }

    const playerRecord: MasterPlayer = {
        ...baseRecord,
        ...formValues,
        school: profile.school,
        district: profile.district,
        regularRating: ratingValue,
        dob: dob instanceof Date ? dob.toISOString() : undefined,
        uscfExpiration: uscfExpiration instanceof Date ? uscfExpiration.toISOString() : undefined,
    };
    
    if (existingPlayerInDb) {
      updatePlayer(playerRecord);
      const toastTitle = !rosterPlayers.some(p => p.id === playerRecord.id) ? "Player Added to Roster" : "Player Updated";
      toast({ title: toastTitle, description: `${values.firstName} ${values.lastName}'s information has been updated.`});
    } else {
      addPlayer(playerRecord);
      toast({ title: "Player Added", description: `${values.firstName} ${values.lastName} has been added to the roster.`});
    }

    setIsPlayerDialogOpen(false);
    setEditingPlayer(null);
  }
  
  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Roster</h1>
            <p className="text-muted-foreground">
              Manage your school's player roster.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleAddPlayer}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Player
            </Button>
          </div>
        </div>

        {profile ? (
          <Card className="bg-secondary/50 border-dashed">
              <CardHeader>
                  <CardTitle className="text-lg">Sponsor Information</CardTitle>
                  <CardDescription>This district and school will be associated with all players added to this roster.</CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-4">
                  <div>
                      <p className="text-sm font-medium text-muted-foreground">District</p>
                      <p className="font-semibold">{profile.district}</p>
                  </div>
                  <div>
                      <p className="text-sm font-medium text-muted-foreground">School</p>
                      <p className="font-semibold">{profile.school}</p>
                  </div>
                  <div>
                      <p className="text-sm font-medium text-muted-foreground">Team Code</p>
                      <p className="font-semibold font-mono">{teamCode}</p>
                  </div>
              </CardContent>
          </Card>
        ) : (
          <Card className="bg-secondary/50 border-dashed animate-pulse">
              <CardHeader>
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-4 w-2/3 mt-1" />
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-5 w-2/3" />
                  </div>
                  <div className="space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-5 w-3/4" />
                  </div>
                  <div className="space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-5 w-1/2" />
                  </div>
              </CardContent>
          </Card>
        )}
        
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('lastName')}>
                      Player
                      {getSortIcon('lastName')}
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('teamCode')}>
                        Team Code
                        {getSortIcon('teamCode')}
                    </Button>
                  </TableHead>
                   <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('uscfId')}>
                      USCF ID
                      {getSortIcon('uscfId')}
                    </Button>
                  </TableHead>
                   <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('regularRating')}>
                      Rating
                      {getSortIcon('regularRating')}
                    </Button>
                  </TableHead>
                   <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('grade')}>
                      Grade
                      {getSortIcon('grade')}
                    </Button>
                  </TableHead>
                   <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('section')}>
                      Section
                      {getSortIcon('section')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={`https://placehold.co/40x40.png`} alt={`${player.firstName} ${player.lastName}`} data-ai-hint="person face" />
                          <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          {`${player.lastName}, ${player.firstName} ${player.middleName || ''}`.trim()}
                           <div className="text-sm text-muted-foreground">{player.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {profile ? generateTeamCode({
                        schoolName: profile.school,
                        district: profile.district,
                        studentType: player.studentType
                      }) : '...'}
                    </TableCell>
                    <TableCell>{player.uscfId}</TableCell>
                    <TableCell>{player.regularRating === undefined ? 'UNR' : player.regularRating}</TableCell>
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
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

       <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <DialogTitle>{editingPlayer ? 'Edit Player' : 'Add New Player'}</DialogTitle>
                <DialogDescription>
                    {editingPlayer ? "Update the player's information." : "Search the local database or enter the player's details manually."}
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6">
                {!editingPlayer && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="text-lg">Search Local Database</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="dialog-search-state">State</Label>
                                    <Select value={searchState} onValueChange={setSearchState}>
                                        <SelectTrigger id="dialog-search-state"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {dbStates.map(s => <SelectItem key={s} value={s}>{s === 'ALL' ? 'All States' : s === 'NO_STATE' ? 'No State' : s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="dialog-search-first-name">First Name</Label>
                                    <Input id="dialog-search-first-name" placeholder="Filter by first name..." value={searchFirstName} onChange={e => setSearchFirstName(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="dialog-search-last-name">Last Name</Label>
                                    <Input id="dialog-search-last-name" placeholder="Filter by last name..." value={searchLastName} onChange={e => setSearchLastName(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="dialog-search-uscf-id">USCF ID</Label>
                                    <Input id="dialog-search-uscf-id" placeholder="Filter by USCF ID..." value={searchUscfId} onChange={e => setSearchUscfId(e.target.value)} />
                                </div>
                            </div>
                            {(isSearching || searchResults.length > 0) && (
                                <Card className="max-h-48 overflow-y-auto">
                                    <CardContent className="p-2">
                                        {isSearching ? (<div className="p-2 text-center text-sm text-muted-foreground">Searching...</div>)
                                        : searchResults.length === 0 ? (<div className="p-2 text-center text-sm text-muted-foreground">No results found.</div>)
                                        : (
                                            searchResults.map(player => (
                                                <button key={player.id} type="button" className="w-full text-left p-2 hover:bg-accent rounded-md" onClick={() => handleSelectSearchedPlayer(player)}>
                                                    <p className="font-medium">{player.firstName} {player.lastName} ({player.state || 'N/A'})</p>
                                                    <p className="text-sm text-muted-foreground">ID: {player.uscfId} | Rating: {player.regularRating === undefined ? 'UNR' : player.regularRating} | Expires: {player.uscfExpiration ? format(new Date(player.uscfExpiration), 'MM/dd/yyyy') : 'N/A'}</p>
                                                </button>
                                            ))
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </CardContent>
                    </Card>
                )}
                <Form {...form}>
                    <form id="player-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input placeholder="Michael" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="uscfId" render={({ field }) => (
                              <FormItem>
                                <FormLabel>USCF ID</FormLabel>
                                <FormControl>
                                    <Input placeholder="12345678 or NEW" {...field} />
                                </FormControl>
                                <FormDescription>
                                    <Link 
                                        href={/^\d{8}$/.test(watchUscfId) ? `https://www.uschess.org/msa/MbrDtlTnmtHst.php?${watchUscfId}` : 'https://new.uschess.org/player-search'}
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-sm text-accent-foreground underline-offset-4 hover:underline"
                                    >
                                        Use the USCF Player Search to verify an ID.
                                    </Link>
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField
                                control={form.control}
                                name="regularRating"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rating</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="1500 or UNR"
                                                disabled={isUscfNew}
                                                {...field}
                                                value={field.value ?? ''}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField
                              control={form.control}
                              name="dob"
                              render={({ field }) => (
                                <FormItem className="flex flex-col">
                                  <FormLabel>Date of Birth</FormLabel>
                                  <div className="flex items-center gap-2">
                                    <FormControl>
                                      <Input
                                        placeholder="MM/DD/YYYY"
                                        value={field.value instanceof Date ? format(field.value, 'MM/dd/yyyy') : field.value || ''}
                                        onChange={(e) => field.onChange(e.target.value)}
                                      />
                                    </FormControl>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant={"outline"} size="icon" className="w-10 shrink-0">
                                          <CalendarIcon className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={field.value instanceof Date ? field.value : undefined}
                                          onSelect={field.onChange}
                                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                          captionLayout="dropdown-buttons"
                                          fromYear={new Date().getFullYear() - 100}
                                          toYear={new Date().getFullYear()}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                             <FormField
                              control={form.control}
                              name="uscfExpiration"
                              render={({ field }) => (
                                <FormItem className="flex flex-col">
                                  <FormLabel>USCF Expiration</FormLabel>
                                  <div className="flex items-center gap-2">
                                    <FormControl>
                                      <Input
                                        placeholder="MM/DD/YYYY"
                                        disabled={isUscfNew}
                                        value={field.value instanceof Date ? format(field.value, 'MM/dd/yyyy') : field.value || ''}
                                        onChange={(e) => field.onChange(e.target.value)}
                                      />
                                    </FormControl>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant={"outline"} size="icon" className="w-10 shrink-0" disabled={isUscfNew}>
                                          <CalendarIcon className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                          mode="single"
                                          selected={field.value instanceof Date ? field.value : undefined}
                                          onSelect={field.onChange}
                                          disabled={isUscfNew}
                                          captionLayout="dropdown-buttons"
                                          fromYear={new Date().getFullYear() - 2}
                                          toYear={new Date().getFullYear() + 10}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Player Email</FormLabel><FormControl><Input type="email" placeholder="player@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Player Phone Number (Optional)</FormLabel><FormControl><Input type="tel" placeholder="(555) 555-5555" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={form.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Player Zip Code</FormLabel><FormControl><Input placeholder="78501" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a state" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {formStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {profile?.district === 'PHARR-SAN JUAN-ALAMO ISD' && (
                              <FormField control={form.control} name="studentType" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Student Type (PSJA Only)</FormLabel>
                                    <FormControl>
                                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4 pt-2">
                                        <FormItem className="flex items-center space-x-2">
                                          <FormControl><RadioGroupItem value="gt" id={`gt-radio-${editingPlayer?.id || 'new'}`} /></FormControl>
                                          <FormLabel htmlFor={`gt-radio-${editingPlayer?.id || 'new'}`} className="font-normal cursor-pointer">GT Student</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2">
                                          <FormControl><RadioGroupItem value="independent" id={`ind-radio-${editingPlayer?.id || 'new'}`} /></FormControl>
                                          <FormLabel htmlFor={`ind-radio-${editingPlayer?.id || 'new'}`} className="font-normal cursor-pointer">Independent</FormLabel>
                                        </FormItem>
                                      </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                              )} />
                            )}
                        </div>
                    </form>
                </Form>
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" form="player-form">{editingPlayer ? 'Save Changes' : 'Add Player'}</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {playerToDelete?.firstName} {playerToDelete?.lastName} from your roster. They will not be deleted from the master database and can be added again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Remove From Roster</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
