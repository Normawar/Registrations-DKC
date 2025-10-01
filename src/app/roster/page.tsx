
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getUserRole } from '@/lib/role-utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid } from 'date-fns';
import Papa from 'papaparse';
import { AppLayout } from '@/components/app-layout';
import { AuthGuard } from '@/app/auth-guard';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, PlusCircle, Trash2, Edit, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Check, FilePenLine, History, UserPlus, Download } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { generateTeamCode } from '@/lib/school-utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';


// --- Form Schema and Type Definitions ---
const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12, };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12, 'Championship': 12 };

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First Name is required."),
  middleName: z.string().optional().transform(val => val === '' ? undefined : val),
  lastName: z.string().min(1, "Last Name is required."),
  uscfId: z.string().min(1, "USCF ID is required."),
  uscfExpiration: z.date().optional(),
  regularRating: z.coerce.number().optional(),
  grade: z.string().optional(),
  section: z.string().optional(),
  email: z.string().email("Invalid email.").min(1, "Email is required."),
  zipCode: z.string().min(1, "Zip Code is required."),
  phone: z.string().optional(),
  dob: z.date().optional(),
  studentType: z.string().optional(),
  state: z.string().optional(),
  school: z.string().min(1, "School is required."),
  district: z.string().min(1, "District is required."),
}).refine(data => data.uscfId.toUpperCase() !== 'NEW' ? data.uscfExpiration !== undefined : true, {
  message: "USCF Expiration is required unless ID is NEW.",
  path: ["uscfExpiration"],
}).refine(data => {
  if (!data.grade || !data.section || data.section === 'Championship') return true;
  const playerGrade = gradeToNumber[data.grade];
  const sectionMax = sectionMaxGrade[data.section];
  return playerGrade <= sectionMax;
}, {
  message: "Player's grade is too high for this section.",
  path: ["section"],
});

type PlayerFormValues = z.infer<typeof playerFormSchema>;

// --- Reusable Components ---

const DateInput = React.forwardRef<HTMLInputElement, { value?: Date; onChange?: (date: Date | undefined) => void; placeholder?: string; }>(({ value, onChange, placeholder }, ref) => {
  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    setTextValue(value instanceof Date && isValid(value) ? format(value, 'MM/dd/yyyy') : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value;
    setTextValue(str);
    if (!str) {
      onChange?.(undefined);
      return;
    }
    // Basic regex for MM/DD/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      const [month, day, year] = str.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      if (isValid(date)) {
        onChange?.(date);
      }
    }
  };

  return <Input ref={ref} type="text" value={textValue} onChange={handleChange} placeholder={placeholder || 'MM/DD/YYYY'} />;
});
DateInput.displayName = 'DateInput';

