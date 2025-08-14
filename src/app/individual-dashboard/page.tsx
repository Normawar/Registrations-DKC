
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
import { FileText, ImageIcon, User, Users, Plus, X, School } from "lucide-react";
import { ParentRegistrationComponent } from "@/components/parent-registration-component";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { PlayerSearchDialog } from "@/components/PlayerSearchDialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const districtSchoolMapping = {
  "SHARYLAND ISD": [
    "SHARYLAND PIONEER H S",
    "SHARYLAND H S",
    "B L GRAY JUNIOR HIGH",
    "SHARYLAND INTERMEDIATE",
    "SHARYLAND NORTH JUNIOR HIGH",
    "MISSION H S FRESHMAN",
    "LAURA BIRD ELEMENTARY",
    "LIBERTY ELEMENTARY",
    "LOMA VISTA ELEMENTARY",
    "NORMA ALVAREZ ELEMENTARY",
    "SALINAS ELEMENTARY",
    "SAUCEDA ELEMENTARY"
  ],
  "MCALLEN ISD": [
    "MCALLEN H S",
    "MCALLEN MEMORIAL H S",
    "ROWE H S",
    "NIKKI ROWE H S",
    "LAMAR ACADEMY",
    "CATHEY MIDDLE",
    "LINCOLN MIDDLE SCHOOL",
    "TRAVIS MIDDLE SCHOOL",
    "DE ZAVALA MIDDLE SCHOOL",
    "MEMORIAL MIDDLE SCHOOL",
    "BROWN MIDDLE SCHOOL",
    "AUSTIN ELEMENTARY",
    "BONHAM ELEMENTARY",
    "CROCKETT ELEMENTARY",
    "FRANKLIN ELEMENTARY",
    "HOUSTON ELEMENTARY",
    "JACKSON ELEMENTARY",
    "KENNEDY ELEMENTARY",
    "LAMAR ELEMENTARY",
    "SEGUIN ELEMENTARY",
    "TRAVIS ELEMENTARY",
    "WILSON ELEMENTARY"
  ],
  "EDINBURG CISD": [
    "EDINBURG H S",
    "EDINBURG NORTH H S",
    "VELA H S",
    "IDEA EDINBURG",
    "ROBERT VELA H S",
    "HENDERSON MIDDLE SCHOOL",
    "KENNEDY MIDDLE SCHOOL",
    "EISENHOWER MIDDLE SCHOOL",
    "NASCIMENTO ELEMENTARY",
    "PETERSON ELEMENTARY",
    "RAMIREZ ELEMENTARY"
  ],
  "PHARR-SAN JUAN-ALAMO ISD": [
    "PSJA H S",
    "PSJA MEMORIAL H S",
    "PSJA NORTH H S",
    "PSJA SOUTHWEST H S",
    "GERALDINE PALMER ELEMENTARY",
    "LLOYD M BENTSEN ELEMENTARY",
    "RAUL GARCIA ELEMENTARY",
    "JOSE BORREGO MIDDLE SCHOOL"
  ],
  "LA JOYA ISD": [
    "LA JOYA H S",
    "PALMVIEW H S",
    "JUAREZ-LINCOLN H S",
    "LA JOYA COMMUNITY H S",
    "MEMORIAL MIDDLE SCHOOL",
    "DR AMERICO PAREDES MIDDLE SCHOOL",
    "ABEL GARCIA ELEMENTARY",
    "ALTON ELEMENTARY",
    "INEZ ELEMENTARY"
  ],
  "MISSION CISD": [
    "MISSION H S",
    "MISSION VETERANS MEMORIAL H S",
    "ALTON MEMORIAL JUNIOR HIGH",
    "CANTU ELEMENTARY",
    "ESCANDON ELEMENTARY",
    "LEAL ELEMENTARY",
    "MENDEZ ELEMENTARY"
  ],
  "HIDALGO ISD": [
    "HIDALGO H S",
    "HIDALGO EARLY COLLEGE H S",
    "CARMEN ANAYA ELEMENTARY",
    "SALINAS ELEMENTARY"
  ],
  "DONNA ISD": [
    "DONNA H S",
    "DONNA NORTH H S",
    "S H LEADERSHIP ACADEMY",
    "ADAME ELEMENTARY",
    "ALBA A DUNLAP ELEMENTARY",
    "DONNA ELEMENTARY"
  ],
  "MERCEDES ISD": [
    "MERCEDES H S",
    "MERCEDES JUNIOR HIGH",
    "FERNANDEZ ELEMENTARY",
    "MERCEDES ELEMENTARY",
    "ROOSEVELT ELEMENTARY"
  ],
  "WESLACO ISD": [
    "WESLACO H S",
    "WESLACO EAST H S",
    "JOHN F KENNEDY H S",
    "WESLACO EAST H S",
    "AIRPORT ELEMENTARY",
    "BRIDGE ELEMENTARY",
    "CENTRAL ELEMENTARY"
  ],
  "BROWNSVILLE ISD": [
    "BROWNSVILLE H S",
    "HANNA H S",
    "LOPEZ H S",
    "PACE H S",
    "PORTER H S",
    "VETERANS MEMORIAL H S",
    "BREEDEN ELEMENTARY",
    "CUMMINGS MIDDLE SCHOOL"
  ],
  "HARLINGEN CISD": [
    "HARLINGEN H S",
    "HARLINGEN SOUTH H S",
    "HARLINGEN H S SOUTH CAMPUS",
    "COAKLEY MIDDLE SCHOOL",
    "GUTIERREZ MIDDLE SCHOOL",
    "AUSTIN ELEMENTARY",
    "BOWIE ELEMENTARY"
  ]
};

