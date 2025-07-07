
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEvents } from "@/hooks/use-events";
import { useMemo } from "react";
import { format } from "date-fns";
import { FileText, ImageIcon, Info } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useMasterDb } from "@/context/master-db-context";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";


export default function DashboardPage() {
  const { events } = useEvents();
  const { database: allPlayers } = useMasterDb();
  const { profile } = useSponsorProfile();

  const rosterPlayers = useMemo(() => {
    if (!profile || profile.role !== 'sponsor') return [];
    return allPlayers.filter(p => p.district === profile.district && p.school === profile.school);
  }, [allPlayers, profile]);

  const upcomingEvents = useMemo(() => {
    return events
      .filter(event => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [events]);

  const playersWithMissingInfo = useMemo(() => {
    return rosterPlayers.filter(player => {
      return !player.uscfId || !player.grade || !player.section || !player.email || !player.dob || !player.zipCode;
    });
  }, [rosterPlayers]);


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

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events ({upcomingEvents.length})</CardTitle>
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
                    <p className="text-sm text-muted-foreground">No pending requests</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>My Roster ({rosterPlayers.length})</CardTitle>
            <CardDescription>A quick view of your sponsored players. Scroll to see more.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Regular Rating</TableHead>
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
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/roster">View & Manage Full Roster</Link>
            </Button>
          </CardFooter>
        </Card>

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
