
'use client';

import { useState, useEffect } from 'react';
import { format, differenceInHours } from 'date-fns';

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
  uscfId: string;
  uscfExpiration?: Date;
  rating?: number;
  grade: string;
  section: string;
};

type PlayerRegistration = {
  byes: {
    round1: string;
    round2: string;
  };
  section: string;
  uscfStatus: 'current' | 'new' | 'renewing';
};
type RegistrationSelections = Record<string, PlayerRegistration>;

const initialEvents: Event[] = [
  {
    id: '1',
    name: "Spring Open 2024",
    date: new Date(new Date().setDate(new Date().getDate() + 10)), // Upcoming
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
    date: new Date(new Date().setDate(new Date().getDate() + 40)), // Upcoming
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
    date: new Date(new Date().setDate(new Date().getDate() + 1)), // 24hr late fee
    location: "North High School",
    registered: "0/80",
    status: "Open",
    rounds: 4,
  },
  {
    id: '5',
    name: "New Year Blitz",
    date: new Date(new Date().setDate(new Date().getDate() + 2)), // 48hr late fee
    location: "Online",
    registered: "0/200",
    status: "Open",
    imageUrl: "https://placehold.co/100x100.png",
    rounds: 9,
  },
];

const rosterPlayers: Player[] = [
    { id: "1", firstName: "Alex", lastName: "Ray", uscfId: "12345678", uscfExpiration: new Date('2025-12-31'), rating: 1850, grade: "10th Grade", section: 'High School K-12' },
    { id: "2", firstName: "Jordan", lastName: "Lee", uscfId: "87654321", uscfExpiration: new Date('2023-01-15'), rating: 2100, grade: "11th Grade", section: 'Championship' },
    { id: "3", firstName: "Casey", lastName: "Becker", uscfId: "11223344", uscfExpiration: new Date('2025-06-01'), rating: 1500, grade: "9th Grade", section: 'High School K-12' },
    { id: "4", firstName: "Morgan", lastName: "Taylor", uscfId: "NEW", rating: 1000, grade: "5th Grade", section: 'Elementary K-5' },
    { id: "5", firstName: "Riley", lastName: "Quinn", uscfId: "55667788", uscfExpiration: new Date('2024-11-30'), rating: 1980, grade: "11th Grade", section: 'Championship' },
    { id: "6", firstName: "Skyler", lastName: "Jones", uscfId: "99887766", uscfExpiration: new Date('2025-02-28'), rating: 1650, grade: "9th Grade", section: 'High School K-12' },
    { id: "7", firstName: "Drew", lastName: "Smith", uscfId: "11122233", uscfExpiration: new Date('2023-10-01'), rating: 2050, grade: "12th Grade", section: 'Championship' },
];

const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];

const gradeToNumber: { [key: string]: number } = {
  'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3,
  '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7,
  '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11,
  '12th Grade': 12,
};

const sectionMaxGrade: { [key: string]: number } = {
  'Kinder-1st': 1,
  'Primary K-3': 3,
  'Elementary K-5': 5,
  'Middle School K-8': 8,
  'High School K-12': 12,
  'Championship': 12,
};