const texasDistricts = Object.keys(districtSchoolMapping).sort();
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
  grade: z.string().min(1, { message: "Grade is required." }),
  section: z.string().min(1, { message: "Section is required." }),
  email: z.string().min(1, { message: "Email is required." }).email({ message: "Please enter a valid email." }),
  phone: z.string().optional(),
  dob: z.date({ required_error: "Date of Birth is required." }),
  zipCode: z.string().min(1, { message: "Zip Code is required." }),
  studentType: z.string().optional(),
  state: z.string().optional(),
  school: z.string().min(1, { message: "School is required." }),
  district: z.string().min(1, { message: "District is required." }),
}).refine(data => {
    if (data.uscfId.toUpperCase() !== 'NEW') { 
        return data.uscfExpiration !== undefined; 
    }
    return true;
}, { message: "USCF Expiration is required unless ID is NEW.", path: ["uscfExpiration"] });


type PlayerFormValues = z.infer<typeof playerFormSchema>;

export default function IndividualDashboardPage() {
  const { events } = useEvents();
  const { profile, isProfileLoaded } = useSponsorProfile();
  const { database, updatePlayer } = useMasterDb();
  const { toast } = useToast();
  
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [isEditPlayerDialogOpen, setIsEditPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [pendingStudentForEdit, setPendingStudentForEdit] = useState<MasterPlayer | null>(null);

  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [availableSchools, setAvailableSchools] = useState<string[]>([]);
  const [showCustomSchool, setShowCustomSchool] = useState(false);
  const [showCustomDistrict, setShowCustomDistrict] = useState(false);

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

  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== 'OTHER') {
      const schools = districtSchoolMapping[selectedDistrict as keyof typeof districtSchoolMapping] || [];
      setAvailableSchools(schools.sort());
    } else {
      setAvailableSchools([]);
    }
  }, [selectedDistrict]);
  
  const handleConfirmAddStudent = (studentToAdd: MasterPlayer) => {
    if (!profile?.email) return;

    const updatedStudents = [...parentStudents, studentToAdd];
    setParentStudents(updatedStudents);
    
    const studentIds = updatedStudents.map(s => s.id);
    localStorage.setItem(`parent_students_${profile.email}`, JSON.stringify(studentIds));
  };
  
  const handleSelectStudent = (player: MasterPlayer) => {
    if (parentStudents.find(s => s.id === player.id)) {
      toast({
        variant: 'destructive',
        title: "Student Already Added",
        description: `${player.firstName} ${player.lastName} is already in your students list.`
      });
      return;
    }

    const missingFields = ['dob', 'grade', 'section', 'email', 'zipCode']
        .filter(field => !(player as any)[field]);
    
    if (missingFields.length > 0) {
      setPendingStudentForEdit(player);
      handleEditStudent(player);
      return;
    }

    handleConfirmAddStudent(player);
     toast({
        title: "Student Added",
        description: `${player.firstName} ${player.lastName} has been added to your students list.`
      });
  };

  const handleEditStudent = (player: MasterPlayer) => {
    setEditingPlayer(player);
    setShowCustomSchool(false);
    setShowCustomDistrict(false);
    const initialDistrict = player.district || '';
    setSelectedDistrict(initialDistrict);
    
    playerForm.reset({
      id: player.id || '',
      firstName: player.firstName || '',
      middleName: player.middleName || '',
      lastName: player.lastName || '',
      uscfId: player.uscfId || '',
      regularRating: player.regularRating,
      grade: player.grade || '',
      section: player.section || '',
      email: player.email || '',
      phone: player.phone || '',
      zipCode: player.zipCode || '',
      studentType: player.studentType || '',
      state: player.state || 'TX',
      school: player.school || '',
      district: player.district || '',
      dob: player.dob ? new Date(player.dob) : undefined,
      uscfExpiration: player.uscfExpiration ? new Date(player.uscfExpiration) : undefined,
    });
    
    setIsEditPlayerDialogOpen(true);
  };

  const handleRemoveStudent = (studentToRemove: MasterPlayer) => {
    if (!profile?.email) return;
    const updatedStudents = parentStudents.filter(s => s.id !== studentToRemove.id);
    setParentStudents(updatedStudents);

    const studentIds = updatedStudents.map(s => s.id);
    localStorage.setItem(`parent_students_${profile.email}`, JSON.stringify(studentIds));

    toast({
      title: "Student Removed",
      description: `${studentToRemove.firstName} ${studentToRemove.lastName} has been removed from your list.`
    });
  };

  const handlePlayerFormSubmit = async (values: PlayerFormValues) => {
    if (!editingPlayer) return;

    const { uscfExpiration, dob, ...restOfValues } = values;
    
    const updatedPlayerRecord: MasterPlayer = {
      ...editingPlayer,
      ...restOfValues,
      school: values.school?.trim() || '',
      district: values.district?.trim() || '',
      dob: dob ? dob.toISOString() : undefined,
      uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
    };
    
    updatePlayer(updatedPlayerRecord);

    if (pendingStudentForEdit) {
      handleConfirmAddStudent(updatedPlayerRecord);
      const schoolInfo = values.school && values.district 
        ? ` and assigned to ${values.school} - ${values.district}`
        : '';
      toast({ 
        title: "Student Added", 
        description: `${values.firstName} ${values.lastName} has been completed${schoolInfo} and added to your students list.`
      });
    } else {
      setParentStudents(prev => prev.map(s => s.id === updatedPlayerRecord.id ? updatedPlayerRecord : s));
      toast({ 
        title: "Student Updated", 
        description: `${values.firstName} ${values.lastName}'s information has been updated.`
      });
    }
    
    setIsEditPlayerDialogOpen(false);
    setEditingPlayer(null);
    setPendingStudentForEdit(null);
  };

  const handleCancelEdit = () => {
    setPendingStudentForEdit(null);
    setIsEditPlayerDialogOpen(false);
    setEditingPlayer(null);
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
                        <h4 className="font-semibold flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-muted-foreground" /> Your Students ({parentStudents.length})</h4>
                        <Button size="sm" onClick={() => setIsSearchDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Student
                        </Button>
                    </div>
                    {parentStudents.length > 0 ? (
                        <div className="space-y-2">
                            {parentStudents.map(student => (
                                <div key={student.id} className="flex items-center justify-between text-sm p-3 border rounded hover:bg-muted/50 transition-colors">
                                    <div className="flex-1">
                                        <button
                                            onClick={() => handleEditStudent(student)}
                                            className="text-left hover:text-primary transition-colors font-medium underline-offset-4 hover:underline cursor-pointer"
                                        >
                                            {student.firstName} {student.lastName}
                                        </button>
                                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                            <div>USCF ID: {student.uscfId} | Rating: {student.regularRating || 'UNR'}</div>
                                            {student.school && student.district && (
                                                <div className="flex items-center gap-1">
                                                    <School className="h-3 w-3" />
                                                    {student.school} - {student.district}
                                                </div>
                                            )}
                                            {student.grade && (
                                                <div>Grade: {student.grade} | Section: {student.section || 'Not set'}</div>
                                            )}
                                            {(!student.email || !student.grade || !student.section) && (
                                                <div className="text-orange-600 text-xs">
                                                    ⚠️ Profile incomplete - click name to complete
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => handleRemoveStudent(student)}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive ml-2 shrink-0"
                                        title="Remove student"
                                    >
                                        <X className="h-4 w-4" />
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
                      <FormField control={playerForm.control} name="district" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>District * (Select First)</FormLabel>
                          {showCustomDistrict ? (
                            <div className="space-y-2">
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="Enter custom district name"
                                  onChange={(e) => {
                                    field.onChange(e.target.value);
                                    setSelectedDistrict(e.target.value);
                                  }}
                                />
                              </FormControl>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setShowCustomDistrict(false);
                                  setSelectedDistrict('');
                                  field.onChange('');
                                  playerForm.setValue('school', '');
                                }}
                              >
                                ← Back to dropdown
                              </Button>
                            </div>
                          ) : (
                            <Select 
                              onValueChange={(value) => {
                                if (value === 'OTHER') {
                                  setShowCustomDistrict(true);
                                  setSelectedDistrict('OTHER');
                                  field.onChange('');
                                  playerForm.setValue('school', '');
                                } else {
                                  field.onChange(value);
                                  setSelectedDistrict(value);
                                  playerForm.setValue('school', '');
                                  setShowCustomSchool(false);
                                }
                              }} 
                              value={field.value && !showCustomDistrict ? field.value : ''}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a district first" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[200px]">
                                {texasDistricts.map(district => (
                                  <SelectItem key={district} value={district}>{district}</SelectItem>
                                ))}
                                <SelectItem value="OTHER">Other (Enter Custom)</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage />
                        </FormItem> 
                      )} />
                      
                      <FormField control={playerForm.control} name="school" render={({ field }) => ( 
                        <FormItem>
                          <FormLabel>School *</FormLabel>
                          {showCustomSchool ? (
                            <div className="space-y-2">
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="Enter custom school name"
                                />
                              </FormControl>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setShowCustomSchool(false);
                                  field.onChange('');
                                }}
                              >
                                ← Back to dropdown
                              </Button>
                            </div>
                          ) : (
                            <Select 
                              onValueChange={(value) => {
                                if (value === 'OTHER') {
                                  setShowCustomSchool(true);
                                  field.onChange('');
                                } else {
                                  field.onChange(value);
                                }
                              }} 
                              value={field.value && !showCustomSchool ? field.value : ''}
                              disabled={!selectedDistrict || selectedDistrict === 'OTHER' || showCustomDistrict}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue 
                                    placeholder={
                                      !selectedDistrict || selectedDistrict === 'OTHER' || showCustomDistrict
                                        ? "Select district first" 
                                        : availableSchools.length > 0
                                        ? "Select a school"
                                        : "No schools available"
                                    } 
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[200px]">
                                {availableSchools.map(school => (
                                  <SelectItem key={school} value={school}>{school}</SelectItem>
                                ))}
                                {availableSchools.length > 0 && (
                                  <SelectItem value="OTHER">Other (Enter Custom)</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage />
                          {selectedDistrict && availableSchools.length > 0 && !showCustomSchool && (
                            <p className="text-xs text-muted-foreground">
                              {availableSchools.length} schools available in {selectedDistrict}
                            </p>
                          )}
                        </FormItem> 
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
                    onClick={() => {
                        playerForm.handleSubmit(handlePlayerFormSubmit)();
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

```
- src/components/individual-registration-dialog.tsx
- `src/app/individual-dashboard/page.tsx`
- `src/components/PlayerSearchDialog.tsx`
- `src/app/roster/page.tsx`
- `src/components/parent-registration-component.tsx`
- `src/app/events/page.tsx`