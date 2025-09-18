
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInHours, isSameDay, isValid, parse, startOfDay } from 'date-fns';
import { doc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { 
    PlusCircle, 
    Trash2,
    Loader2,
    Search,
    Info,
    CalendarIcon,
    Award,
    CheckCircle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEvents, type Event } from '@/hooks/use-events';
import { createInvoice } from '@/ai/flows/create-invoice-flow';
import { createPsjaSplitInvoice } from '@/ai/flows/create-psja-split-invoice-flow';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { generateTeamCode } from '@/lib/school-utils';
import { DollarSign } from 'lucide-react';

// --- Types and Schemas ---

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12, };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12, 'Championship': 12 };

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, "First Name is required."),
  lastName: z.string().min(1, "Last Name is required."),
  uscfId: z.string().min(1, "USCF ID is required."),
  uscfExpiration: z.date().optional(),
  regularRating: z.coerce.number().optional(),
  grade: z.string().min(1, "Please select a grade."),
  section: z.string().min(1, "Please select a section."),
  email: z.string().email({ message: "Please enter a valid email." }),
  dob: z.date({ required_error: "Date of birth is required."}),
  zipCode: z.string().min(5, { message: "A valid 5-digit zip code is required." }),
}).refine(data => {
    if (data.uscfId.toUpperCase() !== 'NEW') { return data.uscfExpiration !== undefined; }
    return true;
  }, { message: "USCF Expiration is required unless ID is NEW.", path: ["uscfExpiration"] })
  .refine((data) => {
    if (!data.grade || !data.section || data.section === 'Championship') return true;
    const playerGradeLevel = gradeToNumber[data.grade];
    const sectionMaxLevel = sectionMaxGrade[data.section];
    if (playerGradeLevel === undefined || sectionMaxLevel === undefined) return true;
    return playerGradeLevel <= sectionMaxLevel;
  }, { message: "Player's grade is too high for this section.", path: ["section"] });

type PlayerFormValues = z.infer<typeof playerFormSchema>;

type StagedPlayer = PlayerFormValues & {
    uscfStatus: 'current' | 'new' | 'renewing';
    byes: { round1: string; round2: string };
    studentType?: 'gt' | 'independent';
};

const invoiceRecipientSchema = z.object({
    sponsorName: z.string().min(1, 'Sponsor name is required.'),
    sponsorEmail: z.string().email('Please enter a valid email.'),
    schoolName: z.string().min(1, 'School name is required.'),
    teamCode: z.string().optional(),
});
type InvoiceRecipientValues = z.infer<typeof invoiceRecipientSchema>;

type SortableColumnKey = 'lastName' | 'uscfId' | 'regularRating';

// --- Main Component ---

