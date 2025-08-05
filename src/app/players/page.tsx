

'use client';

import { useState, useMemo, useRef, useCallback, Suspense } from 'react';
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
  CardFooter,
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
  Info,
  Download,
  Upload,
  Trash2
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
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
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
  'Championship': 12, // Open to all, so it's always valid
};

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, { message: "First Name is required." }),
  middleName: z.string().optional(),
  lastName: z.string().min(1, { message: "Last Name is required." }),
  uscfId: z.string().min(1, { message: "USCF ID is required." }),
  uscfExpiration: z.date().optional(),
  regularRating: z.preprocess(
    (val) => (String(val).toUpperCase() === 'UNR' || val === '' ? undefined : val),
    z.coerce.number({invalid_type_error: "Rating must be a number or UNR."}).optional()
  ),
  quickRating: z.string().optional(),
  grade: z.string().optional(),
  section: z.string().optional(),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  dob: z.date().optional(),
  zipCode: z.string().optional(),
  studentType: z.string().optional(),
  state: z.string().optional(),
  school: z.string().min(1, { message: "School name is required."}),
  district: z.string().min(1, { message: "District name is required."}),
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
type SortableColumnKey = 'lastName' | 'school' | 'uscfId' | 'regularRating' | 'grade' | 'state' | 'uscfExpiration' | 'events';

