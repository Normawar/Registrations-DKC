'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getUserRole } from '@/lib/role-utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid } from 'date-fns';
import { AppLayout } from '@/components/app-layout';
import { AuthGuard } from '@/app/auth-guard';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Edit, UserPlus, History } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// Form Schema and Type Definitions
const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12 };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12, 'Championship': 12 };

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First Name is required."),
  middleName: z.string().optional().transform(val => val === '' ? undefined : val),
  lastName: z.string().min(1, "Last Name is required."),
  uscfId: z.string().min(1, "USCF ID is required."),
  uscfExpiration: z.date().optional(),
  regularRating: z.preprocess(
    (val) => {
      if (!val || String(val).toUpperCase() === 'UNR' || val === '') {
        return undefined;
      }
      return val;
    },
    z.coerce.number({
      invalid_type_error: "Rating must be a number or UNR."
    }).optional()
  ),
  grade: z.string().optional().transform(val => val === '' ? undefined : val),
  section: z.string().optional().transform(val => val === '' ? undefined : val),
  email: z.string().email("Invalid email.").min(1, "Email is required."),
  zipCode: z.string().min(1, "Zip Code is required."),
  phone: z.string().optional().transform(val => val === '' ? undefined : val),
  dob: z.date().optional(),
  studentType: z.string().optional().transform(val => val === '' ? undefined : val),
  state: z.string().optional().transform(val => val === '' ? undefined : val),
  school: z.string().min(1, "School is required."),
  district: z.string().min(1, "District is required."),
}).refine(data => data.uscfId.toUpperCase() !== 'NEW' ? data.uscfExpiration !== undefined : true, {
  message: "USCF Expiration is required unless ID is NEW.",
  path: ["uscfExpiration"],
}).refine(data => {
  if (!data.grade || !data.section || data.section === 'Championship') return true;
  const playerGrade = gradeToNumber[data.grade];
  const sectionMax = sectionMaxGrade[data.section];
  if (playerGrade === undefined || sectionMax === undefined) return true;
  return playerGrade <= sectionMax;
}, {
  message: "Player's grade is too high for this section.",
  path: ["section"],
});

type PlayerFormValues = z.infer<typeof playerFormSchema>;

// Date Input Component
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

