

'use client';

import { AppLayout } from "@/components/app-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEvents } from "@/hooks/use-events";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { FileText, ImageIcon, User, Users, Plus, X, CalendarIcon } from "lucide-react";
import { ParentRegistrationComponent } from "@/components/parent-registration-component";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { PlayerSearchDialog } from "@/components/PlayerSearchDialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];

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
  // Handle empty strings by transforming them to undefined, then requiring
  grade: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string({ required_error: "Grade is required." }).min(1, { message: "Grade is required." })
  ),
  section: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string({ required_error: "Section is required." }).min(1, { message: "Section is required." })
  ),
  email: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string({ required_error: "Email is required." }).email({ message: "Please enter a valid email." })
  ),
  phone: z.string().optional(),
  dob: z.date({ required_error: "Date of Birth is required." }),
  zipCode: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string({ required_error: "Zip Code is required." }).min(1, { message: "Zip Code is required." })
  ),
  studentType: z.string().optional(),
  state: z.string().optional(),
  school: z.string().min(1, { message: "School name is required."}),
  district: z.string().min(1, { message: "District name is required."}),
}).refine(data => {
    if (data.uscfId.toUpperCase() !== 'NEW') { 
        return data.uscfExpiration !== undefined; 
    }
    return true;
}, { message: "USCF Expiration is required unless ID is NEW.", path: ["uscfExpiration"] });


type PlayerFormValues = z.infer<typeof playerFormSchema>;


