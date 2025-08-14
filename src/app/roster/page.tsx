
'use client';

import { useState, useMemo, Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Search, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { generateTeamCode } from '@/lib/school-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SortableColumnKey = 'lastName' | 'teamCode' | 'uscfId' | 'regularRating' | 'grade' | 'section';

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12, };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12 };

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
}).refine(data => {
    if (data.uscfId.toUpperCase() !== 'NEW') { return data.uscfExpiration !== undefined; }
    return true;
}, { message: "USCF Expiration is required unless ID is NEW.", path: ["uscfExpiration"] })
.refine((data) => {
    if (!data.grade || !data.section || data.section === 'Championship') return true;
    const playerGradeLevel = gradeToNumber[data.grade];
    const sectionMaxLevel = sectionMaxGrade[data.section];
    if (playerGradeLevel === undefined || sectionMaxLevel === undefined) return true;
    return playerGradeLevel <= sectionMaxLevel;
  }, { message: "Player's grade is too high for this section.", path: ["section"] });

type PlayerFormValues = z.infer<typeof playerFormSchema>;

function RosterPageContent() {
  const { toast } = useToast();
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [isEditPlayerDialogOpen, setIsEditPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>(null);

  const { profile, isProfileLoaded } = useSponsorProfile();
  const { database, addPlayer, updatePlayer, isDbLoaded } = useMasterDb();
  
  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;

  const playerForm = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
  });

  const rosterPlayers = useMemo(() => {
    if (!isProfileLoaded || !isDbLoaded || !profile) return [];
    return database.filter(player => player.district === profile.district && player.school === profile.school);
  }, [database, profile, isProfileLoaded, isDbLoaded]);

  const rosterPlayerIds = useMemo(() => rosterPlayers.map(p => p.id), [rosterPlayers]);

  const sortedPlayers = useMemo(() => {
    let sortablePlayers = [...rosterPlayers];
    if (sortConfig) {
      sortablePlayers.sort((a, b) => {
        const key = sortConfig.key;
        let aVal: any = a[key as keyof MasterPlayer] ?? '';
        let bVal: any = b[key as keyof MasterPlayer] ?? '';
        
        if (key === 'teamCode' && profile) {
          aVal = generateTeamCode({ schoolName: a.school, district: a.district, studentType: a.studentType });
          bVal = generateTeamCode({ schoolName: b.school, district: b.district, studentType: b.studentType });
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortConfig.direction === 'ascending' ? result : -result;
      });
    }
    return sortablePlayers;
  }, [rosterPlayers, sortConfig, profile]);

  const requestSort = (key: SortableColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const handleEditPlayer = (player: MasterPlayer) => {
    setEditingPlayer(player);
    playerForm.reset({
        ...player,
        dob: player.dob ? new Date(player.dob) : undefined,
        uscfExpiration: player.uscfExpiration ? new Date(player.uscfExpiration) : undefined,
    });
    setIsEditPlayerDialogOpen(true);
  };
  
  const handleSelectPlayer = (player: MasterPlayer) => {
    console.log('🏠 Roster: handleSelectPlayer called with:', player.firstName, player.lastName);
    // Player is already assigned to the sponsor's school/district by the dialog
    addPlayer(player);
    toast({ title: "Player Added", description: `${player.firstName} ${player.lastName} has been added to your roster.` });
    console.log('🏠 Roster: Player added to database');
};

const handlePlayerSelectedForEdit = (player: MasterPlayer) => {
    console.log('📝 Roster: handlePlayerSelectedForEdit called with:', player.firstName, player.lastName);
    console.log('🔍 Raw player data:', player);
    
    // NEW: Log all the player properties to see what's available
    console.log('🔍 All player properties:');
    Object.keys(player).forEach(key => {
        console.log(`  ${key}:`, player[key as keyof MasterPlayer], typeof player[key as keyof MasterPlayer]);
    });
    
    console.log('🔍 Player rating:', player.regularRating, typeof player.regularRating);
    console.log('🔍 Player uscfExpiration:', player.uscfExpiration, typeof player.uscfExpiration);
    
    // Open the edit dialog with the newly added player
    setEditingPlayer(player);
    
    // Parse rating - handle both string and number formats
    let ratingValue;
    if (player.regularRating !== undefined && player.regularRating !== null) {
        if (typeof player.regularRating === 'string') {
            const numRating = parseInt(player.regularRating);
            ratingValue = isNaN(numRating) ? undefined : numRating;
        } else {
            ratingValue = player.regularRating;
        }
    }
    
    // Parse USCF expiration date - handle multiple date formats
    let uscfExpirationDate;
    if (player.uscfExpiration) {
        try {
            // Try parsing as ISO string first
            uscfExpirationDate = new Date(player.uscfExpiration);
            // Check if the date is valid
            if (isNaN(uscfExpirationDate.getTime())) {
                console.log('❌ Invalid uscfExpiration date:', player.uscfExpiration);
                uscfExpirationDate = undefined;
            } else {
                console.log('✅ Parsed uscfExpiration:', uscfExpirationDate);
            }
        } catch (error) {
            console.log('❌ Error parsing uscfExpiration:', error);
            uscfExpirationDate = undefined;
        }
    }
    
    // Parse DOB
    let dobDate;
    if (player.dob) {
        try {
            dobDate = new Date(player.dob);
            if (isNaN(dobDate.getTime())) {
                console.log('❌ Invalid dob date:', player.dob);
                dobDate = undefined;
            } else {
                console.log('✅ Parsed dob:', dobDate);
            }
        } catch (error) {
            console.log('❌ Error parsing dob:', error);
            dobDate = undefined;
        }
    }
    
    console.log('🔍 Final values for form:');
    console.log('- Rating:', ratingValue);
    console.log('- USCF Expiration:', uscfExpirationDate);
    console.log('- DOB:', dobDate);
    
    // Properly populate ALL fields from the database
    const formData = {
        id: player.id,
        firstName: player.firstName || '',
        middleName: player.middleName || '',
        lastName: player.lastName || '',
        uscfId: player.uscfId || '',
        regularRating: ratingValue, // Use the parsed rating
        grade: player.grade || '',
        section: player.section || '',
        email: player.email || '',
        phone: player.phone || '',
        zipCode: player.zipCode || '',
        studentType: player.studentType || '',
        state: player.state || '',
        school: player.school || '',
        district: player.district || '',
        dob: dobDate,
        uscfExpiration: uscfExpirationDate,
    };
    
    console.log('🔍 Form data being set:', formData);
    
    playerForm.reset(formData);
    setIsEditPlayerDialogOpen(true);
};
  
  const handleRemoveFromRoster = (player: MasterPlayer) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };
  
  const confirmRemoveFromRoster = () => {
    if (playerToDelete) {
      updatePlayer({ ...playerToDelete, school: '', district: '' });
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from your roster.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

const handlePlayerFormSubmit = async (values: PlayerFormValues) => {
    if (!editingPlayer) return;

    // For sponsors, validate required fields before saving
    const requiredFields = ['firstName', 'lastName', 'uscfId', 'email', 'grade', 'section', 'dob', 'zipCode'];
    const missingFields = requiredFields.filter(field => {
        const value = values[field as keyof PlayerFormValues];
        return !value || (typeof value === 'string' && value.trim() === '');
    });

    if (missingFields.length > 0) {
        const fieldLabels = {
            firstName: 'First Name',
            lastName: 'Last Name', 
            uscfId: 'USCF ID',
            email: 'Email',
            grade: 'Grade',
            section: 'Section',
            dob: 'Date of Birth',
            zipCode: 'Zip Code'
        };
        
        toast({
            variant: 'destructive',
            title: 'Required Information Missing',
            description: `Please complete these required fields: ${missingFields.map(f => fieldLabels[f as keyof typeof fieldLabels]).join(', ')}`
        });
        return; // Don't save until all required fields are filled
    }

    const { uscfExpiration, dob, ...restOfValues } = values;
    
    const updatedPlayerRecord: MasterPlayer = {
        ...editingPlayer,
        ...restOfValues,
        dob: dob ? dob.toISOString() : undefined,
        uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
    };
    
    await updatePlayer(updatedPlayerRecord);

    toast({ 
        title: "Player Updated", 
        description: `${values.firstName} ${values.lastName} has been successfully added to your roster with complete information.`
    });
    
    setIsEditPlayerDialogOpen(false);
    setEditingPlayer(null);
};


  if (!isProfileLoaded || !isDbLoaded) {
    return <AppLayout><Skeleton className="h-[60vh] w-full" /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Team Roster</h1>
            <p className="text-muted-foreground">
              Manage your team players and their information. ({rosterPlayers.length} players)
            </p>
          </div>
          <Button onClick={() => setIsSearchDialogOpen(true)} className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Add Player from Database
          </Button>
        </div>

        {profile && teamCode && (
          <Alert>
            <AlertTitle>Team Information</AlertTitle>
            <AlertDescription>
              <strong>School:</strong> {profile.school}<br/>
              <strong>District:</strong> {profile.district}<br/>
              <strong>Team Code:</strong> {teamCode}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader><CardTitle>Current Roster</CardTitle><CardDescription>Players registered under your school and district</CardDescription></CardHeader>
          <CardContent>
            {rosterPlayers.length === 0 ? (
              <div className="text-center py-8"><p className="text-muted-foreground">No players in your roster yet.</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('lastName')}>Player Name {getSortIcon('lastName')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('teamCode')}>Team Code {getSortIcon('teamCode')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('uscfId')}>USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('regularRating')}>Rating {getSortIcon('regularRating')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('grade')}>Grade {getSortIcon('grade')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('section')}>Section {getSortIcon('section')}</Button></TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlayers.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8"><AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback></Avatar>
                            <div>
                              <div className="font-medium">{player.firstName} {player.lastName}</div>
                              <div className="text-sm text-muted-foreground">{player.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{generateTeamCode({ schoolName: player.school, district: player.district, studentType: player.studentType })}</TableCell>
                        <TableCell>{player.uscfId}</TableCell>
                        <TableCell>{player.regularRating || 'UNR'}</TableCell>
                        <TableCell>{player.grade}</TableCell>
                        <TableCell>{player.section}</TableCell>
                         <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEditPlayer(player)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRemoveFromRoster(player)} className="text-destructive">Remove from Roster</DropdownMenuItem>
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

        <PlayerSearchDialog 
            isOpen={isSearchDialogOpen}
            onOpenChange={setIsSearchDialogOpen}
            onSelectPlayer={handleSelectPlayer}
            onPlayerSelected={handlePlayerSelectedForEdit}
            excludeIds={rosterPlayerIds}
            portalType="sponsor"
        />

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Player from Roster</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove {playerToDelete?.firstName} {playerToDelete?.lastName} from your roster, but they will remain in the master database. Are you sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemoveFromRoster} className="bg-destructive text-destructive-foreground">Remove Player</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isEditPlayerDialogOpen} onOpenChange={setIsEditPlayerDialogOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 flex flex-col">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle>Edit Player Information</DialogTitle>
                    <DialogDescription>Update the details for {editingPlayer?.firstName} {editingPlayer?.lastName}. This will update the master player record.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6">
                    <Form {...playerForm}>
                        <form id="edit-player-form" onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField control={playerForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Opt)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={playerForm.control} name="school" render={({ field }) => ( <FormItem><FormLabel>School</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="district" render={({ field }) => ( <FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={playerForm.control} name="uscfId" render={({ field }) => ( <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="1500 or UNR" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={playerForm.control} name="dob" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date of Birth</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 100} toYear={new Date().getFullYear()} initialFocus/></PopoverContent></Popover><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="uscfExpiration" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>USCF Expiration</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 2} toYear={new Date().getFullYear() + 10} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={playerForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={playerForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                        </form>
                    </Form>
                </div>
                <DialogFooter className="p-6 pt-4 border-t shrink-0">
                    <Button type="button" variant="ghost" onClick={() => setIsEditPlayerDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" form="edit-player-form">Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={<AppLayout><Skeleton className="h-96 w-full" /></AppLayout>}>
      <RosterPageContent />
    </Suspense>
  );
}

    