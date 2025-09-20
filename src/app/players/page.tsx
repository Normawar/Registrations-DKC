

// Updated src/app/players/page.tsx
'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';
import { useSearchParams, useRouter } from 'next/navigation';

import { AppLayout } from '@/components/app-layout';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CSVUploadComponent } from '@/components/csv-upload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OrganizerGuard } from '@/components/auth-guard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';


const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12, };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12, 'Championship': 12 };

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, { message: "First Name is required." }),
  middleName: z.string().optional().transform(val => val === '' ? undefined : val),
  lastName: z.string().min(1, { message: "Last Name is required." }),
  uscfId: z.string().min(1, { message: "USCF ID is required." }),
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
  email: z.string().min(1, { message: "Email is required for roster players." }).email({ message: "Please enter a valid email." }),
  zipCode: z.string().min(1, { message: "Zip Code is required for roster players." }),
  phone: z.string().optional().transform(val => val === '' ? undefined : val),
  dob: z.date().optional(),
  studentType: z.string().optional().transform(val => val === '' ? undefined : val),
  state: z.string().optional().transform(val => val === '' ? undefined : val),
  school: z.string().min(1, { message: "School name is required."}),
  district: z.string().min(1, { message: "District name is required."}),
}).refine(data => {
  if (data.uscfId.toUpperCase() !== 'NEW') { 
    return data.uscfExpiration !== undefined; 
  }
  return true;
}, { 
  message: "USCF Expiration is required unless ID is NEW.", 
  path: ["uscfExpiration"] 
}).refine((data) => {
  if (!data.grade || !data.section || data.section === 'Championship') return true;
  const playerGradeLevel = gradeToNumber[data.grade];
  const sectionMaxLevel = sectionMaxGrade[data.section];
  if (playerGradeLevel === undefined || sectionMaxLevel === undefined) return true;
  return playerGradeLevel <= sectionMaxLevel;
}, { 
  message: "Player's grade is too high for this section.", 
  path: ["section"] 
});

type PlayerFormValues = z.infer<typeof playerFormSchema>;