export default function IndividualDashboardPage() {
  const { events } = useEvents();
  const { profile, isProfileLoaded, updateProfile: updateSponsorProfile } = useSponsorProfile();
  const { database, updatePlayer } = useMasterDb();
  const { toast } = useToast();
  
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [pendingStudent, setPendingStudent] = useState<MasterPlayer | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const [isEditPlayerDialogOpen, setIsEditPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [pendingStudentForEdit, setPendingStudentForEdit] = useState<MasterPlayer | null>(null);

  const playerForm = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
  });

  const upcomingEvents = useMemo(() => {
    return events
      .filter(event => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      // mock registration status
      .map((event, index) => ({...event, registered: [true, true, false, false, true][index % 5] || false })); 
  }, [events]);

  useEffect(() => {
    if (profile?.email && database.length > 0) {
      try {
        const storedParentStudents = localStorage.getItem(`parent_students_${profile.email}`);
        if (storedParentStudents) {
          const studentIds = JSON.parse(storedParentStudents);
          const students = database.filter(p => studentIds.includes(p.id));
          setParentStudents(students);
        }
      } catch (error) {
        console.error('Failed to load parent students:', error);
      }
    }
  }, [profile, database]);
  
  const handleSelectStudent = (player: MasterPlayer) => {
    // Check if student already added
    if (parentStudents.find(s => s.id === player.id)) {
      toast({
        variant: 'destructive',
        title: "Student Already Added",
        description: `${player.firstName} ${player.lastName} is already in your students list.`
      });
      return;
    }

    // Check if student has required information
    const missingFields = [];
    if (!player.dob) missingFields.push('Date of Birth');
    if (!player.grade) missingFields.push('Grade');
    if (!player.section) missingFields.push('Section');
    if (!player.email) missingFields.push('Email');
    if (!player.zipCode) missingFields.push('Zip Code');
    
    if (missingFields.length > 0) {
      // Instead of showing error, open edit dialog to complete info
      setPendingStudentForEdit(player);
      handleEditStudent(player);
      return;
    }

    // If student has complete information, show confirmation dialog
    setPendingStudent(player);
    setIsConfirmDialogOpen(true);
  };
  
  const handleEditStudent = (player: MasterPlayer) => {
    setEditingPlayer(player);
    playerForm.reset({
      ...player,
      dob: player.dob ? new Date(player.dob) : undefined,
      uscfExpiration: player.uscfExpiration ? new Date(player.uscfExpiration) : undefined,
    });
    setIsEditPlayerDialogOpen(true);
  };

  const handleConfirmAddStudent = (studentToAdd?: MasterPlayer) => {
    const student = studentToAdd || pendingStudent;
    if (!student || !profile?.email) return;

    const updatedStudents = [...parentStudents, student];
    setParentStudents(updatedStudents);
    
    const studentIds = updatedStudents.map(s => s.id);
    localStorage.setItem(`parent_students_${profile.email}`, JSON.stringify(studentIds));
    
    toast({
      title: "Student Added",
      description: `${student.firstName} ${student.lastName} has been added to your students list.`
    });

    // Clean up
    setPendingStudent(null);
    setPendingStudentForEdit(null);
    setIsConfirmDialogOpen(false);
  };

  const handlePlayerFormSubmit = async (values: PlayerFormValues) => {
  console.log('🔍 Form submit triggered with values:', values);
  console.log('🔍 editingPlayer:', editingPlayer);
  console.log('🔍 pendingStudentForEdit:', pendingStudentForEdit);

  if (!editingPlayer) {
    console.log('❌ No editing player found');
    return;
  }

  try {
    const { uscfExpiration, dob, ...restOfValues } = values;
    
    const updatedPlayerRecord: MasterPlayer = {
      ...editingPlayer,
      ...restOfValues,
      dob: dob ? dob.toISOString() : undefined,
      uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
    };
    
    console.log('🔍 About to update player:', updatedPlayerRecord);
    
    // Update the player in the database
    updatePlayer(updatedPlayerRecord);
    console.log('✅ Player updated in database');

    // If this was a pending student, add them to the list
    if (pendingStudentForEdit) {
      console.log('🔍 Adding student to parent list');
      handleConfirmAddStudent(updatedPlayerRecord);
    } else {
      toast({ 
        title: "Student Updated", 
        description: `${values.firstName} ${values.lastName}'s information has been updated.`
      });
    }
    
    setIsEditPlayerDialogOpen(false);
    setEditingPlayer(null);
    setPendingStudentForEdit(null);
    console.log('✅ Form submission completed successfully');
    
  } catch (error) {
    console.error('❌ Error in form submission:', error);
    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'Failed to save student information. Please try again.'
    });
  }
};

  const handleCancelEdit = () => {
    if (pendingStudentForEdit) {
      // User was adding a new student but cancelled
      setPendingStudentForEdit(null);
    }
    setIsEditPlayerDialogOpen(false);
    setEditingPlayer(null);
  };

  const handleCancelAddStudent = () => {
    setPendingStudent(null);
    setIsConfirmDialogOpen(false);
  };

  const handleRemoveStudent = (student: MasterPlayer) => {
    const updatedStudents = parentStudents.filter(s => s.id !== student.id);
    setParentStudents(updatedStudents);
    
    if (profile?.email) {
      const studentIds = updatedStudents.map(s => s.id);
      localStorage.setItem(`parent_students_${profile.email}`, JSON.stringify(studentIds));
    }
    
    toast({
      title: "Student Removed",
      description: `${student.firstName} ${student.lastName} has been removed from your students list.`
    });
  };

  if (!isProfileLoaded || !profile) {
    return (
        <AppLayout>
            <div className="space-y-8">
                <div>
                    <Skeleton className="h-9 w-1/2" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                             <Skeleton className="h-6 w-1/2" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-16 w-16 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Skeleton className="h-48 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Player Dashboard</h1>
          <p className="text-muted-foreground">
            An overview of your chess activities.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={profile.avatarType === 'upload' ? profile.avatarValue : `https://placehold.co/64x64.png`} alt={`${profile.firstName} ${profile.lastName}`} data-ai-hint="person face" />
                    <AvatarFallback>{profile.firstName.charAt(0)}{profile.lastName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-xl font-bold">{profile.firstName} {profile.lastName}</div>
                    <div className="text-sm text-muted-foreground">{profile.email}</div>
                  </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center border-t pt-4">
                        <h4 className="font-semibold flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" /> 
                          Your Students ({parentStudents.length})
                        </h4>
                        <Button size="sm" onClick={() => setIsSearchDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Student
                        </Button>
                    </div>
                    {parentStudents.length > 0 ? (
                        <div className="space-y-2">
                            {parentStudents.map(student => (
                                <div key={student.id} className="flex items-center justify-between text-sm p-2 border rounded">
                                    <span>{student.firstName} {student.lastName}</span>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => handleRemoveStudent(student)}
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No students added yet. Use the Add Student button to search and add your students.
                        </p>
                    )}
                </div>
            </CardContent>
            <CardFooter>
               <Button asChild variant="outline">
                  <Link href="/profile">View & Edit Profile</Link>
                </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
               <CardDescription>Events you are registered for and upcoming tournaments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-start gap-1">
                            {event.imageUrl && (
                                <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-primary">
                                  <a href={event.imageUrl} target="_blank" rel="noopener noreferrer" title={event.imageName}>
                                    <ImageIcon className="mr-2 h-4 w-4" /> {event.imageName || 'Image'}
                                  </a>
                                </Button>
                            )}
                            {event.pdfUrl && event.pdfUrl !== '#' && (
                                <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-primary">
                                  <a href={event.pdfUrl} target="_blank" rel="noopener noreferrer" title={event.pdfName}>
                                    <FileText className="mr-2 h-4 w-4" /> {event.pdfName || 'PDF'}
                                  </a>
                                </Button>
                            )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{event.name}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(event.date), 'PPP')}</p>
                        </div>
                    </div>
                    {event.registered ? (
                       <Badge variant="default" className="bg-green-600">Registered</Badge>
                    ) : (
                      <Button asChild variant="secondary" size="sm">
                        <Link href="/events">
                          Register Now
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <ParentRegistrationComponent parentProfile={profile} />

        <div>
          <h2 className="text-2xl font-bold font-headline">Recent Activity</h2>
          <Card className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Summer Championship</TableCell>
                  <TableCell>
                    <Badge variant="outline">Invoice Paid</Badge>
                  </TableCell>
                  <TableCell className="text-right">2024-05-22</TableCell>
                </TableRow>
                 <TableRow>
                  <TableCell>Summer Championship</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Registered</Badge>
                  </TableCell>
                  <TableCell className="text-right">2024-05-22</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Spring Open 2024</TableCell>
                  <TableCell>
                    <Badge variant="destructive">Withdrew</Badge>
                  </TableCell>
                  <TableCell className="text-right">2024-05-21</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>
        
        <PlayerSearchDialog
            isOpen={isSearchDialogOpen}
            onOpenChange={setIsSearchDialogOpen}
            onSelectPlayer={handleSelectStudent}
            excludeIds={parentStudents.map(s => s.id)}
            portalType="individual"
        />

        {/* Confirmation Dialog */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Student</DialogTitle>
              <DialogDescription>
                Are you sure you want to add {pendingStudent?.firstName} {pendingStudent?.lastName} to your students list?
              </DialogDescription>
            </DialogHeader>
            {pendingStudent && (
              <div className="py-4">
                <div className="space-y-2">
                  <p><strong>Name:</strong> {pendingStudent.firstName} {pendingStudent.lastName}</p>
                  <p><strong>USCF ID:</strong> {pendingStudent.uscfId}</p>
                  <p><strong>Rating:</strong> {pendingStudent.regularRating || 'UNR'}</p>
                  <p><strong>School:</strong> {pendingStudent.school || 'N/A'}</p>
                  <p><strong>Grade:</strong> {pendingStudent.grade || 'N/A'}</p>
                  <p><strong>Section:</strong> {pendingStudent.section || 'N/A'}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelAddStudent}>
                Cancel
              </Button>
              <Button onClick={() => handleConfirmAddStudent()}>
                Add Student
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
      {/* Edit Student Dialog */}
      <Dialog open={isEditPlayerDialogOpen} onOpenChange={setIsEditPlayerDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>
              {pendingStudentForEdit ? 'Complete Student Information' : 'Edit Student Information'}
            </DialogTitle>
            <DialogDescription>
              {pendingStudentForEdit 
                ? `Complete the required information for ${editingPlayer?.firstName} ${editingPlayer?.lastName} to add them as your student.`
                : `Update the details for ${editingPlayer?.firstName} ${editingPlayer?.lastName}.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <Form {...playerForm}>
              <form id="edit-student-form" onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField control={playerForm.control} name="firstName" render={({ field }) => ( 
                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> 
                  )} />
                  <FormField control={playerForm.control} name="lastName" render={({ field }) => ( 
                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> 
                  )} />
                  <FormField control={playerForm.control} name="middleName" render={({ field }) => ( 
                    <FormItem><FormLabel>Middle Name (Opt)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> 
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={playerForm.control} name="uscfId" render={({ field }) => ( 
                    <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> 
                  )} />
                  <FormField control={playerForm.control} name="regularRating" render={({ field }) => ( 
                    <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="1500 or UNR" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> 
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={playerForm.control} name="dob" render={({ field }) => ( 
                    <FormItem className="flex flex-col"><FormLabel>Date of Birth *</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 100} toYear={new Date().getFullYear()} initialFocus/></PopoverContent></Popover><FormMessage /></FormItem> 
                  )} />
                  <FormField control={playerForm.control} name="uscfExpiration" render={({ field }) => ( 
                    <FormItem className="flex flex-col"><FormLabel>USCF Expiration</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 2} toYear={new Date().getFullYear() + 10} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={playerForm.control} name="grade" render={({ field }) => ( 
                    <FormItem><FormLabel>Grade *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> 
                  )} />
                  <FormField control={playerForm.control} name="section" render={({ field }) => ( 
                    <FormItem><FormLabel>Section *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> 
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={playerForm.control} name="email" render={({ field }) => ( 
                    <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> 
                  )} />
                  <FormField control={playerForm.control} name="zipCode" render={({ field }) => ( 
                    <FormItem><FormLabel>Zip Code *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> 
                  )} />
                </div>
              </form>
            </Form>
          </div>
          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <Button type="button" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
            <Button 
              type="button"
              onClick={async () => {
                console.log('🔍 Button clicked - triggering form submission');
                
                // Get current form values
                const currentValues = playerForm.getValues();
                console.log('🔍 Current form values:', currentValues);
                
                // Get form errors
                const formErrors = playerForm.formState.errors;
                console.log('🔍 Current form errors:', formErrors);
                
                // Check if form is valid
                const isValid = playerForm.formState.isValid;
                console.log('🔍 Form is valid:', isValid);
                
                // Trigger validation manually
                const validationResult = await playerForm.trigger();
                console.log('🔍 Manual validation result:', validationResult);
                
                // Get errors after manual validation
                const errorsAfterValidation = playerForm.formState.errors;
                console.log('🔍 Errors after validation:', errorsAfterValidation);
                
                if (validationResult) {
                  console.log('✅ Validation passed, calling handleSubmit');
                  playerForm.handleSubmit(handlePlayerFormSubmit)();
                } else {
                  console.log('❌ Validation failed');
                  toast({
                    variant: 'destructive',
                    title: 'Validation Failed',
                    description: 'Please fill in all required fields before saving.'
                  });
                }
              }}
            >
              {pendingStudentForEdit ? 'Complete & Add Student' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AppLayout>
  );
}