export default function EventsPage() {
    const { toast } = useToast();
    const [events, setEvents] = useState<Event[]>(initialEvents);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selections, setSelections] = useState<RegistrationSelections>({});
    const [calculatedFees, setCalculatedFees] = useState(0);

    const calculateTotalFee = (currentSelections: RegistrationSelections, event: Event): number => {
      let total = 0;
      const hoursUntilEvent = differenceInHours(event.date, new Date());
      
      let registrationFee = 20;
      if (hoursUntilEvent <= 24) {
        registrationFee = 30;
      } else if (hoursUntilEvent <= 48) {
        registrationFee = 25;
      }
      
      for (const playerId in currentSelections) {
        total += registrationFee;
        const playerSelection = currentSelections[playerId];
        if (playerSelection.uscfStatus === 'new' || playerSelection.uscfStatus === 'renewing') {
          total += 24;
        }
      }
      return total;
    }

    useEffect(() => {
        if (selectedEvent && Object.keys(selections).length > 0) {
            const total = calculateTotalFee(selections, selectedEvent);
            setCalculatedFees(total);
        } else {
            setCalculatedFees(0);
        }
    }, [selections, selectedEvent]);

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
            const player = rosterPlayers.find(p => p.id === playerId);
            if (isSelected && player) {
                const isExpired = !player.uscfExpiration || player.uscfExpiration < new Date();
                newSelections[playerId] = { 
                    byes: { round1: 'none', round2: 'none' },
                    section: player.section,
                    uscfStatus: player.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current',
                };
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
              if (byeNumber === 'round1' && value === 'none') {
                  newSelections[playerId].byes.round2 = 'none';
              }
          }
          return newSelections;
      });
    }

    const handleSectionChange = (playerId: string, section: string) => {
      setSelections(prev => {
          const newSelections = {...prev};
          if(newSelections[playerId]) {
              newSelections[playerId].section = section;
          }
          return newSelections;
      });
    }

    const handleUscfStatusChange = (playerId: string, status: 'current' | 'new' | 'renewing') => {
        setSelections(prev => {
            const newSelections = {...prev};
            if(newSelections[playerId]) {
                newSelections[playerId].uscfStatus = status;
            }
            return newSelections;
        });
    }

    const handleProceedToInvoice = () => {
        setIsDialogOpen(false);
        setIsInvoiceDialogOpen(true);
    }

    const handleGenerateInvoice = () => {
        if (!selectedEvent) return;
        
        const newConfirmation = {
            id: new Date().toISOString(),
            eventName: selectedEvent.name,
            eventDate: selectedEvent.date.toISOString(),
            submissionTimestamp: new Date().toISOString(),
            selections,
            totalInvoiced: calculatedFees,
        };

        try {
            const existingConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
            const updatedConfirmations = [...existingConfirmations, newConfirmation];
            localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
            
            console.log("----- SIMULATED INVOICE GENERATION -----");
            console.log("To: Sponsor");
            console.log(`Subject: Invoice for ${selectedEvent.name} Registration`);
            console.log(`Timestamp: ${new Date(newConfirmation.submissionTimestamp).toLocaleString()}`);
            console.log(`Total Players: ${Object.keys(selections).length}`);
            console.log(`Total Amount Invoiced: $${newConfirmation.totalInvoiced.toFixed(2)}`);
            console.log("Registered Players:");
            Object.entries(selections).forEach(([playerId, details]) => {
                const player = rosterPlayers.find(p => p.id === playerId);
                if (player) {
                    const byeText = [details.byes.round1, details.byes.round2].filter(b => b !== 'none').map(b => `R${b}`).join(', ') || 'None';
                    console.log(`  - ${player.firstName} ${player.lastName} | Section: ${details.section} | Byes: ${byeText} | USCF: ${details.uscfStatus}`);
                }
            });
            console.log("-----------------------------------------");
            
            toast({
                title: "Invoice Generated",
                description: `Your registration for ${Object.keys(selections).length} players has been submitted. A confirmation email with the invoice has been sent.`
            });

        } catch (error) {
            console.error("Failed to save confirmation to localStorage", error);
             toast({
                variant: "destructive",
                title: "Submission Error",
                description: `Could not save your registration confirmation. Please try again.`
            });
        }
        
        setIsInvoiceDialogOpen(false);
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
    
    const isSectionValid = (player: Player, section: string): boolean => {
      if (section === 'Championship') return true;
      
      const playerGradeLevel = gradeToNumber[player.grade];
      const sectionMaxLevel = sectionMaxGrade[section];

      if (playerGradeLevel === undefined || sectionMaxLevel === undefined) {
        return true; 
      }

      return playerGradeLevel <= sectionMaxLevel;
    };

    const hasInvalidSelections = Object.entries(selections).some(([playerId, registration]) => {
        const player = rosterPlayers.find(p => p.id === playerId);
        return player ? !isSectionValid(player, registration.section) : false;
    });

    const sectionOptions = sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>);

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
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Register for {selectedEvent?.name}</DialogTitle>
            <DialogDescription>
              Select players, change sections, request byes, and specify USCF membership status.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <ScrollArea className="h-96 w-full">
              <div className="space-y-4 pr-6">
                {rosterPlayers.map((player) => {
                  const isSelected = !!selections[player.id];
                  const firstBye = selections[player.id]?.byes.round1;
                  const isSectionInvalid = isSelected && !isSectionValid(player, selections[player.id]!.section);
                  const uscfStatus = selections[player.id]?.uscfStatus;

                  return (
                    <div key={player.id} className="items-start gap-4 rounded-md border p-4 grid grid-cols-[auto,1fr]">
                        <Checkbox
                          id={`player-${player.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => handlePlayerSelect(player.id, checked)}
                          className="mt-1"
                        />
                        <div className="grid gap-2">
                            <Label htmlFor={`player-${player.id}`} className="font-medium cursor-pointer">
                                {player.firstName} {player.lastName}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Grade: {player.grade} &bull; Section: {player.section} &bull; Rating: {player.rating || 'N/A'}
                            </p>
                            
                            {isSelected && selectedEvent && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2 items-start">
                                    <div className="grid gap-1.5">
                                      <Label className="text-xs">USCF Membership</Label>
                                      <RadioGroup
                                        value={uscfStatus}
                                        onValueChange={(value) => handleUscfStatusChange(player.id, value as any)}
                                        className="mt-1"
                                      >
                                        <div className="flex items-center space-x-2">
                                          <RadioGroupItem value="current" id={`current-${player.id}`} />
                                          <Label htmlFor={`current-${player.id}`} className="font-normal text-sm">Current</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <RadioGroupItem value="new" id={`new-${player.id}`} />
                                          <Label htmlFor={`new-${player.id}`} className="font-normal text-sm">New (+$24)</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <RadioGroupItem value="renewing" id={`renewing-${player.id}`} />
                                          <Label htmlFor={`renewing-${player.id}`} className="font-normal text-sm">Renewing (+$24)</Label>
                                        </div>
                                      </RadioGroup>
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label htmlFor={`section-${player.id}`} className="text-xs">Section</Label>
                                      <Select onValueChange={(value) => handleSectionChange(player.id, value)} value={selections[player.id]?.section}>
                                        <SelectTrigger id={`section-${player.id}`} className={cn("w-full", isSectionInvalid && "border-destructive ring-1 ring-destructive")}>
                                          <SelectValue placeholder="Select Section" />
                                        </SelectTrigger>
                                        <SelectContent>{sectionOptions}</SelectContent>
                                      </Select>
                                      {isSectionInvalid && (
                                          <p className="text-xs text-destructive">Grade level too high for this section.</p>
                                      )}
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label htmlFor={`bye1-${player.id}`} className="text-xs">Bye 1</Label>
                                      <Select onValueChange={(value) => handleByeChange(player.id, 'round1', value)} defaultValue="none">
                                        <SelectTrigger id={`bye1-${player.id}`} className="w-full">
                                          <SelectValue placeholder="Select Bye" />
                                        </SelectTrigger>
                                        <SelectContent>{roundOptions(selectedEvent.rounds)}</SelectContent>
                                      </Select>
                                    </div>
                                     <div className="grid gap-1.5">
                                      <Label htmlFor={`bye2-${player.id}`} className="text-xs">Bye 2</Label>
                                      <Select onValueChange={(value) => handleByeChange(player.id, 'round2', value)} value={selections[player.id]?.byes.round2 || 'none'} disabled={!firstBye || firstBye === 'none'}>
                                        <SelectTrigger id={`bye2-${player.id}`} className="w-full">
                                          <SelectValue placeholder="Select Bye" />
                                        </SelectTrigger>
                                        <SelectContent>{roundOptions(selectedEvent.rounds, firstBye)}</SelectContent>
                                      </Select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="sm:justify-between items-center pt-2 border-t">
              <div className="font-bold text-lg">
                Total: ${calculatedFees.toFixed(2)}
              </div>
              <div>
                <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={handleProceedToInvoice} disabled={Object.keys(selections).length === 0 || hasInvalidSelections}>
                    Review Invoice ({Object.keys(selections).length} Players)
                </Button>
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Register and Accept Invoice</DialogTitle>
                  <DialogDescription>
                      You are registering {Object.keys(selections).length} player(s) for {selectedEvent?.name}. Review the total amount below. Clicking the button will finalize your registration and generate an invoice.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <h3 className="text-2xl font-bold text-center">Total to be Invoiced: ${calculatedFees.toFixed(2)}</h3>
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsInvoiceDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleGenerateInvoice}>Register and Accept Invoice</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
