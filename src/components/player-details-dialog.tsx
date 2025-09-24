
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { useToast } from '@/hooks/use-toast';
import { History, Trash2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

// Reusable DateInput component for MM/DD/YYYY format
const DateInput = React.forwardRef<HTMLInputElement, {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}>(({ value, onChange, placeholder, className }, ref) => {
  const [displayValue, setDisplayValue] = useState('');
  
  useEffect(() => {
    if (value && isValid(value)) {
      setDisplayValue(format(value, 'MM/dd/yyyy'));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      onChange?.(undefined);
      return;
    }
    const parsedDate = parse(inputValue, 'MM/dd/yyyy', new Date());
    if (isValid(parsedDate)) {
      onChange?.(parsedDate);
      setDisplayValue(format(parsedDate, 'MM/dd/yyyy'));
    } else {
      setDisplayValue(value && isValid(value) ? format(value, 'MM/dd/yyyy') : '');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  return (
    <Input
      ref={ref}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder || 'MM/DD/YYYY'}
      className={className}
    />
  );
});
DateInput.displayName = 'DateInput';


const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const states = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

// Zod Schema with all new validations
const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First Name is required."),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last Name is required."),
  district: z.string().min(1, "District is required."),
  school: z.string().min(1, "School is required."),
  uscfId: z.string().min(1, "USCF ID is required.").regex(/^\d+$|^NEW$/, "USCF ID must be a number or 'NEW'"),
  dob: z.date({ required_error: "Date of Birth is required." }),
  uscfExpiration: z.date().optional(),
  grade: z.string().min(1, "Grade is required."),
  section: z.string().min(1, "Section is required."),
  email: z.string().email("A valid email is required."),
  zipCode: z.string().min(5, "A valid 5-digit Zip Code is required."),
  state: z.string().optional(),
  regularRating: z.preprocess(val => (String(val).toUpperCase() === 'UNR' || val === '') ? undefined : val, z.coerce.number({ invalid_type_error: "Rating must be a number or UNR." }).optional()),
  studentType: z.string().optional(),
}).refine(data => data.uscfId.toUpperCase() === 'NEW' || !!data.uscfExpiration, {
  message: "USCF Expiration is required unless ID is 'NEW'.",
  path: ["uscfExpiration"]
});

