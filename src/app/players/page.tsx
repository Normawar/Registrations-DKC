
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Papa from 'papaparse';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { PlusCircle, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { districts as allDistricts } from '@/lib/data/districts';
import { schoolData } from '@/lib/data/school-data';
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { getMasterDatabase, setMasterDatabase, type ImportedPlayer } from '@/lib/data/master-player-store';


type Player = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  uscfId: string;
  regularRating?: number;
  quickRating?: string;
  school: string;
  district: string;
  events: number;
  eventIds: string[];
  expirationDate?: string;
  state?: string;
};


const initialPlayersData: Player[] = [
  { id: "p1", firstName: "Liam", middleName: "J", lastName: "Johnson", uscfId: "12345678", regularRating: 1850, quickRating: '1900/10', school: "Independent", district: "None", events: 2, eventIds: ['e2'], expirationDate: '12/31/2025', state: 'TX' },
  { id: "p2", firstName: "Olivia", middleName: "K", lastName: "Smith", uscfId: "87654321", regularRating: 2100, quickRating: '2120/5', school: "City Chess Club", district: "None", events: 3, eventIds: ['e1', 'e3'], expirationDate: '06/30/2026', state: 'CA' },
  { id: "p3", firstName: "Noah", middleName: "L", lastName: "Williams", uscfId: "11223344", regularRating: 1600, quickRating: '1650/12', school: "Scholastic Stars", district: "None", events: 1, eventIds: ['e1'], expirationDate: '01/01/2025', state: 'NY' },
  { id: "p4", firstName: "Emma", middleName: "M", lastName: "Brown", uscfId: "44332211", regularRating: 1950, quickRating: '2000/20', school: "Independent", district: "None", events: 1, eventIds: ['e2'], expirationDate: '03/15/2025', state: 'FL' },
  { id: "p5", firstName: "James", middleName: "N", lastName: "Jones", uscfId: "55667788", regularRating: 2200, quickRating: '2250/15', school: "Grandmasters Inc.", district: "None", events: 4, eventIds: ['e1', 'e2', 'e3'], expirationDate: '11/20/2024', state: 'IL' },
  { id: "p6", firstName: "Alex", middleName: "S", lastName: "Ray", uscfId: "98765432", regularRating: 1750, quickRating: '1780/8', school: "SHARYLAND PIONEER H S", district: "SHARYLAND ISD", events: 2, eventIds: ['e1'], expirationDate: '08/01/2025', state: 'TX' },
  { id: "p7", firstName: "Jordan", middleName: "T", lastName: "Lee", uscfId: "23456789", regularRating: 2050, quickRating: '2080/7', school: "SHARYLAND PIONEER H S", district: "SHARYLAND ISD", events: 3, eventIds: ['e1', 'e2'], expirationDate: '09/09/2024', state: 'TX' },
];

const allEvents = [
  { id: 'e1', name: 'Spring Open 2024' },
  { id: 'e2', name: 'Summer Championship' },
  { id: 'e3', name: 'Autumn Classic' },
];


type SortableColumnKey = 'name' | 'uscfId' | 'regularRating' | 'school' | 'district' | 'events';

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First Name is required."),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last Name is required."),
  district: z.string().min(1, "District is required."),
  school: z.string().min(1, "School is required."),
  uscfId: z.string().min(1, "USCF ID is required."),
  regularRating: z.coerce.number().optional(),
  quickRating: z.string().optional(),
});
type PlayerFormValues = z.infer<typeof playerFormSchema>;


