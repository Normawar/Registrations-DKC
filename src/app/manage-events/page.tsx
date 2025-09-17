

'use client';

import { useState, useEffect, useMemo, useRef, type ChangeEvent, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse, isSameDay, parseISO, startOfDay } from 'date-fns';
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
    Check,
    Edit,
    Delete
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
import { schoolData } from '@/lib/data/school-data';
import Papa from 'papaparse';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { OrganizerGuard } from '@/components/auth-guard';
import { generateTeamCode } from '@/lib/school-utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


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
  isClosed: z.boolean().optional(),
  isPsjaOnly: z.boolean().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;
type SortableColumnKey = 'name' | 'date' | 'location' | 'regularFee' | 'status' | 'district';

type StoredConfirmation = {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  submissionTimestamp: string;
  eventId?: string;
  eventName: string;
  eventDate: string;
  selections: Record<string, { section: string; uscfStatus: 'current' | 'new' | 'renewing', status?: 'active' | 'withdrawn' }>;
  invoiceStatus?: 'CANCELED' | 'COMPED' | 'PAID' | 'UNPAID';
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

function ManageEventsContent() {
  const { toast } = useToast();
  const { events, addBulkEvents, updateEvent, deleteEvent, clearAllEvents } = useEvents();
  const { database: allPlayers, isDbLoaded, dbSchools } = useMasterDb();
  const { profile } = useSponsorProfile();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'ascending' });
  
  const [isRegistrationsOpen, setIsRegistrationsOpen] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationInfo[]>([]);
  const [selectedEventForReg, setSelectedEventForReg] = useState<Event | null>(null);
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [downloadedPlayers, setDownloadedPlayers] = useState<StoredDownloads>({});

  const [districtFilter, setDistrictFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<'real' | 'test'>('real');

  const uniqueDistricts = useMemo(() => {
    const schoolDistricts = dbSchools.map(s => schoolData.find(sd => sd.schoolName === s)?.district).filter(Boolean) as string[];
    const playerDistricts = allPlayers.map(p => p.district).filter(Boolean) as string[];
    const eventLocationDistricts = events.map(e => {
        const lowerLocation = e.location.toLowerCase();
        if (lowerLocation.includes("mcallen")) return "MCALLEN ISD";
        if (lowerLocation.includes("psja") || lowerLocation.includes("austin ms") || lowerLocation.includes("kennedy ms")) return "PHARR-SAN JUAN-ALAMO ISD";
        if (lowerLocation.includes("edinburg") || lowerLocation.includes("zavala")) return "EDINBURG CISD";
        if (lowerLocation.includes("sharyland")) return "SHARYLAND ISD";
        return null;
    }).filter(Boolean) as string[];
    
    return [...new Set([...schoolDistricts, ...playerDistricts, ...eventLocationDistricts])].sort();
}, [dbSchools, allPlayers, events]);
  
  const getDistrictForLocation = useCallback((location: string): string => {
    if (!isDbLoaded || !location) return 'Unknown';
    const lowerLocation = location.toLowerCase();

    // Specific keywords for districts
    if (lowerLocation.includes("psja")) return "PHARR-SAN JUAN-ALAMO ISD";
    if (lowerLocation.includes("mcallen")) return "MCALLEN ISD";
    if (lowerLocation.includes("edinburg")) return "EDINBURG CISD";
    if (lowerLocation.includes("sharyland")) return "SHARYLAND ISD";
    if (lowerLocation.includes("la joya")) return "LA JOYA ISD";
    if (lowerLocation.includes("fall swiss") || lowerLocation.includes("de zavala")) return "EDINBURG CISD";
    if (lowerLocation.includes("austin ms") || lowerLocation.includes("kennedy ms")) return "PHARR-SAN JUAN-ALAMO ISD";
    if (lowerLocation.includes("barrientes")) return "EDINBURG CISD";

    
    // Check against school data
    const foundSchool = schoolData.find(s => lowerLocation.includes(s.schoolName.toLowerCase()));
    if (foundSchool) return foundSchool.district;

    // Check against player data as a fallback
    const foundPlayer = allPlayers.find(p => p.school && lowerLocation.includes(p.school.toLowerCase()));
    if (foundPlayer) return foundPlayer.district;
    
    return 'Unknown';
  }, [isDbLoaded, allPlayers]);
  
  const getEventStatus = (event: Event): "Open" | "Completed" | "Closed" => {
    if (event.isClosed) return "Closed";
    const today = startOfDay(new Date());
    const eventDay = startOfDay(new Date(event.date));
    return eventDay < today ? "Completed" : "Open";
  };

  const sortedEvents = useMemo(() => {
    const isTestEvent = (event: Event) => {
        const district = getDistrictForLocation(event.location);
        const lowerLocation = event.location.toLowerCase();
        return district.toLowerCase().startsWith("test") || event.name.toLowerCase().startsWith("test") || lowerLocation.startsWith("test");
    };

    let filteredEvents = [...events].filter(event => {
        return eventTypeFilter === 'test' ? isTestEvent(event) : !isTestEvent(event);
    });

    if (districtFilter !== 'all') {
      filteredEvents = filteredEvents.filter(event => {
        const district = getDistrictForLocation(event.location);
        return district === districtFilter;
      });
    }

    if (sortConfig !== null) {
      filteredEvents.sort((a, b) => {
        const aStatus = getEventStatus(a);
        const bStatus = getEventStatus(b);
        if (aStatus === 'Open' && bStatus !== 'Open') return -1;
        if (aStatus !== 'Open' && bStatus === 'Open') return 1;
        if (aStatus === 'Closed' && bStatus === 'Completed') return -1;
        if (aStatus === 'Completed' && bStatus === 'Closed') return 1;

        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'district') {
            aValue = getDistrictForLocation(a.location);
            bValue = getDistrictForLocation(b.location);
        } else {
            aValue = a[sortConfig.key as keyof Event];
        }

        bValue = sortConfig.key === 'district' ? getDistrictForLocation(b.location) : b[sortConfig.key as keyof Event];
        
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
    return filteredEvents;
  }, [events, sortConfig, districtFilter, eventTypeFilter, getDistrictForLocation]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      date: new Date(),
      location: '',
      rounds: 5,
      regularFee: 20,
      lateFee: 25,
      veryLateFee: 30,
      dayOfFee: 35,
      imageUrl: '',
      imageName: '',
      pdfUrl: '',
      pdfName: '',
      isClosed: false,
      isPsjaOnly: false,
    },
  });

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
          isClosed: !!editingEvent.isClosed,
          isPsjaOnly: !!editingEvent.isPsjaOnly,
        });
      } else {
        form.reset({
          name: '',
          date: new Date(),
          location: '',
          rounds: 5,
          regularFee: 20,
          lateFee: 25,
          veryLateFee: 30,
          dayOfFee: 35,
          imageUrl: '',
          imageName: '',
          pdfUrl: '',
          pdfName: '',
          isClosed: false,
          isPsjaOnly: false,
        });
      }
    }
  }, [isDialogOpen, editingEvent, form]);

  const processEventImportData = (data: any[]) => {
    const newEvents: Event[] = [];
    let errors = 0;
    let skippedEmptyRows = 0;
  
    const findColumn = (row: any, searchTerms: string[]) => {
      const keys = Object.keys(row);
      for (const term of searchTerms) {
        const found = keys.find(key => 
          key.toLowerCase().trim().replace(/ /g, '').includes(term.toLowerCase().replace(/ /g, '')) && 
          row[key] !== null && 
          row[key] !== undefined && 
          String(row[key]).trim() !== ''
        );
        if (found) {
          return row[found];
        }
      }
      return null;
    };
    
    data.forEach((row: any, index: number) => {
      if (!row || 
          typeof row !== 'object' || 
          Object.keys(row).length === 0 ||
          Object.values(row).every(val => val === null || val === '' || val === undefined)) {
        skippedEmptyRows++;
        return;
      }
  
      try {
        const dateStr = findColumn(row, ['date']);
        const location = findColumn(row, ['location', 'school']);
        
        if (!dateStr || !location) {
          skippedEmptyRows++;
          return;
        }
  
        const date = new Date(dateStr);
        if (!isValid(date)) {
          errors++;
          return;
        }
        
        const name = `${location}`;
        
        const eventData = {
          id: `evt-${Date.now()}-${Math.random()}`,
          name: name,
          date: date.toISOString(),
          location: location,
          rounds: Number(findColumn(row, ['rounds', 'round']) || 5),
          regularFee: Number(findColumn(row, ['regularfee', 'regular']) || 20),
          lateFee: Number(findColumn(row, ['latefee', 'late']) || 25),
          veryLateFee: Number(findColumn(row, ['verylatefee', 'very']) || 30),
          dayOfFee: Number(findColumn(row, ['dayoffee', 'dayof']) || 35),
          imageUrl: '',
          imageName: '',
          pdfUrl: '',
          pdfName: '',
          isClosed: String(findColumn(row, ['status']) || '').toLowerCase() === 'closed',
          isPsjaOnly: false,
        };
        
        newEvents.push(eventData as Event);
      } catch(e) {
        errors++;
        console.error(`Error parsing event row ${index + 1}:`, e);
      }
    });
    
    if (newEvents.length === 0 && data.length > 0) {
      toast({ 
        variant: 'destructive', 
        title: 'Import Failed', 
        description: `No events could be created. Skipped ${skippedEmptyRows} empty rows, ${errors} errors.` 
      });
      return;
    }
  
    addBulkEvents(newEvents);
    toast({ 
      title: "Import Complete", 
      description: `Successfully imported ${newEvents.length} events! Skipped ${skippedEmptyRows} empty rows.` 
    });
  };

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy', 
      transformHeader: (header: string) => header.trim(), 
      complete: (results) => {
        const cleanedData = results.data.filter((row: any) => {
          return row && typeof row === 'object' && 
                 Object.keys(row).length > 0 &&
                 !Object.values(row).every(val => val === null || val === '' || val === undefined);
        });
        processEventImportData(cleanedData);
      },
      error: (error) => { 
        toast({ variant: 'destructive', title: 'Import Failed', description: error.message }); 
      },
    });
    if (e.target) e.target.value = '';
  };
  
  const handlePasteImport = () => {
    if (!pasteData) { 
      toast({ variant: 'destructive', title: 'No data', description: 'Please paste data.' }); 
      return; 
    }
    
    Papa.parse(pasteData, {
      header: true,
      skipEmptyLines: 'greedy', 
      transformHeader: (header: string) => header.trim(),
      complete: (resultsWithHeader) => {
        if (resultsWithHeader.data.length > 0 && resultsWithHeader.meta.fields) {
          const cleanedData = resultsWithHeader.data.filter((row: any) => {
            return row && typeof row === 'object' && 
                   Object.keys(row).length > 0 &&
                   !Object.values(row).every(val => val === null || val === '' || val === undefined);
          });
          processEventImportData(cleanedData);
        } else {
          toast({ variant: 'destructive', title: 'Import Failed', description: 'No data parsed.' });
        }
        setIsPasteDialogOpen(false);
        setPasteData('');
      },
      error: (error) => { 
        toast({ variant: 'destructive', title: 'Parse Failed', description: error.message }); 
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
  
  const handleClearEvents = () => {
    clearAllEvents();
    toast({ title: 'All Events Cleared', description: 'The event list is now empty.' });
    setIsClearAlertOpen(false);
  };

  const handleViewRegistrations = async (event: Event) => {
    if (!isDbLoaded || !db) {
        toast({ variant: 'destructive', title: 'Loading...', description: 'Player database is still loading, please try again in a moment.' });
        return;
    }

    const invoicesCol = collection(db, 'invoices');
    const invoiceSnapshot = await getDocs(invoicesCol);
    const allConfirmations: StoredConfirmation[] = invoiceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StoredConfirmation[];
    
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));
    const uniquePlayerRegistrations = new Map<string, RegistrationInfo>();
    const eventDate = parseISO(event.date);

    const activeConfirmations = allConfirmations.filter(conf => 
        conf.invoiceStatus !== 'CANCELED' && 
        conf.invoiceStatus !== 'COMPED'
    );

    for (const conf of activeConfirmations) {
        if (conf.eventId !== event.id) continue;
        
        for (const playerId in conf.selections) {
            if (uniquePlayerRegistrations.has(playerId)) continue;
            
            const registrationDetails = conf.selections[playerId];
            const player = playerMap.get(playerId);
            
            if (player) {
                uniquePlayerRegistrations.set(playerId, { 
                    player, 
                    details: registrationDetails, 
                    invoiceId: conf.invoiceId, 
                    invoiceNumber: conf.invoiceNumber 
                });
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
    if (editingEvent) {
      const eventData = { 
        ...editingEvent,
        ...values, 
        date: values.date.toISOString() 
      };
      updateEvent(eventData as Event);
      toast({ title: "Event Updated", description: `"${values.name}" has been successfully updated.` });
    } else {
      const eventData = { ...values, date: values.date.toISOString() };
      addBulkEvents([{ ...eventData, id: Date.now().toString() }]);
      toast({ title: "Event Added", description: `"${values.name}" has been successfully created.` });
    }
    setIsDialogOpen(false);
  }
  
  const exportedPlayers = useMemo(() => {
    if (!selectedEventForReg) return [];
    const exportedIds = new Set(downloadedPlayers[selectedEventForReg.id] || []);
    return registrations.filter(p => exportedIds.has(p.player.id) && p.details.status !== 'withdrawn');
  }, [registrations, downloadedPlayers, selectedEventForReg]);

  const registeredPlayers = useMemo(() => {
    if (!selectedEventForReg) return [];
    const exportedIds = new Set(downloadedPlayers[selectedEventForReg.id] || []);
    return registrations.filter(p => !exportedIds.has(p.player.id) && p.details.status !== 'withdrawn');
  }, [registrations, downloadedPlayers, selectedEventForReg]);
  
    const handleDownload = (playerList: RegistrationInfo[], type: 'registered' | 'exported' | 'all') => {
        if (!selectedEventForReg) return;

        if (playerList.length === 0) {
            toast({ title: 'No Players to Export', description: 'There are no players in this category to export.' });
            return;
        }

        const exportedIds = new Set(downloadedPlayers[selectedEventForReg.id] || []);

        const csvData = playerList.map(p => {
            let status = 'Registered';
            if (p.details.status === 'withdrawn') {
                status = 'Withdrawn';
            } else if (type === 'all') {
                status = exportedIds.has(p.player.id) ? 'Exported' : 'Registered';
            } else if (type === 'exported') {
                status = 'Exported';
            }

            return {
                "Team Code": generateTeamCode({ schoolName: p.player.school, district: p.player.district, studentType: p.player.studentType }),
                "StudentType": p.player.studentType || 'regular',
                "Last Name": p.player.lastName,
                "First Name": p.player.firstName,
                "Middle Name": p.player.middleName || '',
                "USCF ID": p.player.uscfId,
                "Grade": p.player.grade,
                "Section": p.details.section,
                "Rating": p.player.regularRating || 'UNR',
                "Status": status,
                "Invoice #": p.invoiceNumber || 'N/A'
            };
        });

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const fileNameSuffix = `${type}_registrations`;
        link.setAttribute('download', `${selectedEventForReg.name.replace(/\s+/g, "_")}_${fileNameSuffix}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (type === 'registered') {
            const newlyDownloadedIds = playerList.map(p => p.player.id);
            const updatedDownloads = {
                ...downloadedPlayers,
                [selectedEventForReg.id]: [...(downloadedPlayers[selectedEventForReg.id] || []), ...newlyDownloadedIds]
            };
            setDownloadedPlayers(updatedDownloads);
            localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
        }
        
        toast({ title: 'Export Complete', description: `${playerList.length} players exported.`});
    };
  
  const handleResetAll = () => {
    if (!selectedEventForReg) return;
    const updatedDownloads = { ...downloadedPlayers };
    delete updatedDownloads[selectedEventForReg.id];
    setDownloadedPlayers(updatedDownloads);
    localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
    toast({ title: 'Status Reset', description: 'All players for this event are now marked as "Registered".' });
  };
  
  const togglePlayerStatus = (playerId: string) => {
    if (!selectedEventForReg) return;
    const currentExported = downloadedPlayers[selectedEventForReg.id] || [];
    const isExported = currentExported.includes(playerId);
    
    let newExported: string[];
    if (isExported) {
      newExported = currentExported.filter(id => id !== playerId);
    } else {
      newExported = [...currentExported, playerId];
    }
    
    const updatedDownloads = { ...downloadedPlayers, [selectedEventForReg.id]: newExported };
    setDownloadedPlayers(updatedDownloads);
    localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
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
          {profile?.role === 'organizer' && (
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileImport} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Import Events</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                      Import Events from CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsPasteDialogOpen(true)}>
                      Paste from Sheet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleAddEvent}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Event
              </Button>
              <Button variant="destructive" onClick={() => setIsClearAlertOpen(true)}>
                <Delete className="mr-2 h-4 w-4" /> Clear All Events
              </Button>
            </div>
          )}
        </div>
        
        <Card>
          <CardHeader>
              <CardTitle>All Events</CardTitle>
              <div className="flex justify-between items-center">
                <CardDescription>
                  A list of all upcoming and past events.
                </CardDescription>
                <div className="flex items-center gap-4">
                  <RadioGroup value={eventTypeFilter} onValueChange={(v) => setEventTypeFilter(v as 'real' | 'test')} className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="real" id="real-events" />
                      <Label htmlFor="real-events">Real Events</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="test" id="test-events" />
                      <Label htmlFor="test-events">Test Events</Label>
                    </div>
                  </RadioGroup>

                  <div className="w-64">
                    <Select value={districtFilter} onValueChange={setDistrictFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter by district..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Districts</SelectItem>
                            {uniqueDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-0"><Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('name')}>Event Name {getSortIcon('name')}</Button></TableHead>
                  <TableHead className="p-0"><Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('date')}>Date {getSortIcon('date')}</Button></TableHead>
                  <TableHead className="p-0"><Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('district')}>District {getSortIcon('district')}</Button></TableHead>
                  <TableHead className="p-0"><Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('location')}>Location {getSortIcon('location')}</Button></TableHead>
                  <TableHead className="p-0"><Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('regularFee')}>Fees {getSortIcon('regularFee')}</Button></TableHead>
                  <TableHead className="p-0"><Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('status')}>Status {getSortIcon('status')}</Button></TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEvents.map((event) => {
                  const status = getEventStatus(event);
                  const district = getDistrictForLocation(event.location);
                  const displayDistrict = district === 'PHARR-SAN JUAN-ALAMO ISD' ? 'PSJA' : district;
                  
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>{format(new Date(event.date), 'PPP')}</TableCell>
                      <TableCell>{displayDistrict}</TableCell>
                      <TableCell>{event.location}</TableCell>
                      <TableCell>${event.regularFee} / ${event.lateFee} / ${event.veryLateFee} / ${event.dayOfFee}</TableCell>
                      <TableCell><Badge variant={status === 'Open' ? 'default' : status === 'Closed' ? 'destructive' : 'secondary'} className={cn(status === 'Open' ? 'bg-green-600 text-white' : '')}>{status}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleViewRegistrations(event)}><Users className="mr-2 h-4 w-4" />View Registrations</DropdownMenuItem>
                            {profile?.role === 'organizer' && (
                              <>
                                <DropdownMenuItem onClick={() => handleEditEvent(event)}><FilePenLine className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/organizer-registration?eventId=${event.id}`}><PlusCircle className="mr-2 h-4 w-4" />Register Players</Link></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteEvent(event)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            <DialogDescription>{editingEvent ? 'Update the event details below.' : 'Fill in the form to create a new event.'}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <Form {...form}>
              <form id="event-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Event Name</FormLabel><FormControl><Input placeholder="e.g., Spring Open 2024" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="location" render={({ field }) => ( <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="e.g., City Convention Center" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Event Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus captionLayout="dropdown-buttons" fromYear={new Date().getFullYear()} toYear={new Date().getFullYear() + 10}/></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="rounds" render={({ field }) => ( <FormItem><FormLabel>Rounds</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                </div>
                <div>
                  <Label>Registration Fees</Label>
                  <Card className="p-4 mt-2 bg-muted/50"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <FormField control={form.control} name="regularFee" render={({ field }) => ( <FormItem><FormLabel>Regular Fee ($)</FormLabel><FormControl><Input type="number" placeholder="20" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                      <FormField control={form.control} name="lateFee" render={({ field }) => ( <FormItem><FormLabel>Late Fee ($)</FormLabel><FormControl><Input type="number" placeholder="25" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                      <FormField control={form.control} name="veryLateFee" render={({ field }) => ( <FormItem><FormLabel>Very Late Fee ($)</FormLabel><FormControl><Input type="number" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                      <FormField control={form.control} name="dayOfFee" render={({ field }) => ( <FormItem><FormLabel>Day of Fee ($)</FormLabel><FormControl><Input type="number" placeholder="35" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  </div></Card>
                </div>
                <div className="space-y-4">
                  <FormField control={form.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel>Image URL (Optional)</FormLabel><FormControl><Input placeholder="https://placehold.co/100x100.png" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="imageName" render={({ field }) => ( <FormItem><FormLabel>Image Name (Optional)</FormLabel><FormControl><Input placeholder="e.g., Event Banner" {...field} /></FormControl><FormDescription>A descriptive name for the image attachment.</FormDescription><FormMessage /></FormItem> )}/>
                </div>
                <div className="space-y-4">
                  <FormField control={form.control} name="pdfUrl" render={({ field }) => ( <FormItem><FormLabel>PDF Flyer URL (Optional)</FormLabel><FormControl><Input placeholder="https://example.com/flyer.pdf" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="pdfName" render={({ field }) => ( <FormItem><FormLabel>PDF Name (Optional)</FormLabel><FormControl><Input placeholder="e.g., Official Flyer" {...field} /></FormControl><FormDescription>A descriptive name for the PDF attachment.</FormDescription><FormMessage /></FormItem> )}/>
                </div>
                <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="isClosed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Close Registrations
                            </FormLabel>
                            <FormDescription>
                              Check this box to prevent any new registrations for this event.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isPsjaOnly"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Restrict to PSJA Students
                            </FormLabel>
                            <FormDescription>
                              Only allow sponsors and parents of students in PHARR-SAN JUAN-ALAMO ISD to register.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                </div>
              </form>
            </Form>
          </div>
          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" form="event-form">{editingEvent ? 'Save Changes' : 'Create Event'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the event "{eventToDelete?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Events?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete all events from the list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearEvents} className="bg-destructive hover:bg-destructive/90">Clear Events</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isRegistrationsOpen} onOpenChange={setIsRegistrationsOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Registrations for {selectedEventForReg?.name}</DialogTitle>
            <DialogDescription className="sr-only">
              View registrations for the selected event.
            </DialogDescription>
             <div className="flex items-center gap-4 text-sm pt-2">
               <Badge variant="outline">Registered: {registeredPlayers.length}</Badge>
               <Badge variant="secondary">Exported: {exportedPlayers.length}</Badge>
             </div>
          </DialogHeader>
          
          <div className="space-y-4">
            {profile?.role === 'organizer' && (
                <div className="border border-amber-500 bg-amber-50 rounded-lg p-4 inline-block">
                    <p className="text-sm font-medium italic text-amber-800 mb-2">For SwissSys only:</p>
                    <div className='flex items-center gap-2'>
                        <Button 
                            onClick={() => handleDownload(registeredPlayers, 'registered')} 
                            disabled={registeredPlayers.length === 0} 
                            size="sm"
                            className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export Registered Players ({registeredPlayers.length})
                        </Button>
                        <Button 
                            onClick={() => handleDownload(exportedPlayers, 'exported')} 
                            disabled={exportedPlayers.length === 0} 
                            size="sm"
                            className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Exported List ({exportedPlayers.length})
                        </Button>
                    </div>
                </div>
            )}
            <div className='flex items-center gap-4 mt-2'>
                <Button onClick={() => handleDownload(registrations, 'all')} size="sm" variant="outline">
                    Download All Registrations ({registrations.length})
                </Button>
                {profile?.role === 'organizer' && (
                  <Button variant="link" size="sm" onClick={handleResetAll} className="text-xs">Reset All Player Statuses</Button>
                )}
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
                    <TableHead>Status</TableHead>
                    <TableHead>Invoice #</TableHead>
                    {profile?.role === 'organizer' && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.length === 0 ? ( <TableRow><TableCell colSpan={profile?.role === 'organizer' ? 7 : 6} className="h-24 text-center">No players registered yet.</TableCell></TableRow> ) : (
                  registrations.map(({ player, details, invoiceNumber }) => {
                    const isWithdrawn = details.status === 'withdrawn';
                    const isExported = selectedEventForReg && (downloadedPlayers[selectedEventForReg.id] || []).includes(player.id);
                    let status: React.ReactNode = <Badge variant="secondary">Registered</Badge>;
                    if(isWithdrawn) status = <Badge variant="destructive">Withdrawn</Badge>;
                    else if(isExported) status = <Badge variant="default" className="bg-green-600 text-white">Exported</Badge>;
                    
                    return (
                        <TableRow key={player.id} className={cn(isWithdrawn && 'text-muted-foreground opacity-60')}>
                            <TableCell className={cn("font-medium", isWithdrawn && "line-through")}>
                                <div className="flex items-center gap-2">
                                  {player.firstName} {player.lastName}
                                  {player.studentType === 'gt' && <Badge variant="secondary" className="bg-yellow-200 text-yellow-800">GT</Badge>}
                                  {player.studentType === 'independent' && <Badge variant="secondary" className="bg-purple-200 text-purple-800">IND</Badge>}
                                </div>
                            </TableCell>
                            <TableCell>{player.uscfId}</TableCell>
                            <TableCell>{player.school}</TableCell>
                            <TableCell>{details.section}</TableCell>
                            <TableCell>{status}</TableCell>
                            <TableCell>{invoiceNumber || 'N/A'}</TableCell>
                            {profile?.role === 'organizer' && !isWithdrawn && (
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => togglePlayerStatus(player.id)}>
                                  Change Status
                                </Button>
                              </TableCell>
                            )}
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
            <DialogDescription>Copy event data from your spreadsheet and paste it into the text area below.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Tabs defaultValue="events"><TabsList className="grid w-full grid-cols-1"><TabsTrigger value="events">Import Events</TabsTrigger></TabsList>
              <TabsContent value="events"><Textarea placeholder="Paste event data here..." className="h-64" value={pasteData} onChange={(e) => setPasteData(e.target.value)} /></TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button onClick={handlePasteImport}><ClipboardPaste className="mr-2 h-4 w-4" />Import Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export default function ManageEventsPage() {
  return (
    <OrganizerGuard>
      <ManageEventsContent />
    </OrganizerGuard>
  );
}
