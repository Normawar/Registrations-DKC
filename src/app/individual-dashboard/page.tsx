
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
import { useMemo } from "react";
import { format } from "date-fns";
import { FileText, ImageIcon } from "lucide-react";
import { ParentRegistrationComponent } from "@/components/parent-registration-component";


const individualProfile = { 
  id: "p2", 
  firstName: "Olivia", 
  lastName: "Smith", 
  email: 'olivia@example.com', 
  rating: 2100,
  phone: '(555) 555-5555' 
};

export default function IndividualDashboardPage() {
  const { events } = useEvents();

  const upcomingEvents = useMemo(() => {
    return events
      .filter(event => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      // mock registration status
      .map((event, index) => ({...event, registered: [true, true, false, false, true][index % 5] || false })); 
  }, [events]);

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
              <CardTitle>My Player Profile</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={`https://placehold.co/64x64.png`} alt={`${individualProfile.firstName} ${individualProfile.lastName}`} data-ai-hint="person face" />
                    <AvatarFallback>{individualProfile.firstName.charAt(0)}{individualProfile.lastName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-xl font-bold">{individualProfile.firstName} {individualProfile.lastName}</div>
                    <div className="text-sm text-muted-foreground">{individualProfile.email}</div>
                    <div className="text-sm font-semibold">Rating: {individualProfile.rating}</div>
                  </div>
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
        
        <ParentRegistrationComponent parentProfile={individualProfile} />

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
      </div>
    </AppLayout>
  );
}
