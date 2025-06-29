
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';

type Event = {
    id: string;
    name: string;
    date: Date;
    location: string;
    registered: string;
    status: "Open" | "Upcoming" | "Closed" | "Completed";
    imageUrl?: string;
    pdfUrl?: string;
    rounds: number;
};

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  rating?: number;
};

type PlayerRegistration = {
  byes: {
    round1: string;
    round2: string;
  }
}
type RegistrationSelections = Record<string, PlayerRegistration>;

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
    rounds: 5,
  },
  {
    id: '2',
    name: "Summer Championship",
    date: new Date("2024-07-20"),
    location: "Grand Hotel Ballroom",
    registered: "95/100",
    status: "Open",
    rounds: 7,
  },
  {
    id: '3',
    name: "Autumn Classic",
    date: new Date("2024-09-10"),
    location: "Community Chess Club",
    registered: "40/50",
    status: "Completed",
    pdfUrl: "#",
    rounds: 5,
  },
  {
    id: '4',
    name: "Winter Scholastic",
    date: new Date("2024-12-05"),
    location: "North High School",
    registered: "0/80",
    status: "Upcoming",
    rounds: 4,
  },
  {
    id: '5',
    name: "New Year Blitz",
    date: new Date("2025-01-01"),
    location: "Online",
    registered: "0/200",
    status: "Upcoming",
    imageUrl: "https://placehold.co/100x100.png",
    rounds: 9,
  },
];

const rosterPlayers: Player[] = [
    { id: "1", firstName: "Alex", lastName: "Ray", rating: 1850 },
    { id: "2", firstName: "Jordan", lastName: "Lee", rating: 2100 },
    { id: "3", firstName: "Casey", lastName: "Becker", rating: 1500 },
    { id: "4", firstName: "Morgan", lastName: "Taylor", rating: 1720 },
    { id: "5", firstName: "Riley", lastName: "Quinn", rating: 1980 },
    { id: "6", firstName: "Skyler", lastName: "Jones", rating: 1650 },
    { id: "7", firstName: "Drew", lastName: "Smith", rating: 2050 },
];


export default function EventsPage() {
    const { toast } = useToast();
    const [events, setEvents] = useState<Event[]>(initialEvents);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selections, setSelections] = useState<RegistrationSelections>({});

    const handleRegisterClick = (event: Event) => {
        if (event.status === 'Open' || event.status === 'Upcoming') {
            setSelectedEvent(event);
            setIsDialogOpen(true);
            setSelections({});
        }
    }

    const handlePlayerSelect = (playerId: string, isSelected: boolean | string) => {
        setSelections(prev => {
            const newSelections = {...prev};
            if (isSelected) {
                newSelections[playerId] = { byes: { round1: 'none', round2: 'none' } };
            } else {
                delete newSelections[playerId];
            }
            return newSelections;
        });
    }

    const handleByeChange = (playerId: string, byeNumber: 'round1' | 'round2', value: string) => {
      setSelections(prev => {
          const newSelections = {...prev};
          if(newSelections[playerId]) {
              newSelections[playerId].byes[byeNumber] = value;
              // If round1 is set to none, also reset round2
              if (byeNumber === 'round1' && value === 'none') {
                  newSelections[playerId].byes.round2 = 'none';
              }
          }
          return newSelections;
      });
    }

    const handleSubmitRegistration = () => {
        if (!selectedEvent) return;
        
        console.log("Registering for event:", selectedEvent.name);
        console.log("Selected players and byes:", selections);

        toast({
            title: "Registration Submitted",
            description: `Your registration for "${selectedEvent.name}" has been submitted for ${Object.keys(selections).length} players.`
        });
        
        setIsDialogOpen(false);
        setSelectedEvent(null);
        setSelections({});
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
    
    const roundOptions = (maxRounds: number, exclude?: string) => {
      const options = [<SelectItem key="none" value="none">No Bye</SelectItem>];
      for (let i = 1; i <= maxRounds; i++) {
        if (String(i) !== exclude) {
          options.push(<SelectItem key={i} value={String(i)}>Round {i}</SelectItem>);
        }
      }
      return options;
    };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Register for event</h1>
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
                          onClick={() => handleRegisterClick(event)}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Register for {selectedEvent?.name}</DialogTitle>
            <DialogDescription>
              Select players from your roster to register for this event. You can request up to two 1/2 point byes per player.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <ScrollArea className="h-72 w-full">
              <div className="space-y-4 pr-6">
                {rosterPlayers.map((player) => {
                  const isSelected = !!selections[player.id];
                  const firstBye = selections[player.id]?.byes.round1;
                  return (
                    <div key={player.id} className="items-center gap-4 rounded-md border p-4 grid grid-cols-[auto,1fr,auto,auto]">
                        <Checkbox
                          id={`player-${player.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => handlePlayerSelect(player.id, checked)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor={`player-${player.id}`} className="font-medium cursor-pointer">
                                {player.firstName} {player.lastName}
                            </Label>
                            <p className="text-sm text-muted-foreground">Rating: {player.rating || 'N/A'}</p>
                        </div>
                        {isSelected && selectedEvent && (
                          <>
                            <div className="grid gap-1.5">
                              <Label htmlFor={`bye1-${player.id}`} className="text-xs">Bye 1</Label>
                              <Select onValueChange={(value) => handleByeChange(player.id, 'round1', value)} defaultValue="none">
                                <SelectTrigger id={`bye1-${player.id}`} className="w-32">
                                  <SelectValue placeholder="Select Bye" />
                                </SelectTrigger>
                                <SelectContent>{roundOptions(selectedEvent.rounds)}</SelectContent>
                              </Select>
                            </div>
                             <div className="grid gap-1.5">
                              <Label htmlFor={`bye2-${player.id}`} className="text-xs">Bye 2</Label>
                              <Select onValueChange={(value) => handleByeChange(player.id, 'round2', value)} value={selections[player.id]?.byes.round2 || 'none'} disabled={!firstBye || firstBye === 'none'}>
                                <SelectTrigger id={`bye2-${player.id}`} className="w-32">
                                  <SelectValue placeholder="Select Bye" />
                                </SelectTrigger>
                                <SelectContent>{roundOptions(selectedEvent.rounds, firstBye)}</SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={handleSubmitRegistration} disabled={Object.keys(selections).length === 0}>
                Submit Registration ({Object.keys(selections).length} Players)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
