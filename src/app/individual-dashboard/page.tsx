
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
import { FileText, ImageIcon, User, Users, Plus } from "lucide-react";
import { ParentRegistrationComponent } from "@/components/parent-registration-component";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { PlayerSearchDialog } from "@/components/PlayerSearchDialog";
import { useToast } from "@/hooks/use-toast";


export default function IndividualDashboardPage() {
  const { events } = useEvents();
  const { profile, isProfileLoaded } = useSponsorProfile();
  const { database } = useMasterDb();
  const { toast } = useToast();
  
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

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
  
  const handleAddStudent = (player: MasterPlayer) => {
    if (!profile?.email) return;
    if (!parentStudents.find(s => s.id === player.id)) {
      const updatedStudents = [...parentStudents, player];
      setParentStudents(updatedStudents);
      
      const studentIds = updatedStudents.map(s => s.id);
      localStorage.setItem(`parent_students_${profile.email}`, JSON.stringify(studentIds));
      
      toast({
        title: "Student Added",
        description: `${player.firstName} ${player.lastName} has been added to your students list.`
      });
    }
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
                        <ul className="list-disc list-inside text-sm text-muted-foreground pl-2">
                            {parentStudents.map(student => (
                                <li key={student.id}>{student.firstName} {student.lastName}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No students added yet. Use the Add Student button to search and add your students.</p>
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
            onSelectPlayer={handleAddStudent}
            excludeIds={parentStudents.map(s => s.id)}
            portalType="individual"
        />
      </div>
    </AppLayout>
  );
}