type PlayerFormValues = z.infer<typeof playerFormSchema>;

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
                        {player.createdAt ? format(new Date(player.createdAt), 'PPP p') : 'Unknown Date'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        By: {player.createdBy || 'Unknown User'}
                    </p>
                </div>
                <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">LAST UPDATED</h4>
                    <p className="text-sm font-semibold">
                        {player.updatedAt 
                            ? format(new Date(player.updatedAt), 'PPP p') 
                            : (player.createdAt ? format(new Date(player.createdAt), 'PPP p') : 'Unknown Date')
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
                                    {entry.changes.map((change, i) => <li key={i} className="text-xs text-muted-foreground">Field <span className="font-semibold text-foreground">{change.field}</span> changed from <span className="italic text-red-600 mx-1">'{String(change.oldValue)}'</span> to <span className="italic text-green-600 mx-1">'{String(change.newValue)}'</span></li>)}
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


export function PlayerDetailsDialog({ isOpen, onOpenChange, playerToEdit, onPlayerCreatedOrUpdated, onAddToRoster }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  playerToEdit: MasterPlayer | null;
  onPlayerCreatedOrUpdated: () => void;
  onAddToRoster?: (player: MasterPlayer) => void;
}) {
  const { addPlayer, updatePlayer, deletePlayer, dbDistricts, getSchoolsForDistrict, database } = useMasterDb();
  const { profile } = useSponsorProfile();
  const { toast } = useToast();
  const [schoolsForEditDistrict, setSchoolsForEditDistrict] = useState<string[]>([]);
  
  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
  });

  const editDistrict = form.watch('district');

  useEffect(() => {
    if (editDistrict) {
      setSchoolsForEditDistrict(getSchoolsForDistrict(editDistrict));
    }
  }, [editDistrict, getSchoolsForDistrict]);

  useEffect(() => {
    if (isOpen) {
      if (playerToEdit) {
        form.reset({
          ...playerToEdit,
          dob: playerToEdit.dob ? new Date(playerToEdit.dob) : undefined,
          uscfExpiration: playerToEdit.uscfExpiration ? new Date(playerToEdit.uscfExpiration) : undefined,
          state: playerToEdit.state || 'TX',
        });
        if (playerToEdit.district) {
          setSchoolsForEditDistrict(getSchoolsForDistrict(playerToEdit.district));
        }
      } else {
        form.reset({
          id: `temp_${Date.now()}`,
          firstName: '', lastName: '', middleName: '',
          district: '', school: '',
          uscfId: 'NEW', dob: undefined, uscfExpiration: undefined,
          grade: '', section: '', email: '', zipCode: '', state: 'TX',
          regularRating: undefined, studentType: 'independent'
        });
      }
    }
  }, [isOpen, playerToEdit, form, getSchoolsForDistrict]);

  const onEditSubmit = async (values: PlayerFormValues) => {
    if (!profile) return;
    
    const isEmailInUse = database.some(p => p.email === values.email && p.id !== (playerToEdit?.id || values.id));
    if (isEmailInUse) {
      form.setError("email", { type: "manual", message: "This email is already used by another player." });
      return;
    }
    
    if (playerToEdit?.id) {
      const updatedPlayer: MasterPlayer = { ...playerToEdit, ...values, dob: values.dob?.toISOString(), uscfExpiration: values.uscfExpiration?.toISOString() };
      await updatePlayer(updatedPlayer, profile);
      toast({ title: "Player Updated" });
    } else {
      const newPlayer: MasterPlayer = { ...values, id: values.id!, events: 0, eventIds: [], dob: values.dob.toISOString(), uscfExpiration: values.uscfExpiration?.toISOString() } as MasterPlayer;
      await addPlayer(newPlayer, profile);
      toast({ title: "Player Created" });
    }
    onPlayerCreatedOrUpdated();
    onOpenChange(false);
  };
  
  const handleAddToRoster = async () => {
    const values = form.getValues();
    const result = playerFormSchema.safeParse(values);
    if (!result.success) {
      form.trigger();
      toast({ variant: 'destructive', title: "Validation Error", description: "Please fix the errors before adding to roster."});
      return;
    }

    if (onAddToRoster) {
        const player = { ...playerToEdit, ...result.data } as MasterPlayer;
        onAddToRoster(player);
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (playerToEdit) {
      await deletePlayer(playerToEdit.id);
      toast({ title: "Player Deleted", description: `${playerToEdit.firstName} ${playerToEdit.lastName} has been removed.` });
      onPlayerCreatedOrUpdated();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>{playerToEdit?.id ? `Player Details: ${playerToEdit.firstName} ${playerToEdit.lastName}` : 'Create New Player'}</DialogTitle>
          <DialogDescription>{playerToEdit?.id ? 'Modify the player\'s information below.' : 'Enter the details for the new player.'}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-8">
            <Form {...form}>
              <form id="player-details-form" onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Player Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="middleName" render={({ field }) => (<FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">School Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="district" render={({ field }) => (<FormItem><FormLabel>District *</FormLabel><Select onValueChange={(v) => { field.onChange(v); form.setValue('school', ''); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl><SelectContent>{dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="school" render={({ field }) => (<FormItem><FormLabel>School *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger></FormControl><SelectContent>{schoolsForEditDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                  {editDistrict === 'PHARR-SAN JUAN-ALAMO ISD' && (<FormField control={form.control} name="studentType" render={({ field }) => (<FormItem><FormLabel>Student Type</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value || 'independent'} className="flex items-center space-x-4"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="independent" /></FormControl><FormLabel className="font-normal">Independent</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="gt" /></FormControl><FormLabel className="font-normal">GT</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />)}
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Chess Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="uscfId" render={({ field }) => (<FormItem><FormLabel>USCF ID *</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Enter USCF ID number or "NEW".</FormDescription><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="uscfExpiration" render={({ field }) => (<FormItem><FormLabel>USCF Expiration *</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="e.g., 1500 or UNR" value={field.value?.toString() || ''} onChange={(e) => { const v = e.target.value; field.onChange(v === '' || v.toUpperCase() === 'UNR' ? undefined : v); }} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="grade" render={({ field }) => (<FormItem><FormLabel>Grade *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="section" render={({ field }) => (<FormItem><FormLabel>Section *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="dob" render={({ field }) => (<FormItem><FormLabel>Date of Birth *</FormLabel><FormControl><DateInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><Select onValueChange={field.onChange} defaultValue="TX" value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                <Separator className="my-8" />
                <ChangeHistorySection player={playerToEdit} />
              </form>
            </Form>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-4 border-t bg-muted/30 shrink-0">
          <div className="flex justify-between w-full">
            {playerToEdit?.id ? (<Button type="button" variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />Delete Player</Button>) : (<div></div>)}
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              {onAddToRoster && !playerToEdit?.id && (
                <Button type="button" onClick={handleAddToRoster}>Add to Roster</Button>
              )}
              <Button type="submit" form="player-details-form">{playerToEdit?.id ? 'Save Changes' : 'Create Player'}</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
