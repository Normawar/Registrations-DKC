
'use client';

import { useState, useMemo, useRef } from "react";
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
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';

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
  state: z.string().optional(),
  expirationDate: z.string().optional(),
});
type PlayerFormValues = z.infer<typeof playerFormSchema>;


export default function PlayersPage() {
  const { toast } = useToast();
  const { database: masterDatabase, setDatabase, isDbLoaded } = useMasterDb();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 50;

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
      state: '',
      expirationDate: '',
    },
  });
  
  const openDialog = (player: MasterPlayer | null) => {
    setEditingPlayer(player);
    if (player) {
      form.reset({
        id: player.id,
        firstName: player.firstName,
        middleName: player.middleName || '',
        lastName: player.lastName,
        district: player.district,
        school: player.school,
        uscfId: player.uscfId,
        regularRating: player.regularRating,
        quickRating: player.quickRating || '',
        state: player.state || '',
        expirationDate: player.expirationDate || '',
      });
      handleDistrictChange(player.district, true);
    } else {
      form.reset();
    }
    setIsDialogOpen(true);
  }

  const handleDeletePlayer = (player: MasterPlayer) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };

  const confirmDelete = () => {
    if (playerToDelete) {
        setDatabase(masterDatabase.filter(p => p.id !== playerToDelete.id));
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
      const updatedPlayer: MasterPlayer = {
        ...editingPlayer,
        ...values
      };
      setDatabase(masterDatabase.map(p => 
        p.id === editingPlayer.id ? updatedPlayer : p
      ));
      toast({ title: "Player Updated", description: `${values.firstName} ${values.lastName}'s data has been updated.`});
    } else {
      const newPlayer: MasterPlayer = {
        id: `p-${Date.now()}`,
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        uscfId: values.uscfId,
        regularRating: values.regularRating || 0,
        quickRating: values.quickRating || '',
        district: values.district,
        school: values.school,
        state: values.state,
        expirationDate: values.expirationDate,
        events: 0,
        eventIds: [],
      };
      setDatabase([...masterDatabase, newPlayer]);
      toast({ title: "Player Added", description: `${values.firstName} ${values.lastName} has been added.`});
    }
    setIsDialogOpen(false);
    setEditingPlayer(null);
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const { update: updateToast, dismiss } = toast({
      title: 'Import Started',
      description: 'Your database file is being uploaded and processed...',
      duration: Infinity,
    });

    Papa.parse(file, {
        worker: true,
        delimiter: "\t",
        skipEmptyLines: true,
        complete: (results) => {
            const rows = results.data as string[][];
            const dbMap = new Map<string, MasterPlayer>(masterDatabase.map(p => [p.uscfId, p]));
            
            const CHUNK_SIZE = 5000;
            let currentIndex = 0;
            let errorCount = 0;

            function processChunk() {
                const chunkEnd = Math.min(currentIndex + CHUNK_SIZE, rows.length);
                for (let i = currentIndex; i < chunkEnd; i++) {
                    try {
                        const row = rows[i];
                        if (!row || row.length < 2) continue;
                        
                        const uscfId = row[1]?.trim();
                        if (!uscfId || !/^\d{8}$/.test(uscfId)) continue;
            
                        const namePart = row[0]?.trim();
                        if (!namePart) { errorCount++; continue; }
            
                        let lastName = '', firstName = '', middleName = '';
                        if (namePart.includes(',')) {
                            const parts = namePart.split(',');
                            lastName = parts[0].trim();
                            const firstAndMiddle = (parts[1] || '').trim().split(/\s+/).filter(Boolean);
                            if (firstAndMiddle.length > 0) firstName = firstAndMiddle.shift() || '';
                            if (firstAndMiddle.length > 0) middleName = firstAndMiddle.join(' ');
                        } else {
                            const parts = namePart.split(/\s+/).filter(Boolean);
                            if (parts.length > 0) lastName = parts.pop()!;
                            if (parts.length > 0) firstName = parts.shift()!;
                            if (parts.length > 0) middleName = parts.join(' ');
                        }
            
                        if (!lastName && !firstName) { errorCount++; continue; }
                      
                        const expirationDateStr = row[2] || '';
                        const state = row[3] || '';
                        const regularRatingString = row[4] || '';
                        const quickRatingString = row[5] || '';
                        
                        let regularRating: number | undefined = undefined;
                        if (regularRatingString) {
                            const ratingMatch = regularRatingString.match(/^(\d+)/);
                            if (ratingMatch && ratingMatch[1]) { regularRating = parseInt(ratingMatch[1], 10); }
                        }
            
                        const existingPlayer = dbMap.get(uscfId);
                        if (existingPlayer) {
                            existingPlayer.firstName = firstName || existingPlayer.firstName;
                            existingPlayer.lastName = lastName || existingPlayer.lastName;
                            existingPlayer.middleName = middleName;
                            existingPlayer.state = state;
                            existingPlayer.expirationDate = expirationDateStr;
                            existingPlayer.regularRating = regularRating;
                            existingPlayer.quickRating = quickRatingString || undefined;
                            dbMap.set(uscfId, existingPlayer);
                        } else {
                            const newPlayer: MasterPlayer = {
                                id: `p-${uscfId}`,
                                uscfId: uscfId,
                                firstName: firstName || '',
                                lastName: lastName,
                                middleName: middleName || undefined,
                                state: state,
                                expirationDate: expirationDateStr,
                                regularRating: regularRating,
                                quickRating: quickRatingString || undefined,
                                school: "Independent",
                                district: "None",
                                events: 0,
                                eventIds: [],
                            };
                            dbMap.set(uscfId, newPlayer);
                        }
                    } catch (e) {
                        console.error("Error parsing a player row:", rows[i], e);
                        errorCount++;
                    }
                }

                currentIndex += CHUNK_SIZE;

                if (currentIndex < rows.length) {
                    const progress = Math.round((currentIndex / rows.length) * 100);
                    updateToast({
                        title: 'Importing...',
                        description: `Processing database... ${progress}% complete.`,
                      });
                    setTimeout(processChunk, 0); // Yield to the browser
                } else {
                    const newMasterList = Array.from(dbMap.values());
                    setDatabase(newMasterList);
                    setCurrentPage(1); // Reset to first page after import
                    
                    setIsImporting(false);
                    
                    let description = `Database updated. Processed ${rows.length} records. The database now contains ${newMasterList.length} unique players.`;
                    if (errorCount > 0) description += ` Could not parse ${errorCount} rows.`;
                    
                    updateToast({
                      title: 'Import Complete',
                      description: description,
                      duration: 5000,
                    });
                }
            }
            
            processChunk();
        },
        error: (error: any) => {
            setIsImporting(false);
            updateToast({
              variant: 'destructive',
              title: 'Import Error',
              description: `Failed to parse file: ${error.message}`,
              duration: 10000,
            });
        }
    });

    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };


  const filteredAndSortedPlayers = useMemo(() => {
    let sortablePlayers = [...masterDatabase];
    
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
                aVal = a[key as keyof MasterPlayer];
                bVal = b[key as keyof MasterPlayer];
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
  }, [sortConfig, selectedEvent, masterDatabase]);
  
  const paginatedPlayers = useMemo(() => {
    return filteredAndSortedPlayers.slice(
      (currentPage - 1) * ROWS_PER_PAGE,
      currentPage * ROWS_PER_PAGE
    );
  }, [filteredAndSortedPlayers, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedPlayers.length / ROWS_PER_PAGE);

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

    const eventName = 'master_player_list';
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

  const allEvents = useMemo(() => {
    const eventsMap = new Map<string, { id: string, name: string }>();
    masterDatabase.forEach(player => {
        player.eventIds?.forEach(eventId => {
            if (!eventsMap.has(eventId)) {
                // In a real app, you'd look up the event name from an events service/context
                eventsMap.set(eventId, { id: eventId, name: `Event ${eventId}` });
            }
        });
    });
    return Array.from(eventsMap.values());
  }, [masterDatabase]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">All Players</h1>
            <p className="text-muted-foreground">
              Manage the master player database for the entire system.
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
            <Button onClick={() => openDialog(null)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Player
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Master Player List</CardTitle>
            <CardDescription>
                This is the central database of all known players. Upload a tab-delimited file to populate or update it. This database is used for the search function on the Roster page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isDbLoaded ? (
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
                    {paginatedPlayers.map((player) => (
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
                            <DropdownMenuItem onClick={() => openDialog(player)}>Edit Player</DropdownMenuItem>
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
          <CardFooter>
            <div className="flex items-center justify-between w-full">
                <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
            </div>
          </CardFooter>
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
                        <SelectContent position="item-aligned">
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
                        <SelectContent position="item-aligned">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="state" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="expirationDate" render={({ field }) => ( <FormItem><FormLabel>USCF Expiration</FormLabel><FormControl><Input placeholder="MM/DD/YYYY" {...field} /></FormControl><FormMessage /></FormItem> )} />
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