export default function PlayersPage() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    try {
        const stored = localStorage.getItem('all_players_master_db');
        if (stored) {
            setPlayers(JSON.parse(stored));
        } else {
            setPlayers(initialPlayersData);
        }
    } catch (e) {
        setPlayers(initialPlayersData);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
        localStorage.setItem('all_players_master_db', JSON.stringify(players));
    }
  }, [players, isLoaded]);
  
  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      district: '',
      school: '',
      uscfId: '',
      regularRating: undefined,
      quickRating: '',
    },
  });
  
  useEffect(() => {
    if (editingPlayer) {
      form.reset({
        id: editingPlayer.id,
        firstName: editingPlayer.firstName,
        middleName: editingPlayer.middleName || '',
        lastName: editingPlayer.lastName,
        district: editingPlayer.district,
        school: editingPlayer.school,
        uscfId: editingPlayer.uscfId,
        regularRating: editingPlayer.regularRating,
        quickRating: editingPlayer.quickRating || '',
      });
      handleDistrictChange(editingPlayer.district, true);
    } else {
      form.reset();
    }
  }, [editingPlayer, form]);

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setIsDialogOpen(true);
  };
  
  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setIsDialogOpen(true);
  };

  const handleDeletePlayer = (player: Player) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };

  const confirmDelete = () => {
    if (playerToDelete) {
        setPlayers(prev => prev.filter(p => p.id !== playerToDelete.id));
        toast({ title: "Player Removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed.`});
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };
  
  const handleDistrictChange = (district: string, isEditing = false) => {
    if (!isEditing) {
        form.setValue('school', '');
    }
    form.setValue('district', district);
    if (district === 'None') {
        setSchoolsForDistrict(['Independent']);
        if (!isEditing) {
            form.setValue('school', 'Independent');
        }
    } else {
        const filteredSchools = schoolData
        .filter((school) => school.district === district)
        .map((school) => school.schoolName)
        .sort();
        setSchoolsForDistrict(filteredSchools);
    }
  };

  function onSubmit(values: PlayerFormValues) {
    if (editingPlayer) {
      // Update existing player
      setPlayers(prev => prev.map(p => 
        p.id === editingPlayer.id ? { ...p, ...values } : p
      ));
      toast({ title: "Player Updated", description: `${values.firstName} ${values.lastName}'s data has been updated.`});
    } else {
      // Add new player
      const newPlayer: Player = {
        id: `p-${Date.now()}`,
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        uscfId: values.uscfId,
        regularRating: values.regularRating || 0,
        quickRating: values.quickRating || '',
        district: values.district,
        school: values.school,
        events: 0,
        eventIds: [],
      };
      setPlayers(prev => [...prev, newPlayer]);
      toast({ title: "Player Added", description: `${values.firstName} ${values.lastName} has been added.`});
    }
    setIsDialogOpen(false);
    setEditingPlayer(null);
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast({ title: 'Import Started', description: 'Processing database file in the background. This may take a moment. The page itself will not freeze.' });

    const importedPlayers: ImportedPlayer[] = [];
    let errorCount = 0;

    Papa.parse(file, {
      worker: true,
      delimiter: "\t",
      skipEmptyLines: true,
      step: (results) => {
        const row = results.data as string[];
        
        // Skip rows that don't have at least the USCF ID column.
        if (!row || row.length < 2) {
            return;
        }

        const uscfId = row[1];
        // A valid USCF ID is an 8-digit number. This check will effectively
        // skip most header, footer, or malformed non-player data rows.
        if (!/^\d{8}$/.test(uscfId)) {
            return;
        }

        try {
          // From here, we assume it's a player row and apply stricter parsing.
          if (row.length < 5) {
            console.warn('Skipping malformed player row (not enough columns):', row);
            errorCount++;
            return;
          }
        
          const namePart = row[0];
          const expirationDateStr = row[2];
          const state = row[3];
          const regularRatingString = row[4];
          const quickRatingString = row[5] || '';

          if (!namePart) {
            console.warn('Skipping malformed player row (missing name):', row);
            errorCount++;
            return;
          }

          const nameParts = namePart.split(',');
          if (nameParts.length < 2) {
            console.warn("Skipping malformed player row (name not in 'Last, First' format):", row);
            errorCount++;
            return;
          }
          const lastName = nameParts[0].trim();
          const firstAndMiddleParts = nameParts[1].trim().split(' ').filter(p => p);
          const firstName = firstAndMiddleParts.shift() || '';
          const middleName = firstAndMiddleParts.join(' ');

          if (!firstName || !lastName) {
            console.warn("Skipping malformed player row (could not parse first/last name):", row);
            errorCount++;
            return;
          }

          const regularRating = parseInt(regularRatingString?.replace('*', ''), 10) || undefined;

          const newPlayer: ImportedPlayer = {
            id: `p-${uscfId}`,
            uscfId,
            firstName,
            lastName,
            middleName: middleName || undefined,
            expirationDate: expirationDateStr,
            state: state,
            regularRating,
            quickRating: quickRatingString,
          };
          importedPlayers.push(newPlayer);
        } catch (e) {
          console.error("Error parsing a row that appeared to be a player:", row, e);
          errorCount++;
        }
      },
      complete: () => {
        const existingDb = getMasterDatabase();
        const dbMap = new Map<string, ImportedPlayer>(existingDb.map(p => [p.uscfId, p]));
        
        importedPlayers.forEach(player => {
            dbMap.set(player.uscfId, player);
        });

        const newMasterList = Array.from(dbMap.values());
        setMasterDatabase(newMasterList);
        
        setIsImporting(false);
        let description = `Database updated with ${importedPlayers.length} records. The database now contains ${newMasterList.length} unique players for this session.`;
        if (errorCount > 0) description += ` Could not parse ${errorCount} rows.`;
        
        toast({ title: 'Import Complete', description: description });
      },
      error: (error) => {
        setIsImporting(false);
        toast({ variant: 'destructive', title: 'Import Error', description: `Failed to parse file: ${error.message}` });
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const filteredAndSortedPlayers = useMemo(() => {
    let sortablePlayers = [...players];
    
    if (selectedEvent !== 'all') {
      sortablePlayers = sortablePlayers.filter(p => p.eventIds.includes(selectedEvent));
    }

    if (sortConfig) {
        sortablePlayers.sort((a, b) => {
            const key = sortConfig.key;
            let aVal: any;
            let bVal: any;
            
            if (key === 'name') {
                aVal = a.lastName;
                bVal = b.lastName;
            } else {
                aVal = a[key as keyof Player];
                bVal = b[key as keyof Player];
            }
            
            let result = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                result = aVal.localeCompare(bVal);
            } else {
                if (aVal < bVal) result = -1;
                if (aVal > bVal) result = 1;
            }
            
            if (key === 'name' && result === 0) {
                result = a.firstName.localeCompare(b.firstName);
            }

            return sortConfig.direction === 'ascending' ? result : -result;
        });
    }
    return sortablePlayers;
  }, [sortConfig, selectedEvent, players]);
  
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
  
  const selectedDistrict = form.watch('district');

  const handleExportCsv = () => {
    if (filteredAndSortedPlayers.length === 0) {
        toast({
            variant: "destructive",
            title: "No Players to Export",
            description: "There are no players in the current view to export."
        });
        return;
    }

    const headers = ['FullName', 'LastName', 'FirstName', 'MiddleName', 'USCF_ID', 'RegularRating', 'QuickRating', 'School', 'District', 'EventsCount'];

    const csvRows = filteredAndSortedPlayers.map(player => {
        const fullName = `${player.lastName}, ${player.firstName}`;
        const row = [
            fullName,
            player.lastName,
            player.firstName,
            player.middleName || '',
            player.uscfId,
            player.regularRating,
            player.quickRating,
            player.school,
            player.district,
            player.events,
        ];
        return row.map(value => {
            const stringValue = String(value ?? '').replace(/"/g, '""'); // Escape double quotes
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue}"`;
            }
            return stringValue;
        }).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const eventName = selectedEvent === 'all' 
        ? 'all_players' 
        : allEvents.find(e => e.id === selectedEvent)?.name.replace(/\s+/g, '_').toLowerCase() || 'event_players';
    const fileName = `${eventName}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
        title: "Export Successful",
        description: `${fileName} has been downloaded.`
    });
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">All Players</h1>
            <p className="text-muted-foreground">
              Manage player rosters for all events. (Organizer View)
            </p>
          </div>
          <div className="flex gap-2">
             <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.tsv"
              onChange={handleFileImport}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload Database (.txt)
            </Button>
            <Button onClick={handleExportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
            </Button>
            <Button onClick={handleAddPlayer}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Player
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter and Sort Players</CardTitle>
            <CardDescription>
                Use the filter to view players by event. Upload a tab-delimited file or CSV to load the master database for searching on the Roster page.
            </CardDescription>
            <div className="pt-2">
                 <Select onValueChange={setSelectedEvent} defaultValue="all">
                    <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Filter by event..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Players</SelectItem>
                        {allEvents.map(event => (
                            <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </CardHeader>
          <CardContent>
            {!isLoaded ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('name')}>
                            Player {getSortIcon('name')}
                        </Button>
                    </TableHead>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('uscfId')}>
                            USCF ID {getSortIcon('uscfId')}
                        </Button>
                    </TableHead>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('regularRating')}>
                            Regular Rating {getSortIcon('regularRating')}
                        </Button>
                    </TableHead>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('school')}>
                            School {getSortIcon('school')}
                        </Button>
                    </TableHead>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('district')}>
                            District {getSortIcon('district')}
                        </Button>
                    </TableHead>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('events')}>
                            # Events {getSortIcon('events')}
                        </Button>
                    </TableHead>
                    <TableHead>
                        <span className="sr-only">Actions</span>
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredAndSortedPlayers.map((player) => (
                    <TableRow key={player.id}>
                        <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                            <AvatarImage src={`https://placehold.co/40x40.png`} alt={player.firstName} data-ai-hint="person face" />
                            <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {`${player.lastName}, ${player.firstName} ${player.middleName || ''}`.trim()}
                        </div>
                        </TableCell>
                        <TableCell>{player.uscfId}</TableCell>
                        <TableCell>{player.regularRating}</TableCell>
                        <TableCell>{player.school}</TableCell>
                        <TableCell>{player.district}</TableCell>
                        <TableCell>{player.events}</TableCell>
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
                            <DropdownMenuItem onClick={() => handleEditPlayer(player)}>Edit Player</DropdownMenuItem>
                            <DropdownMenuItem>View Registrations</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeletePlayer(player)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Remove Player
                            </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlayer ? "Edit Player" : "Add New Player"}</DialogTitle>
            <DialogDescription>Fill out the details for the player.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Opt.)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District</FormLabel>
                      <Select onValueChange={(value) => handleDistrictChange(value)} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {allDistricts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedDistrict}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {schoolsForDistrict.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="uscfId" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel>USCF ID</FormLabel>
                        <FormControl><Input placeholder="12345678 or NEW" {...field} /></FormControl>
                        <FormDescription>
                            <Link href="https://new.uschess.org/player-search" target="_blank" className="text-primary underline">
                                Find USCF ID on official website
                            </Link>
                        </FormDescription>
                        <FormMessage />
                    </FormItem> 
                 )} />
                 <FormField control={form.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Regular Rating</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit">{editingPlayer ? 'Save Changes' : 'Add Player'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the player {playerToDelete?.firstName} {playerToDelete?.lastName}.
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
    </AppLayout>
  );
}
