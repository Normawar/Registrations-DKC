
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  uscfExpiration: z.date().optional(),
  regularRating: z.coerce.number().optional(),
  quickRating: z.string().optional(),
  grade: z.string().min(1, { message: "Please select a grade." }),
  section: z.string().min(1, { message: "Please select a section." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phone: z.string().optional(),
  dob: z.date({ required_error: "Date of birth is required."}),
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
    return data.regularRating !== undefined && data.regularRating !== null && !isNaN(data.regularRating);
  }
  return true;
}, {
  message: "Rating is required unless USCF ID is NEW.",
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
  
  const { profile } = useSponsorProfile();
  const { database: allPlayers, setDatabase: setAllPlayers, isDbLoaded } = useMasterDb();
  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;

  const rosterPlayers = useMemo(() => {
    if (!profile || !isDbLoaded || profile.role !== 'sponsor') return [];
    return allPlayers.filter(p => p.district === profile.district && p.school === profile.school);
  }, [allPlayers, profile, isDbLoaded]);

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
        });
      }
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
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from the roster.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  function onSubmit(values: PlayerFormValues) {
    if (!profile) return;

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

    const isDuplicatePlayer = allPlayers.some(p => 
      p.id !== values.id &&
      p.firstName.trim().toLowerCase() === values.firstName.trim().toLowerCase() &&
      p.lastName.trim().toLowerCase() === values.lastName.trim().toLowerCase() &&
      p.dob && new Date(p.dob).getTime() === values.dob.getTime()
    );

    if (isDuplicatePlayer) {
      form.setError("firstName", { type: "manual", message: "A player with this name and date of birth already exists." });
      return;
    }
    
    const isEmailUnique = !allPlayers.some(p => p.email && p.email.toLowerCase() === values.email.toLowerCase() && p.id !== values.id);

    if (!isEmailUnique) {
      const existingPlayer = allPlayers.find(p => p.email && p.email.toLowerCase() === values.email.toLowerCase());
      form.setError("email", { type: "manual", message: `Email already used by ${existingPlayer?.firstName} ${existingPlayer?.lastName}.` });
      return;
    }

    const playerRecord: MasterPlayer = {
      ...values,
      id: editingPlayer?.id || `p-${Date.now()}`,
      school: profile.school,
      district: profile.district,
      dob: values.dob.toISOString(),
      uscfExpiration: values.uscfExpiration?.toISOString(),
      events: editingPlayer?.events || 0,
      eventIds: editingPlayer?.eventIds || [],
    };

    if (editingPlayer) {
      setAllPlayers(allPlayers.map(p => p.id === editingPlayer.id ? playerRecord : p));
      toast({ title: "Player Updated", description: `${values.firstName} ${values.lastName}'s information has been updated.`});
    } else {
      setAllPlayers([...allPlayers, playerRecord]);
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
                    <TableCell>{player.regularRating || 'N/A'}</TableCell>
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
                    {editingPlayer ? "Update the player's information." : "Enter the player's details manually."}
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
                            <FormField control={form.control} name="uscfId" render={({ field }) => (
                              <FormItem>
                                <FormLabel>USCF ID</FormLabel>
                                <FormControl>
                                    <Input placeholder="12345678 or NEW" {...field} />
                                </FormControl>
                                <FormDescription>
                                    Students without a USCF ID can be added with &quot;NEW&quot;.
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
                                    <FormItem className="flex flex-col"><FormLabel>Date of Birth</FormLabel>
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
              This will permanently remove {playerToDelete?.firstName} {playerToDelete?.lastName} from your roster.
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
