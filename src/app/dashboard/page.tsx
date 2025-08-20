
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
import { Info } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useMasterDb } from "@/context/master-db-context";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";


export default function DashboardPage() {
  const { events } = useEvents();
  const { database: allPlayers } = useMasterDb();
  const { profile } = useSponsorProfile();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    // This ensures client-specific code runs only after mounting
    setClientReady(true);
    setSelectedDate(new Date());
  }, []);

  const rosterPlayers = useMemo(() => {
    if (!profile || profile.role !== 'sponsor') return [];
    return allPlayers.filter(p => p.district === profile.district && p.school === profile.school);
  }, [allPlayers, profile]);

  const playersWithMissingInfo = useMemo(() => {
    return rosterPlayers.filter(player => {
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

  return (
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
                                        <p className="font-medium">{event.name}</p>
                                        <p className="text-muted-foreground">{event.location}</p>
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
                  <TableHead>Player</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Liam Johnson</div>
                    <div className="text-sm text-muted-foreground">
                      liam@example.com
                    </div>
                  </TableCell>
                  <TableCell>Spring Open 2024</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Registered</Badge>
                  </TableCell>
                  <TableCell className="text-right">2024-05-23</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Olivia Smith</div>
                    <div className="text-sm text-muted-foreground">
                      olivia@example.com
                    </div>
                  </TableCell>
                  <TableCell>Summer Championship</TableCell>
                  <TableCell>
                    <Badge variant="outline">Invoiced</Badge>
                  </TableCell>
                  <TableCell className="text-right">2024-05-22</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Noah Williams</div>
                    <div className="text-sm text-muted-foreground">
                      noah@example.com
                    </div>
                  </TableCell>
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
      </div>
    </AppLayout>
  );
}