function PlayersPageContent() {
  const { toast } = useToast();
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>(null);
  
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchUscfId, setSearchUscfId] = useState('');
  const [searchState, setSearchState] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 50;

  const { profile } = useSponsorProfile();
  const { database: allPlayers, addPlayer, updatePlayer, deletePlayer, isDbLoaded, dbPlayerCount, dbStates, setDatabase } = useMasterDb();
  
  const formStates = useMemo(() => {
    if (isDbLoaded) {
        const states = new Set(allPlayers.map(p => p.state).filter(Boolean) as string[]);
        return Array.from(states).sort();
    }
    return [];
  }, [isDbLoaded, allPlayers]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      uscfId: '',
      regularRating: undefined,
      quickRating: '',
      uscfExpiration: undefined,
      dob: undefined,
      grade: '',
      section: '',
      email: '',
      phone: '',
      zipCode: '',
      studentType: undefined,
      state: '',
      school: '',
      district: '',
    }
  });

  const watchUscfId = form.watch('uscfId');

  useEffect(() => {
    if (isPlayerDialogOpen) {
      if (editingPlayer) {
        form.reset({
          ...editingPlayer,
          dob: editingPlayer.dob ? new Date(editingPlayer.dob) : undefined,
          uscfExpiration: editingPlayer.uscfExpiration ? new Date(editingPlayer.uscfExpiration) : undefined,
        });
      } else {
        form.reset({
          firstName: '',
          middleName: '',
          lastName: '',
          uscfId: '',
          regularRating: undefined,
          quickRating: '',
          uscfExpiration: undefined,
          dob: undefined,
          grade: '',
          section: '',
          email: '',
          phone: '',
          zipCode: '',
          studentType: undefined,
          state: '',
          school: 'Independent',
          district: 'None',
        });
      }
    }
  }, [isPlayerDialogOpen, editingPlayer, form]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFirstName, searchLastName, searchUscfId, searchState]);
  
  const filteredPlayers = useMemo(() => {
    if (!isDbLoaded) return [];

    const lowerFirstName = searchFirstName.toLowerCase();
    const lowerLastName = searchLastName.toLowerCase();

    if (!lowerFirstName && !lowerLastName && !searchUscfId && searchState === 'ALL') {
        return allPlayers;
    }

    // Debounced search can be implemented here if performance is an issue
    return allPlayers.filter(player => {
        const stateMatch = searchState === 'ALL' 
            || (searchState === 'NO_STATE' && !player.state)
            || player.state === searchState;
        const firstNameMatch = !lowerFirstName || player.firstName?.toLowerCase().includes(lowerFirstName);
        const lastNameMatch = !lowerLastName || player.lastName?.toLowerCase().includes(lowerLastName);
        const uscfIdMatch = !searchUscfId || player.uscfId?.includes(searchUscfId);

        return stateMatch && firstNameMatch && lastNameMatch && uscfIdMatch;
    });
  }, [isDbLoaded, allPlayers, searchFirstName, searchLastName, searchUscfId, searchState]);

  const sortedPlayers = useMemo(() => {
    const sortablePlayers = [...filteredPlayers];
    if (sortConfig) {
      sortablePlayers.sort((a, b) => {
        const key = sortConfig.key;
        let aVal: any = a[key as keyof MasterPlayer] ?? '';
        let bVal: any = b[key as keyof MasterPlayer] ?? '';
        let result = 0;

        if (key === 'grade' && typeof a.grade === 'string' && typeof b.grade === 'string') {
          aVal = gradeToNumber[a.grade] ?? -1;
          bVal = gradeToNumber[b.grade] ?? -1;
        } else if (key === 'regularRating') {
          aVal = a.regularRating ?? -Infinity;
          bVal = b.regularRating ?? -Infinity;
        } else if (key === 'uscfExpiration') {
          aVal = a.uscfExpiration ? new Date(a.uscfExpiration).getTime() : 0;
          bVal = b.uscfExpiration ? new Date(b.uscfExpiration).getTime() : 0;
        } else if (key === 'events') {
          aVal = a.events;
          bVal = b.events;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            result = aVal.localeCompare(bVal);
        } else {
            if (aVal < bVal) result = -1;
            if (aVal > bVal) result = 1;
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
  }, [filteredPlayers, sortConfig]);

  const totalPages = useMemo(() => {
    if (sortedPlayers.length === 0) return 1;
    return Math.ceil(sortedPlayers.length / ROWS_PER_PAGE);
  }, [sortedPlayers]);

  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    return sortedPlayers.slice(startIndex, endIndex);
  }, [sortedPlayers, currentPage]);

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
    form.reset();
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
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from the master database.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  function onSubmit(values: PlayerFormValues) {
    if (values.uscfId.toUpperCase() !== 'NEW') {
      const existingPlayerWithUscfId = allPlayers.find(p => 
        p.uscfId?.toLowerCase() === values.uscfId.toLowerCase() && p.id !== values.id
      );

      if (existingPlayerWithUscfId) {
        form.setError("uscfId", { 
          type: "manual", 
          message: `USCF ID already assigned to ${existingPlayerWithUscfId.firstName} ${existingPlayerWithUscfId.lastName}.` 
        });
        return;
      }
    }
    
    const { uscfExpiration, dob, ...restOfValues } = values;

    const playerRecord: MasterPlayer = {
      ...editingPlayer, 
      ...restOfValues,
      id: editingPlayer?.id || `p-${Date.now()}`,
      dob: dob?.toISOString(),
      uscfExpiration: uscfExpiration?.toISOString(),
      events: editingPlayer?.events || 0,
      eventIds: editingPlayer?.eventIds || [],
    };

    if (editingPlayer) {
      updatePlayer(playerRecord);
      toast({ title: "Player Updated", description: `${values.firstName} ${values.lastName}'s information has been updated.`});
    } else {
      addPlayer(playerRecord);
      toast({ title: "Player Added", description: `${values.firstName} ${values.lastName} has been added to the master database.`});
    }
    setIsPlayerDialogOpen(false);
    setEditingPlayer(null);
  }
  
  const playerDistrict = form.watch('district');
  const showStudentType = profile?.role === 'organizer' && playerDistrict === 'PSJA ISD';


  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">All Players</h1>
          <p className="text-muted-foreground">
            Manage the master database of all players in the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={handleAddPlayer}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Player
            </Button>
        </div>
      </div>
      
      <Card>
          <CardHeader>
              <CardTitle>Master Player Database</CardTitle>
              <div className="text-sm text-muted-foreground">
                  There are currently {isDbLoaded ? dbPlayerCount.toLocaleString() : <div className="animate-pulse rounded-md bg-muted h-4 w-20 inline-block" />} players in the database. Use the fields below to filter the list.
              </div>
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                      <Label htmlFor="search-state">State</Label>
                      <Select value={searchState} onValueChange={setSearchState}>
                          <SelectTrigger id="search-state">
                              <SelectValue placeholder="All States" />
                          </SelectTrigger>
                          <SelectContent>
                              {dbStates.map(s => (
                                  <SelectItem key={s} value={s}>
                                      {s === 'ALL' ? 'All States' : s === 'NO_STATE' ? 'No State' : s}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="search-first-name">First Name</Label>
                      <Input
                          id="search-first-name"
                          placeholder="Filter by first name..."
                          value={searchFirstName}
                          onChange={e => setSearchFirstName(e.target.value)}
                      />
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="search-last-name">Last Name</Label>
                      <Input
                          id="search-last-name"
                          placeholder="Filter by last name..."
                          value={searchLastName}
                          onChange={e => setSearchLastName(e.target.value)}
                      />
                  </div>
                  <div className="space-y-1">
                      <Label htmlFor="search-uscf-id">USCF ID</Label>
                      <Input
                          id="search-uscf-id"
                          placeholder="Filter by USCF ID..."
                          value={searchUscfId}
                          onChange={e => setSearchUscfId(e.target.value)}
                      />
                  </div>
              </div>
          </CardHeader>
          <CardContent>
              <ScrollArea className="h-[60vh]">
                  <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                              <TableHead className="p-0">
                                  <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('lastName')}>
                                      Player {getSortIcon('lastName')}
                                  </Button>
                              </TableHead>
                              <TableHead className="p-0">
                                  <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('school')}>
                                      School / District {getSortIcon('school')}
                                  </Button>
                              </TableHead>
                              <TableHead className="p-0">
                                  <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('uscfId')}>
                                      USCF ID {getSortIcon('uscfId')}
                                  </Button>
                              </TableHead>
                              <TableHead className="p-0">
                                  <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('uscfExpiration')}>
                                      Expiration {getSortIcon('uscfExpiration')}
                                  </Button>
                              </TableHead>
                              <TableHead className="p-0">
                                  <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('regularRating')}>
                                      Rating {getSortIcon('regularRating')}
                                  </Button>
                              </TableHead>
                               <TableHead className="p-0">
                                  <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('events')}>
                                      Events {getSortIcon('events')}
                                  </Button>
                              </TableHead>
                              <TableHead>
                                  <span className="sr-only">Actions</span>
                              </TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {paginatedPlayers.map((player) => (
                          <TableRow key={player.id}>
                              <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                  <AvatarImage src={`https://placehold.co/40x40.png`} alt={`${player.firstName} ${player.lastName}`} data-ai-hint="person face" />
                                  <AvatarFallback>{player.firstName?.charAt(0)}{player.lastName?.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                  {`${player.lastName}, ${player.firstName} ${player.middleName || ''}`.trim()}
                                  <div className="text-sm text-muted-foreground">{player.email}</div>
                                  </div>
                              </div>
                              </TableCell>
                              <TableCell>
                                  <div>
                                      <p className="font-medium">{player.school}</p>
                                      <p className="text-sm text-muted-foreground">{player.district}</p>
                                  </div>
                              </TableCell>
                              <TableCell>{player.uscfId}</TableCell>
                              <TableCell>{player.uscfExpiration ? format(new Date(player.uscfExpiration), 'PPP') : 'N/A'}</TableCell>
                              <TableCell>{player.regularRating === undefined ? 'UNR' : player.regularRating}</TableCell>
                              <TableCell>{player.events}</TableCell>
                              <TableCell className="text-right">
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
              </ScrollArea>
          </CardContent>
          <CardFooter className="flex items-center justify-between pt-6">
              <div className="text-sm text-muted-foreground">
                  Showing <strong>{paginatedPlayers.length > 0 ? (currentPage - 1) * ROWS_PER_PAGE + 1 : 0}</strong> to <strong>{Math.min(currentPage * ROWS_PER_PAGE, sortedPlayers.length)}</strong> of <strong>{sortedPlayers.length.toLocaleString()}</strong> players
              </div>
              <div className="flex items-center gap-2">
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                  >
                      Previous
                  </Button>
                  <span className="text-sm font-medium">
                      Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
                  </span>
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                  >
                      Next
                  </Button>
              </div>
          </CardFooter>
      </Card>

       <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <DialogTitle>{editingPlayer ? 'Edit Player' : 'Add New Player'}</DialogTitle>
                <DialogDescription>
                    {editingPlayer ? "Update the player's information." : "Enter player details manually."}
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6">
                <Form {...form}>
                    <form id="player-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input placeholder="Michael" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="school" render={({ field }) => ( <FormItem><FormLabel>School</FormLabel><FormControl><Input placeholder="e.g., Lincoln High School" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="district" render={({ field }) => ( <FormItem><FormLabel>District</FormLabel><FormControl><Input placeholder="e.g., Lincoln ISD" {...field} /></FormControl><FormMessage /></FormItem> )} />
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
                                        className="text-sm font-bold text-primary hover:text-primary/80"
                                    >
                                        Use the USCF Player Search to verify an ID.
                                    </Link>
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="1500 or UNR" {...field} value={field.value ?? ''} disabled={watchUscfId.toUpperCase() === 'NEW'} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField control={form.control} name="dob" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date of Birth (Optional)</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant={"outline"}
                                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                            >
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                            captionLayout="dropdown-buttons"
                                            fromYear={new Date().getFullYear() - 100}
                                            toYear={new Date().getFullYear()}
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="uscfExpiration" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>USCF Expiration</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant={"outline"}
                                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                            disabled={watchUscfId.toUpperCase() === 'NEW'}
                                            >
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={watchUscfId.toUpperCase() === 'NEW'}
                                            captionLayout="dropdown-buttons"
                                            fromYear={new Date().getFullYear() - 2}
                                            toYear={new Date().getFullYear() + 10}
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade (Optional)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section (Optional)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Player Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="player@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Player Phone Number (Optional)</FormLabel><FormControl><Input type="tel" placeholder="(555) 555-5555" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={form.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Player Zip Code (Optional)</FormLabel><FormControl><Input placeholder="78501" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State (Optional)</FormLabel>
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
                             {showStudentType && (
                                <FormField control={form.control} name="studentType" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Student Type</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center gap-4 pt-2">
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl><RadioGroupItem value="gt" id={`gt-radio-org-${editingPlayer?.id || 'new'}`} /></FormControl>
                                            <FormLabel htmlFor={`gt-radio-org-${editingPlayer?.id || 'new'}`} className="font-normal cursor-pointer">GT Student</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl><RadioGroupItem value="independent" id={`ind-radio-org-${editingPlayer?.id || 'new'}`} /></FormControl>
                                            <FormLabel htmlFor={`ind-radio-org-${editingPlayer?.id || 'new'}`} className="font-normal cursor-pointer">Independent</FormLabel>
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
              This will permanently remove {playerToDelete?.firstName} {playerToDelete?.lastName} from the master database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function PlayersPage() {
    return (
        <AppLayout>
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <PlayersPageContent />
            </Suspense>
        </AppLayout>
    );
}

