
'use client';

import { useState, useEffect, type ReactNode, useMemo, useCallback, Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInHours, isSameDay, parse, isValid } from 'date-fns';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

import { AppLayout } from "@/components/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ClipboardCheck, ExternalLink, UploadCloud, File as FileIcon, Loader2, Download, CalendarIcon, RefreshCw, Info, Award, MessageSquarePlus, UserMinus, UserPlus, FilePenLine, UserX, UserCheck, History, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { getInvoiceStatus } from '@/ai/flows/get-invoice-status-flow';
import { generateTeamCode } from '@/lib/school-utils';
import { auth, storage } from '@/lib/firebase';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { cancelInvoice } from '@/ai/flows/cancel-invoice-flow';
import { recreateInvoiceFromRoster } from '@/ai/flows/recreate-invoice-from-roster-flow';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import type { ChangeRequest } from '@/lib/data/requests-data';
import { requestsData as initialRequestsData } from '@/lib/data/requests-data';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createInvoice } from '@/ai/flows/create-invoice-flow';
import { useEvents, type Event } from '@/hooks/use-events';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const grades = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];
const sections = ['Kinder-1st', 'Primary K-3', 'Elementary K-5', 'Middle School K-8', 'High School K-12', 'Championship'];
const gradeToNumber: { [key: string]: number } = { 'Kindergarten': 0, '1st Grade': 1, '2nd Grade': 2, '3rd Grade': 3, '4th Grade': 4, '5th Grade': 5, '6th Grade': 6, '7th Grade': 7, '8th Grade': 8, '9th Grade': 9, '10th Grade': 10, '11th Grade': 11, '12th Grade': 12, };
const sectionMaxGrade: { [key: string]: number } = { 'Kinder-1st': 1, 'Primary K-3': 3, 'Elementary K-5': 5, 'Middle School K-8': 8, 'High School K-12': 12, 'Championship': 12 };

const playerFormSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, { message: "First Name is required." }),
  middleName: z.string().optional(),
  lastName: z.string().min(1, { message: "Last Name is required." }),
  uscfId: z.string().min(1, { message: "USCF ID is required." }),
  uscfExpiration: z.date().optional(),
  regularRating: z.preprocess(
    (val) => (String(val).toUpperCase() === 'UNR' || val === '' ? undefined : val),
    z.coerce.number({invalid_type_error: "Rating must be a number or UNR."}).optional()
  ),
  grade: z.string().optional(),
  section: z.string().optional(),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  dob: z.date().optional(),
  zipCode: z.string().optional(),
  studentType: z.string().optional(),
  state: z.string().optional(),
  school: z.string().min(1, { message: "School name is required."}),
  district: z.string().min(1, { message: "District name is required."}),
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

type PlayerRegistration = {
  byes: {
    round1: string;
    round2: string;
  };
  section: string;
  uscfStatus: 'current' | 'new' | 'renewing';
  status?: 'active' | 'withdrawn';
  withdrawnBy?: string;
  withdrawnAt?: string;
};
type RegistrationSelections = Record<string, PlayerRegistration>;

type PaymentMethod = 'po' | 'check' | 'cashapp' | 'zelle';

type Confirmation = {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  submissionTimestamp: string;
  selections: RegistrationSelections;
  totalInvoiced: number;
  invoiceId?: string;
  invoiceUrl?: string;
  invoiceNumber?: string;
  teamCode: string;
  paymentMethod?: PaymentMethod;
  poNumber?: string;
  checkNumber?: string;
  checkDate?: string;
  amountPaid?: string;
  paymentFileName?: string;
  paymentFileUrl?: string;
  invoiceStatus?: string;
  sponsorName: string; 
  sponsorEmail: string;
  schoolName: string;
  district: string;
  previousVersionId?: string; // For linking revised invoices
};

type ConfirmationInputs = {
  paymentMethod: PaymentMethod;
  poNumber: string;
  checkNumber: string;
  checkDate?: Date;
  amountPaid: string;
  file: File | null;
  paymentFileName?: string;
  paymentFileUrl?: string;
};

type ChangeRequestInputs = {
  playerId: string;
  requestType: string;
  details: string;
  byeRound1?: string;
  byeRound2?: string;
};

type SortableColumnKey = 'eventName' | 'submissionTimestamp' | 'totalInvoiced';

