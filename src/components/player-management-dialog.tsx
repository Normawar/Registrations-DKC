'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parse, isValid, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MasterPlayer } from '@/lib/actions/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const playerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleName: z.string().optional(),
  uscfId: z.string().min(1, "USCF ID is required"),
  grade: z.string().min(1, "Grade is required"),
  gender: z.enum(['Male', 'Female', 'Other'], { required_error: "Gender is required" }),
  dob: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Invalid email address"),
  zip: z.string().min(1, "Zip code is required"),
  uscfExpiration: z.string().optional(),
  district: z.string().optional(),
  school: z.string().optional(),
  section: z.string().optional(),
});

export type PlayerFormValues = z.infer<typeof playerSchema>;

interface PlayerManagementDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  player: Partial<MasterPlayer> | null;
  onSubmit: (values: PlayerFormValues) => void;
  isAddingToRoster?: boolean;
  isCreatingPlayer?: boolean;
  sections?: string[];
}

export function PlayerManagementDialog({ isOpen, onOpenChange, player, onSubmit, isAddingToRoster, isCreatingPlayer, sections = [] }: PlayerManagementDialogProps) {
  const schema = isCreatingPlayer ? playerSchema.extend({ uscfId: z.string().optional() }) : playerSchema;
  
  const { control, handleSubmit, formState: { errors }, reset } = useForm<PlayerFormValues>({
    resolver: zodResolver(schema),
  });

  React.useEffect(() => {
    if (isOpen) {
        const formattedPlayer = {
            ...player,
            dob: player?.dob ? format(parseISO(player.dob), 'MM/dd/yyyy') : '',
            uscfExpiration: player?.uscfExpiration ? format(parseISO(player.uscfExpiration), 'MM/dd/yyyy') : '',
        };
      reset(formattedPlayer || {});
    }
  }, [isOpen, player, reset]);
  
  const getDialogTitle = () => {
    if (isAddingToRoster) return "Add Player to Roster";
    if (player?.id) return "Edit Player";
    return "Create New Player";
  };

  const handleFormSubmit = (values: PlayerFormValues) => {
      const submissionData = {
          ...values,
          dob: values.dob ? format(parse(values.dob, 'MM/dd/yyyy', new Date()), 'yyyy-MM-dd') : '',
          uscfExpiration: values.uscfExpiration ? format(parse(values.uscfExpiration, 'MM/dd/yyyy', new Date()), 'yyyy-MM-dd') : '',
      };
      onSubmit(submissionData);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-6 -mr-6 pl-6">
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Player Details</TabsTrigger>
                <TabsTrigger value="requests" disabled>Event Requests</TabsTrigger>
                <TabsTrigger value="history" disabled>Change History</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="pt-4">
                <form id="player-form" onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="firstName" className="text-right">First Name</Label>
                        <Controller name="firstName" control={control} render={({ field }) => <Input id="firstName" {...field} className="col-span-3" />} />
                        {errors.firstName && <p className="col-span-4 text-red-500 text-sm">{errors.firstName.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="lastName" className="text-right">Last Name</Label>
                        <Controller name="lastName" control={control} render={({ field }) => <Input id="lastName" {...field} className="col-span-3" />} />
                        {errors.lastName && <p className="col-span-4 text-red-500 text-sm">{errors.lastName.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="middleName" className="text-right">Middle Name</Label>
                        <Controller name="middleName" control={control} render={({ field }) => <Input id="middleName" {...field} className="col-span-3" />} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="uscfId" className="text-right">USCF ID</Label>
                        <Controller name="uscfId" control={control} render={({ field }) => <Input id="uscfId" {...field} className="col-span-3" />} />
                        {errors.uscfId && <p className="col-span-4 text-red-500 text-sm">{errors.uscfId.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="grade" className="text-right">Grade</Label>
                        <Controller name="grade" control={control} render={({ field }) => <Input id="grade" {...field} className="col-span-3" />} />
                        {errors.grade && <p className="col-span-4 text-red-500 text-sm">{errors.grade.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="gender" className="text-right">Gender</Label>
                        <Controller
                            name="gender"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select a gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.gender && <p className="col-span-4 text-red-500 text-sm">{errors.gender.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dob" className="text-right">DOB</Label>
                        <Controller name="dob" control={control} render={({ field }) => <Input id="dob" {...field} className="col-span-3" placeholder="MM/DD/YYYY" />} />
                        {errors.dob && <p className="col-span-4 text-red-500 text-sm">{errors.dob.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">Email</Label>
                        <Controller name="email" control={control} render={({ field }) => <Input id="email" {...field} className="col-span-3" />} />
                        {errors.email && <p className="col-span-4 text-red-500 text-sm">{errors.email.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="zip" className="text-right">Zip Code</Label>
                        <Controller name="zip" control={control} render={({ field }) => <Input id="zip" {...field} className="col-span-3" />} />
                        {errors.zip && <p className="col-span-4 text-red-500 text-sm">{errors.zip.message}</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="uscfExpiration" className="text-right">USCF Exp.</Label>
                        <Controller name="uscfExpiration" control={control} render={({ field }) => <Input id="uscfExpiration" {...field} className="col-span-3" placeholder="MM/DD/YYYY" />} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="district" className="text-right">District</Label>
                        <Controller name="district" control={control} render={({ field }) => <Input id="district" {...field} className="col-span-3" />} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="school" className="text-right">School</Label>
                        <Controller name="school" control={control} render={({ field }) => <Input id="school" {...field} className="col-span-3" />} />
                    </div>
                </form>
            </TabsContent>
            <TabsContent value="requests">
                <div className="p-4 text-center text-muted-foreground">Event request functionality will be available here.</div>
            </TabsContent>
            <TabsContent value="history">
                <div className="p-4 text-center text-muted-foreground">Player change history will be displayed here.</div>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter className="mt-auto pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
            <Button type="submit" form="player-form">{isAddingToRoster ? 'Add to Roster' : (player?.id ? 'Save Changes' : 'Create Player')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
