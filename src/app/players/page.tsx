
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
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
import { lookupUscfPlayer } from '@/ai/flows/lookup-uscf-player-flow';
import { Label } from '@/components/ui/label';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { type PlayerSearchResult } from '@/ai/flows/search-uscf-players-flow';
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
  regularRating: z.coerce.number().optional(),
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
type SortableColumnKey = 'lastName' | 'school' | 'uscfId' | 'regularRating' | 'grade' | 'state';


export default function PlayersPage() {
  const { toast } = useToast();
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>(null);
  const [isLookingUpUscfId, setIsLookingUpUscfId] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 50;

  // States for player search
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchState, setSearchState] = useState('ALL');
  
  const { profile } = useSponsorProfile();
  const { database: allPlayers, setDatabase: setAllPlayers, isDbLoaded, dbPlayerCount, searchPlayers } = useMasterDb();
  
  const dbStates = useMemo(() => {
    if (isDbLoaded) {
        const states = new Set(allPlayers.map(p => p.state).filter(Boolean) as string[]);
        return ['ALL', ...Array.from(states).sort()];
    }
    return ['ALL'];
  }, [isDbLoaded, allPlayers]);
  
  const formStates = useMemo(() => {
    if (isDbLoaded) {
        const states = new Set(allPlayers.map(p => p.state).filter(Boolean) as string[]);
        return Array.from(states).sort();
    }
    return [];
  }, [isDbLoaded, allPlayers]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker>();
  const [isImporting, setIsImporting] = useState(false);
  const toastControlsRef = useRef<{ id: string; dismiss: () => void; update: (props: any) => void; } | null>(null);

  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    // Use a timeout to ensure the UI updates to show the "Preparing" toast before starting heavy work.
    setTimeout(() => {
      toastControlsRef.current = toast({
          title: 'Preparing Import...',
          description: 'This may take a moment for large files.',
          duration: Infinity,
      });

      // Pass the existing DB state to the worker for merging
      workerRef.current?.postMessage({ file, existingPlayers: allPlayers });
    }, 50);

    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }, [toast, allPlayers]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('@/workers/importer-worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (event) => {
        const { players, error } = event.data;

        if (error) {
            setIsImporting(false);
            if (toastControlsRef.current) toastControlsRef.current.dismiss();
            toast({ variant: 'destructive', title: 'Import Error', description: `Failed to parse file: ${error}`, duration: 10000 });
            return;
        }

        const totalToSave = players.length;
        if (toastControlsRef.current) {
            toastControlsRef.current.update({ id: toastControlsRef.current.id, title: 'Parsing Complete', description: `Parsed ${totalToSave.toLocaleString()} players. Now saving to database...` });
        }
        
        (async () => {
            try {
                await setAllPlayers(players, (saved, total) => {
                    if (toastControlsRef.current) {
                        toastControlsRef.current.update({
                            id: toastControlsRef.current.id,
                            title: 'Saving to Database...',
                            description: `Parsed: ${total.toLocaleString()} | Saved: ${saved.toLocaleString()} of ${total.toLocaleString()}`
                        });
                    }
                });
                let title = 'Import Complete!';
                let description = `The database now contains ${players.length.toLocaleString()} players.`;

                if (toastControlsRef.current) {
                  toastControlsRef.current.update({ id: toastControlsRef.current.id, title: title, description: description, duration: 10000 });
                }
            } catch(err) {
                if (toastControlsRef.current) {
                   toastControlsRef.current.update({ id: toastControlsRef.current.id, variant: 'destructive', title: 'Database Save Error', description: err instanceof Error ? err.message : 'An unknown error occurred.', duration: 10000 });
                }
            } finally { 
              setIsImporting(false);
              toastControlsRef.current = null;
            }
        })();
    };

    workerRef.current.onerror = (e) => {
        console.error("Worker error:", e);
        if (toastControlsRef.current) {
            toastControlsRef.current.update({ id: toastControlsRef.current.id, variant: 'destructive', title: 'Import Failed', description: 'A worker error occurred. Please check the console.', duration: 10000 });
        }
        setIsImporting(false);
        toastControlsRef.current = null;
    }

    return () => { 
        workerRef.current?.terminate();
    };
  }, [setAllPlayers, toast]);
  
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
        setSearchFirstName('');
        setSearchLastName('');
        setSearchResults([]);
      }
    }
  }, [isPlayerDialogOpen, editingPlayer, form]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterText]);
  
  const filteredPlayers = useMemo(() => {
    if (!filterText) return allPlayers;
    const lowercasedFilter = filterText.toLowerCase();
    return allPlayers.filter(player => {
        return (
            player.firstName.toLowerCase().includes(lowercasedFilter) ||
            player.lastName.toLowerCase().includes(lowercasedFilter) ||
            player.uscfId.includes(lowercasedFilter) ||
            player.school.toLowerCase().includes(lowercasedFilter) ||
            player.district.toLowerCase().includes(lowercasedFilter)
        );
    });
  }, [allPlayers, filterText]);

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
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            result = aVal.localeCompare(bVal);
        } else {
            if (aVal < bVal) result = -1;
            if (aVal > bVal) result = 1;
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

  const watchUscfId = form.watch('uscfId');
  const isUscfNew = watchUscfId.toUpperCase() === 'NEW';

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
      setAllPlayers(allPlayers.filter(p => p.id !== playerToDelete.id));
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from the master database.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  const handleUscfLookup = async () => {
    const uscfId = form.getValues('uscfId');
    if (!uscfId || uscfId.toUpperCase() === 'NEW') {
        toast({
            variant: "destructive",
            title: "Invalid USCF ID",
            description: "Please enter a valid USCF ID to look up.",
        });
        return;
    }

    setIsLookingUpUscfId(true);
    try {
        const result = await lookupUscfPlayer({ uscfId });
        if (result.error) {
            console.error("USCF Lookup Error:", result.error);
            toast({ variant: "destructive", title: "Lookup Failed", description: result.error });
        } else {
            if (result.rating !== undefined) {
                form.setValue('regularRating', result.rating, { shouldValidate: true });
            }
            if (result.expirationDate) {
                const expDate = new Date(result.expirationDate);
                const adjustedDate = new Date(expDate.getTime() + expDate.getTimezoneOffset() * 60000);
                form.setValue('uscfExpiration', adjustedDate, { shouldValidate: true });
            }
            
            if (!form.getValues('firstName') && result.firstName) {
                form.setValue('firstName', result.firstName);
            }
            if (!form.getValues('lastName') && result.lastName) {
                form.setValue('lastName', result.lastName);
            }
            if (!form.getValues('middleName') && result.middleName) {
                form.setValue('middleName', result.middleName);
            }
            if (result.state) {
                form.setValue('state', result.state, { shouldValidate: true });
            }

            toast({ title: "Lookup Successful", description: `Updated details for ${[result.firstName, result.lastName].join(' ')}.` });
        }
    } catch (error) {
        console.error("USCF Lookup Flow Error:", error);
        const description = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Lookup Failed", description });
    } finally {
        setIsLookingUpUscfId(false);
    }
  };

  function onSubmit(values: PlayerFormValues) {
    if (values.uscfId.toUpperCase() !== 'NEW') {
      const existingPlayerWithUscfId = allPlayers.find(p => 
        p.uscfId.toLowerCase() === values.uscfId.toLowerCase() && p.id !== values.id
      );

      if (existingPlayerWithUscfId) {
        form.setError("uscfId", { 
          type: "manual", 
          message: `USCF ID already assigned to ${existingPlayerWithUscfId.firstName} ${existingPlayerWithUscfId.lastName}.` 
        });
        return;
      }
    }
    
    const playerRecord: MasterPlayer = {
      ...editingPlayer, // Preserve fields not in the form like events
      ...values,
      id: editingPlayer?.id || `p-${Date.now()}`,
      dob: values.dob?.toISOString(),
      uscfExpiration: values.uscfExpiration?.toISOString(),
      events: editingPlayer?.events || 0,
      eventIds: editingPlayer?.eventIds || [],
    };

    if (editingPlayer) {
      setAllPlayers(allPlayers.map(p => p.id === editingPlayer.id ? playerRecord : p));
      toast({ title: "Player Updated", description: `${values.firstName} ${values.lastName}'s information has been updated.`});
    } else {
      setAllPlayers([...allPlayers, playerRecord]);
      toast({ title: "Player Added", description: `${values.firstName} ${values.lastName} has been added to the master database.`});
    }
    setIsPlayerDialogOpen(false);
    setEditingPlayer(null);
  }
  
  const handlePerformSearch = useCallback(async () => {
    if (!searchLastName && !searchFirstName) {
        toast({ variant: 'destructive', title: 'Name Required', description: 'Please enter a first or last name to search.' });
        return;
    }
    setIsSearching(true);
    setSearchResults([]);
    try {
        const results = await searchPlayers({
            firstName: searchFirstName,
            lastName: searchLastName,
            state: searchState
        });

        const mappedResults: PlayerSearchResult[] = results.map(p => ({
            uscfId: p.uscfId,
            firstName: p.firstName,
            lastName: p.lastName,
            middleName: p.middleName,
            rating: p.regularRating,
            state: p.state,
            expirationDate: p.uscfExpiration ? format(new Date(p.uscfExpiration), 'yyyy-MM-dd') : undefined,
            quickRating: p.quickRating
        }));

        setSearchResults(mappedResults.slice(0, 50));
        
    } catch (e) {
        const description = e instanceof Error ? e.message : 'An unknown error occurred.';
        toast({ variant: 'destructive', title: 'Search Failed', description: description });
    } finally {
        setIsSearching(false);
    }
  }, [searchFirstName, searchLastName, searchState, searchPlayers, toast]);
  
  const handleSelectSearchedPlayer = (player: PlayerSearchResult) => {
    form.reset(); // Clear previous form state
    form.setValue('firstName', player.firstName || '');
    form.setValue('lastName', player.lastName || '');
    form.setValue('middleName', player.middleName || '');
    form.setValue('uscfId', player.uscfId || '');
    form.setValue('regularRating', player.rating);
    form.setValue('quickRating', player.quickRating || '');
    form.setValue('state', player.state || '');
    
    if (player.expirationDate) {
        const expDate = parse(player.expirationDate, 'yyyy-MM-dd', new Date());
        if (isValid(expDate)) {
            form.setValue('uscfExpiration', expDate);
        }
    }
    
    setSearchResults([]);
    setSearchFirstName('');
    setSearchLastName('');
    toast({ title: 'Player Selected', description: `${player.firstName} ${player.lastName}'s data has been auto-filled.` });
  };
  

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline">All Players</h1>
            <p className="text-muted-foreground">
              Manage the master database of all players in the system.
            </p>
          </div>
          <div className="flex items-center gap-2">
             <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.tsv"
              onChange={handleFileImport}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import Database (.txt)
            </Button>
            <Button onClick={handleAddPlayer}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Player
            </Button>
          </div>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Master Player Database</CardTitle>
                <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      There are currently {isDbLoaded ? dbPlayerCount.toLocaleString() : <Skeleton className="h-4 w-20 inline-block" />} players in the database.
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter players by name, ID, school..."
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            className="pl-10"
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
                                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('regularRating')}>
                                        Rating {getSortIcon('regularRating')}
                                    </Button>
                                </TableHead>
                                <TableHead className="p-0">
                                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('state')}>
                                        State {getSortIcon('state')}
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
                                    <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
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
                                <TableCell>{player.regularRating || 'N/A'}</TableCell>
                                <TableCell>{player.state}</TableCell>
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
      </div>

       <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <DialogTitle>{editingPlayer ? 'Edit Player' : 'Add New Player'}</DialogTitle>
                <DialogDescription>
                    {editingPlayer ? "Update the player's information." : "Search the database or enter details manually."}
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                    <Card className="bg-muted/50">
                        <CardHeader>
                            <CardTitle className="text-base">Player Database Search</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label>State</Label>
                                    <Select value={searchState} onValueChange={setSearchState}>
                                        <SelectTrigger><SelectValue placeholder="All States" /></SelectTrigger>
                                        <SelectContent>
                                            {dbStates.map(s => <SelectItem key={s} value={s}>{s === 'ALL' ? 'All States' : s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label>First Name (Optional)</Label>
                                    <Input placeholder="John" value={searchFirstName} onChange={e => setSearchFirstName(e.target.value)} />
                                </div>
                                <div className='space-y-2'>
                                    <Label>Last Name</Label>
                                    <Input placeholder="Smith" value={searchLastName} onChange={e => setSearchLastName(e.target.value)} />
                                </div>
                                <Button onClick={handlePerformSearch} disabled={isSearching}>
                                    {isSearching ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Search className='mr-2 h-4 w-4' />}
                                    Search
                                </Button>
                            </div>
                            
                            {searchResults.length > 0 && (
                                <Card className="w-full mt-4 max-h-48 overflow-y-auto">
                                    <CardContent className="p-2">
                                      {searchResults.map(p => (
                                          <button
                                              key={p.uscfId}
                                              type="button"
                                              className="w-full text-left p-2 hover:bg-accent rounded-md"
                                              onClick={() => handleSelectSearchedPlayer(p)}
                                          >
                                              <p className="font-medium">{p.firstName} {p.lastName} ({p.state})</p>
                                              <p className="text-sm text-muted-foreground">ID: {p.uscfId} | Rating: {p.rating || 'N/A'}</p>
                                          </button>
                                      ))}
                                      {searchResults.length > 1 && (
                                          <Alert variant="default" className="mt-2">
                                              <Info className="h-4 w-4" />
                                              <AlertTitle>Multiple Results</AlertTitle>
                                              <AlertDescription>
                                                  Multiple players match this name. Please verify the correct player on the official USCF website if needed.
                                              </AlertDescription>
                                          </Alert>
                                      )}
                                    </CardContent>
                                </Card>
                            )}
                        </CardContent>
                    </Card>

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
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            <Input placeholder="12345678 or NEW" {...field} />
                                        </FormControl>
                                        <Button type="button" variant="outline" onClick={handleUscfLookup} disabled={isLookingUpUscfId || isUscfNew || !watchUscfId}>
                                            {isLookingUpUscfId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
                                        </Button>
                                    </div>
                                    <FormDescription>
                                        Students without a USCF ID can be added with &quot;NEW&quot;.
                                    </FormDescription>
                                    <FormDescription>
                                        <Link href="https://new.uschess.org/player-search" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                            Find USCF ID on the official USCF website
                                        </Link>
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="number" placeholder="1500" {...field} value={field.value ?? ''} disabled={isUscfNew} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="dob" render={({ field }) => {
                                    const [inputValue, setInputValue] = useState<string>( field.value ? format(field.value, "MM/dd/yyyy") : "" );
                                    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
                                    useEffect(() => { field.value ? setInputValue(format(field.value, "MM/dd/yyyy")) : setInputValue(""); }, [field.value]);
                                    const handleBlur = () => {
                                        const parsedDate = parse(inputValue, "MM/dd/yyyy", new Date());
                                        if (isValid(parsedDate)) {
                                            if (parsedDate <= new Date() && parsedDate >= new Date("1900-01-01")) { field.onChange(parsedDate); } 
                                            else { setInputValue(field.value ? format(field.value, "MM/dd/yyyy") : ""); }
                                        } else {
                                            if (inputValue === "") { field.onChange(undefined); } 
                                            else { setInputValue(field.value ? format(field.value, "MM/dd/yyyy") : ""); }
                                        }
                                    };
                                    return (
                                        <FormItem className="flex flex-col"><FormLabel>Date of Birth (Optional)</FormLabel>
                                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                            <div className="relative">
                                            <FormControl><Input placeholder="MM/DD/YYYY" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onBlur={handleBlur} /></FormControl>
                                            <PopoverTrigger asChild><Button variant={"ghost"} className="absolute right-0 top-0 h-full w-10 p-0 font-normal" aria-label="Open calendar"><CalendarIcon className="h-4 w-4 text-muted-foreground" /></Button></PopoverTrigger>
                                            </div>
                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsCalendarOpen(false); }} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent>
                                        </Popover><FormMessage /></FormItem>
                                    );
                                }} />
                                <FormField control={form.control} name="uscfExpiration" render={({ field }) => {
                                    const [inputValue, setInputValue] = useState<string>( field.value ? format(field.value, "MM/dd/yyyy") : "" );
                                    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
                                    useEffect(() => { if (field.value) { setInputValue(format(field.value, "MM/dd/yyyy")); } else { setInputValue(""); } }, [field.value]);
                                    const handleBlur = () => {
                                      const parsedDate = parse(inputValue, "MM/dd/yyyy", new Date());
                                      if (isValid(parsedDate)) {
                                        field.onChange(parsedDate);
                                      } else {
                                        if (inputValue === "") { field.onChange(undefined); } 
                                        else { setInputValue(field.value ? format(field.value, "MM/dd/yyyy") : ""); }
                                      }
                                    };
                                    return (
                                      <FormItem className="flex flex-col"><FormLabel>USCF Expiration</FormLabel>
                                         <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                           <div className="relative">
                                            <FormControl><Input placeholder="MM/DD/YYYY" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onBlur={handleBlur} disabled={isUscfNew} /></FormControl>
                                             <PopoverTrigger asChild>
                                              <Button variant={"ghost"} className="absolute right-0 top-0 h-full w-10 p-0 font-normal" aria-label="Open calendar" disabled={isUscfNew}>
                                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                              </Button>
                                            </PopoverTrigger>
                                          </div>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsCalendarOpen(false); }} initialFocus disabled={isUscfNew} />
                                          </PopoverContent>
                                        </Popover><FormMessage /></FormItem>
                                    );
                                }} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade (Optional)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section (Optional)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Player Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="player@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Player Phone Number (Optional)</FormLabel><FormControl><Input type="tel" placeholder="(555) 555-5555" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            </div>
                        </form>
                    </Form>
                </div>
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
              This will permanently remove {playerToDelete?.firstName} {playerToDelete?.lastName} from the master database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
