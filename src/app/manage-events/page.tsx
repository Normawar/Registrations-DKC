
'use client';

import { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';
import { useEvents, type Event } from '@/hooks/use-events';
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
  Trash2,
  FilePenLine,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  Upload
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import Papa from 'papaparse';

const eventFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  date: z.date({ required_error: "An event date is required." }),
  location: z.string().min(3, { message: "Location is required." }),
  rounds: z.coerce.number().int().min(1, { message: "Must be at least 1 round." }),
  regularFee: z.coerce.number().min(0, { message: "Fee cannot be negative." }),
  lateFee: z.coerce.number().min(0, { message: "Fee cannot be negative." }),
  veryLateFee: z.coerce.number().min(0, { message: "Fee cannot be negative." }),
  dayOfFee: z.coerce.number().min(0, { message: "Fee cannot be negative." }),
  imageUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  imageName: z.string().optional(),
  pdfUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  pdfName: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;
type SortableColumnKey = 'name' | 'date' | 'location' | 'regularFee' | 'status';

type StoredConfirmation = {
  eventId?: string;
  selections: Record<string, { section: string; uscfStatus: 'current' | 'new' | 'renewing' }>;
};

type RegistrationInfo = {
  player: MasterPlayer;
  details: {
    section: string;
    uscfStatus: 'current' | 'new' | 'renewing';
  }
};

export default function ManageEventsPage() {
  const { toast } = useToast();
  const { events, addBulkEvents, updateEvent, deleteEvent } = useEvents();
  const { database: allPlayers } = useMasterDb();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'ascending' });
  
  const [isRegistrationsOpen, setIsRegistrationsOpen] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationInfo[]>([]);
  const [selectedEventForReg, setSelectedEventForReg] = useState<Event | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      date: new Date(),
      location: '',
      rounds: 5,
      regularFee: 25,
      lateFee: 30,
      veryLateFee: 35,
      dayOfFee: 40,
      imageUrl: '',
      imageName: '',
      pdfUrl: '',
      pdfName: '',
    },
  });

  const getEventStatus = (event: Event): "Open" | "Completed" => {
    return new Date(event.date) < new Date() ? "Completed" : "Open";
  };

  const sortedEvents = useMemo(() => {
    const sortableEvents = [...events];
    if (sortConfig !== null) {
      sortableEvents.sort((a, b) => {
        const aStatus = getEventStatus(a);
        const bStatus = getEventStatus(b);
        if (aStatus === 'Open' && bStatus === 'Completed') return -1;
        if (aStatus === 'Completed' && bStatus === 'Open') return 1;

        let aValue: any = a[sortConfig.key as keyof Event];
        let bValue: any = b[sortConfig.key as keyof Event];
        
        if (sortConfig.key === 'date') {
            aValue = new Date(a.date).getTime();
            bValue = new Date(b.date).getTime();
        } else if (sortConfig.key === 'status') {
            aValue = aStatus;
            bValue = bStatus;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableEvents;
  }, [events, sortConfig]);

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
    }
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  useEffect(() => {
    if (isDialogOpen) {
      if (editingEvent) {
        form.reset({
          ...editingEvent,
          date: new Date(editingEvent.date),
        });
      } else {
        form.reset({
          name: '',
          date: new Date(),
          location: '',
          rounds: 5,
          regularFee: 25,
          lateFee: 30,
          veryLateFee: 35,
          dayOfFee: 40,
          imageUrl: '',
          imageName: '',
          pdfUrl: '',
          pdfName: '',
        });
      }
    }
  }, [isDialogOpen, editingEvent, form]);

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newEvents: Event[] = [];
        let errors = 0;
        results.data.forEach((row: any) => {
          try {
            const dateStr = row['date'] || row['Date'];
            if (!dateStr) {
                console.warn("Skipping row due to missing date:", row);
                errors++;
                return;
            }
            const date = new Date(dateStr);
            if (!isValid(date)) throw new Error(`Invalid date format for value: "${dateStr}"`);
            
            const eventData = {
              id: `evt-${Date.now()}-${Math.random()}`,
              name: row['name'] || row['Name'],
              date: date.toISOString(),
              location: row['location'] || row['Location'],
              rounds: row['rounds'] || row['Rounds'],
              regularFee: row['regularFee'] || row['Regular Fee'],
              lateFee: row['lateFee'] || row['Late Fee'],
              veryLateFee: row['veryLateFee'] || row['Very Late Fee'],
              dayOfFee: row['dayOfFee'] || row['Day of Fee'],
              imageUrl: row['imageUrl'] || row['Image URL'] || undefined,
              imageName: row['imageName'] || row['Image Name'] || undefined,
              pdfUrl: row['pdfUrl'] || row['PDF URL'] || undefined,
              pdfName: row['pdfName'] || row['PDF Name'] || undefined,
            };

            const requiredFields: (keyof typeof eventData)[] = ['name', 'date', 'location', 'rounds', 'regularFee', 'lateFee', 'veryLateFee', 'dayOfFee'];
            for (const field of requiredFields) {
              if (eventData[field] === undefined || eventData[field] === null || (typeof eventData[field] === 'number' && isNaN(eventData[field]))) {
                throw new Error(`Missing or invalid required field: ${field}`);
              }
            }
            
            const finalEvent: Event = {
                id: eventData.id,
                name: String(eventData.name),
                date: eventData.date,
                location: String(eventData.location),
                rounds: parseInt(String(eventData.rounds), 10),
                regularFee: parseFloat(String(eventData.regularFee)),
                lateFee: parseFloat(String(eventData.lateFee)),
                veryLateFee: parseFloat(String(eventData.veryLateFee)),
                dayOfFee: parseFloat(String(eventData.dayOfFee)),
                imageUrl: eventData.imageUrl ? String(eventData.imageUrl) : undefined,
                imageName: eventData.imageName ? String(eventData.imageName) : undefined,
                pdfUrl: eventData.pdfUrl ? String(eventData.pdfUrl) : undefined,
                pdfName: eventData.pdfName ? String(eventData.pdfName) : undefined,
            };
            
            newEvents.push(finalEvent);
          } catch(e) {
            errors++;
            console.error("Error parsing event row:", row, e);
          }
        });

        if (newEvents.length === 0 && results.data.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Import Failed',
                description: `Could not import any events. Please ensure your CSV has the required headers and valid data.`
            });
            return;
        }

        addBulkEvents(newEvents);
        
        toast({
          title: "Import Complete",
          description: `Successfully imported ${newEvents.length} events. ${errors > 0 ? `Skipped ${errors} invalid rows.` : ''}`
        });
      },
      error: (error) => {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: `An error occurred while parsing the CSV file: ${error.message}`
        });
      },
    });

    if (e.target) {
        e.target.value = '';
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setIsDialogOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsDialogOpen(true);
  };
  
  const handleDeleteEvent = (event: Event) => {
    setEventToDelete(event);
    setIsAlertOpen(true);
  };

  const handleViewRegistrations = (event: Event) => {
    const rawConfirmations = localStorage.getItem('confirmations');
    const confirmations: StoredConfirmation[] = rawConfirmations ? JSON.parse(rawConfirmations) : [];
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));
    
    const eventRegistrations: RegistrationInfo[] = [];
    for (const conf of confirmations) {
        if (conf.eventId === event.id) {
            for (const playerId in conf.selections) {
                const player = playerMap.get(playerId);
                if (player) {
                    eventRegistrations.push({ player, details: conf.selections[playerId] });
                }
            }
        }
    }
    setRegistrations(eventRegistrations);
    setSelectedEventForReg(event);
    setIsRegistrationsOpen(true);
  };
  
  const confirmDelete = () => {
    if (eventToDelete) {
      deleteEvent(eventToDelete.id);
      toast({ title: "Event Deleted", description: `"${eventToDelete.name}" has been removed.` });
    }
    setIsAlertOpen(false);
    setEventToDelete(null);
  };

  function onSubmit(values: EventFormValues) {
    const eventData = { ...values, date: values.date.toISOString() };
    if (editingEvent) {
      updateEvent(eventData as Event);
      toast({ title: "Event Updated", description: `"${values.name}" has been successfully updated.` });
    } else {
      addBulkEvents([{ ...eventData, id: Date.now().toString() }]);
      toast({ title: "Event Added", description: `"${values.name}" has been successfully created.` });
    }
    setIsDialogOpen(false);
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Manage Events</h1>
            <p className="text-muted-foreground">
              Create, edit, and manage your tournament events and fees.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv"
              onChange={handleFileImport}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={handleAddEvent}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Event
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('name')}>
                        Event Name {getSortIcon('name')}
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('date')}>
                        Date {getSortIcon('date')}
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('location')}>
                        Location {getSortIcon('location')}
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('regularFee')}>
                        Fees (Early, Reg., Late, Day of) {getSortIcon('regularFee')}
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('status')}>
                        Status {getSortIcon('status')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{format(new Date(event.date), 'PPP')}</TableCell>
                    <TableCell>{event.location}</TableCell>
                    <TableCell>{`$${event.regularFee} / $${event.lateFee} / $${event.veryLateFee} / $${event.dayOfFee}`}</TableCell>
                    <TableCell>
                      <Badge variant={getEventStatus(event) === 'Open' ? 'default' : 'secondary'} className={cn(getEventStatus(event) === 'Open' ? 'bg-green-600 text-white' : '')}>
                        {getEventStatus(event)}
                      </Badge>
                    </TableCell>
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
                           <DropdownMenuItem onClick={() => handleViewRegistrations(event)}>
                            <Users className="mr-2 h-4 w-4" /> View Registrations
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditEvent(event)}>
                            <FilePenLine className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/organizer-registration?eventId=${event.id}`}>
                              <PlusCircle className="mr-2 h-4 w-4" /> Register Players
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteEvent(event)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
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
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Update the event details below.' : 'Fill in the form to create a new event.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Spring Open 2024" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="e.g., City Convention Center" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Event Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
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
                            initialFocus
                            captionLayout="dropdown-buttons"
                            fromYear={new Date().getFullYear()}
                            toYear={new Date().getFullYear() + 10}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField control={form.control} name="rounds" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rounds</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <div>
                <Label>Registration Fees</Label>
                <Card className="p-4 mt-2 bg-muted/50">
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField control={form.control} name="regularFee" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regular Fee ($)</FormLabel>
                        <FormControl><Input type="number" placeholder="25" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                     <FormField control={form.control} name="lateFee" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Late Fee ($)</FormLabel>
                        <FormControl><Input type="number" placeholder="30" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                     <FormField control={form.control} name="veryLateFee" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Very Late Fee ($)</FormLabel>
                        <FormControl><Input type="number" placeholder="35" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                     )} />
                     <FormField control={form.control} name="dayOfFee" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Fee ($)</FormLabel>
                        <FormControl><Input type="number" placeholder="40" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                   </div>
                </Card>
              </div>

              <div className="space-y-4">
                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL (Optional)</FormLabel>
                    <FormControl><Input placeholder="https://placehold.co/100x100.png" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="imageName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Name (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Event Banner" {...field} /></FormControl>
                    <FormDescription>A descriptive name for the image attachment.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="space-y-4">
                 <FormField control={form.control} name="pdfUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>PDF Flyer URL (Optional)</FormLabel>
                    <FormControl><Input placeholder="https://example.com/flyer.pdf" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="pdfName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>PDF Name (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Official Flyer" {...field} /></FormControl>
                     <FormDescription>A descriptive name for the PDF attachment.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit">
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </Button>
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
              This action cannot be undone. This will permanently delete the event
              "{eventToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isRegistrationsOpen} onOpenChange={setIsRegistrationsOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Registrations for {selectedEventForReg?.name}</DialogTitle>
            <DialogDescription>
              {registrations.length} player(s) registered for this event.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>USCF Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No players registered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  registrations.map(({ player, details }) => (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium">{player.firstName} {player.lastName}</TableCell>
                      <TableCell>{player.school}</TableCell>
                      <TableCell>{details.section}</TableCell>
                      <TableCell>
                        <Badge variant={details.uscfStatus === 'current' ? 'default' : 'secondary'} className={cn(details.uscfStatus === 'current' ? 'bg-green-600 text-white' : '', 'capitalize')}>
                          {details.uscfStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