export function OrganizerRegistrationForm({ eventId }: { eventId: string | null }) {
    const { toast } = useToast();
    const { events } = useEvents();
    
    const event = useMemo(() => events.find(e => e.id === eventId), [events, eventId]);

    const [stagedPlayers, setStagedPlayers] = useState<StagedPlayer[]>([]);
    const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<StagedPlayer | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [view, setView] = useState<'selection' | 'review' | 'finalize'>('selection');

    // Finalize state
    const [invoiceType, setInvoiceType] = useState<'team' | 'individual'>('team');
    const [splitUscfFees, setSplitUscfFees] = useState(false);

    // Player search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const { database: masterDatabase, isDbLoaded, dbDistricts, dbSchools } = useMasterDb();
    const [selectedDistrict, setSelectedDistrict] = useState('all');
    const [selectedSchool, setSelectedSchool] = useState('all');
    const [schoolRoster, setSchoolRoster] = useState<MasterPlayer[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'lastName', direction: 'ascending' });

    const playerForm = useForm<PlayerFormValues>({
        resolver: zodResolver(playerFormSchema),
        defaultValues: { grade: '', section: '', uscfId: '', firstName: '', lastName: '', email: '', zipCode: ''}
    });

    const invoiceForm = useForm<InvoiceRecipientValues>({
        resolver: zodResolver(invoiceRecipientSchema),
    });

    const schoolsForSelectedDistrict = useMemo(() => {
        if (selectedDistrict === 'all') return dbSchools;
        return masterDatabase.filter(p => p.district === selectedDistrict)
                             .map(p => p.school)
                             .filter((value, index, self) => self.indexOf(value) === index)
                             .sort();
    }, [selectedDistrict, masterDatabase, dbSchools]);

    // Effect to update roster when school changes
    useEffect(() => {
        if (selectedSchool !== 'all' && selectedDistrict !== 'all' && isDbLoaded) {
            const roster = masterDatabase.filter(p => p.school === selectedSchool && p.district === selectedDistrict);
            setSchoolRoster(roster);
        } else {
            setSchoolRoster([]);
        }
    }, [selectedSchool, selectedDistrict, masterDatabase, isDbLoaded]);

    const filteredSchoolRoster = useMemo(() => {
        let filtered = schoolRoster;

        if (searchQuery.length > 0) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(p => 
                `${p.firstName} ${p.lastName}`.toLowerCase().includes(lowerQuery) ||
                p.uscfId.includes(searchQuery)
            );
        }
        
        if (sortConfig) {
            filtered.sort((a, b) => {
                const key = sortConfig.key;
                let aVal: any = a[key as keyof MasterPlayer] ?? '';
                let bVal: any = b[key as keyof MasterPlayer] ?? '';
                
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
                
                const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return sortConfig.direction === 'ascending' ? result : -result;
            });
        }
        return filtered;
    }, [schoolRoster, searchQuery, sortConfig]);

    const requestSort = (key: SortableColumnKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
      
    const getSortIcon = (columnKey: SortableColumnKey) => {
        if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4" />;
        return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const handleSelectSearchedPlayer = (player: MasterPlayer) => {
        const isExpired = !player.uscfExpiration || new Date(player.uscfExpiration) < new Date(event?.date ?? new Date());
        const uscfStatus = player.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current';

        const playerToStage: StagedPlayer = {
            id: player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            uscfId: player.uscfId,
            regularRating: player.regularRating,
            uscfExpiration: player.uscfExpiration ? new Date(player.uscfExpiration) : undefined,
            dob: player.dob ? new Date(player.dob) : undefined,
            email: player.email,
            zipCode: player.zipCode,
            grade: player.grade,
            section: player.section,
            uscfStatus: uscfStatus,
            studentType: player.studentType,
            byes: { round1: 'none', round2: 'none' }
        };
        setStagedPlayers(prev => [...prev, playerToStage]);
        toast({ title: "Player Added", description: `${player.firstName} ${player.lastName} has been staged for registration.` });
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            const playersToStage = filteredSchoolRoster
                .filter(p => !stagedPlayers.some(sp => sp.id === p.id))
                .map(player => {
                    const isExpired = !player.uscfExpiration || new Date(player.uscfExpiration) < new Date(event?.date ?? new Date());
                    const uscfStatus = player.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current';
                    return {
                        id: player.id,
                        firstName: player.firstName,
                        lastName: player.lastName,
                        uscfId: player.uscfId,
                        regularRating: player.regularRating,
                        uscfExpiration: player.uscfExpiration ? new Date(player.uscfExpiration) : undefined,
                        dob: player.dob ? new Date(player.dob) : undefined,
                        email: player.email,
                        zipCode: player.zipCode,
                        grade: player.grade,
                        section: player.section,
                        uscfStatus: uscfStatus,
                        studentType: player.studentType,
                        byes: { round1: 'none', round2: 'none' }
                    };
                });
            setStagedPlayers(prev => [...prev, ...playersToStage]);
        } else {
            const rosterIds = new Set(filteredSchoolRoster.map(p => p.id));
            setStagedPlayers(prev => prev.filter(p => !rosterIds.has(p.id!)));
        }
    };


    const handlePlayerFormSubmit = (values: PlayerFormValues) => {
        if (!event) return;
        const eventDate = new Date(event.date);
        const isExpired = !values.uscfExpiration || values.uscfExpiration < eventDate;
        const uscfStatus = values.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current';
        const playerDetails = masterDatabase.find(p => p.id === values.id);

        const playerToStage: StagedPlayer = {
            ...values,
            id: values.id || `temp-${Date.now()}`,
            uscfStatus,
            studentType: playerDetails?.studentType,
            byes: { round1: 'none', round2: 'none' }
        };

        if (editingPlayer) {
            setStagedPlayers(stagedPlayers.map(p => p.id === editingPlayer.id ? playerToStage : p));
        } else {
            setStagedPlayers([...stagedPlayers, playerToStage]);
        }
        setIsPlayerDialogOpen(false);
    };

    const handleEditPlayer = (player: StagedPlayer) => {
        setEditingPlayer(player);
        playerForm.reset(player);
        setIsPlayerDialogOpen(true);
    };
    
    const handleAddPlayerClick = () => {
        setEditingPlayer(null);
        playerForm.reset();
        setIsPlayerDialogOpen(true);
    };
    
    const handleRemovePlayer = (id: string) => {
        setStagedPlayers(stagedPlayers.filter(p => p.id !== id));
    };

    const handleProceedToConfirmation = async () => {
        if (stagedPlayers.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Players Staged',
                description: 'Please add at least one player to the list before registering.',
            });
            return;
        }
        if (selectedSchool === 'all' || !db) {
            toast({
                variant: 'destructive',
                title: 'No School Selected',
                description: 'Please select a specific school to assign the invoice to.',
            });
            return;
        }
        setView('review');
    };

    const getFeeForEvent = () => {
        if (!event) return { fee: 0, type: 'Regular Registration' };
        
        const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : new Date(event.date);
        const now = new Date();
    
        if (startOfDay(now) > startOfDay(deadline)) {
            const eventDate = new Date(event.date);
            if (isSameDay(eventDate, now)) {
                return { fee: event.dayOfFee || event.regularFee, type: 'Day-of Registration' };
            }
            const hoursUntilEvent = differenceInHours(eventDate, now);
            if (hoursUntilEvent <= 24) {
                return { fee: event.veryLateFee || event.regularFee, type: 'Very Late Registration' };
            }
            return { fee: event.lateFee || event.regularFee, type: 'Late Registration' };
        }
        
        return { fee: event.regularFee, type: 'Regular Registration' };
    };

    const feeBreakdown = useMemo(() => {
        if (!event) return { registrationFees: 0, uscfFees: 0, lateFees: 0, total: 0, feeType: 'Regular Registration' };
        const { fee: currentFee, type: feeType } = getFeeForEvent();
        const uscfFee = 24;
        const registrationFees = stagedPlayers.length * event.regularFee;
        const lateFees = stagedPlayers.length * (currentFee - event.regularFee);
        const uscfFees = stagedPlayers.filter(s => s.uscfStatus !== 'current' && s.studentType !== 'gt').length * uscfFee;
        const total = registrationFees + lateFees + uscfFees;
        return { registrationFees, uscfFees, lateFees, total, feeType };
    }, [stagedPlayers, event]);

    const handleFinalize = async () => {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('school', '==', selectedSchool), limit(1));
        const querySnapshot = await getDocs(q);
    
        let sponsorName = '';
        let sponsorEmail = '';
    
        if (!querySnapshot.empty) {
            const sponsorDoc = querySnapshot.docs[0].data();
            sponsorName = `${sponsorDoc.firstName} ${sponsorDoc.lastName}`;
            sponsorEmail = sponsorDoc.email;
        } else {
            toast({
                title: "No Default Sponsor Found",
                description: `No default sponsor found for ${selectedSchool}. Please enter their details manually.`,
            });
        }
        
        invoiceForm.reset({
            schoolName: selectedSchool,
            sponsorName: sponsorName,
            sponsorEmail: sponsorEmail,
            teamCode: generateTeamCode({ schoolName: selectedSchool, district: selectedDistrict }),
        });

        setView('finalize');
    };

    const handleGenerateInvoice = async (values: InvoiceRecipientValues) => {
        if (invoiceType === 'team') {
            await handleGenerateTeamInvoice(values);
        } else {
            await handleGenerateIndividualInvoices(values);
        }
    };
    
    const handleGenerateTeamInvoice = async (recipient: InvoiceRecipientValues) => {
        if (!event || !db) return;
        
        const district = masterDatabase.find(p => p.school === recipient.schoolName)?.district;
        const isPsjaDistrict = district === 'PHARR-SAN JUAN-ALAMO ISD';

        const hasGt = stagedPlayers.some(p => p.studentType === 'gt');
        const hasIndependent = stagedPlayers.some(p => p.studentType !== 'gt');
        
        if (isPsjaDistrict && hasGt && hasIndependent) {
            await handlePsjaSplitInvoice(recipient, district);
            return;
        }

        setIsSubmitting(true);
        const { fee: registrationFeePerPlayer } = getFeeForEvent();
        
        const lateFeeAmount = registrationFeePerPlayer - event.regularFee;

        const playersToInvoice = stagedPlayers.map(p => {
            return {
                playerName: `${p.firstName} ${p.lastName}`,
                uscfId: p.uscfId,
                baseRegistrationFee: event.regularFee,
                lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
                uscfAction: p.uscfStatus !== 'current',
                isGtPlayer: p.studentType === 'gt',
            };
        });

        const totalInvoiced = feeBreakdown.total;

        try {
            const result = await createInvoice({
                ...recipient,
                district,
                eventName: event.name.replace(/\(PSJA students only\)/i, '').trim(),
                eventDate: event.date,
                uscfFee: 24,
                players: playersToInvoice,
                bookkeeperEmail: '',
                gtCoordinatorEmail: '',
            });

            await saveConfirmation(result.invoiceId, result, playersToInvoice, totalInvoiced);
            
            toast({ title: "Team Invoice Generated Successfully!", description: `Invoice ${result.invoiceNumber || result.invoiceId} for ${stagedPlayers.length} players has been created.` });
            
            setStagedPlayers([]);
            setView('selection');
            
        } catch (error) {
            console.error("Failed to create team invoice:", error);
            const description = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: "destructive", title: "Submission Error", description });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handlePsjaSplitInvoice = async (recipient: InvoiceRecipientValues, district: string) => {
        if (!event) return;
        setIsSubmitting(true);
    
        const { fee: currentFee } = getFeeForEvent();
        const lateFeeAmount = currentFee - event.regularFee;
    
        const playersToInvoice = stagedPlayers.map(p => ({
            playerName: `${p.firstName} ${p.lastName}`,
            uscfId: p.uscfId,
            baseRegistrationFee: event.regularFee,
            lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
            uscfAction: p.uscfStatus !== 'current',
            isGtPlayer: p.studentType === 'gt',
            section: p.section
        }));
    
        try {
          const result = await createPsjaSplitInvoice({
            ...recipient,
            district: 'PHARR-SAN JUAN-ALAMO ISD',
            eventName: event.name.replace(/\(PSJA students only\)/i, '').trim(),
            eventDate: event.date,
            uscfFee: 24,
            players: playersToInvoice,
            bookkeeperEmail: '',
            gtCoordinatorEmail: '',
          });
    
          if (result.gtInvoice) {
            const gtPlayers = playersToInvoice.filter(p => p.isGtPlayer);
            const gtTotal = gtPlayers.length * event.regularFee;
            await saveConfirmation(result.gtInvoice.invoiceId, result.gtInvoice, gtPlayers, gtTotal, "GT");
          }
    
          if (result.independentInvoice) {
            const indPlayers = playersToInvoice.filter(p => !p.isGtPlayer);
            const indUscfFees = indPlayers.filter(p => p.uscfAction).length * 24;
            const indLateFees = stagedPlayers.length * lateFeeAmount;
            const indRegFees = indPlayers.length * event.regularFee;
            const indTotal = indRegFees + indLateFees + indUscfFees;
            await saveConfirmation(result.independentInvoice.invoiceId, result.independentInvoice, indPlayers, indTotal, "Independent");
          }
          
          toast({ title: "PSJA Split Invoices Created!", description: "Separate invoices for GT and Independent players have been created."});
          
          setStagedPlayers([]);
          setView('selection');
          
        } catch (error) {
          handleInvoiceError(error, "PSJA Split Invoice Creation Failed");
        } finally {
            setIsSubmitting(false);
        }
      };

    const handleGenerateIndividualInvoices = async (recipient: InvoiceRecipientValues) => {
        if (!event || !db || stagedPlayers.length === 0) return;
        
        setIsSubmitting(true);
        
        const promises = stagedPlayers.map(async (player) => {
            const { fee: registrationFee } = getFeeForEvent();
            const lateFeeAmount = registrationFee - event.regularFee;

            const playerToInvoice = {
                playerName: `${player.firstName} ${player.lastName}`,
                uscfId: player.uscfId,
                baseRegistrationFee: event.regularFee,
                lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
                uscfAction: player.uscfStatus !== 'current',
                section: player.section,
                isGtPlayer: player.studentType === 'gt'
            };

            const uscfFee = 24;
            const totalInvoiced = registrationFee + (player.uscfStatus !== 'current' && player.studentType !== 'gt' ? uscfFee : 0);
            
            try {
                const result = await createInvoice({
                    sponsorName: recipient.sponsorName,
                    sponsorEmail: recipient.sponsorEmail,
                    schoolName: recipient.schoolName,
                    teamCode: recipient.teamCode,
                    eventName: event.name.replace(/\(PSJA students only\)/i, '').trim(),
                    eventDate: event.date,
                    uscfFee,
                    players: [playerToInvoice],
                    description: `Invoice for ${player.firstName} ${player.lastName}`,
                    bookkeeperEmail: '',
                    gtCoordinatorEmail: '',
                });

                await saveConfirmation(result.invoiceId, result, [playerToInvoice], totalInvoiced);
                return { success: true, invoiceNumber: result.invoiceNumber };

            } catch (error) {
                console.error(`Failed to create invoice for ${player.firstName} ${player.lastName}:`, error);
                return { success: false, name: `${player.firstName} ${player.lastName}` };
            }
        });

        const results = await Promise.all(promises);
        const successfulInvoices = results.filter(r => r.success).length;
        const failedInvoices = results.filter(r => !r.success);

        if (successfulInvoices > 0) {
            toast({ title: `Successfully generated ${successfulInvoices} individual invoices.` });
        }
        if (failedInvoices.length > 0) {
            toast({ variant: "destructive", title: `Failed to create invoices for ${failedInvoices.length} players.`, description: `Players: ${failedInvoices.map(f => f.name).join(', ')}` });
        }
        
        setStagedPlayers([]);
        setView('selection');
        setIsSubmitting(false);
    };

    const saveConfirmation = async (invoiceId: string, result: any, playersInInvoice: any[], total: number, type?: "Registration" | "USCF" | "GT" | "Independent") => {
        if (!event || !db) {
          console.error('Missing event or db in saveConfirmation');
          throw new Error('Cannot save confirmation: missing dependencies');
        }
        
        const selections = Object.fromEntries(
            stagedPlayers
              .filter(player => {
                return playersInInvoice.some(pl => pl.playerName === `${player.firstName} ${player.lastName}`);
              })
              .map(player => [
                player.id!,
                {
                  firstName: player.firstName,
                  lastName: player.lastName,
                  uscfId: player.uscfId,
                  grade: player.grade,
                  section: player.section,
                  email: player.email,
                  zipCode: player.zipCode,
                  byes: player.byes,
                  uscfStatus: player.uscfStatus,
                  studentType: player.studentType,
                  status: 'active'
                }
              ])
        );
      
        const teamCode = result.teamCode || 
          invoiceForm.getValues('teamCode') || 
          generateTeamCode({ schoolName: selectedSchool, district: selectedDistrict });
        
        let eventName = event.name.replace(/\(PSJA students only\)/i, '').trim();
        if (type) {
            eventName = `${eventName} - ${type}`;
        }

        const newConfirmation = {
            id: invoiceId, 
            invoiceId: invoiceId, 
            eventId: event.id, 
            eventName: eventName,
            eventDate: event.date, 
            submissionTimestamp: new Date().toISOString(), 
            selections: selections,
            totalInvoiced: result.newTotalAmount || total, 
            totalAmount: result.newTotalAmount || total,
            invoiceUrl: result.invoiceUrl, 
            invoiceNumber: result.invoiceNumber, 
            teamCode: teamCode,
            invoiceStatus: result.status,
            status: result.status,
            purchaserName: result.sponsorName || invoiceForm.getValues('sponsorName'), 
            schoolName: result.schoolName || invoiceForm.getValues('schoolName'), 
            sponsorEmail: result.sponsorEmail || invoiceForm.getValues('sponsorEmail'), 
            district: result.district || masterDatabase.find(p => p.school === invoiceForm.getValues('schoolName'))?.district || ''
        };
      
        try {
          const invoiceDocRef = doc(db, 'invoices', invoiceId);
          await setDoc(invoiceDocRef, newConfirmation);
          console.log('Successfully saved confirmation to Firestore:', newConfirmation);
        } catch (error) {
          console.error('Failed to save confirmation to Firestore:', error);
          throw error;
        }
    };
    
    const handleCompRegistration = async (recipient: InvoiceRecipientValues) => {
        if (!event || !db) return;
        setIsSubmitting(true);
        try {
            const confirmationId = `COMP_${Date.now()}`;
            const district = masterDatabase.find(p => p.school === recipient.schoolName)?.district;
            
            const newConfirmation = {
                id: confirmationId, invoiceId: confirmationId, eventId: event.id,
                eventName: event.name.replace(/\(PSJA students only\)/i, '').trim(),
                eventDate: event.date,
                submissionTimestamp: new Date().toISOString(),
                selections: stagedPlayers.reduce((acc, p) => ({ ...acc, [p.id!]: { byes: p.byes, section: p.section, uscfStatus: p.uscfStatus, studentType: p.studentType, status: 'active' } }), {}),
                totalInvoiced: 0,
                teamCode: recipient.teamCode,
                invoiceStatus: 'COMPED',
                purchaserName: recipient.sponsorName,
                schoolName: recipient.schoolName,
                sponsorEmail: recipient.sponsorEmail,
                district
            };

            const invoiceDocRef = doc(db, 'invoices', confirmationId);
            await setDoc(invoiceDocRef, newConfirmation);

            toast({
                title: "Registration Comped",
                description: `${stagedPlayers.length} players have been registered for ${event.name} at no charge.`
            });

            setStagedPlayers([]);
            setView('selection');

        } catch (error) {
          handleInvoiceError(error, "Failed to comp registration");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleInvoiceError = (error: any, title: string) => {
        console.error(title, error);
        const description = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Submission Error", description });
    };
    
    if (!event) {
        return (
            <Card>
                <CardContent className='pt-6'>
                    Event not found. Please go back to Manage Events and select an event.
                </CardContent>
            </Card>
        );
    }
    
    if(view === 'review') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Confirm Registration & Charges</CardTitle>
                    <CardDescription>Review the total charges for {event.name} before finalizing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-semibold mb-3">Selected Students ({stagedPlayers.length})</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {stagedPlayers.map((player) => (
                                <div key={player.id} className="flex justify-between items-center text-sm bg-muted/50 rounded p-2">
                                <span>{player.firstName} {player.lastName}</span>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="text-xs">{player.section}</Badge>
                                    {player.uscfStatus !== 'current' && (
                                    <Badge variant="secondary" className="text-xs">USCF {player.uscfStatus}</Badge>
                                    )}
                                </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="border rounded-lg p-4 space-y-3">
                        <h3 className="font-semibold">Charge Breakdown</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                            <span>Registration Fees ({stagedPlayers.length} × ${event.regularFee})</span>
                            <span>${feeBreakdown.registrationFees.toFixed(2)}</span>
                            </div>
                            {feeBreakdown.lateFees > 0 && (
                            <div className="flex justify-between text-amber-600">
                                <span>{feeBreakdown.feeType} ({stagedPlayers.length} × ${(feeBreakdown.lateFees / stagedPlayers.length).toFixed(2)})</span>
                                <span>${feeBreakdown.lateFees.toFixed(2)}</span>
                            </div>
                            )}
                            {feeBreakdown.uscfFees > 0 && (
                            <div className="flex justify-between">
                                <span>USCF Fees ({stagedPlayers.filter(s => s.uscfStatus !== 'current' && s.studentType !== 'gt').length} × $24)</span>
                                <span>${feeBreakdown.uscfFees.toFixed(2)}</span>
                            </div>
                            )}
                            <div className="border-t pt-2 flex justify-between font-semibold">
                            <span>Total Amount</span>
                            <span>${feeBreakdown.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4">
                        <Label>Invoice Options</Label>
                        <RadioGroup value={invoiceType} onValueChange={(v) => setInvoiceType(v as 'team' | 'individual')} className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="team" id="team" /><Label htmlFor="team" className="cursor-pointer">Invoice as Team (One Invoice)</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="individual" id="individual" /><Label htmlFor="individual" className="cursor-pointer">Invoice Individually</Label></div>
                        </RadioGroup>
                        {invoiceType === 'team' && (
                            <div className="pl-6 flex items-center space-x-2">
                                <Checkbox
                                    id="split-uscf-fees"
                                    checked={splitUscfFees}
                                    onCheckedChange={(checked) => setSplitUscfFees(!!checked)}
                                    disabled={feeBreakdown.uscfFees === 0}
                                />
                                <Label htmlFor="split-uscf-fees" className="text-sm font-medium">Create separate invoice for USCF fees</Label>
                            </div>
                        )}
                    </div>

                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => setView('selection')}>Back to Selection</Button>
                    <Button onClick={handleFinalize}>Proceed to Finalize</Button>
                </CardFooter>
            </Card>
        );
    }
    
    if(view === 'finalize') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Finalize Registration</CardTitle>
                    <CardDescription>Provide recipient details for the invoice, or comp the registration.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...invoiceForm}>
                        <form className="space-y-4 pt-4">
                            <FormField control={invoiceForm.control} name="sponsorName" render={({ field }) => ( <FormItem><FormLabel>Recipient/Sponsor Name</FormLabel><FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={invoiceForm.control} name="sponsorEmail" render={({ field }) => ( <FormItem><FormLabel>Recipient Email</FormLabel><FormControl><Input type="email" placeholder="sponsor@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={invoiceForm.control} name="schoolName" render={({ field }) => ( <FormItem><FormLabel>School/Organization Name</FormLabel><FormControl><Input placeholder="e.g., Lincoln High School" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={invoiceForm.control} name="teamCode" render={({ field }) => ( <FormItem><FormLabel>Team Code</FormLabel><FormControl><Input placeholder="e.g., LIHS" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </form>
                    </Form>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row items-stretch gap-2 pt-4">
                    <Button type="button" onClick={invoiceForm.handleSubmit(handleGenerateInvoice)} disabled={isSubmitting} className="flex-1">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {invoiceType === 'team' ? 'Create Team Invoice(s)' : 'Create Individual Invoices'}
                    </Button>
                    <div className="relative flex items-center">
                        <div className="flex-grow border-t"></div>
                        <span className="flex-shrink mx-4 text-muted-foreground text-xs">OR</span>
                        <div className="flex-grow border-t"></div>
                    </div>
                    <Button type="button" variant="outline" onClick={invoiceForm.handleSubmit(handleCompRegistration)} disabled={isSubmitting} className="flex-1">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
                        Comp Registration (No Invoice)
                    </Button>
                    <Button variant="ghost" onClick={() => setView('review')} className="sm:absolute sm:top-4 sm:right-4">Back</Button>
                </CardFooter>
            </Card>
        );
    }
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Register Players for an Event</h1>
                <p className="text-muted-foreground">Organizer mode: Manually add and register players for an upcoming event.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Selected Event</CardTitle>
                </CardHeader>
                <CardContent>
                    <h2 className="text-xl font-semibold">{event.name.replace(/\(PSJA students only\)/i, '').trim()}</h2>
                    <p className="text-muted-foreground">{format(new Date(event.date), 'PPP')} • {event.location}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>School Roster Selection</CardTitle>
                    <CardDescription>
                        Filter by district and school to load a roster, then search and add players to the staged list.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className='grid md:grid-cols-2 gap-4'>
                        <div>
                            <Label htmlFor="district-filter">District</Label>
                            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                                <SelectTrigger id="district-filter"><SelectValue placeholder="Select a district" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Districts</SelectItem>
                                    {dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="school-filter">School</Label>
                            <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                                <SelectTrigger id="school-filter"><SelectValue placeholder="Select a school" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Schools</SelectItem>
                                    {schoolsForSelectedDistrict.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter roster by USCF ID or Name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-10"
                            disabled={schoolRoster.length === 0}
                        />
                    </div>

                    <div className="border rounded-md max-h-72 overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('lastName')}>Player {getSortIcon('lastName')}</Button></TableHead>
                                    <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('uscfId')}>USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                                    <TableHead><Button variant="ghost" className="px-0" onClick={() => requestSort('regularRating')}>Rating {getSortIcon('regularRating')}</Button></TableHead>
                                    <TableHead className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Label htmlFor="select-all" className="sr-only">Select All</Label>
                                            <Checkbox
                                                id="select-all"
                                                onCheckedChange={toggleSelectAll}
                                                checked={filteredSchoolRoster.length > 0 && filteredSchoolRoster.every(p => stagedPlayers.some(sp => sp.id === p.id))}
                                                ref={(el) => {
                                                    if (el) {
                                                        const isIndeterminate = filteredSchoolRoster.length > 0 && stagedPlayers.some(sp => filteredSchoolRoster.find(p => p.id === sp.id)) && !filteredSchoolRoster.every(p => stagedPlayers.some(sp => sp.id === p.id));
                                                        el.indeterminate = isIndeterminate;
                                                    }
                                                }}
                                            />
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schoolRoster.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Select a school to view roster.</TableCell>
                                    </TableRow>
                                ) : filteredSchoolRoster.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No players match your search in this roster.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSchoolRoster.map(player => {
                                        const isStaged = stagedPlayers.some(p => p.id === player.id);
                                        return (
                                            <TableRow key={player.id}>
                                                <TableCell className="font-medium">{player.firstName} {player.lastName}</TableCell>
                                                <TableCell>{player.uscfId}</TableCell>
                                                <TableCell>{player.regularRating || 'UNR'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="outline" onClick={() => handleSelectSearchedPlayer(player)} disabled={isStaged}>
                                                        {isStaged ? <><CheckCircle className="mr-2 h-4 w-4 text-green-600"/>Staged</> : 'Add'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <Button variant="outline" onClick={handleAddPlayerClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Player Manually</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Staged Players ({stagedPlayers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Player</TableHead>
                                    <TableHead>USCF ID</TableHead>
                                    <TableHead>Grade</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stagedPlayers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No players staged for registration.</TableCell>
                                    </TableRow>
                                )}
                                {stagedPlayers.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.firstName} {p.lastName}</TableCell>
                                        <TableCell>{p.uscfId}</TableCell>
                                        <TableCell>{p.grade}</TableCell>
                                        <TableCell>{p.section}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditPlayer(p)}>Edit</Button>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemovePlayer(p.id!)}>Remove</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleProceedToConfirmation} disabled={stagedPlayers.length === 0}>
                        Proceed to Register ({stagedPlayers.length} Players)
                    </Button>
                </CardFooter>
            </Card>

            {/* Player Add/Edit Dialog */}
            <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle>{editingPlayer ? 'Edit Player' : 'Add Player'}</DialogTitle>
                        <DialogDescription>Fill in the required details for this player to register them.</DialogDescription>
                    </DialogHeader>
                    <div className='flex-1 overflow-y-auto p-6'>
                        <Form {...playerForm}>
                            <form id="player-dialog-form" onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={playerForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={playerForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={playerForm.control} name="uscfId" render={({ field }) => ( <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input placeholder="12345678 or NEW" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={playerForm.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={playerForm.control} name="dob" render={({ field }) => ( <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => { const dateValue = e.target.value; if (dateValue) { const parsedDate = new Date(dateValue + 'T00:00:00'); if (!isNaN(parsedDate.getTime())) { field.onChange(parsedDate); } } else { field.onChange(undefined); } }} max={format(new Date(), 'yyyy-MM-dd')} min="1900-01-01" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={playerForm.control} name="uscfExpiration" render={({ field }) => ( <FormItem><FormLabel>USCF Expiration</FormLabel><FormControl><Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => { const dateValue = e.target.value; if (dateValue) { const parsedDate = new Date(dateValue + 'T00:00:00'); if (!isNaN(parsedDate.getTime())) { field.onChange(parsedDate); } } else { field.onChange(undefined); } }} min={format(new Date(), 'yyyy-MM-dd')} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={playerForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger></FormControl><SelectContent position="item-aligned">{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                    <FormField control={playerForm.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger></FormControl><SelectContent position="item-aligned">{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={playerForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={playerForm.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                            </form>
                        </Form>
                    </div>
                     <DialogFooter className="p-6 pt-4 border-t shrink-0">
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" form="player-dialog-form">{editingPlayer ? 'Update Player' : 'Add Player to List'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