const DateInput = React.forwardRef<HTMLInputElement, {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}>(({ value, onChange, placeholder, className }, ref) => {
  const [displayValue, setDisplayValue] = useState('');
  
  useEffect(() => {
    const newDisplayValue = (value instanceof Date && !isNaN(value.getTime())) 
      ? format(value, 'yyyy-MM-dd') 
      : '';
    setDisplayValue(newDisplayValue);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    if (inputValue === '') {
      onChange?.(undefined);
      return;
    }

    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = inputValue.match(dateRegex);

    if (match) {
        const [, year, month, day] = match.map(Number);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            if (isValid(date)) {
                onChange?.(date);
            }
        }
    }
  };

  return (
    <Input
      ref={ref}
      type="date"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
});
DateInput.displayName = 'DateInput';


const ChangeHistoryTab = ({ player }: { player: MasterPlayer | null }) => {
    if (!player?.changeHistory || player.changeHistory.length === 0) {
        return <div className="p-6 text-center text-muted-foreground">No change history available for this player.</div>;
    }

    return (
        <div className="p-6 space-y-4">
            {player.changeHistory.slice().reverse().map(entry => (
                <div key={entry.timestamp} className="text-sm border-l-2 pl-4">
                    <p className="font-medium">
                        {format(new Date(entry.timestamp), 'PPP p')} by {entry.userName}
                    </p>
                    <ul className="list-disc pl-5 mt-1 text-muted-foreground text-xs">
                        {entry.changes.map((change, index) => (
                            <li key={index}>
                                Field <span className="font-semibold text-foreground">{change.field}</span> changed from <span className="italic">'{String(change.oldValue)}'</span> to <span className="italic">'{String(change.newValue)}'</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
  };


function PlayersPageContent() {
  const { addPlayer, updatePlayer, database } = useMasterDb();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const searchParams = useSearchParams();
  const router = useRouter();

  const playerForm = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
  });

  const handlePlayerSelected = (player: any) => {
    const isMasterPlayer = 'uscfId' in player;
    const playerToEdit: MasterPlayer = isMasterPlayer ? player : {
      id: player.uscf_id,
      uscfId: player.uscf_id,
      firstName: player.name.split(', ')[1] || '',
      lastName: player.name.split(', ')[0] || '',
      middleName: player.name.split(', ').length > 2 ? player.name.split(', ')[2] : '',
      regularRating: player.rating_regular || undefined,
      uscfExpiration: player.expiration_date ? new Date(player.expiration_date).toISOString() : undefined,
      state: player.state || 'TX',
      school: '',
      district: '',
      grade: '',
      section: '',
      email: '',
      zipCode: '',
      events: 0,
      eventIds: [],
    };
    
    setEditingPlayer(playerToEdit);
    playerForm.reset({
      ...playerToEdit,
      dob: playerToEdit.dob ? new Date(playerToEdit.dob) : undefined,
      uscfExpiration: playerToEdit.uscfExpiration ? new Date(playerToEdit.uscfExpiration) : undefined,
      studentType: playerToEdit.studentType || 'independent',
    });
    setIsEditOpen(true);
  };
  
  // Effect to handle opening the dialog via URL parameter
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && database.length > 0) {
      const playerToEdit = database.find(p => p.id === editId);
      if (playerToEdit) {
        handlePlayerSelected(playerToEdit);
        // Clean the URL
        router.replace('/players', { scroll: false });
      } else {
        toast({
          variant: 'destructive',
          title: 'Player Not Found',
          description: `Could not find a player with ID: ${editId}`,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, database, router]);

  const handlePlayerFormSubmit = async (values: PlayerFormValues) => {
    if (!editingPlayer) return;
  
    const { uscfExpiration, dob, ...restOfValues } = values;
    
    const updatedPlayerRecord: MasterPlayer = {
      ...editingPlayer,
      ...restOfValues,
      dob: dob ? dob.toISOString() : undefined,
      uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
    };
    
    const isNew = !database.some(p => p.id === updatedPlayerRecord.id);

    if (isNew) {
      await addPlayer(updatedPlayerRecord);
      toast({ 
        title: "Player Added", 
        description: `${values.firstName} ${values.lastName} has been added to the master database.`
      });
    } else {
      await updatePlayer(updatedPlayerRecord, profile);
      toast({ 
        title: "Player Updated", 
        description: `${values.firstName} ${values.lastName}'s information has been updated.`
      });
    }
    
    setIsEditOpen(false);
    setEditingPlayer(null);
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Master Player Database</h1>
            <p className="text-sm text-gray-600 mt-1">
              Search, manage, and register every player in the system.
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button
              className="flex items-center"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="w-4 h-4 mr-2" />
              Search Players
            </Button>
          </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Bulk Upload</CardTitle>
                <CardDescription>Upload a CSV file to add or update multiple players in the master database at once.</CardDescription>
            </CardHeader>
            <CardContent>
                <CSVUploadComponent />
            </CardContent>
        </Card>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-800">Search to Begin</h2>
            <p className="mt-1 text-sm">
                Use the "Search Players" button to find, edit, or add players to the master database. 
                Displaying all {database.length.toLocaleString()} players at once is not supported for performance reasons.
            </p>
        </div>


        <EnhancedPlayerSearchDialog
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          onPlayerSelected={handlePlayerSelected}
          title="Search and Add Players"
          userProfile={profile}
          preFilterByUserProfile={true}
        />

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-0 border-b shrink-0">
              <DialogTitle>{editingPlayer && database.some(p => p.id === editingPlayer.id) ? 'Edit Player' : 'Add New Player'}</DialogTitle>
              <DialogDescription>
                Complete the player's information. This will add them to or update their record in the master database.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="details" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mt-4 px-6">
                <TabsTrigger value="details">Player Details</TabsTrigger>
                <TabsTrigger value="history">Change History</TabsTrigger>
              </TabsList>
              <ScrollArea className="flex-1 overflow-y-auto">
                <TabsContent value="details" className="mt-0">
                  <div className='p-6'>
                    <Form {...playerForm}>
                      <form id="edit-player-form" onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-4">
                        {/* Form fields here */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={playerForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={playerForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={playerForm.control} name="school" render={({ field }) => (<FormItem><FormLabel>School</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={playerForm.control} name="district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        {editingPlayer?.district === 'PHARR-SAN JUAN-ALAMO ISD' && (
                          <FormField
                            control={playerForm.control}
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
                                      <FormControl>
                                        <RadioGroupItem value="independent" />
                                      </FormControl>
                                      <FormLabel className="font-normal">Independent</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                      <FormControl>
                                        <RadioGroupItem value="gt" />
                                      </FormControl>
                                      <FormLabel className="font-normal">GT (Gifted & Talented)</FormLabel>
                                    </FormItem>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={playerForm.control} name="uscfId" render={({ field }) => (<FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={playerForm.control} name="regularRating" render={({ field }) => (<FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="1500 or UNR" value={field.value?.toString() || ''} onChange={(e) => { const value = e.target.value; if (value === '' || value.toUpperCase() === 'UNR') { field.onChange(undefined); } else { field.onChange(value); } }} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField control={playerForm.control} name="dob" render={({ field }) => (<FormItem><FormLabel>Date of Birth</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange} placeholder="YYYY-MM-DD" /></FormControl><FormMessage /></FormItem>)} />
                           <FormField control={playerForm.control} name="uscfExpiration" render={({ field }) => (<FormItem><FormLabel>USCF Expiration</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange} placeholder="YYYY-MM-DD"/></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={playerForm.control} name="grade" render={({ field }) => (<FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                          <FormField control={playerForm.control} name="section" render={({ field }) => (<FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={playerForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={playerForm.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={playerForm.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                      </form>
                    </Form>
                  </div>
                </TabsContent>
                <TabsContent value="history" className="mt-0 flex-1 overflow-y-auto">
                  <ChangeHistoryTab player={editingPlayer} />
                </TabsContent>
              </ScrollArea>
              <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" form="edit-player-form">Update Player</Button>
              </DialogFooter>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}


function PlayersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrganizerGuard>
        <PlayersPageContent />
      </OrganizerGuard>
    </Suspense>
  )
}

export default PlayersPage;
