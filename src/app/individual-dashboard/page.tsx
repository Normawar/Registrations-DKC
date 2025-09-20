
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
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEvents } from "@/hooks/use-events";
import { useState, useEffect, useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { Info, FileText, ImageIcon, User, PlusCircle, Search } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IndividualRegistrationDialog } from "@/components/individual-registration-dialog";
import { PlayerSearchDialog } from "@/components/PlayerSearchDialog";
import { useToast } from "@/hooks/use-toast";
import { IndividualGuard } from "@/components/auth-guard";


function IndividualDashboardContent() {
  const { events } = useEvents();
  const { database: allPlayers } = useMasterDb();
  const { profile, loading } = useSponsorProfile();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [parentStudents, setParentStudents] = useState<MasterPlayer[]>([]);
  
  const loadParentStudents = () => {
    if (profile?.email && allPlayers.length > 0) {
      try {
        const storedParentStudents = localStorage.getItem(`parent_students_${profile.email}`);
        if (storedParentStudents) {
          const studentIds = JSON.parse(storedParentStudents);
          const students = allPlayers.filter(p => studentIds.includes(p.id));
          setParentStudents(students);
        } else {
          setParentStudents([]);
        }
      } catch (error) {
        console.error('Failed to load parent students:', error);
      }
    }
  };

  useEffect(() => {
    loadParentStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, allPlayers]);
  
  const parentStudentIds = useMemo(() => parentStudents.map(p => p.id), [parentStudents]);

  const playersWithMissingInfo = useMemo(() => {
    return parentStudents.filter(player => {
      return !player.uscfId || !player.grade || !player.section || !player.email || !player.dob || !player.zipCode;
    });
  }, [parentStudents]);

  const eventDates = useMemo(() => {
    return events.map(event => new Date(event.date));
  }, [events]);

  const eventsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter(event => isSameDay(new Date(event.date), selectedDate));
  }, [events, selectedDate]);
  
  const handleRegisterClick = (event: any) => {
    setSelectedEvent(event);
    setIsRegistrationDialogOpen(true);
  };
  
  const handleStudentAdded = (newStudent: MasterPlayer) => {
    if (!profile) return;
    
    const parentStudentsKey = `parent_students_${profile.email}`;
    const existingStudentIds = JSON.parse(localStorage.getItem(parentStudentsKey) || '[]');
    if (!existingStudentIds.includes(newStudent.id)) {
        const updatedStudentIds = [...existingStudentIds, newStudent.id];
        localStorage.setItem(parentStudentsKey, JSON.stringify(updatedStudentIds));
        loadParentStudents();
        toast({
            title: "Student Added",
            description: `${newStudent.firstName} ${newStudent.lastName} has been added to your list.`
        });
    } else {
        toast({
            variant: 'destructive',
            title: "Student Already Added",
            description: `${newStudent.firstName} ${newStudent.lastName} is already on your list.`
        });
    }
  };

  return (
    <>
      <AppLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
            <p className="text-muted-foreground">
              An overview of your students and events.
            </p>
          </div>

          {playersWithMissingInfo.length > 0 && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Incomplete Student Information</AlertTitle>
              <AlertDescription>
                The following students have missing details: {playersWithMissingInfo.map(p => `${p.firstName} ${p.lastName}`).join(', ')}. 
                Please update their profiles to ensure they can be registered for events.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                  <CardHeader>
                      <CardTitle>Event Calendar</CardTitle>
                      <CardDescription>Highlighted dates indicate a scheduled tournament.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                      {loading ? (
                        <div className="w-full flex flex-col items-center gap-4">
                          <Skeleton className="h-[290px] w-[280px]" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : (
                        <>
                          <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={setSelectedDate}
                              className="rounded-md border"
                              modifiers={{
                                  highlighted: eventDates,
                              }}
                              modifiersClassNames={{
                                  highlighted: 'bg-primary/20 text-primary-foreground rounded-full'
                              }}
                          />
                          <div className="mt-4 w-full space-y-2">
                              <h4 className="font-semibold">Events on {selectedDate ? format(selectedDate, 'PPP') : 'selected date'}</h4>
                              {eventsForSelectedDate.length > 0 ? (
                                  eventsForSelectedDate.map(event => (
                                      <div key={event.id} className="p-3 border rounded-md text-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium">{event.name}</p>
                                                <p className="text-muted-foreground">{event.location}</p>
                                            </div>
                                            <Button size="sm" onClick={() => handleRegisterClick(event)}>
                                                Register
                                            </Button>
                                        </div>
                                        <div className="mt-2 pt-2 border-t flex items-center gap-4">
                                            {event.imageUrl && (
                                                <Button asChild variant="link" size="sm" className="p-0 h-auto text-muted-foreground hover:text-primary">
                                                    <a href={event.imageUrl} target="_blank" rel="noopener noreferrer" title={event.imageName}>
                                                        <ImageIcon className="mr-1.5 h-4 w-4" /> {event.imageName || 'Image'}
                                                    </a>
                                                </Button>
                                            )}
                                            {event.pdfUrl && event.pdfUrl !== '#' && (
                                                <Button asChild variant="link" size="sm" className="p-0 h-auto text-muted-foreground hover:text-primary">
                                                    <a href={event.pdfUrl} target="_blank" rel="noopener noreferrer" title={event.pdfName}>
                                                        <FileText className="mr-1.5 h-4 w-4" /> {event.pdfName || 'PDF'}
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                  ))
                              ) : (
                                  <p className="text-sm text-muted-foreground">No events scheduled for this day.</p>
                              )}
                          </div>
                        </>
                      )}
                  </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>My Students ({loading ? '...' : parentStudents.length})</CardTitle>
                  <CardDescription>A quick view of your managed students.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    {loading ? (
                      <div className="space-y-4">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead className="text-right">Rating</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parentStudents.map((player) => (
                            <TableRow key={player.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src={`https://placehold.co/40x40.png`} alt={`${player.firstName} ${player.lastName}`} data-ai-hint="person face" />
                                    <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">{player.lastName}, {player.firstName}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {player.email || 'No email'}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{player.regularRating || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </ScrollArea>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => setIsAddStudentDialogOpen(true)} variant="outline">
                    <Search className="mr-2 h-4 w-4"/> Add Student from Database
                  </Button>
                </CardFooter>
              </Card>
          </div>
        </div>
      </AppLayout>

      {profile && (
        <>
          <IndividualRegistrationDialog
            isOpen={isRegistrationDialogOpen}
            onOpenChange={setIsRegistrationDialogOpen}
            event={selectedEvent}
            parentProfile={profile}
          />
          <PlayerSearchDialog 
            isOpen={isAddStudentDialogOpen}
            onOpenChange={setIsAddStudentDialogOpen}
            onSelectPlayer={handleStudentAdded}
            excludeIds={parentStudentIds}
            portalType="individual"
          />
        </>
      )}
    </>
  );
}

export default function IndividualDashboardPage() {
    return (
        <IndividualGuard>
            <IndividualDashboardContent />
        </IndividualGuard>
    );
}
