
'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { format, differenceInHours, isSameDay } from 'date-fns';

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
    Info,
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
import { createInvoice } from '@/ai/flows/create-invoice-flow';
import { useEvents, type Event } from '@/hooks/use-events';
import { generateTeamCode } from '@/lib/school-utils';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { useRoster, type Player } from '@/hooks/use-roster';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { checkSquareConfig } from '@/lib/actions/check-config';

type PlayerRegistration = {
  byes: {
    round1: string;
    round2: string;
  };
  section: string;
  uscfStatus: 'current' | 'new' | 'renewing';
  studentType?: 'gt' | 'independent';
};
type RegistrationSelections = Record<string, PlayerRegistration>;

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
    const { events } = useEvents();
    const { profile: sponsorProfile } = useSponsorProfile();
    const { players: rosterPlayers } = useRoster();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selections, setSelections] = useState<RegistrationSelections>({});
    const [calculatedFees, setCalculatedFees] = useState(0);
    const [clientReady, setClientReady] = useState(false);
    const [isSquareConfigured, setIsSquareConfigured] = useState(true);

    useEffect(() => {
        checkSquareConfig().then(({ isConfigured }) => setIsSquareConfigured(isConfigured));
    }, []);

    useEffect(() => {
        setClientReady(true);
    }, []);

    const calculateTotalFee = (currentSelections: RegistrationSelections, event: Event): number => {
      let total = 0;
      if (!clientReady) return 0;
      
      const eventDate = new Date(event.date);
      const now = new Date();
      
      let registrationFee = event.regularFee;
      if (isSameDay(eventDate, now)) {
        registrationFee = event.dayOfFee;
      } else {
        const hoursUntilEvent = differenceInHours(eventDate, now);
        if (hoursUntilEvent <= 24) {
          registrationFee = event.veryLateFee;
        } else if (hoursUntilEvent <= 48) {
          registrationFee = event.lateFee;
        }
      }
      
      for (const playerId in currentSelections) {
        total += registrationFee;
        const playerSelection = currentSelections[playerId];
        if (playerSelection.uscfStatus === 'new' || playerSelection.uscfStatus === 'renewing') {
          total += 24; // Standard USCF fee
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
    }, [selections, selectedEvent, clientReady]);

    const handleRegisterClick = (event: Event) => {
        const status = getEventStatus(event);
        if (status === 'Open' || status === 'Upcoming') {
            setSelectedEvent(event);
            setIsDialogOpen(true);
            setSelections({});
        }
    }

    const handlePlayerSelect = (playerId: string, isSelected: boolean | string) => {
        setSelections(prev => {
            const newSelections = {...prev};
            const player = rosterPlayers.find(p => p.id === playerId);
            if (isSelected && player && selectedEvent) {
                const eventDate = new Date(selectedEvent.date);
                const isExpired = !player.uscfExpiration || player.uscfExpiration < eventDate;
                newSelections[playerId] = { 
                    byes: { round1: 'none', round2: 'none' },
                    section: player.section,
                    uscfStatus: player.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current',
                    studentType: player.studentType,
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

    const handleStudentTypeChange = (playerId: string, studentType: 'gt' | 'independent') => {
      setSelections(prev => {
          const newSelections = {...prev};
          if(newSelections[playerId]) {
              newSelections[playerId].studentType = studentType;
          }
          return newSelections;
      });
    }

    const handleProceedToInvoice = () => {
        setIsDialogOpen(false);
        setIsInvoiceDialogOpen(true);
    }

    const handleGenerateInvoice = async () => {
        if (!selectedEvent || !sponsorProfile) return;
        
        let registrationFeePerPlayer = selectedEvent.regularFee;
        if (clientReady) {
            const eventDate = new Date(selectedEvent.date);
            const now = new Date();
            if (isSameDay(eventDate, now)) {
                registrationFeePerPlayer = selectedEvent.dayOfFee;
            } else {
                const hoursUntilEvent = differenceInHours(eventDate, new Date());
                if (hoursUntilEvent <= 24) { registrationFeePerPlayer = selectedEvent.veryLateFee; } 
                else if (hoursUntilEvent <= 48) { registrationFeePerPlayer = selectedEvent.lateFee; }
            }
        }

        const isPsja = sponsorProfile.district === 'PHARR-SAN JUAN-ALAMO ISD';
        const allIndependent = isPsja && Object.values(selections).length > 0 && Object.values(selections).every(s => s.studentType === 'independent');
        
        const teamCode = generateTeamCode({ 
            schoolName: sponsorProfile.school, 
            district: sponsorProfile.district,
            studentType: allIndependent ? 'independent' : undefined
        });

        const playersToInvoice = Object.entries(selections).map(([playerId, registration]) => {
            const player = rosterPlayers.find(p => p.id === playerId)!;
            const lateFeeAmount = registrationFeePerPlayer - selectedEvent!.regularFee;
            return {
                playerName: `${player.firstName} ${player.lastName}`,
                baseRegistrationFee: selectedEvent!.regularFee,
                lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
                uscfAction: registration.uscfStatus !== 'current',
            };
        });

        try {
            const { invoiceId, invoiceUrl, status, invoiceNumber } = await createInvoice({
                sponsorName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`,
                sponsorEmail: sponsorProfile.email,
                schoolName: sponsorProfile.school,
                teamCode: teamCode,
                eventName: selectedEvent.name,
                eventDate: selectedEvent.date,
                uscfFee: 24,
                players: playersToInvoice
            });

            const newConfirmation = {
                id: invoiceId,
                invoiceId: invoiceId,
                eventName: selectedEvent.name,
                eventDate: selectedEvent.date,
                submissionTimestamp: new Date().toISOString(),
                selections,
                totalInvoiced: calculatedFees,
                invoiceUrl,
                invoiceNumber,
                teamCode: teamCode,
                invoiceStatus: status,
                purchaserName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`,
                schoolName: sponsorProfile.school,
                district: sponsorProfile.district,
            };

            const existingConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
            localStorage.setItem('confirmations', JSON.stringify([...existingConfirmations, newConfirmation]));
            
            const existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
            localStorage.setItem('all_invoices', JSON.stringify([...existingInvoices, newConfirmation]));
            window.dispatchEvent(new Event('all_invoices_updated'));
            
            toast({
                title: "Invoice Generated Successfully!",
                description: (
                  <p>
                    Invoice {invoiceNumber || invoiceId} for {Object.keys(selections).length} players has been submitted.
                    <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline ml-2">
                      View Invoice
                    </a>
                  </p>
                ),
            });

        } catch (error) {
            console.error("Failed to create invoice or save confirmation", error);
            const description = error instanceof Error ? error.message : "An unknown error occurred. Please try again.";
            toast({
                variant: "destructive",
                title: "Submission Error",
                description: description,
            });
        }
        
        setIsInvoiceDialogOpen(false);
        setSelectedEvent(null);
        setSelections({});
    }

    const getEventStatus = (event: Event): "Open" | "Upcoming" | "Closed" | "Completed" => {
      if (!clientReady) return "Upcoming";
      const now = new Date();
      const eventDate = new Date(event.date);
      if (now > eventDate) {
        return "Completed";
      }
      return "Open";
    };

    const getStatusBadge = (status: "Open" | "Upcoming" | "Closed" | "Completed") => {
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

    const isUscfStatusValid = (player: Player, registration: PlayerRegistration, event: Event): boolean => {
      if (registration.uscfStatus === 'current') {
        if (player.uscfId.toUpperCase() === 'NEW') return false;
        if (!player.uscfExpiration) return false;
        if (new Date(event.date) > player.uscfExpiration) return false;
      }
      return true;
    };

    const isPersonalDataComplete = (player: Player): boolean => {
        return !!(player.dob && player.zipCode && player.email);
    }

    const isRenewingDataValid = (player: Player): boolean => {
      if (player.uscfId.toUpperCase() === 'NEW') return false;
      return isPersonalDataComplete(player);
    };

    const hasInvalidSelections = Object.entries(selections).some(([playerId, registration]) => {
        const player = rosterPlayers.find(p => p.id === playerId);
        return player ? !isSectionValid(player, registration.section) : false;
    });

    const hasInvalidUscfSelections = Object.entries(selections).some(([playerId, registration]) => {
      const player = rosterPlayers.find(p => p.id === playerId);
      return player && selectedEvent ? !isUscfStatusValid(player, registration, selectedEvent) : false;
    });

    const hasInvalidDataForUscfAction = Object.entries(selections).some(([playerId, registration]) => {
      const player = rosterPlayers.find(p => p.id === playerId);
      if (!player) return true;

      if (registration.uscfStatus === 'renewing') {
        return !isRenewingDataValid(player);
      }
      if (registration.uscfStatus === 'new') {
        return !isPersonalDataComplete(player);
      }
      return false;
    });

    const sectionOptions = sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>);
    
    // For invoice dialog
    const uscfActionsCount = Object.values(selections).filter(s => s.uscfStatus === 'new' || s.uscfStatus === 'renewing').length;
    const registrationCount = Object.keys(selections).length;
    const uscfFee = 24;
    let registrationFeePerPlayer = selectedEvent?.regularFee ?? 0;
    let feeTypeLabel = "Regular Fee";
    if (selectedEvent && clientReady) {
        const eventDate = new Date(selectedEvent.date);
        const now = new Date();
        if (isSameDay(eventDate, now)) {
            registrationFeePerPlayer = selectedEvent.dayOfFee;
            feeTypeLabel = "Day of Registration Fee";
        } else {
            const hoursUntilEvent = differenceInHours(eventDate, now);
            if (hoursUntilEvent <= 24) { 
                registrationFeePerPlayer = selectedEvent.veryLateFee; 
                feeTypeLabel = "Late Fee (1 day prior)";
            } else if (hoursUntilEvent <= 48) { 
                registrationFeePerPlayer = selectedEvent.lateFee; 
                feeTypeLabel = "Late Fee (2 days prior)";
            }
        }
    }
    const appliedPenalty = selectedEvent ? registrationFeePerPlayer - selectedEvent.regularFee : 0;


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
                  <TableHead>Attachments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const status = getEventStatus(event);
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>{clientReady ? format(new Date(event.date), 'PPP') : ''}</TableCell>
                      <TableCell>{event.location}</TableCell>
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
                          className={cn("text-white", getStatusBadge(status))}
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <Button 
                            onClick={() => handleRegisterClick(event)}
                            disabled={status === 'Closed' || status === 'Completed'}
                            >
                            Register
                          </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Register for {selectedEvent?.name}
              {registrationCount > 0 && (
                <span className="ml-2 font-normal text-muted-foreground">
                  ({registrationCount} player(s) selected)
                </span>
              )}
            </DialogTitle>
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
                  const isUscfInvalid = isSelected && selectedEvent && uscfStatus === 'current' && !isUscfStatusValid(player, selections[player.id]!, selectedEvent);
                  const isRenewingInvalid = isSelected && uscfStatus === 'renewing' && !isRenewingDataValid(player);
                  const isNewInvalid = isSelected && uscfStatus === 'new' && !isPersonalDataComplete(player);

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
                            <p className="text-sm text-muted-foreground">
                                USCF ID: {player.uscfId} &bull; Expires: {player.uscfExpiration ? format(player.uscfExpiration, 'MM/dd/yyyy') : 'N/A'}
                            </p>
                            
                            {isSelected && selectedEvent && (
                                <>
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
                                      {isUscfInvalid && (
                                          <p className="text-xs text-destructive">
                                              Player must have a valid, unexpired USCF membership for this event to be 'Current'.
                                          </p>
                                      )}
                                      {(isRenewingInvalid || isNewInvalid) && (
                                          <div className="mt-2 text-xs text-destructive p-2 bg-destructive/10 rounded-md">
                                              Player data is incomplete for this action. Please update DOB, Zip, and Email in the{' '}
                                              <Link href="/roster" className="underline font-semibold hover:text-destructive/80" target="_blank" rel="noopener noreferrer">
                                                  Roster Page
                                              </Link>.
                                          </div>
                                      )}
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

                                {sponsorProfile?.district === 'PHARR-SAN JUAN-ALAMO ISD' && (
                                    <div className="grid gap-1.5 mt-4">
                                        <Label className="text-xs">Student Type (PSJA Only)</Label>
                                        <RadioGroup
                                            value={selections[player.id]?.studentType}
                                            onValueChange={(value) => handleStudentTypeChange(player.id, value as any)}
                                            className="flex items-center gap-4"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="gt" id={`gt-${player.id}`} />
                                                <Label htmlFor={`gt-${player.id}`} className="font-normal text-sm cursor-pointer">GT Student</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="independent" id={`independent-${player.id}`} />
                                                <Label htmlFor={`independent-${player.id}`} className="font-normal text-sm cursor-pointer">Independent</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                )}
                                
                                <p className="text-xs text-muted-foreground mt-2">
                                    Scholastic - .5 pts bye available<br />
                                    Open - .5 pt bye available only Rds 1-4
                                </p>
                                </>
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
                <Button type="button" onClick={handleProceedToInvoice} disabled={registrationCount === 0 || hasInvalidSelections || hasInvalidUscfSelections || hasInvalidDataForUscfAction}>
                    Review Invoice ({registrationCount} Players)
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
                      You are about to register {registrationCount} player(s) for {selectedEvent?.name}. Please review the summary below.
                  </DialogDescription>
              </DialogHeader>
              {selectedEvent && (
                <div className="py-4 space-y-4">
                  {!isSquareConfigured && (
                    <Alert variant="destructive">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Square Not Configured</AlertTitle>
                      <AlertDescription>
                        Payment processing is disabled. Please add your Square credentials to your .env file to create invoices.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="rounded-lg border bg-muted p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Base Registration Fee</span>
                          <span className="font-medium">{registrationCount} &times; ${selectedEvent.regularFee.toFixed(2)}</span>
                      </div>
                      {appliedPenalty > 0 && (
                          <div className="flex justify-between">
                              <span className="text-muted-foreground">{feeTypeLabel}</span>
                              <span className="font-medium">{registrationCount} &times; ${appliedPenalty.toFixed(2)}</span>
                          </div>
                      )}
                      {uscfActionsCount > 0 && (
                          <div className="flex justify-between">
                              <span className="text-muted-foreground">New / Renewing USCF Memberships</span>
                              <span className="font-medium">{uscfActionsCount} &times; ${uscfFee.toFixed(2)}</span>
                          </div>
                      )}
                      <div className="pt-2 border-t mt-2">
                        <p className="text-xs text-muted-foreground/80">Fee reminder: a late fee is applied for registrations made within 48 hours of the event. This fee increases for registrations made within 24 hours or on the day of the event.</p>
                      </div>
                  </div>

                  <div className="text-center rounded-lg border border-primary/20 bg-primary/5 py-4">
                    <p className="text-sm font-medium text-muted-foreground">TOTAL TO BE INVOICED</p>
                    <p className="text-3xl font-bold text-primary">${calculatedFees.toFixed(2)}</p>
                  </div>
                </div>
              )}
              <DialogFooter>
                  <Button variant="ghost" onClick={() => {
                      setIsInvoiceDialogOpen(false);
                      setIsDialogOpen(true);
                  }}>Back</Button>
                  <Button onClick={handleGenerateInvoice} disabled={!isSquareConfigured}>Register and Accept Invoice</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
