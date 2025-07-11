
'use client';

import React, { useState, useEffect, ReactNode, useMemo } from 'react';
import { format, differenceInHours, isSameDay, startOfToday } from 'date-fns';

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
    Loader2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Download,
    Check,
    Search,
    UserCheck
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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { createInvoice } from '@/ai/flows/create-invoice-flow';
import { useEvents, type Event } from '@/hooks/use-events';
import { generateTeamCode } from '@/lib/school-utils';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { createMembershipInvoice } from '@/ai/flows/create-membership-invoice-flow';
import { checkSquareConfig } from '@/lib/actions/check-config';
import { useMasterDb, type MasterPlayer as Player } from '@/context/master-db-context';
import Papa from 'papaparse';


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

type Confirmation = {
  id: string; // Unique ID for the confirmation record itself
  eventId: string;
  eventName: string;
  eventDate: string;
  selections: RegistrationSelections;
  invoiceId?: string;
  invoiceUrl?: string;
  sponsorName: string;
  sponsorEmail: string;
};

type StoredDownloads = {
  [eventId: string]: string[]; // Array of player IDs that have been downloaded
};

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

type SortableColumnKey = 'name' | 'date' | 'location' | 'status';

export default function EventsPage() {
    const { toast } = useToast();
    const { events } = useEvents();
    const { profile: sponsorProfile } = useSponsorProfile();
    const { database: allPlayers } = useMasterDb();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [isRegistrationsOpen, setIsRegistrationsOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selections, setSelections] = useState<RegistrationSelections>({});
    const [calculatedFees, setCalculatedFees] = useState({ total: 0, registration: 0, uscf: 0 });
    const [clientReady, setClientReady] = useState(false);
    const [separateUscfInvoice, setSeparateUscfInvoice] = useState(false);
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [isSquareConfigured, setIsSquareConfigured] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'ascending' });
    const [eventRegistrations, setEventRegistrations] = useState<Confirmation[]>([]);
    const [alreadyRegisteredIds, setAlreadyRegisteredIds] = useState<Set<string>>(new Set());
    
    const [playerSortConfig, setPlayerSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
    const [registrationsSearchQuery, setRegistrationsSearchQuery] = useState('');

    const rosterPlayers = useMemo(() => {
        if (!sponsorProfile || sponsorProfile.role !== 'sponsor') return [];
        return allPlayers.filter(p => p.district === sponsorProfile.district && p.school === sponsorProfile.school);
    }, [allPlayers, sponsorProfile]);
    
    const eventRegistrationsMap = useMemo(() => {
        const map = new Map<string, number>();
        eventRegistrations.forEach(conf => {
            if (conf.eventId) {
                const count = map.get(conf.eventId) || 0;
                map.set(conf.eventId, count + Object.keys(conf.selections).length);
            }
        });
        return map;
    }, [eventRegistrations]);


    useEffect(() => {
        setClientReady(true);
        checkSquareConfig().then(({ isConfigured }) => {
            setIsSquareConfigured(isConfigured);
        });
        const storedConfirmations = localStorage.getItem('confirmations');
        if (storedConfirmations) {
            setEventRegistrations(JSON.parse(storedConfirmations));
        }
    }, []);

    const getEventStatus = (event: Event): "Open" | "Upcoming" | "Closed" | "Completed" => {
      if (!clientReady) return "Upcoming";
      const now = new Date();
      const eventDate = new Date(event.date);
      if (now > eventDate) {
        return "Completed";
      }
      return "Open";
    };

    const sortedEvents = useMemo(() => {
        const today = startOfToday();
        const sortableEvents = events.filter(event => new Date(event.date) >= today);

        if (sortConfig) {
            sortableEvents.sort((a, b) => {
                let aValue: string | number | Date;
                let bValue: string | number | Date;

                if (sortConfig.key === 'status') {
                    aValue = getEventStatus(a);
                    bValue = getEventStatus(b);
                } else if (sortConfig.key === 'date') {
                    aValue = new Date(a.date);
                    bValue = new Date(b.date);
                } else {
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableEvents;
    }, [events, sortConfig, clientReady]);

    const requestSort = (key: SortableColumnKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (columnKey: SortableColumnKey) => {
        if (!sortConfig || sortConfig.key !== columnKey) {
            return <ArrowUpDown className="ml-2 h-4 w-4" />;
        }
        if (sortConfig.direction === 'ascending') {
            return <ArrowUp className="ml-2 h-4 w-4" />;
        }
        return <ArrowDown className="ml-2 h-4 w-4" />;
    };


    const calculateTotalFee = (currentSelections: RegistrationSelections, event: Event) => {
      let registrationTotal = 0;
      let uscfTotal = 0;
      if (!clientReady) return { total: 0, registration: 0, uscf: 0 };
      
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
        registrationTotal += registrationFee;
        const playerSelection = currentSelections[playerId];
        if (playerSelection.uscfStatus === 'new' || playerSelection.uscfStatus === 'renewing') {
          uscfTotal += 24; // Standard USCF fee
        }
      }
      return { total: registrationTotal + uscfTotal, registration: registrationTotal, uscf: uscfTotal };
    }

    useEffect(() => {
        if (selectedEvent && Object.keys(selections).length > 0) {
            const fees = calculateTotalFee(selections, selectedEvent);
            setCalculatedFees(fees);
        } else {
            setCalculatedFees({ total: 0, registration: 0, uscf: 0 });
        }
    }, [selections, selectedEvent, clientReady]);

    const handleRegisterClick = (event: Event) => {
        const status = getEventStatus(event);
        if (status === 'Open' || status === 'Upcoming') {
            // Find players already registered for this event
            const registeredIds = new Set<string>();
            eventRegistrations.forEach(conf => {
                if (conf.eventId === event.id) {
                    Object.keys(conf.selections).forEach(playerId => {
                        registeredIds.add(playerId);
                    });
                }
            });

            setSelectedEvent(event);
            setAlreadyRegisteredIds(registeredIds);
            setIsDialogOpen(true);
            setSelections({});
        }
    }
    
    const handleEventNameClick = (event: Event) => {
        setSelectedEvent(event);
        setRegistrationsSearchQuery(''); // Reset search when opening
        setIsRegistrationsOpen(true);
    };

    const handlePlayerSelect = (playerId: string, isSelected: boolean | string) => {
        setSelections(prev => {
            const newSelections = {...prev};
            const player = rosterPlayers.find(p => p.id === playerId);
            if (isSelected && player && selectedEvent) {
                const eventDate = new Date(selectedEvent.date);
                const expDate = player.uscfExpiration ? new Date(player.uscfExpiration) : null;
                const isExpired = !expDate || expDate < eventDate;
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
        setIsCreatingInvoice(true);
        
        const playersWithUscfAction = Object.entries(selections).filter(
            ([_, r]) => r.uscfStatus === 'new' || r.uscfStatus === 'renewing'
        );

        try {
            if (separateUscfInvoice && playersWithUscfAction.length > 0) {
                // SEPARATE INVOICES
                // 1. Create Registration Invoice
                const isPsja = sponsorProfile.district === 'PHARR-SAN JUAN-ALAMO ISD';
                const allIndependent = isPsja && Object.values(selections).length > 0 && Object.values(selections).every(s => s.studentType === 'independent');
                const teamCode = generateTeamCode({ schoolName: sponsorProfile.school, district: sponsorProfile.district, studentType: allIndependent ? 'independent' : undefined });
                
                let registrationFeePerPlayer = selectedEvent.regularFee;
                if (clientReady) {
                    const eventDate = new Date(selectedEvent.date);
                    const now = new Date();
                    if (isSameDay(eventDate, now)) { registrationFeePerPlayer = selectedEvent.dayOfFee; }
                    else { const hoursUntilEvent = differenceInHours(eventDate, now); if (hoursUntilEvent <= 24) { registrationFeePerPlayer = selectedEvent.veryLateFee; } else if (hoursUntilEvent <= 48) { registrationFeePerPlayer = selectedEvent.lateFee; } }
                }

                const registrationPlayers = Object.entries(selections).map(([playerId]) => {
                    const player = rosterPlayers.find(p => p.id === playerId)!;
                    const lateFeeAmount = registrationFeePerPlayer - selectedEvent!.regularFee;
                    return { playerName: `${player.firstName} ${player.lastName}`, uscfId: player.uscfId, baseRegistrationFee: selectedEvent!.regularFee, lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0, uscfAction: false, };
                });

                const regResult = await createInvoice({
                    sponsorName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`, sponsorEmail: sponsorProfile.email, schoolName: sponsorProfile.school,
                    teamCode: teamCode, eventName: selectedEvent.name, eventDate: selectedEvent.date, uscfFee: 24, players: registrationPlayers
                });
                
                const regConfirmation = {
                    id: regResult.invoiceId, eventId: selectedEvent.id, invoiceId: regResult.invoiceId, eventName: selectedEvent.name, eventDate: selectedEvent.date, submissionTimestamp: new Date().toISOString(),
                    selections, totalInvoiced: calculatedFees.registration, invoiceUrl: regResult.invoiceUrl, invoiceNumber: regResult.invoiceNumber, teamCode: teamCode,
                    invoiceStatus: regResult.status, sponsorName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`, sponsorEmail: sponsorProfile.email, schoolName: sponsorProfile.school, district: sponsorProfile.district,
                };

                const existingConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
                localStorage.setItem('confirmations', JSON.stringify([...existingConfirmations, regConfirmation]));
                let existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
                localStorage.setItem('all_invoices', JSON.stringify([...existingInvoices, regConfirmation]));
                
                toast({ title: "Event Invoice Generated!", description: <p>Invoice {regResult.invoiceNumber} for event registration is ready. <a href={regResult.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline ml-2">View</a></p> });

                // 2. Create USCF Invoice
                const uscfPlayers = playersWithUscfAction.map(([playerId]) => {
                    const player = rosterPlayers.find(p => p.id === playerId)!;
                    return { firstName: player.firstName, middleName: player.middleName, lastName: player.lastName, email: player.email, phone: player.phone, dob: new Date(player.dob).toISOString(), zipCode: player.zipCode, };
                });
                const uscfResult = await createMembershipInvoice({
                    purchaserName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`, purchaserEmail: sponsorProfile.email, schoolName: sponsorProfile.school,
                    membershipType: "USCF Membership (New/Renew)", fee: 24, players: uscfPlayers,
                });
                const uscfInvoiceData = {
                    id: uscfResult.invoiceId, invoiceId: uscfResult.invoiceId, invoiceTitle: `USCF Membership for ${uscfPlayers.length} players`, submissionTimestamp: new Date().toISOString(), totalInvoiced: calculatedFees.uscf,
                    invoiceUrl: uscfResult.invoiceUrl, invoiceNumber: uscfResult.invoiceNumber, purchaserName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`, invoiceStatus: uscfResult.status,
                    schoolName: sponsorProfile.school, district: sponsorProfile.district, membershipType: "USCF Membership (New/Renew)",
                };
                existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
                localStorage.setItem('all_invoices', JSON.stringify([...existingInvoices, uscfInvoiceData]));

                toast({ title: "USCF Invoice Generated!", description: <p>Invoice {uscfResult.invoiceNumber} for USCF fees is ready. <a href={uscfResult.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline ml-2">View</a></p> });

            } else {
                // COMBINED INVOICE (original logic)
                let registrationFeePerPlayer = selectedEvent.regularFee;
                if (clientReady) {
                    const eventDate = new Date(selectedEvent.date);
                    const now = new Date();
                    if (isSameDay(eventDate, now)) { registrationFeePerPlayer = selectedEvent.dayOfFee; } 
                    else { const hoursUntilEvent = differenceInHours(eventDate, new Date()); if (hoursUntilEvent <= 24) { registrationFeePerPlayer = selectedEvent.veryLateFee; } else if (hoursUntilEvent <= 48) { registrationFeePerPlayer = selectedEvent.lateFee; } }
                }
                const isPsja = sponsorProfile.district === 'PHARR-SAN JUAN-ALAMO ISD';
                const allIndependent = isPsja && Object.values(selections).length > 0 && Object.values(selections).every(s => s.studentType === 'independent');
                const teamCode = generateTeamCode({ schoolName: sponsorProfile.school, district: sponsorProfile.district, studentType: allIndependent ? 'independent' : undefined });

                const playersToInvoice = Object.entries(selections).map(([playerId, registration]) => {
                    const player = rosterPlayers.find(p => p.id === playerId)!;
                    const lateFeeAmount = registrationFeePerPlayer - selectedEvent!.regularFee;
                    return { playerName: `${player.firstName} ${player.lastName}`, uscfId: player.uscfId, baseRegistrationFee: selectedEvent!.regularFee, lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0, uscfAction: registration.uscfStatus !== 'current', };
                });

                const result = await createInvoice({
                    sponsorName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`, sponsorEmail: sponsorProfile.email, schoolName: sponsorProfile.school, teamCode: teamCode,
                    eventName: selectedEvent.name, eventDate: selectedEvent.date, uscfFee: 24, players: playersToInvoice
                });

                const newConfirmation: Confirmation = {
                    id: result.invoiceId, eventId: selectedEvent.id, invoiceId: result.invoiceId, eventName: selectedEvent.name, eventDate: selectedEvent.date, submissionTimestamp: new Date().toISOString(), selections,
                    totalInvoiced: calculatedFees.total, invoiceUrl: result.invoiceUrl, invoiceNumber: result.invoiceNumber, teamCode: teamCode, invoiceStatus: result.status,
                    sponsorName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`, sponsorEmail: sponsorProfile.email, schoolName: sponsorProfile.school, district: sponsorProfile.district,
                };

                const existingConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
                localStorage.setItem('confirmations', JSON.stringify([...existingConfirmations, newConfirmation]));
                const existingInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
                localStorage.setItem('all_invoices', JSON.stringify([...existingInvoices, newConfirmation]));
                
                toast({ title: "Invoice Generated Successfully!", description: <p>Invoice {result.invoiceNumber || result.invoiceId} for {Object.keys(selections).length} players has been submitted. <a href={result.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline ml-2">View Invoice</a></p> });
            }
            window.dispatchEvent(new Event('all_invoices_updated'));
            window.dispatchEvent(new Event('storage'));
        } catch (error) {
            console.error("Failed to create invoice(s) or save confirmation", error);
            const description = error instanceof Error ? error.message : "An unknown error occurred. Please try again.";
            toast({ variant: "destructive", title: "Submission Error", description });
        } finally {
            setIsCreatingInvoice(false);
            setIsInvoiceDialogOpen(false);
            setSelectedEvent(null);
            setSelections({});
            setSeparateUscfInvoice(false);
        }
    }

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
        const expDate = player.uscfExpiration ? new Date(player.uscfExpiration) : null;
        if (!expDate) return false;
        if (new Date(event.date) > expDate) return false;
      }
      return true;
    };

    const isPersonalDataComplete = (player: Player): boolean => {
        const dob = player.dob ? new Date(player.dob) : null;
        return !!(dob && player.zipCode && player.email);
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
    
    const [downloadedPlayers, setDownloadedPlayers] = useState<StoredDownloads>({});
    
    useEffect(() => {
        const stored = localStorage.getItem('downloaded_registrations');
        if (stored) {
            setDownloadedPlayers(JSON.parse(stored));
        }
    }, []);
    
    const allRegisteredPlayersForSelectedEvent = useMemo(() => {
        if (!selectedEvent) return [];
        const playerMap = new Map(allPlayers.map(p => [p.id, p]));
        const registrations = eventRegistrations.filter(c => c.eventId === selectedEvent.id);
        const players = registrations.flatMap(c => 
            Object.entries(c.selections).map(([playerId, details]) => ({
                player: playerMap.get(playerId),
                details
            }))
        ).filter(item => item.player) as { player: Player; details: { section: string } }[];
        
        const eventDownloads = downloadedPlayers[selectedEvent.id] || [];
        
        let filteredPlayers = players;

        if (registrationsSearchQuery) {
            const lowerQuery = registrationsSearchQuery.toLowerCase();
            filteredPlayers = players.filter(({player}) => 
                player.uscfId.toLowerCase().includes(lowerQuery) ||
                `${player.firstName} ${player.lastName}`.toLowerCase().includes(lowerQuery)
            );
        }

        if (playerSortConfig) {
            filteredPlayers.sort((a, b) => {
                let result = 0;
                if (playerSortConfig.key === 'new') {
                    const aIsNew = !eventDownloads.includes(a.player.id);
                    const bIsNew = !eventDownloads.includes(b.player.id);
                    if (aIsNew && !bIsNew) result = -1;
                    else if (!aIsNew && bIsNew) result = 1;
                } else {
                    const key = playerSortConfig.key as keyof Player;
                    let aValue: any = a.player[key];
                    let bValue: any = b.player[key];
                    if (aValue < bValue) result = -1;
                    else if (aValue > bValue) result = 1;
                }
                return playerSortConfig.direction === 'ascending' ? result : -result;
            });
        }
        return filteredPlayers;
    }, [selectedEvent, eventRegistrations, allPlayers, playerSortConfig, downloadedPlayers, registrationsSearchQuery]);
    
    const newPlayersForDownload = useMemo(() => {
        if (!selectedEvent) return [];
        const alreadyDownloaded = downloadedPlayers[selectedEvent.id] || [];
        return allRegisteredPlayersForSelectedEvent.filter(p => !alreadyDownloaded.includes(p.player.id));
    }, [allRegisteredPlayersForSelectedEvent, downloadedPlayers, selectedEvent]);
    
    const handleDownload = () => {
        if (!selectedEvent || newPlayersForDownload.length === 0) return;
        
        const csvData = newPlayersForDownload.map(p => ({
            "USCF ID": p.player.uscfId,
            "First Name": p.player.firstName,
            "Last Name": p.player.lastName,
            "Rating": p.player.regularRating || 'UNR',
            "Grade": p.player.grade,
            "Section": p.details.section,
            "School": p.player.school,
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedEvent.name.replace(/\s+/g, '_')}_new_registrations.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Mark these players as downloaded
        const newlyDownloadedIds = newPlayersForDownload.map(p => p.player.id);
        const updatedDownloads = {
            ...downloadedPlayers,
            [selectedEvent.id]: [...(downloadedPlayers[selectedEvent.id] || []), ...newlyDownloadedIds]
        };
        setDownloadedPlayers(updatedDownloads);
        localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
        toast({ title: 'Download Complete', description: `${newlyDownloadedIds.length} new registrations have been downloaded.`});
    };
    
    const handleMarkAllAsNew = () => {
        if (!selectedEvent) return;
        const updatedDownloads = { ...downloadedPlayers };
        delete updatedDownloads[selectedEvent.id];
        setDownloadedPlayers(updatedDownloads);
        localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
        toast({ title: 'Status Reset', description: 'All players for this event are marked as new.' });
    };

    const handleClearAllNew = () => {
        if (!selectedEvent) return;
        const allPlayerIdsForEvent = allRegisteredPlayersForSelectedEvent.map(p => p.player.id);
        const updatedDownloads = {
            ...downloadedPlayers,
            [selectedEvent.id]: allPlayerIdsForEvent
        };
        setDownloadedPlayers(updatedDownloads);
        localStorage.setItem('downloaded_registrations', JSON.stringify(updatedDownloads));
        toast({ title: 'Status Cleared', description: 'All new registration indicators have been cleared.' });
    };
    
    const requestPlayerSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (playerSortConfig && playerSortConfig.key === key && playerSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setPlayerSortConfig({ key, direction });
    };
    
    const alreadyRegisteredRosterPlayers = useMemo(() => {
        return rosterPlayers.filter(p => alreadyRegisteredIds.has(p.id));
    }, [rosterPlayers, alreadyRegisteredIds]);


  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Upcoming Events</h1>
          <p className="text-muted-foreground">
            Browse upcoming tournaments and register your players.
          </p>
        </div>

        {!isSquareConfigured && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>Square Not Configured</AlertTitle>
            <AlertDescription>
              The system is running in demo mode. No real invoices will be created. To enable Square integration, please add your credentials to the `.env` file.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('name')}>
                            Event Name {getSortIcon('name')}
                        </Button>
                    </TableHead>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('date')}>
                            Date {getSortIcon('date')}
                        </Button>
                    </TableHead>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('location')}>
                            Location {getSortIcon('location')}
                        </Button>
                    </TableHead>
                    <TableHead>Attachments</TableHead>
                    <TableHead className="p-0">
                        <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('status')}>
                            Status {getSortIcon('status')}
                        </Button>
                    </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEvents.map((event) => {
                  const status = getEventStatus(event);
                  const registrationCountForEvent = eventRegistrationsMap.get(event.id) || 0;
                  return (
                    <TableRow key={event.id}>
                        <TableCell className="font-medium">
                            <button onClick={() => handleEventNameClick(event)} className="text-left hover:underline">
                                {event.name} ({registrationCountForEvent})
                            </button>
                        </TableCell>
                      <TableCell>{clientReady ? format(new Date(event.date), 'PPP') : ''}</TableCell>
                      <TableCell>{event.location}</TableCell>
                      <TableCell>
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
                              {(!event.imageUrl && (!event.pdfUrl || event.pdfUrl === '#')) && <span className="text-xs text-muted-foreground">None</span>}
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
            {alreadyRegisteredRosterPlayers.length > 0 && (
                <div className="p-4 border rounded-md bg-muted/50">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><UserCheck className="h-4 w-4 text-green-600" /> Already Registered ({alreadyRegisteredRosterPlayers.length})</h4>
                    <p className="text-xs text-muted-foreground">
                        {alreadyRegisteredRosterPlayers.map(p => `${p.firstName} ${p.lastName}`).join(', ')}
                    </p>
                </div>
            )}
            <ScrollArea className="h-96 w-full">
              <div className="space-y-4 pr-6">
                {rosterPlayers.map((player) => {
                  const isSelected = !!selections[player.id];
                  const isAlreadyRegistered = alreadyRegisteredIds.has(player.id);
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
                          disabled={isAlreadyRegistered}
                        />
                        <div className="grid gap-2">
                            <Label htmlFor={`player-${player.id}`} className={cn("font-medium", isAlreadyRegistered ? "text-muted-foreground" : "cursor-pointer")}>
                                {player.firstName} {player.lastName} {isAlreadyRegistered && <span className="font-normal text-green-600">(Registered)</span>}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Grade: {player.grade} &bull; Section: {player.section} &bull; Rating: {player.regularRating || 'N/A'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                USCF ID: {player.uscfId} &bull; Expires: {player.uscfExpiration ? format(new Date(player.uscfExpiration), 'MM/dd/yyyy') : 'N/A'}
                            </p>
                            
                            {isSelected && selectedEvent && (
                                <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2 items-start">
                                    <div className="grid gap-1.5">
                                      <Label className="text-xs">
                                        USCF Membership (current for {format(new Date(selectedEvent.date), 'MM/dd/yyyy')})
                                      </Label>
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
                                        <SelectContent position="item-aligned">{sectionOptions}</SelectContent>
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
                                        <SelectContent position="item-aligned">{roundOptions(selectedEvent.rounds)}</SelectContent>
                                      </Select>
                                    </div>
                                     <div className="grid gap-1.5">
                                      <Label htmlFor={`bye2-${player.id}`} className="text-xs">Bye 2</Label>
                                      <Select onValueChange={(value) => handleByeChange(player.id, 'round2', value)} value={selections[player.id]?.byes.round2 || 'none'} disabled={!firstBye || firstBye === 'none'}>
                                        <SelectTrigger id={`bye2-${player.id}`} className="w-full">
                                          <SelectValue placeholder="Select Bye" />
                                        </SelectTrigger>
                                        <SelectContent position="item-aligned">{roundOptions(selectedEvent.rounds, firstBye)}</SelectContent>
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
                Total: ${calculatedFees.total.toFixed(2)}
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
      
      <Dialog open={isRegistrationsOpen} onOpenChange={setIsRegistrationsOpen}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Registrations for {selectedEvent?.name}</DialogTitle>
                <DialogDescription>
                    A total of {allRegisteredPlayersForSelectedEvent.length} players are registered for this event.
                </DialogDescription>
            </DialogHeader>
            <div className="my-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by Name or USCF ID..." 
                        className="pl-10"
                        value={registrationsSearchQuery}
                        onChange={(e) => setRegistrationsSearchQuery(e.target.value)}
                    />
                 </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleDownload} disabled={newPlayersForDownload.length === 0} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download New ({newPlayersForDownload.length})
                    </Button>
                    <div className="text-xs text-muted-foreground space-x-2">
                        <button onClick={handleMarkAllAsNew} className="hover:underline">Mark all as new</button>
                        <span>|</span>
                        <button onClick={handleClearAllNew} className="hover:underline">Clear all new</button>
                    </div>
                </div>
            </div>
            <ScrollArea className="h-96 w-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><button onClick={() => requestPlayerSort('lastName')} className="flex items-center">Player <ArrowUpDown className="ml-2 h-4 w-4" /></button></TableHead>
                            <TableHead><button onClick={() => requestPlayerSort('school')} className="flex items-center">School <ArrowUpDown className="ml-2 h-4 w-4" /></button></TableHead>
                            <TableHead><button onClick={() => requestPlayerSort('regularRating')} className="flex items-center">Rating <ArrowUpDown className="ml-2 h-4 w-4" /></button></TableHead>
                            <TableHead><button onClick={() => requestPlayerSort('section')} className="flex items-center">Section <ArrowUpDown className="ml-2 h-4 w-4" /></button></TableHead>
                             <TableHead><button onClick={() => requestPlayerSort('new')} className="flex items-center">New <ArrowUpDown className="ml-2 h-4 w-4" /></button></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allRegisteredPlayersForSelectedEvent.map(({ player, details }) => {
                             const isNew = selectedEvent && !(downloadedPlayers[selectedEvent.id] || []).includes(player.id);
                             return (
                                <TableRow key={player.id}>
                                    <TableCell>{player.firstName} {player.lastName}</TableCell>
                                    <TableCell>{player.school}</TableCell>
                                    <TableCell>{player.regularRating || 'UNR'}</TableCell>
                                    <TableCell>{details.section}</TableCell>
                                    <TableCell>
                                        {isNew && <Check className="h-4 w-4 text-green-600" />}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </ScrollArea>
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
                  {uscfActionsCount > 0 && (
                    <div className="flex items-center space-x-2 my-4 p-4 border rounded-md bg-muted/50">
                        <Switch id="separate-invoice"
                            checked={separateUscfInvoice}
                            onCheckedChange={setSeparateUscfInvoice}
                        />
                        <Label htmlFor="separate-invoice" className="cursor-pointer">Create separate invoice for USCF fees</Label>
                    </div>
                  )}

                  {separateUscfInvoice && uscfActionsCount > 0 ? (
                    <>
                      <div className="rounded-lg border bg-muted p-4 space-y-2 text-sm">
                          <p className="font-semibold text-base">Invoice 1: Event Registration</p>
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
                          <div className="flex justify-between font-bold pt-2 border-t">
                            <span>Subtotal</span>
                            <span>${calculatedFees.registration.toFixed(2)}</span>
                          </div>
                      </div>

                      <div className="rounded-lg border bg-muted p-4 space-y-2 text-sm">
                          <p className="font-semibold text-base">Invoice 2: USCF Memberships</p>
                          <div className="flex justify-between">
                              <span className="text-muted-foreground">New / Renewing USCF Memberships</span>
                              <span className="font-medium">{uscfActionsCount} &times; ${uscfFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold pt-2 border-t">
                            <span>Subtotal</span>
                            <span>${calculatedFees.uscf.toFixed(2)}</span>
                          </div>
                      </div>
                    </>
                  ) : (
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
                  )}

                  <div className="text-center rounded-lg border border-primary/20 bg-primary/5 py-4">
                    <p className="text-sm font-medium text-muted-foreground">TOTAL TO BE INVOICED</p>
                    <p className="text-3xl font-bold text-primary">${calculatedFees.total.toFixed(2)}</p>
                  </div>
                </div>
              )}
              <DialogFooter>
                  <Button variant="ghost" onClick={() => {
                      setIsInvoiceDialogOpen(false);
                      setIsDialogOpen(true);
                  }}>Back</Button>
                  <Button onClick={handleGenerateInvoice} disabled={isCreatingInvoice}>
                      {isCreatingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Register and Accept Invoice(s)
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