export default function ConfirmationsPage() {
  const { toast } = useToast();
  const { profile: sponsorProfile } = useSponsorProfile();
  const { database: allPlayers, isDbLoaded: isPlayersLoaded, updatePlayer } = useMasterDb();
  const { events } = useEvents();

  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [confInputs, setConfInputs] = useState<Record<string, Partial<ConfirmationInputs>>>({});
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, { status?: string; isLoading: boolean }>>({});
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  
  const [isCompAlertOpen, setIsCompAlertOpen] = useState(false);
  const [confToComp, setConfToComp] = useState<Confirmation | null>(null);
  
  const [isChangeAlertOpen, setIsChangeAlertOpen] = useState(false);
  const [changeAlertContent, setChangeAlertContent] = useState({ title: '', description: '' });
  const [changeAction, setChangeAction] = useState<(() => void) | null>(null);

  const [selectedPlayersForWithdraw, setSelectedPlayersForWithdraw] = useState<Record<string, string[]>>({});
  const [selectedPlayersForRestore, setSelectedPlayersForRestore] = useState<Record<string, string[]>>({});
  
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [confToRequestChange, setConfToRequestChange] = useState<Confirmation | null>(null);
  const [changeRequestInputs, setChangeRequestInputs] = useState<Partial<ChangeRequestInputs>>({});

  const [openCollapsibleRow, setOpenCollapsibleRow] = useState<string | null>(null);
  
  const [isAddPlayerDialogOpen, setIsAddPlayerDialogOpen] = useState(false);
  const [confToAddPlayer, setConfToAddPlayer] = useState<Confirmation | null>(null);
  const [playersToAdd, setPlayersToAdd] = useState<string[]>([]);
  const [isCreatingAddonInvoice, setIsCreatingAddonInvoice] = useState(false);
  
  const [isEditPlayerDialogOpen, setIsEditPlayerDialogOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'submissionTimestamp', direction: 'descending' });
  const [searchQuery, setSearchQuery] = useState('');

  const playerForm = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema),
  });

  const playersMap = useMemo(() => {
    return new Map(allPlayers.map(p => [p.id, p]));
  }, [allPlayers]);

  const sortedAndFilteredConfirmations = useMemo(() => {
    let filtered = [...confirmations];

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        
        filtered = filtered.filter(conf => {
            // Search by event name or invoice number
            if (conf.eventName.toLowerCase().includes(lowercasedQuery) ||
                (conf.invoiceNumber && conf.invoiceNumber.toLowerCase().includes(lowercasedQuery))) {
                return true;
            }

            // Check if search query is just a month name
            const isMonthQuery = !/\d/.test(lowercasedQuery);
            if (isMonthQuery && conf.eventDate) {
                const eventDate = new Date(conf.eventDate);
                if (isValid(eventDate) && format(eventDate, 'MMMM').toLowerCase().startsWith(lowercasedQuery)) {
                    return true;
                }
            }

            // Try to parse as a full date if it's not just a month name
            if (!isMonthQuery && conf.eventDate) {
                try {
                    const parsedDate = new Date(lowercasedQuery);
                    if (isValid(parsedDate)) {
                        const eventDate = new Date(conf.eventDate);
                        if (isValid(eventDate) && isSameDay(parsedDate, eventDate)) {
                            return true;
                        }
                    }
                } catch(e) { /* ignore invalid date strings */ }
            }
            
            return false;
        });
    }
    
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];
        
        if (sortConfig.key === 'submissionTimestamp') {
            aValue = new Date(a.submissionTimestamp).getTime();
            bValue = new Date(b.submissionTimestamp).getTime();
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
    return filtered;
  }, [confirmations, sortConfig, searchQuery]);

  const requestSort = (key: SortableColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const confirmationsMap = useMemo(() => {
    return new Map(confirmations.map(c => [c.id, c]));
  }, [confirmations]);

  const fetchAllInvoiceStatuses = (confirmationsToFetch: Confirmation[]) => {
    confirmationsToFetch.forEach(conf => {
        if (conf.invoiceId) {
            fetchInvoiceStatus(conf.id, conf.invoiceId, true);
        }
    });
  };

  const fetchInvoiceStatus = async (confId: string, invoiceId: string, silent = false) => {
      if (!silent) {
          setStatuses(prev => ({ ...prev, [confId]: { ...prev[confId], isLoading: true } }));
      }
      try {
          const { status, invoiceNumber } = await getInvoiceStatus({ invoiceId });
          setStatuses(prev => ({ ...prev, [confId]: { status, isLoading: false } }));
          setConfirmations(prevConfs => prevConfs.map(c => 
            c.id === confId ? { ...c, invoiceStatus: status, invoiceNumber: invoiceNumber } : c
          ));
          const allConfsRaw = localStorage.getItem('confirmations') || '[]';
          const allConfsParsed = JSON.parse(allConfsRaw);
          const updatedConfs = allConfsParsed.map((c: any) => {
              if (c.id === confId) {
                  return { ...c, invoiceStatus: status, invoiceNumber: invoiceNumber };
              }
              return c;
          });
          localStorage.setItem('confirmations', JSON.stringify(updatedConfs));
      } catch (error) {
          console.error(`Failed to fetch status for invoice ${invoiceId}:`, error);
          setStatuses(prev => ({ ...prev, [confId]: { status: 'ERROR', isLoading: false } }));
          if (!silent) {
            const description = error instanceof Error ? error.message : "Failed to get the latest invoice status from Square.";
            toast({ variant: "destructive", title: "Could not refresh status", description });
          }
      }
  };

  useEffect(() => {
    if (!auth || !storage) {
        setIsAuthReady(false);
        setAuthError("Firebase is not configured, so file uploads are disabled. Please check your .env file.");
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) { setIsAuthReady(true); setAuthError(null); } 
        else { signInAnonymously(auth).catch((error) => {
                console.error("Anonymous sign-in failed:", error);
                if (error instanceof Error && (error as any).code === 'auth/admin-restricted-operation') {
                    setAuthError("File uploads are disabled. Anonymous sign-in is not enabled in the Firebase console. Please contact your administrator.");
                }
                setIsAuthReady(false);
            });
        }
    });
    return () => unsubscribe();
  }, []);

  const loadAllData = useCallback(() => {
    try {
      const storedConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
      setConfirmations(storedConfirmations);

      const storedRequests = localStorage.getItem('change_requests');
      setChangeRequests(storedRequests ? JSON.parse(storedRequests) : initialRequestsData);

      const initialInputs: Record<string, Partial<ConfirmationInputs>> = {};
      const initialStatuses: Record<string, { status?: string; isLoading: boolean }> = {};
      for (const conf of storedConfirmations) {
          initialInputs[conf.id] = { paymentMethod: conf.paymentMethod || 'po', poNumber: conf.poNumber || '', checkNumber: conf.checkNumber || '', amountPaid: conf.amountPaid || '', checkDate: conf.checkDate ? new Date(conf.checkDate) : undefined, file: null, paymentFileName: conf.paymentFileName, paymentFileUrl: conf.paymentFileUrl, };
          if (conf.invoiceId) {
            initialStatuses[conf.id] = { status: conf.invoiceStatus || 'LOADING', isLoading: true };
          } else if (conf.invoiceStatus === 'COMPED') {
            initialStatuses[conf.id] = { status: 'COMPED', isLoading: false };
          } else {
            initialStatuses[conf.id] = { status: 'NO_SQ_INV', isLoading: false };
          }
      }
      setConfInputs(initialInputs);
      setStatuses(initialStatuses);
      
      fetchAllInvoiceStatuses(storedConfirmations.filter((c: Confirmation) => c.invoiceId));
    } catch (error) {
        console.error("Failed to load or parse data from localStorage", error);
        setConfirmations([]);
        setChangeRequests(initialRequestsData);
    }
  }, []);
  
  useEffect(() => {
    loadAllData();
    window.addEventListener('storage', loadAllData);
    
    // Check for a hash in the URL on initial load
    if (window.location.hash) {
      const hashId = window.location.hash.substring(1);
      setOpenCollapsibleRow(hashId);
    }

    return () => {
        window.removeEventListener('storage', loadAllData);
    };
  }, [loadAllData]);

  const getPlayerById = (id: string) => playersMap.get(id);

  const getStatusBadgeVariant = (status?: string): string => {
    if (!status) return 'bg-gray-400';
    switch (status.toUpperCase()) {
        case 'PAID': return 'bg-green-600 text-white';
        case 'DRAFT': return 'bg-gray-500';
        case 'COMPED': return 'bg-sky-500 text-white';
        case 'PUBLISHED': return 'bg-blue-500 text-white';
        case 'UNPAID': case 'PARTIALLY_PAID': return 'bg-yellow-500 text-black';
        case 'CANCELED': case 'VOIDED': case 'FAILED': return 'bg-red-600 text-white';
        case 'PAYMENT_PENDING': return 'bg-purple-500 text-white';
        case 'REFUNDED': case 'PARTIALLY_REFUNDED': return 'bg-indigo-500 text-white';
        case 'LOADING': return 'bg-muted text-muted-foreground animate-pulse';
        case 'NO_SQ_INV': return 'bg-gray-400 text-white';
        default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleInputChange = (confId: string, field: keyof ConfirmationInputs, value: any) => {
    setConfInputs(prev => ({ ...prev, [confId]: { ...prev[confId], [field]: value, }, }));
  };

  const handleFileChange = (confId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      handleInputChange(confId, 'file', file);
  };
  
  const handleSavePayment = async (conf: Confirmation) => {
    setIsUpdating(prev => ({ ...prev, [conf.id]: true }));
    const inputs = confInputs[conf.id] || {};
    const paymentMethod = inputs.paymentMethod || 'po';
    try {
        let paymentFileName = conf.paymentFileName;
        let paymentFileUrl = conf.paymentFileUrl;
        if (inputs.file) {
            if (!isAuthReady) { throw new Error(authError || "Authentication is not ready. Cannot upload files."); }
            if (!storage) { throw new Error('Firebase Storage is not configured.'); }
            const storageRef = ref(storage, `purchase-orders/${conf.id}/${inputs.file.name}`);
            const snapshot = await uploadBytes(storageRef, inputs.file);
            paymentFileUrl = await getDownloadURL(snapshot.ref);
            paymentFileName = inputs.file.name;
        }
        
        const teamCode = conf.teamCode || (sponsorProfile ? generateTeamCode({ schoolName: sponsorProfile.school, district: sponsorProfile.district }) : '');
        let newTitle = `${teamCode} @ ${format(new Date(conf.eventDate), 'MM/dd/yyyy')} ${conf.eventName}`;
        let toastMessage = "Payment information has been saved.";

        switch (paymentMethod) {
            case 'po': if (inputs.poNumber) newTitle += ` PO: ${inputs.poNumber}`; break;
            case 'check': if (inputs.checkNumber) newTitle += ` via Check #${inputs.checkNumber}`; if (inputs.checkDate) newTitle += ` dated ${format(inputs.checkDate, 'MM/dd/yy')}`; break;
            case 'cashapp': newTitle += ` via CashApp`; break;
            case 'zelle': newTitle += ` via Zelle`; break;
        }

        if (conf.invoiceId) {
            await updateInvoiceTitle({ invoiceId: conf.invoiceId, title: newTitle });
            toastMessage = "Payment information has been saved and the invoice has been updated.";
            fetchInvoiceStatus(conf.id, conf.invoiceId);
        }

        const updatedConfirmations = confirmations.map(c => c.id === conf.id ? { ...c, teamCode, paymentMethod, poNumber: inputs.poNumber, checkNumber: inputs.checkNumber, checkDate: inputs.checkDate ? inputs.checkDate.toISOString() : undefined, amountPaid: inputs.amountPaid, paymentFileName, paymentFileUrl, } : c);
        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
        setConfirmations(updatedConfirmations);
        setConfInputs(prev => ({ ...prev, [conf.id]: { ...prev[conf.id], file: null, paymentFileName, paymentFileUrl } }));
        toast({ title: "Success", description: toastMessage });
    } catch (error) {
        console.error("Failed to update payment information:", error);
        const description = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Update Failed", description });
    } finally {
        setIsUpdating(prev => ({ ...prev, [conf.id]: false }));
    }
  };

  const handleCompRegistration = async () => {
    if (!confToComp) return;
    setIsUpdating(prev => ({ ...prev, [confToComp.id]: true }));
    setIsCompAlertOpen(false);
    try {
        if (confToComp.invoiceId) {
            console.log(`Canceling Square invoice ${confToComp.invoiceId} for comped registration.`);
            await cancelInvoice({ invoiceId: confToComp.invoiceId });
        }
        const updatedConfirmations = confirmations.map(c => c.id === confToComp.id ? { ...c, invoiceStatus: 'COMPED' } : c);
        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
        loadAllData();
        
        toast({ title: "Registration Comped", description: `The registration for "${confToComp.eventName}" has been marked as complimentary.` });
    } catch (error) {
        console.error("Failed to comp registration:", error);
        const description = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Operation Failed", description });
    } finally {
        setIsUpdating(prev => ({ ...prev, [confToComp.id]: false }));
        setConfToComp(null);
    }
  };

  const handlePlayerStatusChangeAction = async (confId: string, playerIds: string[], newStatus: 'withdrawn' | 'active') => {
      setIsUpdating(prev => ({ ...prev, [confId]: true }));
      setIsChangeAlertOpen(false);

      try {
          const confToUpdate = confirmations.find(c => c.id === confId);
          if (!confToUpdate || !confToUpdate.invoiceId) throw new Error("Could not find the confirmation or invoice to update.");
          if (!sponsorProfile) throw new Error("You must have a sponsor profile to perform this action.");

          const eventDetails = events.find(e => e.id === confToUpdate.eventId);
          if (!eventDetails) throw new Error("Could not find necessary event details.");
          
          const initials = `${sponsorProfile.firstName.charAt(0)}${sponsorProfile.lastName.charAt(0)}`;
          const approvalTimestamp = new Date().toISOString();

          // First, update the selections locally to determine the final roster
          const updatedSelections = { ...confToUpdate.selections };
          playerIds.forEach(id => {
              if (updatedSelections[id]) {
                  if (newStatus === 'withdrawn') {
                    updatedSelections[id] = { ...updatedSelections[id], status: 'withdrawn', withdrawnBy: initials, withdrawnAt: approvalTimestamp };
                  } else {
                    delete updatedSelections[id].status;
                    delete updatedSelections[id].withdrawnBy;
                    delete updatedSelections[id].withdrawnAt;
                  }
              }
          });

          // Determine the final list of active players for the new invoice
          const activePlayerIds = Object.keys(updatedSelections).filter(id => updatedSelections[id].status !== 'withdrawn');
          const activePlayers = activePlayerIds.map(id => getPlayerById(id)).filter((p): p is MasterPlayer => !!p);

          let registrationFeePerPlayer = eventDetails.regularFee;
          const eventDate = new Date(eventDetails.date);
          const now = new Date();
          if (isSameDay(eventDate, now)) { registrationFeePerPlayer = eventDetails.dayOfFee; }
          else { const hoursUntilEvent = differenceInHours(eventDate, now); if (hoursUntilEvent <= 24) registrationFeePerPlayer = eventDetails.veryLateFee; else if (hoursUntilEvent <= 48) registrationFeePerPlayer = eventDetails.lateFee; }

          const newInvoicePlayers = activePlayers.map(player => {
              const isExpired = !player.uscfExpiration || new Date(player.uscfExpiration) < eventDate;
              const uscfStatus = player.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current';
              const lateFeeAmount = registrationFeePerPlayer - eventDetails.regularFee;
              return {
                  playerName: `${player.firstName} ${player.lastName}`,
                  uscfId: player.uscfId,
                  baseRegistrationFee: eventDetails.regularFee,
                  lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
                  uscfAction: uscfStatus !== 'current',
              };
          });
          
          const sponsorNameForInvoice = confToUpdate.sponsorName || `${sponsorProfile.firstName} ${sponsorProfile.lastName}`;
          const sponsorEmailForInvoice = confToUpdate.sponsorEmail || sponsorProfile.email;

          const result = await recreateInvoiceFromRoster({
              originalInvoiceId: confToUpdate.invoiceId,
              players: newInvoicePlayers,
              uscfFee: 24,
              sponsorName: sponsorNameForInvoice,
              sponsorEmail: sponsorEmailForInvoice,
              schoolName: confToUpdate.schoolName,
              teamCode: confToUpdate.teamCode,
              eventName: confToUpdate.eventName,
              eventDate: confToUpdate.eventDate,
          });
          
          // Create the new confirmation object
          const newConfirmationRecord: Confirmation = {
              id: result.newInvoiceId, // The ID of the confirmation record is the new invoice ID
              eventId: confToUpdate.eventId,
              eventName: confToUpdate.eventName,
              eventDate: confToUpdate.eventDate,
              submissionTimestamp: new Date().toISOString(),
              invoiceId: result.newInvoiceId,
              invoiceNumber: result.newInvoiceNumber,
              invoiceUrl: result.newInvoiceUrl,
              invoiceStatus: result.newStatus,
              totalInvoiced: result.newTotalAmount,
              selections: updatedSelections,
              previousVersionId: confToUpdate.id, // Link back to the original confirmation
              teamCode: confToUpdate.teamCode,
              schoolName: confToUpdate.schoolName,
              district: confToUpdate.district,
              sponsorName: sponsorNameForInvoice,
              sponsorEmail: sponsorEmailForInvoice,
          };
          
          const finalConfirmations = confirmations.map(c => 
              c.id === confToUpdate.id ? { ...c, invoiceStatus: 'CANCELED' } : c
          );
          finalConfirmations.push(newConfirmationRecord); // Add the new one

          localStorage.setItem('confirmations', JSON.stringify(finalConfirmations));

          const changedPlayerNames = playerIds.map(id => {
              const p = getPlayerById(id);
              return p ? `${p.firstName} ${p.lastName}` : 'Unknown Player';
          });
          
          // Update the status of the original change request
          const updatedRequests = changeRequests.map(req => {
              if (req.confirmationId === confId && changedPlayerNames.includes(req.player)) {
                  if ((newStatus === 'withdrawn' && req.type.includes('Withdraw')) || (newStatus === 'active' && req.type.includes('Restore'))) {
                      return { ...req, status: 'Approved' as const, approvedBy: initials, approvedAt: approvalTimestamp };
                  }
              }
              return req;
          });
          localStorage.setItem('change_requests', JSON.stringify(updatedRequests));

          loadAllData(); // Reload all data to ensure consistency

          toast({
              title: `Player(s) ${newStatus === 'active' ? 'Restored' : 'Withdrawn'} & Invoice Recreated`,
              description: `A new invoice (${result.newInvoiceNumber}) has been created.`
          });
      } catch (error) {
          console.error(`Failed to ${newStatus === 'active' ? 'restore' : 'withdraw'} player(s) and recreate invoice:`, error);
          const description = error instanceof Error ? error.message : `An unknown error occurred during ${newStatus}al.`;
          toast({ variant: "destructive", title: `${newStatus === 'active' ? 'Restore' : 'Withdrawal'} Failed`, description });
          loadAllData();
      } finally {
          setIsUpdating(prev => ({ ...prev, [confId]: false }));
          if (newStatus === 'withdrawn') {
            setSelectedPlayersForWithdraw(prev => ({ ...prev, [confId]: [] }));
          } else {
            setSelectedPlayersForRestore(prev => ({...prev, [confId]: [] }));
          }
      }
  };
  
  const handleOpenRequestDialog = (conf: Confirmation) => {
    setConfToRequestChange(conf);
    setChangeRequestInputs({ requestType: '' });
    setIsRequestDialogOpen(true);
  };
  
  const handleByeChange = (confId: string, playerId: string, round: 'round1' | 'round2', value: string) => {
    setIsUpdating(prev => ({ ...prev, [confId]: true }));
    const player = getPlayerById(playerId);

    setConfirmations(prevConf => {
      const newConfirmations = prevConf.map(conf => {
        if (conf.id === confId) {
          const newSelections = { ...conf.selections };
          if (newSelections[playerId]) {
            newSelections[playerId].byes = { ...newSelections[playerId].byes, [round]: value };
            if (round === 'round2' && value !== 'none' && newSelections[playerId].byes.round1 === 'none') {
                newSelections[playerId].byes.round1 = '1';
            }
            if (round === 'round1' && value === 'none') {
                newSelections[playerId].byes.round2 = 'none';
            }
          }
          return { ...conf, selections: newSelections };
        }
        return conf;
      });
      localStorage.setItem('confirmations', JSON.stringify(newConfirmations));
      return newConfirmations;
    });

    if (sponsorProfile?.role === 'organizer' && player) {
      const initials = `${sponsorProfile.firstName.charAt(0)}${sponsorProfile.lastName.charAt(0)}`;
      const approvalTimestamp = new Date().toISOString();

      setChangeRequests(prevReqs => {
        const updatedRequests = prevReqs.map(req => {
          if (req.confirmationId === confId && req.player === `${player.firstName} ${player.lastName}` && req.type === 'Bye Request' && req.status === 'Pending') {
            return { ...req, status: 'Approved' as const, approvedBy: initials, approvedAt: approvalTimestamp };
          }
          return req;
        });
        localStorage.setItem('change_requests', JSON.stringify(updatedRequests));
        return updatedRequests;
      });
      window.dispatchEvent(new Event('storage'));
    }

    toast({ title: "Bye Updated", description: `Bye request for ${player?.firstName} has been updated.` });
    setIsUpdating(prev => ({ ...prev, [confId]: false }));
  };

  const handleSubmitChangeRequest = () => {
    if (!confToRequestChange || !changeRequestInputs.playerId || !changeRequestInputs.requestType || !sponsorProfile) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a player and request type.' });
        return;
    }
    
    const player = getPlayerById(changeRequestInputs.playerId);
    const newRequest: ChangeRequest = {
        id: `req-${Date.now()}`,
        confirmationId: confToRequestChange.id,
        eventDate: confToRequestChange.eventDate,
        player: player ? `${player.firstName} ${player.lastName}` : 'Unknown Player',
        event: confToRequestChange.eventName,
        type: changeRequestInputs.requestType,
        details: changeRequestInputs.details || '',
        submitted: new Date().toISOString(),
        submittedBy: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`,
        status: 'Pending',
    };
    
    if (sponsorProfile.role === 'organizer') {
        const actionMap: Record<string, { title: string; description: string; action: () => void }> = {
            'Withdraw Player': {
                title: `Withdraw ${newRequest.player}?`,
                description: `This will mark ${newRequest.player} as withdrawn and recreate the invoice with an updated total. This action cannot be undone.`,
                action: () => handlePlayerStatusChangeAction(newRequest.confirmationId, [changeRequestInputs.playerId!], 'withdrawn')
            },
            'Restore Player': {
                title: `Restore ${newRequest.player}?`,
                description: `This will mark ${newRequest.player} as active and recreate the invoice.`,
                action: () => handlePlayerStatusChangeAction(newRequest.confirmationId, [changeRequestInputs.playerId!], 'active')
            },
            'Bye Request': {
                title: `Update Byes for ${newRequest.player}?`,
                description: `This will update the bye requests for ${newRequest.player}. This change will not affect the invoice.`,
                action: () => {
                  const newByes = { round1: changeRequestInputs.byeRound1 || 'none', round2: changeRequestInputs.byeRound2 || 'none' };
                  handleByeChange(newRequest.confirmationId, changeRequestInputs.playerId!, 'round1', newByes.round1);
                  if (newByes.round1 !== 'none') {
                    handleByeChange(newRequest.confirmationId, changeRequestInputs.playerId!, 'round2', newByes.round2);
                  }
                  setIsChangeAlertOpen(false);
                }
            },
            'Other': {
                title: `Log Change for ${newRequest.player}?`,
                description: `This will log the following note for the player: "${newRequest.details}". This is for record-keeping and will not alter the invoice.`,
                action: () => {
                    setIsChangeAlertOpen(false);
                    const initials = `${sponsorProfile.firstName.charAt(0)}${sponsorProfile.lastName.charAt(0)}`;
                    const approvalTimestamp = new Date().toISOString();
                    const approvedRequest = { ...newRequest, status: 'Approved' as const, approvedBy: initials, approvedAt: approvalTimestamp };
                    const updatedRequests = [approvedRequest, ...changeRequests];
                    setChangeRequests(updatedRequests);
                    localStorage.setItem('change_requests', JSON.stringify(updatedRequests));
                    toast({ title: 'Change Logged', description: `Your change for ${newRequest.player} has been approved and logged.` });
                }
            }
        };

        const changeDetails = actionMap[newRequest.type];
        if (changeDetails) {
            setChangeAlertContent({ title: changeDetails.title, description: changeDetails.description });
            setChangeAction(() => changeDetails.action);
            setIsChangeAlertOpen(true);
        }

    } else {
      const updatedRequests = [newRequest, ...changeRequests];
      setChangeRequests(updatedRequests);
      localStorage.setItem('change_requests', JSON.stringify(updatedRequests));
      toast({ title: 'Request Submitted', description: 'Your change request has been sent to the organizer for review.' });
    }

    setIsRequestDialogOpen(false);
  };
  
  const handleOpenEditPlayerDialog = (player: MasterPlayer) => {
    setPlayerToEdit(player);
    playerForm.reset({
      ...player,
      dob: player.dob ? new Date(player.dob) : undefined,
      uscfExpiration: player.uscfExpiration ? new Date(player.uscfExpiration) : undefined,
    });
    setIsEditPlayerDialogOpen(true);
  };
  
  const handlePlayerFormSubmit = async (values: PlayerFormValues) => {
    if (!playerToEdit) return;

    const { uscfExpiration, dob, ...restOfValues } = values;
    
    const updatedPlayerRecord: MasterPlayer = {
        ...playerToEdit,
        ...restOfValues,
        dob: dob ? dob.toISOString() : undefined,
        uscfExpiration: uscfExpiration ? uscfExpiration.toISOString() : undefined,
    };
    
    await updatePlayer(updatedPlayerRecord);
    
    // Also update the local map for immediate UI feedback
    playersMap.set(playerToEdit.id, updatedPlayerRecord);

    toast({ title: "Player Updated", description: `${values.firstName} ${values.lastName}'s information has been updated.`});
    setIsEditPlayerDialogOpen(false);
    setPlayerToEdit(null);
  };

  const handlePlayerToggle = (playerId: string) => {
    setPlayersToAdd(prev => 
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  const handleWithdrawPlayerSelect = (confId: string, playerId: string) => {
      setSelectedPlayersForWithdraw(prev => {
          const currentSelection = prev[confId] || [];
          const newSelection = currentSelection.includes(playerId)
              ? currentSelection.filter(id => id !== playerId)
              : [...currentSelection, playerId];
          return { ...prev, [confId]: newSelection };
      });
  };

  const handleRestorePlayerSelect = (confId: string, playerId: string) => {
    setSelectedPlayersForRestore(prev => {
        const currentSelection = prev[confId] || [];
        const newSelection = currentSelection.includes(playerId)
            ? currentSelection.filter(id => id !== playerId)
            : [...currentSelection, playerId];
        return { ...prev, [confId]: newSelection };
    });
  };

  const handleAddPlayersToRegistration = async () => {
    if (!confToAddPlayer || playersToAdd.length === 0 || !sponsorProfile) return;
    setIsCreatingAddonInvoice(true);

    try {
        const events: Event[] = JSON.parse(localStorage.getItem('chess_events') || '[]');
        const eventDetails = events.find(e => e.id === confToAddPlayer.eventId);
        if (!eventDetails) {
            throw new Error("Could not find event details to calculate fees.");
        }

        const addedPlayersInfo = playersToAdd.map(id => getPlayerById(id)!);

        let registrationFeePerPlayer = eventDetails.regularFee;
        const eventDate = new Date(eventDetails.date);
        const now = new Date();
        if (isSameDay(eventDate, now)) { registrationFeePerPlayer = eventDetails.dayOfFee; }
        else { const hoursUntilEvent = differenceInHours(eventDate, now); if (hoursUntilEvent <= 24) { registrationFeePerPlayer = eventDetails.veryLateFee; } else if (hoursUntilEvent <= 48) { registrationFeePerPlayer = eventDetails.lateFee; } }
        
        const playersToInvoice = addedPlayersInfo.map(player => {
            const isExpired = !player.uscfExpiration || new Date(player.uscfExpiration) < eventDate;
            const uscfStatus = player.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current';
            const lateFeeAmount = registrationFeePerPlayer - eventDetails.regularFee;
            return {
                playerName: `${player.firstName} ${player.lastName}`,
                uscfId: player.uscfId,
                baseRegistrationFee: eventDetails.regularFee,
                lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
                uscfAction: uscfStatus !== 'current',
            };
        });
        
        const result = await createInvoice({
            sponsorName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`,
            sponsorEmail: sponsorProfile.email,
            schoolName: sponsorProfile.school,
            teamCode: confToAddPlayer.teamCode,
            eventName: `${confToAddPlayer.eventName} (Add-on)`,
            eventDate: confToAddPlayer.eventDate,
            uscfFee: 24,
            players: playersToInvoice,
        });

        const newSelections: RegistrationSelections = {};
        addedPlayersInfo.forEach(p => {
             const isExpired = !p.uscfExpiration || new Date(p.uscfExpiration) < eventDate;
             newSelections[p.id] = {
                 byes: { round1: 'none', round2: 'none' },
                 section: p.section!,
                 uscfStatus: p.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current'
             }
        });

        const updatedConfirmations = confirmations.map(c => {
            if (c.id === confToAddPlayer.id) {
                return { ...c, selections: { ...c.selections, ...newSelections } };
            }
            return c;
        });
        
        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
        loadAllData();

        toast({
            title: "Players Added & New Invoice Created",
            description: `A separate invoice (${result.invoiceNumber}) has been created for the new players.`
        });
        
    } catch(error) {
        console.error("Failed to add players:", error);
        const description = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Operation Failed", description });
    } finally {
        setIsCreatingAddonInvoice(false);
        setIsAddPlayerDialogOpen(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Registration Confirmations</h1>
          <p className="text-muted-foreground"> A history of all your event registration submissions. Attach your PO here.</p>
        </div>

        {authError && ( <Alert variant="destructive"><AlertTitle>File Uploads Disabled</AlertTitle><AlertDescription>{authError}</AlertDescription></Alert> )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle>Registration Confirmations</CardTitle>
                    <CardDescription>Click on a submission to view its details. Column headers are sortable.</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search event, date, invoice..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {sortedAndFilteredConfirmations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <ClipboardCheck className="h-12 w-12" />
                <p className="font-semibold">{searchQuery ? "No Results Found" : "No Confirmations Yet"}</p>
                <p className="text-sm">
                    {searchQuery
                      ? "Your search did not match any confirmations."
                      : "When you register for an event, a confirmation will appear here."
                    }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"><span className="sr-only">Expand</span></TableHead>
                        <TableHead>
                            <Button variant="ghost" className="px-0" onClick={() => requestSort('eventName')}>Event {getSortIcon('eventName')}</Button>
                        </TableHead>
                        <TableHead>
                            <Button variant="ghost" className="px-0" onClick={() => requestSort('submissionTimestamp')}>Submission Date {getSortIcon('submissionTimestamp')}</Button>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                             <Button variant="ghost" className="px-0" onClick={() => requestSort('totalInvoiced')}>Amount {getSortIcon('totalInvoiced')}</Button>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedAndFilteredConfirmations.map((conf) => {
                        const isExpanded = openCollapsibleRow === conf.id;
                        const currentStatus = statuses[conf.id];

                        return (
                            <Fragment key={conf.id}>
                                <TableRow onClick={() => setOpenCollapsibleRow(isExpanded ? null : conf.id)} className="cursor-pointer">
                                    <TableCell>
                                        <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <p>{conf.eventName}</p>
                                        <p className="text-sm text-muted-foreground">{Object.keys(conf.selections).length} Player(s)</p>
                                    </TableCell>
                                    <TableCell>{format(new Date(conf.submissionTimestamp), 'PPP p')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {conf.invoiceNumber && <span className="text-xs font-mono text-muted-foreground">{conf.invoiceNumber}</span>}
                                            {currentStatus && (
                                                <Badge variant="default" className={cn('capitalize w-28 justify-center', getStatusBadgeVariant(currentStatus.status))}>
                                                    {currentStatus.isLoading && currentStatus.status === 'LOADING' ? 'Loading...' : currentStatus.status?.replace(/_/g, ' ').toLowerCase() || 'Unknown'}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">${conf.totalInvoiced.toFixed(2)}</TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <ConfirmationDetails
                                                conf={conf}
                                                confInputs={confInputs}
                                                statuses={statuses}
                                                isUpdating={isUpdating}
                                                isAuthReady={isAuthReady}
                                                selectedPlayersForWithdraw={selectedPlayersForWithdraw}
                                                selectedPlayersForRestore={selectedPlayersForRestore}
                                                events={events}
                                                changeRequests={changeRequests}
                                                confirmationsMap={confirmationsMap}
                                                sponsorProfile={sponsorProfile}
                                                handlers={{
                                                    handleInputChange,
                                                    handleFileChange,
                                                    handleSavePayment,
                                                    setConfToComp,
                                                    setIsCompAlertOpen,
                                                    fetchInvoiceStatus,
                                                    setConfToAddPlayer,
                                                    setIsAddPlayerDialogOpen,
                                                    handleOpenRequestDialog,
                                                    handleWithdrawPlayerSelect,
                                                    handleRestorePlayerSelect,
                                                    setChangeAlertContent,
                                                    setChangeAction,
                                                    setIsChangeAlertOpen,
                                                    handlePlayerStatusChangeAction,
                                                    handleByeChange,
                                                    handleOpenEditPlayerDialog,
                                                    getPlayerById,
                                                    getStatusBadgeVariant,
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        )
                    })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isCompAlertOpen} onOpenChange={setIsCompAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will cancel the **entire invoice** for this registration. All players on this submission will be marked as complimentary, and no payment will be due. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setConfToComp(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleCompRegistration} className="bg-primary hover:bg-primary/90">Confirm & Comp</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={isChangeAlertOpen} onOpenChange={setIsChangeAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{changeAlertContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{changeAlertContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChangeAction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => changeAction && changeAction()} className="bg-destructive hover:bg-destructive/90">Yes, Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}><DialogContent><DialogHeader><DialogTitle>Request a Change</DialogTitle><DialogDescription>Submit a request to the tournament organizer regarding this registration for "{confToRequestChange?.eventName}".</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="request-player">Player</Label><Select value={changeRequestInputs.playerId} onValueChange={(value) => setChangeRequestInputs(prev => ({...prev, playerId: value, requestType: ''}))}><SelectTrigger id="request-player"><SelectValue placeholder="Select a player..." /></SelectTrigger><SelectContent>{confToRequestChange && Object.entries(confToRequestChange.selections).map(([playerId, details]) => { const player = getPlayerById(playerId); return player ? <SelectItem key={playerId} value={playerId} disabled={details.status === 'withdrawn' && sponsorProfile?.role !== 'organizer'}>{player.firstName} {player.lastName} {details.status === 'withdrawn' ? '(Withdrawn)' : ''}</SelectItem> : null; })}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="request-type">Request Type</Label><Select value={changeRequestInputs.requestType} onValueChange={(value) => setChangeRequestInputs(prev => ({...prev, requestType: value}))}><SelectTrigger id="request-type"><SelectValue placeholder="Select a request type..." /></SelectTrigger><SelectContent><SelectItem value="Withdraw Player">Withdraw Player</SelectItem>{sponsorProfile?.role === 'organizer' && <SelectItem value="Restore Player">Restore Player</SelectItem>}<SelectItem value="Section Change">Section Change</SelectItem><SelectItem value="Bye Request">Bye Request</SelectItem><SelectItem value="Other">Other (Note)</SelectItem></SelectContent></Select></div>
      
      {changeRequestInputs.requestType === 'Bye Request' && confToRequestChange && (
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Bye 1</Label>
            <Select value={changeRequestInputs.byeRound1} onValueChange={(value) => setChangeRequestInputs(prev => ({...prev, byeRound1: value}))}>
                <SelectTrigger><SelectValue placeholder="No Bye" /></SelectTrigger>
                <SelectContent>{events.find(e => e.id === confToRequestChange.eventId)?.rounds && Array.from({length: events.find(e => e.id === confToRequestChange.eventId)!.rounds}).map((_, i) => <SelectItem key={i+1} value={String(i+1)}>Round {i+1}</SelectItem>)}<SelectItem value="none">No Bye</SelectItem></SelectContent>
            </Select>
          </div>
           <div className="grid gap-2">
            <Label>Bye 2</Label>
            <Select value={changeRequestInputs.byeRound2} onValueChange={(value) => setChangeRequestInputs(prev => ({...prev, byeRound2: value}))} disabled={!changeRequestInputs.byeRound1 || changeRequestInputs.byeRound1 === 'none'}>
                <SelectTrigger><SelectValue placeholder="No Bye" /></SelectTrigger>
                <SelectContent>{events.find(e => e.id === confToRequestChange.eventId)?.rounds && Array.from({length: events.find(e => e.id === confToRequestChange.eventId)!.rounds}).map((_, i) => changeRequestInputs.byeRound1 !== String(i+1) && <SelectItem key={i+1} value={String(i+1)}>Round {i+1}</SelectItem>)}<SelectItem value="none">No Bye</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid gap-2"><Label htmlFor="request-details">Details</Label><Textarea id="request-details" placeholder="Provide any additional details for the organizer..." value={changeRequestInputs.details || ''} onChange={(e) => setChangeRequestInputs(prev => ({...prev, details: e.target.value}))} /></div></div><DialogFooter><Button variant="ghost" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button><Button onClick={handleSubmitChangeRequest}>Submit Request</Button></DialogFooter></DialogContent></Dialog>
      
      <Dialog open={isAddPlayerDialogOpen} onOpenChange={setIsAddPlayerDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Add Players to Registration</DialogTitle>
                <DialogDescription>Select players from your roster to add to "{confToAddPlayer?.eventName}". A separate invoice will be created for them.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <ScrollArea className="h-72 border rounded-md">
                    <div className="p-4">
                        <h4 className="mb-4 font-medium text-sm leading-none">Your Roster</h4>
                        {isPlayersLoaded && sponsorProfile && allPlayers.filter(p => p.district === sponsorProfile.district && p.school === sponsorProfile.school).map(player => {
                            const isAlreadyRegistered = confToAddPlayer && Object.keys(confToAddPlayer.selections).includes(player.id);
                            return (
                                <div key={player.id} className="flex items-center space-x-2 py-2">
                                    <Checkbox
                                        id={`add-${player.id}`}
                                        checked={playersToAdd.includes(player.id)}
                                        onCheckedChange={() => handlePlayerToggle(player.id)}
                                        disabled={isAlreadyRegistered}
                                    />
                                    <label
                                        htmlFor={`add-${player.id}`}
                                        className={cn("text-sm font-medium leading-none", isAlreadyRegistered ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer", "peer-disabled:cursor-not-allowed peer-disabled:opacity-70")}
                                    >
                                        {player.firstName} {player.lastName} {isAlreadyRegistered && "(Already Registered)"}
                                    </label>
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsAddPlayerDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddPlayersToRegistration} disabled={playersToAdd.length === 0 || isCreatingAddonInvoice}>
                    {isCreatingAddonInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add {playersToAdd.length} Player(s) & Create Invoice
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Player Dialog */}
      <Dialog open={isEditPlayerDialogOpen} onOpenChange={setIsEditPlayerDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <DialogTitle>Edit Player Information</DialogTitle>
                <DialogDescription>Update the details for {playerToEdit?.firstName} {playerToEdit?.lastName}. This will update the master player record.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6">
                <Form {...playerForm}>
                    <form id="edit-player-form" onSubmit={playerForm.handleSubmit(handlePlayerFormSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={playerForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={playerForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={playerForm.control} name="middleName" render={({ field }) => ( <FormItem><FormLabel>Middle Name (Opt)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={playerForm.control} name="school" render={({ field }) => ( <FormItem><FormLabel>School</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={playerForm.control} name="district" render={({ field }) => ( <FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={playerForm.control} name="uscfId" render={({ field }) => ( <FormItem><FormLabel>USCF ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={playerForm.control} name="regularRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><FormControl><Input type="text" placeholder="1500 or UNR" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <FormField control={playerForm.control} name="dob" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date of Birth</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 100} toYear={new Date().getFullYear()} initialFocus/></PopoverContent></Popover><FormMessage /></FormItem> )} />
                             <FormField control={playerForm.control} name="uscfExpiration" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>USCF Expiration</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 2} toYear={new Date().getFullYear() + 10} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={playerForm.control} name="grade" render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            <FormField control={playerForm.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={playerForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={playerForm.control} name="zipCode" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    </form>
                </Form>
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button type="button" variant="ghost" onClick={() => setIsEditPlayerDialogOpen(false)}>Cancel</Button>
                <Button type="submit" form="edit-player-form">Save Changes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}


// Sub-component for details to keep main component cleaner
function ConfirmationDetails({ conf, confInputs, statuses, isUpdating, isAuthReady, selectedPlayersForWithdraw, selectedPlayersForRestore, events, changeRequests, confirmationsMap, sponsorProfile, handlers }: any) {
    const { getPlayerById, handleInputChange, handleFileChange, handleSavePayment, setConfToComp, setIsCompAlertOpen, fetchInvoiceStatus, setConfToAddPlayer, setIsAddPlayerDialogOpen, handleOpenRequestDialog, handleWithdrawPlayerSelect, handleRestorePlayerSelect, setChangeAlertContent, setChangeAction, setIsChangeAlertOpen, handleByeChange, handleOpenEditPlayerDialog, getStatusBadgeVariant } = handlers;
    
    type SortablePlayerKey = 'lastName' | 'section';
    const [playerSortConfig, setPlayerSortConfig] = useState<{ key: SortablePlayerKey; direction: 'ascending' | 'descending' } | null>({ key: 'lastName', direction: 'ascending'});
    
    const requestPlayerSort = (key: SortablePlayerKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (playerSortConfig && playerSortConfig.key === key && playerSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setPlayerSortConfig({ key, direction });
    };

    const getPlayerSortIcon = (columnKey: SortablePlayerKey) => {
        if (!playerSortConfig || playerSortConfig.key !== columnKey) {
        return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        if (playerSortConfig.direction === 'ascending') {
        return <ArrowUp className="ml-2 h-4 w-4" />;
        }
        return <ArrowDown className="ml-2 h-4 w-4" />;
    };
    
    const sortedPlayers = useMemo(() => {
        const playerDetailsList = Object.entries(conf.selections).map(([playerId, details]) => ({
            player: getPlayerById(playerId),
            details,
        })).filter(item => !!item.player);

        if (playerSortConfig) {
            playerDetailsList.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (playerSortConfig.key === 'lastName') {
                    aValue = a.player?.lastName || '';
                    bValue = b.player?.lastName || '';
                } else {
                    aValue = a.details[playerSortConfig.key] || '';
                    bValue = b.details[playerSortConfig.key] || '';
                }

                if (aValue < bValue) {
                    return playerSortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return playerSortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return playerDetailsList;

    }, [conf.selections, getPlayerById, playerSortConfig]);

    const currentInputs = confInputs[conf.id] || {};
    const selectedMethod = currentInputs.paymentMethod || 'po';
    const currentStatus = statuses[conf.id];
    const isLoading = isUpdating[conf.id] || !isAuthReady;
    const selectedWithdrawalIds = selectedPlayersForWithdraw[conf.id] || [];
    const selectedRestoreIds = selectedPlayersForRestore[conf.id] || [];
    const eventDetails = events.find((e: Event) => e.id === conf.eventId);
    const hasWithdrawnPlayers = Object.values(conf.selections).some((p: any) => p.status === 'withdrawn');
    const previousVersion = conf.previousVersionId ? confirmationsMap.get(conf.previousVersionId) : null;

    return (
        <div className="p-4 bg-muted/50">
             <div className="space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                    <h4 className="font-semibold">Registered Players</h4>
                    <div className="flex items-center gap-2">
                        {sponsorProfile?.role === 'sponsor' && <Button variant="secondary" size="sm" onClick={() => { setConfToAddPlayer(conf); setIsAddPlayerDialogOpen(true); }} disabled={isLoading}> <UserPlus className="mr-2 h-4 w-4" /> Add Player </Button>}
                        <Button variant="secondary" size="sm" onClick={() => handleOpenRequestDialog(conf)} disabled={isLoading}> <MessageSquarePlus className="mr-2 h-4 w-4" /> Request Change </Button>
                        {sponsorProfile?.role === 'organizer' && currentStatus?.status !== 'COMPED' && (
                            <Button variant="secondary" size="sm" onClick={() => { setConfToComp(conf); setIsCompAlertOpen(true); }} disabled={isLoading}> <Award className="mr-2 h-4 w-4" /> Comp Registration </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => fetchInvoiceStatus(conf.id, conf.invoiceId!)} disabled={currentStatus?.isLoading || !conf.invoiceId || isLoading}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", currentStatus?.isLoading && "animate-spin")} /> Refresh Status
                        </Button>
                        <Button asChild variant="outline" size="sm" disabled={!conf.invoiceUrl}>
                            <a href={conf.invoiceUrl || '#'} target="_blank" rel="noopener noreferrer" className={cn(!conf.invoiceUrl && 'pointer-events-none')}> <ExternalLink className="mr-2 h-4 w-4" /> View Invoice </a>
                        </Button>
                    </div>
                </div>
                
                <Table>
                    <TableHeader>
                    <TableRow>
                        {sponsorProfile?.role === 'organizer' && <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>}
                        <TableHead>
                            <Button variant="ghost" className="px-0" onClick={() => requestPlayerSort('lastName')}>Player {getPlayerSortIcon('lastName')}</Button>
                        </TableHead>
                        <TableHead>
                            <Button variant="ghost" className="px-0" onClick={() => requestPlayerSort('section')}>Section {getPlayerSortIcon('section')}</Button>
                        </TableHead>
                        <TableHead>USCF Status</TableHead>
                        <TableHead>Byes Requested</TableHead>
                        {sponsorProfile?.role === 'organizer' && <TableHead className='text-right'>Actions</TableHead>}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {sortedPlayers.map(({ player, details }) => {
                        if (!player) return null;
                        const playerId = player.id;
                        
                        const relevantRequests = changeRequests.filter((req: ChangeRequest) => req.confirmationId === conf.id && req.player === `${player.firstName} ${player.lastName}`);
                        const latestRequest = relevantRequests.length > 0 ? relevantRequests[0] : null;

                        const isWithdrawn = details.status === 'withdrawn';
                        
                        return (
                        <TableRow key={playerId} data-state={selectedWithdrawalIds.includes(playerId) || selectedRestoreIds.includes(playerId) ? 'selected' : undefined} className={cn(isWithdrawn && 'bg-muted/50')}>
                            {sponsorProfile?.role === 'organizer' && (
                                <TableCell>
                                    <Checkbox
                                        checked={isWithdrawn ? selectedRestoreIds.includes(playerId) : selectedWithdrawalIds.includes(playerId)}
                                        onCheckedChange={() => isWithdrawn ? handleRestorePlayerSelect(conf.id, playerId) : handleWithdrawPlayerSelect(conf.id, playerId)}
                                        aria-label={`Select ${player.firstName} ${player.lastName}`}
                                        disabled={isLoading || !conf.invoiceId}
                                    />
                                </TableCell>
                            )}
                            <TableCell className={cn("font-medium flex items-center gap-2", isWithdrawn && "line-through text-muted-foreground")}>
                            {isWithdrawn ? <UserX className="h-4 w-4 text-destructive shrink-0" /> : <UserCheck className="h-4 w-4 text-green-600 shrink-0" />}
                            {player.firstName} {player.lastName}
                            {latestRequest && !isWithdrawn && (
                                <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                    <Info className="h-4 w-4 text-blue-500" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p className="font-semibold">{latestRequest.type} - {latestRequest.status}</p>
                                        {latestRequest.details && <p className="italic text-muted-foreground">"{latestRequest.details}"</p>}
                                        <p className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                                            Submitted: {format(new Date(latestRequest.submitted), 'MM/dd/yy, p')} by {latestRequest.submittedBy}
                                        </p>
                                        {latestRequest.status !== 'Pending' && latestRequest.approvedBy && latestRequest.approvedAt && (
                                            <p className="text-xs text-muted-foreground">
                                                Approved by {latestRequest.approvedBy} at {format(new Date(latestRequest.approvedAt), 'MM/dd/yy, p')}
                                            </p>
                                        )}
                                    </TooltipContent>
                                </Tooltip>
                                </TooltipProvider>
                            )}
                            </TableCell>
                            <TableCell className={cn(isWithdrawn && "text-muted-foreground")}>{details.section}</TableCell>
                            <TableCell className={cn(isWithdrawn && "text-muted-foreground")}>
                            {isWithdrawn ? <Badge variant="destructive">Withdrawn</Badge> : <Badge variant={details.uscfStatus === 'current' ? 'default' : 'secondary'} className={details.uscfStatus === 'current' ? 'bg-green-600' : ''}>{details.uscfStatus.charAt(0).toUpperCase() + details.uscfStatus.slice(1)}</Badge>}
                            {isWithdrawn && details.withdrawnAt && <span className="text-xs block text-muted-foreground">on {format(new Date(details.withdrawnAt), 'MM/dd, p')} by {details.withdrawnBy}</span>}
                            </TableCell>
                            <TableCell className={cn(isWithdrawn && "text-muted-foreground")}>
                            {sponsorProfile?.role === 'organizer' && !isWithdrawn ? (
                                <div className="flex gap-2">
                                    <Select
                                        value={details.byes.round1}
                                        onValueChange={(value) => handleByeChange(conf.id, playerId, 'round1', value)}
                                        disabled={!eventDetails || isWithdrawn}
                                    >
                                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Bye</SelectItem>
                                            {eventDetails && Array.from({ length: eventDetails.rounds }).map((_, i) => (
                                                <SelectItem key={i + 1} value={String(i + 1)}>Round {i + 1}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={details.byes.round2}
                                        onValueChange={(value) => handleByeChange(conf.id, playerId, 'round2', value)}
                                        disabled={!eventDetails || details.byes.round1 === 'none' || isWithdrawn}
                                    >
                                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Bye</SelectItem>
                                            {eventDetails && Array.from({ length: eventDetails.rounds }).map((_, i) => (
                                                details.byes.round1 !== String(i + 1) && <SelectItem key={i + 1} value={String(i + 1)}>Round {i + 1}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                [details.byes.round1, details.byes.round2].filter(b => b !== 'none').map(b => `R${b}`).join(', ') || 'None'
                            )}
                            </TableCell>
                            {sponsorProfile?.role === 'organizer' && (
                            <TableCell className='text-right'>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenEditPlayerDialog(player)}>
                                <FilePenLine className="h-4 w-4" />
                                <span className='sr-only'>Edit Player</span>
                                </Button>
                            </TableCell>
                            )}
                        </TableRow>
                        );
                    })}
                    </TableBody>
                </Table>
                    {sponsorProfile?.role === 'organizer' && (
                        <div className="flex justify-end pt-2 gap-2">
                            {hasWithdrawnPlayers && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setChangeAlertContent({
                                            title: `Restore ${selectedRestoreIds.length} Player(s)?`,
                                            description: `This action will recreate the invoice to add back the selected players and update the total amount due. The original invoice will be canceled. This cannot be undone.`
                                        });
                                        setChangeAction(() => () => handlePlayerStatusChangeAction(conf.id, selectedRestoreIds, 'active'));
                                        setIsChangeAlertOpen(true);
                                    }}
                                    disabled={isLoading || selectedRestoreIds.length === 0}
                                >
                                    <UserPlus className="mr-2 h-4 w-4" /> Restore Selected & Recreate Invoice ({selectedRestoreIds.length})
                                </Button>
                            )}
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    setChangeAlertContent({
                                        title: `Withdraw ${selectedWithdrawalIds.length} Player(s)?`,
                                        description: `This action will recreate the invoice to remove the selected players and update the total amount due. The original invoice will be canceled. This cannot be undone.`
                                    });
                                    setChangeAction(() => () => handlePlayerStatusChangeAction(conf.id, selectedWithdrawalIds, 'withdrawn'));
                                    setIsChangeAlertOpen(true);
                                }}
                                disabled={isLoading || selectedWithdrawalIds.length === 0}
                            >
                                <UserMinus className="mr-2 h-4 w-4" /> Withdraw Selected & Recreate Invoice ({selectedWithdrawalIds.length})
                            </Button>
                        </div>
                    )}
            </div>
            
            {previousVersion && (
                <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed opacity-75">
                    <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Previous Version (Canceled Invoice #{previousVersion.invoiceNumber})
                    </h4>
                    <Table className="mt-2">
                        <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Section</TableHead><TableHead>USCF Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {Object.entries(previousVersion.selections).map(([playerId, details]: [string, any]) => {
                            const player = getPlayerById(playerId);
                            return (
                                <TableRow key={playerId} className={details.status === 'withdrawn' ? 'text-muted-foreground line-through' : ''}>
                                    <TableCell>{player ? `${player.firstName} ${player.lastName}` : 'Unknown Player'}</TableCell>
                                    <TableCell>{details.section}</TableCell>
                                    <TableCell>{details.uscfStatus}</TableCell>
                                </TableRow>
                            );
                        })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {currentStatus?.status === 'COMPED' ? (
            <Alert variant="default" className="mt-6 bg-sky-50 border-sky-200"><Award className="h-4 w-4 text-sky-600" /><AlertTitle className="text-sky-800">Complimentary Registration</AlertTitle><AlertDescription className="text-sky-700">This registration was completed at no charge. No payment is required.</AlertDescription></Alert> ) : (
            <div className="space-y-6 pt-6 mt-6 border-t">
                <h4 className="font-semibold">Payment Information</h4>
                <RadioGroup value={selectedMethod} onValueChange={(value) => handleInputChange(conf.id, 'paymentMethod', value as PaymentMethod)} className="grid grid-cols-2 md:grid-cols-4 gap-4" disabled={isLoading}>
                    <div><RadioGroupItem value="po" id={`po-${conf.id}`} className="peer sr-only" /><Label htmlFor={`po-${conf.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Purchase Order</Label></div>
                    <div><RadioGroupItem value="check" id={`check-${conf.id}`} className="peer sr-only" /><Label htmlFor={`check-${conf.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Pay with Check</Label></div>
                    <div><RadioGroupItem value="cashapp" id={`cashapp-${conf.id}`} className="peer sr-only" /><Label htmlFor={`cashapp-${conf.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Cash App</Label></div>
                    <div><RadioGroupItem value="zelle" id={`zelle-${conf.id}`} className="peer sr-only" /><Label htmlFor={`zelle-${conf.id}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Zelle</Label></div>
                </RadioGroup>
                {selectedMethod === 'po' && ( <div className="grid md:grid-cols-2 gap-4 items-start"><div className="space-y-2"><Label htmlFor={`po-number-${conf.id}`}>PO Number</Label><Input id={`po-number-${conf.id}`} placeholder="Enter PO Number" value={currentInputs.poNumber || ''} onChange={(e) => handleInputChange(conf.id, 'poNumber', e.target.value)} disabled={isLoading} /></div><div className="space-y-2"><Label htmlFor={`po-file-${conf.id}`}>Upload PO Document</Label><Input id={`po-file-${conf.id}`} type="file" onChange={(e) => handleFileChange(conf.id, e)} disabled={isLoading} />{currentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {currentInputs.file.name}</span></div> ) : currentInputs.paymentFileUrl && currentInputs.paymentMethod === 'po' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={currentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {currentInputs.paymentFileName}</a></Button></div> ) : null }</div></div> )}
                {selectedMethod === 'check' && ( <div className="grid md:grid-cols-3 gap-4 items-start"><div className="space-y-2"><Label htmlFor={`check-number-${conf.id}`}>Check Number</Label><Input id={`check-number-${conf.id}`} placeholder="Enter Check Number" value={currentInputs.checkNumber || ''} onChange={(e) => handleInputChange(conf.id, 'checkNumber', e.target.value)} disabled={isLoading} /></div><div className="space-y-2"><Label htmlFor={`check-amount-${conf.id}`}>Check Amount</Label><Input id={`check-amount-${conf.id}`} type="number" placeholder={conf.totalInvoiced.toFixed(2)} value={currentInputs.amountPaid || ''} onChange={(e) => handleInputChange(conf.id, 'amountPaid', e.target.value)} disabled={isLoading} /></div><div className="space-y-2"><Label>Check Date</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal",!currentInputs.checkDate && "text-muted-foreground")} disabled={isLoading}><CalendarIcon className="mr-2 h-4 w-4" />{currentInputs.checkDate ? format(currentInputs.checkDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={currentInputs.checkDate} onSelect={(date) => handleInputChange(conf.id, 'checkDate', date)} initialFocus captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 5} toYear={new Date().getFullYear() + 5} /></PopoverContent></Popover></div></div> )}
                {selectedMethod === 'cashapp' && ( <div className="p-4 rounded-md border bg-muted/50 space-y-4"><div className="flex flex-col sm:flex-row gap-4 items-center"><div><p className="font-semibold">Pay via Cash App</p><p className="text-sm text-muted-foreground">Scan the QR code and enter the total amount due. Upload a screenshot of the confirmation.</p><p className="font-bold text-lg mt-1">$DKChess</p></div><a href="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" target="_blank" rel="noopener noreferrer"><Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" alt="CashApp QR Code" width={100} height={100} className="rounded-md transition-transform duration-200 ease-in-out hover:scale-125" data-ai-hint="QR code" /></a></div><div className="grid md:grid-cols-2 gap-4 items-start"><div className="space-y-2"><Label htmlFor={`cashapp-amount-${conf.id}`}>Amount Paid</Label><Input id={`cashapp-amount-${conf.id}`} type="number" placeholder={conf.totalInvoiced.toFixed(2)} value={currentInputs.amountPaid || ''} onChange={(e) => handleInputChange(conf.id, 'amountPaid', e.target.value)} disabled={isLoading} /></div><div className="space-y-2"><Label htmlFor={`cashapp-file-${conf.id}`}>Upload Confirmation Screenshot</Label><Input id={`cashapp-file-${conf.id}`} type="file" accept="image/*" onChange={(e) => handleFileChange(conf.id, e)} disabled={isLoading} />{currentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {currentInputs.file.name}</span></div> ) : currentInputs.paymentFileUrl && currentInputs.paymentMethod === 'cashapp' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={currentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {currentInputs.paymentFileName}</a></Button></div> ) : null }</div></div></div> )}
                {selectedMethod === 'zelle' && ( <div className="p-4 rounded-md border bg-muted/50 space-y-4"><div className="flex flex-col sm:flex-row gap-4 items-center"><div><p className="font-semibold">Pay via Zelle</p><p className="text-sm text-muted-foreground">Scan the QR code or use the phone number to send the total amount due. Upload a screenshot of the confirmation.</p><p className="font-bold text-lg mt-1">956-289-3418</p></div><a href="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" target="_blank" rel="noopener noreferrer"><Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" alt="Zelle QR Code" width={100} height={100} className="rounded-md transition-transform duration-200 ease-in-out hover:scale-125" data-ai-hint="QR code" /></a></div><div className="grid md:grid-cols-2 gap-4 items-start"><div className="space-y-2"><Label htmlFor={`zelle-amount-${conf.id}`}>Amount Paid</Label><Input id={`zelle-amount-${conf.id}`} type="number" placeholder={conf.totalInvoiced.toFixed(2)} value={currentInputs.amountPaid || ''} onChange={(e) => handleInputChange(conf.id, 'amountPaid', e.target.value)} disabled={isLoading} /></div><div className="space-y-2"><Label htmlFor={`zelle-file-${conf.id}`}>Upload Confirmation Screenshot</Label><Input id={`zelle-file-${conf.id}`} type="file" accept="image/*" onChange={(e) => handleFileChange(conf.id, e)} disabled={isLoading} />{currentInputs.file ? ( <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1"> <FileIcon className="h-4 w-4" /> <span>Selected: {currentInputs.file.name}</span></div> ) : currentInputs.paymentFileUrl && currentInputs.paymentMethod === 'zelle' ? ( <div className="pt-1"> <Button asChild variant="link" className="p-0 h-auto"> <a href={currentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer"> <Download className="mr-2 h-4 w-4" /> View {currentInputs.paymentFileName}</a></Button></div> ) : null }</div></div></div> )}
                <Button onClick={() => handleSavePayment(conf)} disabled={isLoading}>
                    {isLoading ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<UploadCloud className="mr-2 h-4 w-4" />)}
                    {isLoading ? 'Saving...' : !isAuthReady ? 'Authenticating...' : 'Save Payment & Update Invoice'}
                </Button>
            </div>
            )}
        </div>
    );
}