const ChangeHistorySection = ({ player }: { player: MasterPlayer | null }) => {
    if (!player) return null;
    return (
        <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" /> Record Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/30">
                <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">CREATED</h4>
                    <p>{player.dateCreated ? format(new Date(player.dateCreated), 'Pp') : 'N/A'} by {player.createdBy || 'N/A'}</p>
                </div>
                <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">LAST UPDATED</h4>
                     <p>{player.dateUpdated ? format(new Date(player.dateUpdated), 'Pp') : 'N/A'} by {player.updatedBy || 'N/A'}</p>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Content ---

function RosterPageContent() {
    const { profile, isProfileLoaded, updateProfile } = useSponsorProfile();
    const { dbDistricts, getSchoolsForDistrict, addPlayer, updatePlayer, deletePlayer } = useMasterDb(); // Still using context for actions and static data
    const { toast } = useToast();
    
    // State for data fetching and UI
    const [roster, setRoster] = useState<MasterPlayer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for dialogs and forms
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
    const [schoolsForEditDistrict, setSchoolsForEditDistrict] = useState<string[]>([]);

    const form = useForm<PlayerFormValues>({ resolver: zodResolver(playerFormSchema) });
    const editDistrict = form.watch('district');

    // --- DATA FETCHING: Use the new /api/roster endpoint ---
    const fetchRoster = useCallback(async () => {
        if (!isProfileLoaded || !profile) return;
        setIsLoading(true);
        setError(null);

        const userRole = getUserRole(profile);
        let url = '/api/roster';
        let params = new URLSearchParams();

        if (userRole === 'organizer') {
            // Organizers can see everything, but for performance, let's not load all by default.
            // This part can be enhanced with filters.
            setIsLoading(false);
            return; // Or load a specific default view
        } else if (userRole === 'sponsor' || userRole === 'district_coordinator') {
            if (profile.district) params.append('district', profile.district);
            if (profile.school) params.append('school', profile.school);
        } else if (userRole === 'individual' && profile.studentIds) {
            if (profile.studentIds.length > 0) {
                 params.append('playerIds', profile.studentIds.join(','));
            } else {
                setRoster([]);
                setIsLoading(false);
                return;
            }
        }

        try {
            const response = await fetch(`${url}?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch roster data.');
            const data = await response.json();
            setRoster(data);
        } catch (e: any) {
            setError(e.message);
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [profile, isProfileLoaded, toast]);

    useEffect(() => {
        fetchRoster();
    }, [fetchRoster]);

    // --- Form and Dialog Logic ---
    useEffect(() => {
        if (editDistrict) {
            setSchoolsForEditDistrict(getSchoolsForDistrict(editDistrict));
        }
    }, [editDistrict, getSchoolsForDistrict]);

    useEffect(() => {
        if (playerToEdit) {
            form.reset({
                ...playerToEdit,
                dob: playerToEdit.dob ? new Date(playerToEdit.dob) : undefined,
                uscfExpiration: playerToEdit.uscfExpiration ? new Date(playerToEdit.uscfExpiration) : undefined,
            });
        } else if (profile) {
            // Pre-fill for new players based on user profile
            form.reset({
                id: `temp_${Date.now()}`,
                uscfId: 'NEW',
                district: profile.district,
                school: profile.school,
                email: profile.email,
                zipCode: profile.zip,
            });
        }
    }, [playerToEdit, form, profile]);

    const handleEditPlayer = (player: MasterPlayer) => {
        setPlayerToEdit(player);
        setIsEditOpen(true);
    };

    const handleCreateNewPlayer = () => {
        setPlayerToEdit(null);
        setIsEditOpen(true);
    };

    const handlePlayerSelectedFromSearch = (player: MasterPlayer) => {
        // Logic to add player to user's context (e.g., individual's studentIds)
        if (getUserRole(profile) === 'individual') {
             const isAlreadyInRoster = profile?.studentIds?.includes(player.id);
             if (isAlreadyInRoster) {
                 toast({ title: "Player Already in Roster" });
                 handleEditPlayer(player); // Open for editing instead
             } else {
                 const updatedStudentIds = [...(profile?.studentIds || []), player.id];
                 updateProfile({ studentIds: updatedStudentIds }).then(() => {
                     toast({ title: "Player Added", description: `${player.firstName} has been added to your roster.` });
                     fetchRoster(); // Refetch the roster
                 });
             }
        } else {
            // For sponsors, player is likely already in their roster if searchable
            // Just open the edit dialog
            handleEditPlayer(player);
        }
        setIsSearchOpen(false);
    };
    
    const onEditSubmit = async (values: PlayerFormValues) => {
      if (!profile) return;
      
      try {
          if (playerToEdit) {
              const updatedPlayer: MasterPlayer = { ...playerToEdit, ...values };
              await updatePlayer(updatedPlayer, profile);
              toast({ title: "Player Updated" });
          } else {
              const newPlayer: MasterPlayer = { ...values, id: values.id || `temp_${Date.now()}` } as MasterPlayer;
              await addPlayer(newPlayer, profile);
              toast({ title: "Player Created" });
          }
          fetchRoster(); // Refresh data
          setIsEditOpen(false);
      } catch(e: any) {
          toast({ title: "Save Failed", description: e.message, variant: "destructive" });
      }
    };

    const handleDeletePlayer = async (player: MasterPlayer) => {
        if (window.confirm(`Are you sure you want to remove ${player.firstName} from your roster? This does not delete their master record.`)) {
            if (getUserRole(profile) === 'individual') {
                const updatedStudentIds = profile.studentIds?.filter(id => id !== player.id);
                await updateProfile({ studentIds: updatedStudentIds });
                toast({ title: 'Student Removed' });
                fetchRoster(); // Refresh
            } else {
                toast({ title: 'Not Supported', description: 'Sponsors cannot remove players. Please contact an organizer.' });
            }
        }
    };
    
    // --- Render Logic ---
    if (isLoading) return <div>Loading your roster...</div>;
    if (error) return <div className='text-red-500'>Error: {error}</div>;
    if (!profile) return <div>Could not load user profile.</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">My Roster</h1>
                    <p className="text-muted-foreground">Manage your players and students.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsSearchOpen(true)}><UserPlus className="mr-2 h-4 w-4"/> Find & Add Player</Button>
                    <Button onClick={handleCreateNewPlayer}><PlusCircle className="mr-2 h-4 w-4"/> Create New Player</Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{getUserRole(profile) === 'individual' ? 'My Students' : 'School Roster'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>USCF ID</TableHead>
                                <TableHead>Grade</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {roster.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center h-24">No players on this roster yet.</TableCell></TableRow>
                            ) : (
                                roster.map(player => (
                                    <TableRow key={player.id}>
                                        <TableCell>{player.firstName} {player.lastName}</TableCell>
                                        <TableCell>{player.uscfId}</TableCell>
                                        <TableCell>{player.grade}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => handleEditPlayer(player)}><Edit className="h-4 w-4" /></Button>
                                            {getUserRole(profile) === 'individual' && (
                                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeletePlayer(player)}><Trash2 className="h-4 w-4" /></Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* --- Dialogs --- */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>{playerToEdit ? 'Edit Player' : 'Create New Player'}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="-mx-6 pr-6 pl-6">
                        <div className="pt-4">
                            <Form {...form}>
                                <form id="player-form" onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-6">
                                    {/* Form Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><Select onValueChange={v => { field.onChange(v); form.setValue('school', ''); }} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="school" render={({ field }) => (<FormItem><FormLabel>School</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{schoolsForEditDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="uscfId" render={({ field }) => (<FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Use 'NEW' for new players.</FormDescription><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="uscfExpiration" render={({ field }) => (<FormItem><FormLabel>USCF Expiration</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="grade" render={({ field }) => (<FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <ChangeHistorySection player={playerToEdit} />
                                </form>
                            </Form>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button type="submit" form="player-form">{playerToEdit ? 'Save Changes' : 'Create Player'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <EnhancedPlayerSearchDialog
                isOpen={isSearchOpen}
                onOpenChange={setIsSearchOpen}
                onPlayerSelected={handlePlayerSelectedFromSearch}
                userProfile={profile}
                preFilterByUserProfile={getUserRole(profile) !== 'organizer'}
            />
        </div>
    );
}

// Organizer-specific content is now separated for clarity.
function OrganizerRosterPage() {
    const { dbDistricts, getSchoolsForDistrict, deletePlayer, updatePlayer, addPlayer } = useMasterDb();
    const { profile } = useSponsorProfile();
    const { toast } = useToast();

    const [players, setPlayers] = useState<MasterPlayer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
    const [selectedSchool, setSelectedSchool] = useState<string>('all');

    const fetchPlayers = useCallback(async (district: string | null) => {
        if (!district) {
            setPlayers([]);
            return;
        }
        setIsLoading(true);
        const params = new URLSearchParams({ district });
        try {
            const res = await fetch(`/api/roster?${params.toString()}`);
            const data = await res.json();
            setPlayers(data);
        } catch (e) {
            toast({ title: "Error fetching players", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchPlayers(selectedDistrict);
    }, [selectedDistrict, fetchPlayers]);

    const schoolsForDistrict = useMemo(() => {
        return selectedDistrict ? getSchoolsForDistrict(selectedDistrict) : [];
    }, [selectedDistrict, getSchoolsForDistrict]);

    const filteredPlayers = useMemo(() => {
        if (selectedSchool === 'all') return players;
        return players.filter(p => p.school === selectedSchool);
    }, [players, selectedSchool]);
    
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold font-headline">Organizer Roster Management</h1>
            <Card>
                <CardHeader>
                    <div className="flex gap-4">
                        <Select onValueChange={setSelectedDistrict} value={selectedDistrict || ''}>
                            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select a District" /></SelectTrigger>
                            <SelectContent>{dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select onValueChange={setSelectedSchool} value={selectedSchool} disabled={!selectedDistrict}>
                             <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select a School" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Schools</SelectItem>
                                {schoolsForDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Loading...</p> : 
                        <p>{filteredPlayers.length} players found.</p>
                        // Full organizer table display would go here
                    }
                </CardContent>
            </Card>
        </div>
    )
}


export default function RosterPage() {
    const { profile, isProfileLoaded } = useSponsorProfile();

    if (!isProfileLoaded) {
        return <AppLayout><div>Loading...</div></AppLayout>;
    }

    return (
        <AuthGuard>
            <AppLayout>
                {getUserRole(profile) === 'organizer' ? (
                    <OrganizerRosterPage />
                ) : (
                    <RosterPageContent />
                )}
            </AppLayout>
        </AuthGuard>
    );
}
