
// Updated src/app/players/page.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

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

export default function PlayersPage() {
  const { addPlayer, updatePlayer } = useMasterDb();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const { toast } = useToast();
  const { profile } = useSponsorProfile();

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
      await updatePlayer(updatedPlayerRecord);
      toast({ 
        title: "Player Updated", 
        description: `${values.firstName} ${values.lastName}'s information has been updated.`
      });
    }
    
    setIsEditOpen(false);
    setEditingPlayer(null);
  };
  
  const { database } = useMasterDb();


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

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">All Players</h2>
            <p className="text-sm text-gray-600">The complete list of players. Use the search button for advanced filtering.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School / District
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    USCF ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" colSpan={7}>
                    Player data will be displayed here when the database loads...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <EnhancedPlayerSearchDialog
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          onPlayerSelected={handlePlayerSelected}
          title="Search and Add Players"
        />

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle>{editingPlayer && database.some(p => p.id === editingPlayer.id) ? 'Edit Player' : 'Add New Player'}</DialogTitle>
                    <DialogDescription>
                        Complete the player's information. This will add them to or update their record in the master database.
                    </DialogDescription>
                </DialogHeader>
                <div className='flex-1 overflow-y-auto p-6'>
                    <Form {...playerForm}>
                        <form id="edit-player-form" onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-4">
                            {/* Form fields here */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="school" render={({ field }) => ( <FormItem><FormLabel>School</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="district" render={({ field }) => ( <FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            {(editingPlayer?.district === 'PHARR-SAN JUAN-ALAMO ISD') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={playerForm.control} name="studentType" render={({ field }) => ( 
                                        <FormItem><FormLabel>Student Type</FormLabel>
                                        <FormControl>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <SelectTrigger><SelectValue placeholder="Select student type" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="independent">Independent</SelectItem>
                                                    <SelectItem value="gt">GT (Gifted & Talented)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="uscfId" render={({ field }) => ( <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="1500 or UNR" value={field.value?.toString() || ''} onChange={(e) => { const value = e.target.value; if (value === '' || value.toUpperCase() === 'UNR') { field.onChange(undefined); } else { field.onChange(value); } }} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="dob" render={({ field }) => ( <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => { const date = e.target.valueAsDate; field.onChange(date ? new Date(date.getTime() + date.getTimezoneOffset() * 60000) : undefined); }} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="uscfExpiration" render={({ field }) => ( <FormItem><FormLabel>USCF Expiration</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => { const date = e.target.valueAsDate; field.onChange(date ? new Date(date.getTime() + date.getTimezoneOffset() * 60000) : undefined); }} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={playerForm.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                        </form>
                    </Form>
                </div>
                <DialogFooter className="p-6 pt-4 border-t shrink-0">
                    <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                    <Button type="submit" form="edit-player-form">Save Player</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
