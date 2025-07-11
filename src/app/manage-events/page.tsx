
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
    Upload,
    ClipboardPaste,
    Download,
    Check
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
import { Textarea } from '@/components/ui/textarea';

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
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  submissionTimestamp: string;
  eventId?: string;
  selections: Record<string, { section: string; uscfStatus: 'current' | 'new' | 'renewing', status?: 'active' | 'withdrawn' }>;
};

type RegistrationInfo = {
  player: MasterPlayer;
  details: {
    section: string;
    uscfStatus: 'current' | 'new' | 'renewing';
    status?: 'active' | 'withdrawn';
  };
  invoiceId?: string;
  invoiceNumber?: string;
};

type StoredDownloads = {
  [eventId: string]: string[]; // Array of player IDs that have been downloaded
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
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [downloadedPlayers, setDownloadedPlayers] = useState<StoredDownloads>({});

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
    const stored = localStorage.getItem('downloaded_registrations');
    if (stored) {
        setDownloadedPlayers(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (isDialogOpen) {
      if (editingEvent) {
        form.reset({
          ...editingEvent,
          date: new Date(editingEvent.date),
          imageUrl: editingEvent.imageUrl || '',
          imageName: editingEvent.imageName || '',
          pdfUrl: editingEvent.pdfUrl || '',
          pdfName: editingEvent.pdfName || '',
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

  const processImportData = (data: any[], hasHeaders: boolean) => {
      const newEvents: Event[] = [];
      let errors = 0;

      const dataToProcess = hasHeaders ? data : data.map(arr => ({
          'Date': arr[0],
          'Tournament': arr[1],
          'Location': arr[2],
          'Rounds': 5,
          'Regular Fee': 25,
          'Late Fee': 30,
          'Very Late Fee': 35,
          'Day of Fee': 40
      }));

      dataToProcess.forEach((row: any) => {
        try {
          let dateStr = row['date'] || row['Date'];
          if (!dateStr) {
              console.warn("Skipping row due to missing date:", row);
              errors++;
              return;
          }

          if (dateStr.includes('-')) {
            dateStr = dateStr.split('-')[0].trim();
          }

          const date = new Date(dateStr);
          if (!isValid(date)) throw new Error(`Invalid date format for value: "${dateStr}"`);
          
          const eventData = {
            id: `evt-${Date.now()}-${Math.random()}`,
            name: row['name'] || row['Name'] || row['Tournament'],
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

      if (newEvents.length === 0 && data.length > 0) {
          toast({
              variant: 'destructive',
              title: 'Import Failed',
              description: `Could not import any events. Please ensure your data has the required headers and valid data.`
          });
          return;
      }

      addBulkEvents(newEvents);
      
      toast({
        title: "Import Complete",
        description: `Successfully imported ${newEvents.length} events. ${errors > 0 ? `Skipped ${errors} invalid rows.` : ''}`
      });
  };
  
  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => processImportData(results.data, true),
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

  const handlePasteImport = () => {
    if (!pasteData) {
        toast({ variant: 'destructive', title: 'No data', description: 'Please paste data into the text area.' });
        return;
    }

    Papa.parse(pasteData, {
        header: true,
        skipEmptyLines: true,
        complete: (resultsWithHeader) => {
            if (resultsWithHeader.data.length > 0 && resultsWithHeader.meta.fields) {
                const firstRowIsLikelyData = resultsWithHeader.meta.fields.some(field => field && (field.includes('/') || !isNaN(Date.parse(field))));
                
                if (firstRowIsLikelyData) {
                    Papa.parse(pasteData, {
                        header: false,
                        skipEmptyLines: true,
                        complete: (resultsWithoutHeader) => {
                            processImportData(resultsWithoutHeader.data, false);
                        }
                    });
                } else {
                    processImportData(resultsWithHeader.data, true);
                }
            } else {
                 toast({ variant: 'destructive', title: 'Import Failed', description: 'No data could be parsed from your input.' });
            }

            setIsPasteDialogOpen(false);
            setPasteData('');
        },
        error: (error) => {
            toast({
              variant: 'destructive',
              title: 'Parse Failed',
              description: `An error occurred while parsing the pasted data: ${error.message}`
            });
        }
    });
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
    const allConfirmations: StoredConfirmation[] = rawConfirmations ? JSON.parse(rawConfirmations) : [];
  
    // De-duplicate confirmations by invoice ID, keeping only the latest one
    const latestConfirmationsByInvoice = Object.values(
      allConfirmations.reduce((acc, conf) => {
        const key = conf.invoiceId || conf.id;
        if (key) {
          if (!acc[key] || new Date(conf.submissionTimestamp) > new Date(acc[key].submissionTimestamp)) {
            acc[key] = conf;
          }
        }
        return acc;
      }, {} as Record<string, StoredConfirmation>)
    );
  
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));
    const uniquePlayerRegistrations = new Map<string, RegistrationInfo>();
  
    // Iterate over the latest confirmations to build the unique player list for the event
    for (const conf of latestConfirmationsByInvoice) {
      if (conf.eventId === event.id) {
        for (const playerId in conf.selections) {
            const registrationDetails = conf.selections[playerId];
            const player = playerMap.get(playerId);
            if (player) {
                // This ensures each player ID appears only once, with their latest registration details.
                uniquePlayerRegistrations.set(playerId, { player, details: registrationDetails, invoiceId: conf.invoiceId, invoiceNumber: conf.invoiceNumber });
            }
        }
      }
    }
  
    const eventRegistrations = Array.from(uniquePlayerRegistrations.values());
    
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
  
  const playersForDownload = useMemo(() => {
    if (!selectedEventForReg) return [];
    const downloadedIds = new Set(downloadedPlayers[selectedEventForReg.id] || []);
    return registrations.filter(p => {
        // Include if player is newly registered and not downloaded
        if (!downloadedIds.has(p.player.id) && p.details.status !== 'withdrawn') {
            return true;
        }
        // Include if player was withdrawn after they were already downloaded
        if (downloadedIds.has(p.player.id) && p.details.status === 'withdrawn') {
            return true;
        }
        return false;
    });
  }, [registrations, downloadedPlayers, selectedEventForReg]);
  
  const handleDownload = (downloadAll: boolean = false) => {
    if (!selectedEventForReg) return;
    
    const playersToDownload = downloadAll ? registrations : playersForDownload;
    if (playersToDownload.length === 0) {
      toast({ title: 'No Players to Download', description: downloadAll ? 'There are no registered players for this event.' : 'There are no new registrations or withdrawals to download.' });
      return;
    }
    
    const csvData = playersToDownload.map(p => ({
        "USCF ID": p.player.uscfId,
        "First Name": p.player.firstName,
        "Last Name": p.player.lastName,
        "Rating": p.player.regularRating || 'UNR',
        "Grade": p.player.grade,
        "Section": p.details.section,
        "School": p.player.school,
        "Status": p.details.status === 'withdrawn' ? 'Withdrawn' : 'Registered'
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileNameSuffix = downloadAll ? 'all_registrations' : 'registered_and_withdrawn';
    link.setAttribute('download', `${selectedEventForReg.name.replace(/\s+/g, '_')}_${fileNameSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (!downloadAll) {
      const newlyDownloadedIds = playersToDownload.map(p => p.player.id);
      const updatedDownloads = {
          ...downloadedPlayers,
          [selectedEventForReg.id]: [...(downloadedPlayers[selectedEventForReg.id] || []), ...newlyDownloadedIds]
      };
      setDownloadedPlayers(updatedDownloads);
      localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
    }
    
    toast({ title: 'Download Complete', description: `${playersToDownload.length} registrations have been downloaded.`});
  };
  
  const handleMarkAllAsNew = () => {
    if (!selectedEventForReg) return;
    const updatedDownloads = { ...downloadedPlayers };
    delete updatedDownloads[selectedEventForReg.id];
    setDownloadedPlayers(updatedDownloads);
    localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
    toast({ title: 'Status Reset', description: 'All players for this event are marked as new.' });
  };

  const handleClearAllNew = () => {
    if (!selectedEventForReg) return;
    const allPlayerIdsForEvent = registrations.map(p => p.player.id);
    const updatedDownloads = {
        ...downloadedPlayers,
        [selectedEventForReg.id]: allPlayerIdsForEvent
    };
    setDownloadedPlayers(updatedDownloads);
    localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
    toast({ title: 'Status Cleared', description: 'All new registration indicators have been cleared.' });
  };

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
             <Button variant="outline" onClick={() => setIsPasteDialogOpen(true)}>
              <ClipboardPaste className="mr-2 h-4 w-4" /> Paste from Sheet
            </Button>
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Update the event details below.' : 'Fill in the form to create a new event.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <Form {...form}>
              <form id="event-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              </form>
            </Form>
          </div>
          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" form="event-form">
              {editingEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogFooter>
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
          <div className='my-4 flex items-center justify-end gap-2'>
              <Button onClick={() => handleDownload(false)} disabled={playersForDownload.length === 0} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download Registered ({playersForDownload.length})
              </Button>
               <Button onClick={() => handleDownload(true)} disabled={registrations.length === 0} variant="secondary" size="sm">
                  Download All ({registrations.length})
              </Button>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="mx-1">|</span>
                <button onClick={handleMarkAllAsNew} className="hover:underline">Mark all as new</button>
                <span className="mx-1">|</span>
                <button onClick={handleClearAllNew} className="hover:underline">Clear all new</button>
              </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>USCF ID</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No players registered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  registrations.map(({ player, details, invoiceId, invoiceNumber }) => {
                    const isWithdrawn = details.status === 'withdrawn';
                    const isDownloaded = selectedEventForReg && (downloadedPlayers[selectedEventForReg.id] || []).includes(player.id);
                    let status: 'Withdrawn' | 'Active' | 'Registered' = 'Registered';
                    if (isWithdrawn) {
                        status = 'Withdrawn';
                    } else if (isDownloaded) {
                        status = 'Active';
                    }
                    
                    return (
                        <TableRow key={player.id} className={cn(isWithdrawn && 'text-muted-foreground opacity-60')}>
                            <TableCell className={cn("font-medium", isWithdrawn && "line-through")}>{player.firstName} {player.lastName}</TableCell>
                            <TableCell>{player.uscfId}</TableCell>
                            <TableCell>{player.school}</TableCell>
                            <TableCell>{details.section}</TableCell>
                            <TableCell>
                                <Button variant="link" asChild className="p-0 h-auto font-mono">
                                    <Link href={`/confirmations#${invoiceId}`}>{invoiceNumber || 'N/A'}</Link>
                                </Button>
                            </TableCell>
                            <TableCell>
                                <Badge variant={
                                    status === 'Withdrawn' ? 'destructive' :
                                    status === 'Active' ? 'default' : 'secondary'
                                } className={cn(status === 'Active' ? 'bg-green-600 text-white' : '')}>
                                    {status}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste from Spreadsheet</DialogTitle>
            <DialogDescription>
              Copy the data from your Google Sheet or Excel file (with or without a header row) and paste it into the text area below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Paste your tab-separated data here..."
              className="h-64"
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handlePasteImport}>
              <ClipboardPaste className="mr-2 h-4 w-4" /> Import Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
