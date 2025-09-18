
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
import { useState, useEffect, useMemo, useCallback } from "react";
import { format, isSameDay } from "date-fns";
import { Info, FileText, ImageIcon, Lock } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SponsorRegistrationDialog } from "@/components/sponsor-registration-dialog";
import { SponsorGuard } from "@/components/auth-guard";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/services/firestore-service";
import { MasterPlayer } from "@/lib/data/full-master-player-data";

function DashboardContent() {
  const { events } = useEvents();
  const { profile } = useSponsorProfile();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [clientReady, setClientReady] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<MasterPlayer[]>([]);
  const [allPlayers, setAllPlayers] = useState<MasterPlayer[]>([]);

  useEffect(() => {
    setClientReady(true);
    setSelectedDate(new Date());
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!db || !profile) return;

    // Fetch roster players for the specific school
    const playersQuery = query(collection(db, 'players'), 
      where('district', '==', profile.district), 
      where('school', '==', profile.school)
    );
    const playersSnapshot = await getDocs(playersQuery);
    const schoolRoster = playersSnapshot.docs.map(doc => doc.data() as MasterPlayer);
    setRosterPlayers(schoolRoster);
    
    // Fetch all players (for name lookups in recent activity)
    // In a production app with millions of players, this should be optimized
    const allPlayersSnapshot = await getDocs(collection(db, 'players'));
    const allPlayerData = allPlayersSnapshot.docs.map(doc => doc.data() as MasterPlayer);
    setAllPlayers(allPlayerData);

    // Fetch recent invoices
    let q = query(collection(db, 'invoices'));
    if (profile.role === 'sponsor' || profile.role === 'district_coordinator') {
      q = query(q, where('district', '==', profile.district), where('schoolName', '==', profile.school));
    } else if (profile.role === 'individual') {
        q = query(q, where('parentEmail', '==', profile.email));
    }

    const invoiceSnapshot = await getDocs(q);
    const allInvoices = invoiceSnapshot.docs.map(doc => doc.data());
    
    const activity = allInvoices
      .sort((a, b) => new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime())
      .slice(0, 5)
      .map(inv => {
        const firstPlayerName = Object.keys(inv.selections || {}).length > 0
          ? allPlayerData.find(p => p.id === Object.keys(inv.selections)[0])?.firstName || 'Unknown Player'
          : 'N/A';
        
        return {
          id: inv.id,
          player: firstPlayerName,
          email: inv.purchaserEmail,
          event: inv.eventName,
          status: inv.invoiceStatus,
          date: inv.submissionTimestamp,
        };
      });

    setRecentActivity(activity);
  }, [profile]);
  
  useEffect(() => {
    if(profile) {
      loadDashboardData();
    }
  }, [profile, loadDashboardData]);

  const playersWithMissingInfo = useMemo(() => {
    return rosterPlayers.filter(player => {
      // **FIX:** Explicitly filter out corrupted "test1 test" players
      if (player.firstName === 'test1' && player.lastName === 'test') {
        return false;
      }
      return !player.uscfId || !player.grade || !player.section || !player.email || !player.dob || !player.zipCode;
    });
  }, [rosterPlayers]);

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

  const getStatusBadge = (status: string) => {
    switch(status?.toUpperCase()) {
        case 'PAID':
        case 'COMPED':
            return <Badge variant="default" className="bg-green-600">Paid</Badge>
        case 'UNPAID':
            return <Badge variant="destructive">Unpaid</Badge>
        case 'CANCELED':
            return <Badge variant="secondary">Canceled</Badge>
        default:
            return <Badge variant="outline">{status || 'Draft'}</Badge>
    }
  };

  return (
    <>
      <AppLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-headline">Sponsors Dashboard</h1>
            <p className="text-muted-foreground">
              An overview of your sponsored activities.
            </p>
          </div>

          {playersWithMissingInfo.length > 0 && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertTitle>Incomplete Player Information</AlertTitle>
              <AlertDescription>
                The following players on your roster have missing details: {playersWithMissingInfo.map(p => `${p.firstName} ${p.lastName}`).join(', ')}. 
                Please <Link href="/roster" className="font-bold underline">update their profiles</Link> to ensure they can be registered for events.
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
                      {clientReady ? (
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
                                                {event.isClosed && (
                                                    <Badge variant="destructive" className="mt-1">
                                                        <Lock className="h-3 w-3 mr-1" />
                                                        Registration Closed
                                                    </Badge>
                                                )}
                                            </div>
                                            <Button size="sm" onClick={() => handleRegisterClick(event)} disabled={event.isClosed}>
                                                Register Players
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
                      ) : (
                        <div className="w-full flex flex-col items-center gap-4">
                          <Skeleton className="h-[290px] w-[280px]" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      )}
                  </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>My Roster ({clientReady ? rosterPlayers.length : '...'})</CardTitle>
                  <CardDescription>A quick view of your sponsored players.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    {clientReady ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead className="text-right">Rating</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rosterPlayers.map((player) => (
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
                                      {player.email}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{player.regularRating || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="space-y-4">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline">
                    <Link href="/roster">View & Manage Full Roster</Link>
                  </Button>
                </CardFooter>
              </Card>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold font-headline">Recent Activity</h2>
            <Card className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player(s)</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                 {recentActivity.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No recent activity.</TableCell>
                    </TableRow>
                 ) : (
                    recentActivity.map(activity => (
                        <TableRow key={activity.id}>
                            <TableCell>
                                <div className="font-medium">{activity.player}</div>
                                <div className="text-sm text-muted-foreground">
                                    {activity.email}
                                </div>
                            </TableCell>
                            <TableCell>{activity.event}</TableCell>
                            <TableCell>{getStatusBadge(activity.status)}</TableCell>
                            <TableCell className="text-right">{format(new Date(activity.date), 'PP')}</TableCell>
                        </TableRow>
                    ))
                 )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </AppLayout>
      <SponsorRegistrationDialog
        isOpen={isRegistrationDialogOpen}
        onOpenChange={setIsRegistrationDialogOpen}
        event={selectedEvent}
      />
    </>
  );
}

export default function DashboardPage() {
  return (
    <SponsorGuard>
      <DashboardContent />
    </SponsorGuard>
  );
}
