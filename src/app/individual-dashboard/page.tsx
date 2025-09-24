
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
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format, isSameDay } from "date-fns";
import { Info, FileText, ImageIcon, User, PlusCircle, Search } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IndividualRegistrationDialog } from "@/components/individual-registration-dialog";
import { PlayerDetailsDialog } from '@/components/player-details-dialog';
import { useToast } from "@/hooks/use-toast";
import { IndividualGuard } from "@/components/auth-guard";
import { useRouter } from "next/navigation";
import { PlayerSearchDialog } from "@/components/PlayerSearchDialog";


function IndividualDashboardContent() {
  const { events } = useEvents();
  const { database: allPlayers, isDbLoaded, updatePlayer, refreshDatabase } = useMasterDb();
  const { profile, updateProfile, loading: profileLoading } = useSponsorProfile();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);

  const parentStudents = useMemo(() => {
    if (!profile?.studentIds || !isDbLoaded) {
      return [];
    }
    return allPlayers.filter(p => profile.studentIds!.includes(p.id));
  }, [profile, allPlayers, isDbLoaded]);


  const parentStudentIds = useMemo(() => 
    parentStudents.map(p => p.id), [parentStudents]
  );

  const playersWithMissingInfo = useMemo(() => {
    return parentStudents.filter(player => {
      return !player.uscfId || !player.grade || !player.section || !player.email || !player.dob || !player.zipCode;
    });
  }, [parentStudents]);

  const eventDates = useMemo(() => {
    const upcoming = events?.filter(event => {
      const isUpcoming = new Date(event.date) >= new Date();
      const isTestEvent = event.name.toLowerCase().startsWith('test');
      return isUpcoming && !event.isClosed && !isTestEvent;
    }) || [];
    return upcoming.map(event => new Date(event.date));
  }, [events]);

  const eventsForSelectedDate = useMemo(() => {
    if (!selectedDate || !events) return [];
    const upcoming = events.filter(event => {
      const isUpcoming = new Date(event.date) >= new Date();
      const isTestEvent = event.name.toLowerCase().startsWith('test');
      return isUpcoming && !event.isClosed && !isTestEvent;
    });
    return upcoming.filter(event => isSameDay(new Date(event.date), selectedDate));
  }, [events, selectedDate]);
  
  const handleRegisterClick = useCallback((event: any) => {
    setSelectedEvent(event);
    setIsRegistrationDialogOpen(true);
  }, []);
  
  const handleEditPlayer = (player: MasterPlayer) => {
    setPlayerToEdit(player);
    setIsEditOpen(true);
  };

  const handleStudentAdded = useCallback(async (newStudent: MasterPlayer) => {
    if (!profile?.email) return;
  
    try {
      if (!parentStudentIds.includes(newStudent.id)) {
        const updatedIds = [...(profile.studentIds || []), newStudent.id];
        await updateProfile({ studentIds: updatedIds });
        
        toast({
          title: "Student Added",
          description: `${newStudent.firstName} ${newStudent.lastName} has been added to your student list.`
        });
        
        // Close the edit dialog
        setIsEditOpen(false);
        setPlayerToEdit(null);
        
        // Only refresh database after successful addition
        refreshDatabase();
      } else {
        toast({
          title: "Student Already on List",
          description: `${newStudent.firstName} ${newStudent.lastName} is already on your list.`
        });
      }
    } catch (error) {
      console.error('Error adding student:', error);
      toast({
        title: "Error",
        description: "Failed to add student. Please try again.",
        variant: "destructive"
      });
    }
  }, [profile, parentStudentIds, toast, updateProfile, refreshDatabase]);

  const handleAddStudentClick = useCallback(() => {
    setIsSearchOpen(true);
  }, []);
  
  const handlePlayerSelectedFromSearch = useCallback((player: any) => {
    const isMasterPlayer = 'uscfId' in player;
    let playerToProcess: MasterPlayer;

    if (isMasterPlayer) {
        playerToProcess = player as MasterPlayer;
    } else {
        // Convert USCFPlayer to MasterPlayer
        const nameParts = player.name ? player.name.split(', ') : ['Unknown', 'Player'];
        playerToProcess = {
        id: player.uscf_id,
        uscfId: player.uscf_id,
        firstName: nameParts[1] || '',
        lastName: nameParts[0] || '',
        middleName: '',
        regularRating: player.rating_regular || undefined,
        uscfExpiration: player.expiration_date ? new Date(player.expiration_date).toISOString() : undefined,
        state: player.state || 'TX',
        school: '', 
        district: '', 
        grade: '', 
        section: '', 
        email: '', 
        zipCode: '',
        dob: undefined,
        events: 0,
        eventIds: [],
        };
    }
    
    // Close search dialog first
    setIsSearchOpen(false);
    
    // Then open edit dialog with the player
    setPlayerToEdit(playerToProcess);
    setIsEditOpen(true);
    }, []);
  
  const handlePlayerCreatedOrUpdated = useCallback(() => {
    // Only refresh if we're not in the middle of adding to roster
    // The refresh should happen in handleStudentAdded after successful addition
    console.log('Player created or updated - refresh will happen after roster addition');
  }, []);


  const isLoading = profileLoading || !isDbLoaded;
  const hasProfile = !!profile?.email;

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

          {!isLoading && playersWithMissingInfo.length > 0 && (
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
                      {isLoading ? (
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
                  <CardTitle>My Students ({isLoading ? '...' : parentStudents.length})</CardTitle>
                  <CardDescription>A quick view of your managed students.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    {isLoading ? (
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
                          {parentStudents.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                                No students added yet. Click "Add Student" to get started.
                              </TableCell>
                            </TableRow>
                          ) : (
                            parentStudents.map((player) => (
                              <TableRow key={player.id} onClick={() => handleEditPlayer(player)} className="cursor-pointer">
                                <TableCell>
                                    <div className="flex items-center gap-3 group">
                                        <Avatar className="h-9 w-9">
                                        <AvatarImage src={`https://picsum.photos/seed/${player.id}/40/40`} alt={`${player.firstName} ${player.lastName}`} data-ai-hint="person face" />
                                        <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                        <div className="font-medium group-hover:underline">{player.lastName}, {player.firstName}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {player.email || 'No email'}
                                        </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">{player.regularRating || 'N/A'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </ScrollArea>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleAddStudentClick} 
                    variant="outline"
                    disabled={isLoading}
                  >
                    <Search className="mr-2 h-4 w-4"/> Add Student from Database
                  </Button>
                </CardFooter>
              </Card>
          </div>
        </div>
      </AppLayout>

      {hasProfile && !isLoading && (
        <>
          <IndividualRegistrationDialog
            isOpen={isRegistrationDialogOpen}
            onOpenChange={setIsRegistrationDialogOpen}
            event={selectedEvent}
            parentProfile={profile}
          />
          <PlayerSearchDialog 
            isOpen={isSearchOpen}
            onOpenChange={setIsSearchOpen}
            onPlayerSelected={handlePlayerSelectedFromSearch}
            excludeIds={parentStudentIds}
            portalType="individual"
            userProfile={profile}
          />
          <PlayerDetailsDialog
            isOpen={isEditOpen}
            onOpenChange={setIsEditOpen}
            playerToEdit={playerToEdit}
            onPlayerCreatedOrUpdated={handlePlayerCreatedOrUpdated}
            onAddToRoster={handleStudentAdded}
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