// Change History Component
const ChangeHistorySection = ({ player }: { player: MasterPlayer | null }) => {
  if (!player) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Record Information
        </h3>
        <div className="p-6 text-center text-muted-foreground border rounded-md bg-muted/30">
          Record information will be available after the player is created.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-muted-foreground" />
        Record Information
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-muted/30">
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-2">RECORD CREATED</h4>
          <p className="text-sm font-semibold">
            {player.dateCreated ? format(new Date(player.dateCreated), 'PPP p') : 'Unknown Date'}
          </p>
          <p className="text-xs text-muted-foreground">
            Created by: {player.createdBy || 'Unknown User'}
          </p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-2">LAST UPDATED</h4>
          <p className="text-sm font-semibold">
            {player.dateUpdated 
              ? format(new Date(player.dateUpdated), 'PPP p') 
              : (player.dateCreated ? format(new Date(player.dateCreated), 'PPP p') : 'Unknown Date')
            }
          </p>
          <p className="text-xs text-muted-foreground">
            Updated by: {player.updatedBy || player.createdBy || 'Unknown User'}
          </p>
        </div>
      </div>

      {player.changeHistory && player.changeHistory.length > 0 ? (
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-3">CHANGE HISTORY</h4>
          <div className="space-y-3 border rounded-md p-4 max-h-64 overflow-y-auto bg-background">
            {player.changeHistory.slice().reverse().map((entry, index) => (
              <div key={entry.timestamp || index} className="text-sm border-l-2 border-muted-foreground pl-4 pb-3 last:pb-0">
                <p className="font-medium text-foreground">
                  {format(new Date(entry.timestamp), 'PPP p')} by {entry.userName}
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {entry.changes.map((change, changeIndex) => (
                    <li key={changeIndex} className="text-xs text-muted-foreground">
                      Field <span className="font-semibold text-foreground">{change.field}</span> changed from 
                      <span className="italic text-red-600 mx-1">'{String(change.oldValue)}'</span> to 
                      <span className="italic text-green-600 mx-1">'{String(change.newValue)}'</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-3">CHANGE HISTORY</h4>
          <div className="p-4 text-center text-xs text-muted-foreground border rounded-md bg-muted/20">
            No changes recorded for this player.
          </div>
        </div>
      )}
    </div>
  );
};

// Main Roster Page Content
function RosterPageContent() {
  const { profile, isProfileLoaded, updateProfile } = useSponsorProfile();
  const { dbDistricts, getSchoolsForDistrict, addPlayer, updatePlayer, deletePlayer } = useMasterDb();
  const { toast } = useToast();
  
  const [roster, setRoster] = useState<MasterPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
  const [schoolsForEditDistrict, setSchoolsForEditDistrict] = useState<string[]>([]);

  const form = useForm<PlayerFormValues>({ resolver: zodResolver(playerFormSchema) });
  const editDistrict = form.watch('district');

  // Data Fetching
  const fetchRoster = useCallback(async () => {
    if (!isProfileLoaded || !profile) return;
    setIsLoading(true);
    setError(null);

    const userRole = getUserRole(profile);
    let url = '/api/roster';
    let params = new URLSearchParams();

    if (userRole === 'organizer') {
      setIsLoading(false);
      return;
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

  // Form Logic
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
      if (playerToEdit.district) {
        setSchoolsForEditDistrict(getSchoolsForDistrict(playerToEdit.district));
      }
    } else if (profile) {
      form.reset({
        id: `temp_${Date.now()}`,
        uscfId: 'NEW',
        district: profile.district,
        school: profile.school,
        email: profile.email,
        zipCode: profile.zip,
      });
    }
  }, [playerToEdit, form, profile, getSchoolsForDistrict]);

  const handleEditPlayer = (player: MasterPlayer) => {
    setPlayerToEdit(player);
    setIsEditOpen(true);
  };

  const handleCreateNewPlayer = () => {
    setPlayerToEdit(null);
    setIsEditOpen(true);
  };

  const handlePlayerSelectedFromSearch = (player: MasterPlayer) => {
    if (getUserRole(profile) === 'individual') {
      const isAlreadyInRoster = profile?.studentIds?.includes(player.id);
      if (isAlreadyInRoster) {
        toast({ title: "Player Already in Roster" });
        handleEditPlayer(player);
      } else {
        const updatedStudentIds = [...(profile?.studentIds || []), player.id];
        updateProfile({ studentIds: updatedStudentIds }).then(() => {
          toast({ title: "Player Added", description: `${player.firstName} has been added to your roster.` });
          fetchRoster();
        });
      }
    } else {
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
        const newPlayer: MasterPlayer = { 
          ...values, 
          id: values.id || `temp_${Date.now()}`,
          events: 0,
          eventIds: []
        } as MasterPlayer;
        await addPlayer(newPlayer, profile);
        toast({ title: "Player Created" });
      }
      fetchRoster();
      setIsEditOpen(false);
      setPlayerToEdit(null);
    } catch(e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDeletePlayer = async (player: MasterPlayer) => {
    if (window.confirm(`Are you sure you want to remove ${player.firstName} from your roster?`)) {
      if (getUserRole(profile) === 'individual') {
        const updatedStudentIds = profile.studentIds?.filter(id => id !== player.id);
        await updateProfile({ studentIds: updatedStudentIds });
        toast({ title: 'Student Removed' });
        fetchRoster();
      } else {
        toast({ title: 'Not Supported', description: 'Sponsors cannot remove players. Please contact an organizer.' });
      }
    }
  };
  
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
          <Button variant="outline" onClick={() => setIsSearchOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4"/> Find & Add Player
          </Button>
          <Button onClick={handleCreateNewPlayer}>
            <PlusCircle className="mr-2 h-4 w-4"/> Create New Player
          </Button>
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
                      <Button variant="ghost" size="sm" onClick={() => handleEditPlayer(player)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {getUserRole(profile) === 'individual' && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeletePlayer(player)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Enhanced Player Edit Dialog with ScrollArea */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>{playerToEdit ? 'Edit Player' : 'Create New Player'}</DialogTitle>
            <DialogDescription>
              {playerToEdit ? 'Modify the player\'s information below.' : 'Enter the details for the new player.'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              <Form {...form}>
                <form id="edit-player-form" onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-6">
                  
                  {/* Player Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Player Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={form.control} name="firstName" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem> 
                      )}/>
                      <FormField control={form.control} name="lastName" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem> 
                      )}/>
                      <FormField control={form.control} name="middleName" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>Middle Name</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem> 
                      )}/>
                    </div>
                  </div>

                  {/* School Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">School Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="district" render={({ field }) => (
                        <FormItem>
                          <FormLabel>District *</FormLabel>
                          <Select onValueChange={(v) => { 
                            field.onChange(v); 
                            setSchoolsForEditDistrict(getSchoolsForDistrict(v)); 
                            form.setValue('school', ''); 
                          }} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="school" render={({ field }) => (
                        <FormItem>
                          <FormLabel>School *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {schoolsForEditDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {editDistrict === 'PHARR-SAN JUAN-ALAMO ISD' && (
                      <FormField
                        control={form.control}
                        name="studentType"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Student Type</FormLabel>
                            <FormControl>
                              <RadioGroup 
                                onValueChange={field.onChange} 
                                value={field.value || 'independent'} 
                                className="flex items-center space-x-4"
                              >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl><RadioGroupItem value="independent" /></FormControl>
                                  <FormLabel className="font-normal">Independent</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl><RadioGroupItem value="gt" /></FormControl>
                                  <FormLabel className="font-normal">GT (Gifted & Talented)</FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {/* Chess Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Chess Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="uscfId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>USCF ID *</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormDescription>Enter USCF ID number or "NEW" for new players.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="regularRating" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rating</FormLabel>
                          <FormControl>
                            <Input 
                              type="text" 
                              placeholder="e.g., 1500, UNR, or NEW" 
                              value={field.value?.toString() || ''} 
                              onChange={(e) => { 
                                const value = e.target.value; 
                                if (value === '' || value.toUpperCase() === 'UNR' || value.toUpperCase() === 'NEW') { 
                                  field.onChange(undefined); 
                                } else { 
                                  field.onChange(value); 
                                } 
                              }} 
                            />
                          </FormControl>
                          <FormDescription>Enter rating, UNR, or NEW</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="uscfExpiration" render={({ field }) => (
                        <FormItem>
                          <FormLabel>USCF Expiration</FormLabel>
                          <FormControl>
                            <DateInput value={field.value} onChange={field.onChange} placeholder="MM/DD/YYYY" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="dob" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <DateInput value={field.value} onChange={field.onChange} placeholder="MM/DD/YYYY" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="grade" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grade</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                            </FormControl>
                            <SelectContent position="item-aligned">
                              {grades.map(grade => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="section" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Section</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                            </FormControl>
                            <SelectContent position="item-aligned">
                              {sections.map(section => <SelectItem key={section} value={section}>{section}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Contact Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl><Input type="email" {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="zipCode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code *</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="state" render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <ChangeHistorySection player={playerToEdit} />

                </form>
              </Form>
            </div>
          </ScrollArea>

          <div className="p-6 pt-4 border-t bg-muted/30 shrink-0">
            <div className="flex justify-between">
              {playerToEdit && getUserRole(profile) === 'individual' && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => {
                    handleDeletePlayer(playerToEdit);
                    setIsEditOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove From My List
                </Button>
              )}
              
              {!playerToEdit && <div></div>}
              
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" form="edit-player-form">
                  {playerToEdit ? 'Save Changes' : 'Create Player'}
                </Button>
              </div>
            </div>
          </div>
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

export default function RosterPage() {
  const { profile, isProfileLoaded } = useSponsorProfile();

  if (!isProfileLoaded) {
    return <AppLayout><div>Loading...</div></AppLayout>;
  }

  return (
    <AuthGuard>
      <AppLayout>
        <RosterPageContent />
      </AppLayout>
    </AuthGuard>
  );
}