
'use client';

import { useState } from 'react';
import { format } from 'date-fns';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { 
    FileText, 
    ImageIcon,
} from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Event = {
    id: string;
    name: string;
    date: Date;
    location: string;
    registered: string;
    status: "Open" | "Upcoming" | "Closed" | "Completed";
    imageUrl?: string;
    pdfUrl?: string;
};

const initialEvents: Event[] = [
  {
    id: '1',
    name: "Spring Open 2024",
    date: new Date("2024-06-15"),
    location: "City Convention Center",
    registered: "128/150",
    status: "Open",
    imageUrl: "https://placehold.co/100x100.png",
    pdfUrl: "#",
  },
  {
    id: '2',
    name: "Summer Championship",
    date: new Date("2024-07-20"),
    location: "Grand Hotel Ballroom",
    registered: "95/100",
    status: "Open",
  },
  {
    id: '3',
    name: "Autumn Classic",
    date: new Date("2024-09-10"),
    location: "Community Chess Club",
    registered: "40/50",
    status: "Completed",
    pdfUrl: "#",
  },
  {
    id: '4',
    name: "Winter Scholastic",
    date: new Date("2024-12-05"),
    location: "North High School",
    registered: "0/80",
    status: "Upcoming",
  },
  {
    id: '5',
    name: "New Year Blitz",
    date: new Date("2025-01-01"),
    location: "Online",
    registered: "0/200",
    status: "Upcoming",
    imageUrl: "https://placehold.co/100x100.png",
  },
];

export default function EventsPage() {
    const { toast } = useToast();
    const [events, setEvents] = useState<Event[]>(initialEvents);

    const handleRegister = (eventName: string, status: Event['status']) => {
        if (status === 'Open' || status === 'Upcoming') {
            toast({
                title: "Registration Submitted",
                description: `Your registration for "${eventName}" has been submitted.`
            });
        }
    }

    const getStatusBadge = (status: Event['status']) => {
      switch (status) {
        case 'Open': return 'bg-green-600';
        case 'Upcoming': return 'bg-blue-500';
        case 'Closed': return 'bg-yellow-500';
        case 'Completed': return 'bg-gray-500';
        default: return 'bg-muted-foreground';
      }
    };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Register for Event</h1>
          <p className="text-muted-foreground">
            Browse upcoming tournaments and register your players.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Attachments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{format(event.date, 'PPP')}</TableCell>
                    <TableCell>{event.location}</TableCell>
                    <TableCell>{event.registered}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            {event.imageUrl && (
                                <a href={event.imageUrl} target="_blank" rel="noopener noreferrer" title="Event Image"><ImageIcon className="h-4 w-4 text-muted-foreground hover:text-primary" /></a>
                            )}
                            {event.pdfUrl && (
                                <a href={event.pdfUrl} target="_blank" rel="noopener noreferrer" title="Event PDF"><FileText className="h-4 w-4 text-muted-foreground hover:text-primary" /></a>
                            )}
                            {(!event.imageUrl && !event.pdfUrl) && <span className="text-xs text-muted-foreground">None</span>}
                        </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={"default"}
                        className={cn("text-white", getStatusBadge(event.status))}
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button 
                          onClick={() => handleRegister(event.name, event.status)}
                          disabled={event.status === 'Closed' || event.status === 'Completed'}
                          >
                          Register
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
