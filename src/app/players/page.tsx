
'use client';

import { useState, useMemo } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { PlusCircle, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { districts as allDistricts } from '@/lib/data/districts';
import { schoolData } from '@/lib/data/school-data';

const initialPlayersData = [
  { id: "p1", firstName: "Liam", middleName: "J", lastName: "Johnson", uscfId: "12345678", rating: 1850, school: "Independent", district: "None", events: 2, eventIds: ['e2'] },
  { id: "p2", firstName: "Olivia", middleName: "K", lastName: "Smith", uscfId: "87654321", rating: 2100, school: "City Chess Club", district: "None", events: 3, eventIds: ['e1', 'e3'] },
  { id: "p3", firstName: "Noah", middleName: "L", lastName: "Williams", uscfId: "11223344", rating: 1600, school: "Scholastic Stars", district: "None", events: 1, eventIds: ['e1'] },
  { id: "p4", firstName: "Emma", middleName: "M", lastName: "Brown", uscfId: "44332211", rating: 1950, school: "Independent", district: "None", events: 1, eventIds: ['e2'] },
  { id: "p5", firstName: "James", middleName: "N", lastName: "Jones", uscfId: "55667788", rating: 2200, school: "Grandmasters Inc.", district: "None", events: 4, eventIds: ['e1', 'e2', 'e3'] },
  { id: "p6", firstName: "Alex", middleName: "S", lastName: "Ray", uscfId: "98765432", rating: 1750, school: "SHARYLAND PIONEER H S", district: "SHARYLAND ISD", events: 2, eventIds: ['e1'] },
  { id: "p7", firstName: "Jordan", middleName: "T", lastName: "Lee", uscfId: "23456789", rating: 2050, school: "SHARYLAND PIONEER H S", district: "SHARYLAND ISD", events: 3, eventIds: ['e1', 'e2'] },
];

const allEvents = [
  { id: 'e1', name: 'Spring Open 2024' },
  { id: 'e2', name: 'Summer Championship' },
  { id: 'e3', name: 'Autumn Classic' },
];

type Player = typeof initialPlayersData[0];
type SortableColumnKey = 'name' | 'uscfId' | 'rating' | 'school' | 'district' | 'events';

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First Name is required."),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last Name is required."),
  district: z.string().min(1, "District is required."),
  school: z.string().min(1, "School is required."),
  uscfId: z.string().min(1, "USCF ID is required."),
  rating: z.coerce.number().optional(),
});
type PlayerFormValues = z.infer<typeof playerFormSchema>;


export default function PlayersPage() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>(initialPlayersData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
  const [selectedEvent, setSelectedEvent] = useState<string>('all');

  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      district: '',
      school: '',
      uscfId: '',
      rating: undefined,
    },
  });

  const handleAddPlayer = () => {
    form.reset();
    setIsDialogOpen(true);
  };
  
  const handleDistrictChange = (district: string) => {
    form.setValue('district', district);
    form.setValue('school', '');
    if (district === 'None') {
        setSchoolsForDistrict(['Independent']);
        form.setValue('school', 'Independent');
    } else {
        const filteredSchools = schoolData
        .filter((school) => school.district === district)
        .map((school) => school.schoolName)
        .sort();
        setSchoolsForDistrict(filteredSchools);
    }
  };

  function onSubmit(values: PlayerFormValues) {
    const newPlayer: Player = {
      id: `p-${Date.now()}`,
      firstName: values.firstName,
      middleName: values.middleName,
      lastName: values.lastName,
      uscfId: values.uscfId,
      rating: values.rating || 0,
      district: values.district,
      school: values.school,
      events: 0,
      eventIds: [],
    };
    setPlayers(prev => [...prev, newPlayer]);
    toast({ title: "Player Added", description: `${values.firstName} ${values.lastName} has been added.`});
    setIsDialogOpen(false);
  }

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

    const headers = ['FullName', 'LastName', 'FirstName', 'MiddleName', 'USCF_ID', 'Rating', 'School', 'District', 'EventsCount'];

    const csvRows = filteredAndSortedPlayers.map(player => {
        const fullName = `${player.lastName}, ${player.firstName}`;
        const row = [
            fullName,
            player.lastName,
            player.firstName,
            player.middleName || '',
            player.uscfId,
            player.rating,
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
                Use the filter to view players by event. Click column headers to sort.
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
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('rating')}>
                          Rating {getSortIcon('rating')}
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
                    <TableCell>{player.rating}</TableCell>
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
                          <DropdownMenuItem>Edit Player</DropdownMenuItem>
                          <DropdownMenuItem>View Registrations</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Remove Player
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Player</DialogTitle>
            <DialogDescription>Fill out the details for the new player.</DialogDescription>
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
                      <Select onValueChange={handleDistrictChange} value={field.value}>
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
                 <FormField control={form.control} name="uscfId" render={({ field }) => ( <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input placeholder="12345678 or NEW" {...field} /></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={form.control} name="rating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit">Add Player</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
