
'use client';

import { useState, useEffect, type ReactNode, useMemo, useCallback } from 'react';
import { format, differenceInHours, isSameDay } from 'date-fns';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ClipboardCheck, ExternalLink, UploadCloud, File as FileIcon, Loader2, Download, CalendarIcon, RefreshCw, Info, Award, MessageSquarePlus, UserMinus, UserPlus } from "lucide-react";
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
import { rebuildInvoiceFromRoster } from '@/ai/flows/rebuild-invoice-from-roster-flow';
import { useMasterDb } from '@/context/master-db-context';
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


type PlayerRegistration = {
  byes: {
    round1: string;
    round2: string;
  };
  section: string;
  uscfStatus: 'current' | 'new' | 'renewing';
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

export default function ConfirmationsPage() {
  const { toast } = useToast();
  const { profile: sponsorProfile } = useSponsorProfile();
  const { database: allPlayers, isDbLoaded: isPlayersLoaded } = useMasterDb();
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

  
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [confToRequestChange, setConfToRequestChange] = useState<Confirmation | null>(null);
  const [changeRequestInputs, setChangeRequestInputs] = useState<Partial<ChangeRequestInputs>>({});

  const [openAccordionItem, setOpenAccordionItem] = useState<string | undefined>(undefined);
  
  const [isAddPlayerDialogOpen, setIsAddPlayerDialogOpen] = useState(false);
  const [confToAddPlayer, setConfToAddPlayer] = useState<Confirmation | null>(null);
  const [playersToAdd, setPlayersToAdd] = useState<string[]>([]);
  const [isCreatingAddonInvoice, setIsCreatingAddonInvoice] = useState(false);

  const playersMap = useMemo(() => {
    return new Map(allPlayers.map(p => [p.id, p]));
  }, [allPlayers]);

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
          const { status } = await getInvoiceStatus({ invoiceId });
          setStatuses(prev => ({ ...prev, [confId]: { status, isLoading: false } }));
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
      storedConfirmations.sort((a: Confirmation, b: Confirmation) => new Date(b.submissionTimestamp).getTime() - new Date(a.submissionTimestamp).getTime());
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
      setOpenAccordionItem(hashId);
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

   const handleWithdrawPlayerAction = async (confId: string, playerIds: string[]) => {
    if (!sponsorProfile) return;

    const originalConfirmation = confirmations.find(c => c.id === confId);
    if (!originalConfirmation || !originalConfirmation.invoiceId) {
        toast({ variant: "destructive", title: "Error", description: "Could not find original confirmation or invoice ID." });
        return;
    }

    setIsUpdating(prev => ({ ...prev, [confId]: true }));
    setIsChangeAlertOpen(false);
    
    const remainingPlayerIds = Object.keys(originalConfirmation.selections).filter(id => !playerIds.includes(id));
    const eventDetails = events.find(e => e.id === originalConfirmation.eventId);

    if (!eventDetails) {
        toast({ variant: "destructive", title: "Event Error", description: "Could not find event details to rebuild invoice." });
        setIsUpdating(prev => ({ ...prev, [confId]: false }));
        return;
    }

    const eventDate = new Date(eventDetails.date);
    let registrationFeePerPlayer = eventDetails.regularFee;
    const now = new Date();
    if (isSameDay(eventDate, now)) { registrationFeePerPlayer = eventDetails.dayOfFee; }
    else { const hoursUntilEvent = differenceInHours(eventDate, now); if (hoursUntilEvent <= 24) { registrationFeePerPlayer = eventDetails.veryLateFee; } else if (hoursUntilEvent <= 48) { registrationFeePerPlayer = eventDetails.lateFee; } }

    const updatedPlayersForInvoice = remainingPlayerIds.map(id => {
        const player = getPlayerById(id)!;
        const registrationDetails = originalConfirmation.selections[id];
        const lateFeeAmount = registrationFeePerPlayer - eventDetails.regularFee;
        return {
            playerName: `${player.firstName} ${player.lastName}`,
            uscfId: player.uscfId,
            baseRegistrationFee: eventDetails.regularFee,
            lateFee: lateFeeAmount > 0 ? lateFeeAmount : 0,
            uscfAction: registrationDetails.uscfStatus !== 'current',
        };
    });
    
    try {
        const result = await rebuildInvoiceFromRoster({
            invoiceId: originalConfirmation.invoiceId,
            sponsorName: `${sponsorProfile.firstName} ${sponsorProfile.lastName}`,
            sponsorEmail: sponsorProfile.email,
            schoolName: sponsorProfile.school,
            teamCode: originalConfirmation.teamCode,
            eventName: originalConfirmation.eventName,
            eventDate: originalConfirmation.eventDate,
            uscfFee: 24,
            players: updatedPlayersForInvoice
        });

      const updatedConfirmations = confirmations.map(c => {
        if (c.id === confId) {
          const newSelections = { ...c.selections };
          playerIds.forEach(id => delete newSelections[id]);
          return { ...c, selections: newSelections, invoiceUrl: result.invoiceUrl, totalInvoiced: result.totalAmount };
        }
        return c;
      });
      localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
      
      const withdrawnPlayerNames = playerIds.map(id => {
          const p = getPlayerById(id);
          return p ? `${p.firstName} ${p.lastName}` : 'Unknown Player';
      });

      const initials = `${sponsorProfile.firstName.charAt(0)}${sponsorProfile.lastName.charAt(0)}`;
      const approvalTimestamp = new Date().toISOString();
      const updatedRequests = changeRequests.map(req => {
        if (req.confirmationId === confId && withdrawnPlayerNames.includes(req.player) && req.type.includes('Withdraw')) {
          return { ...req, status: 'Approved' as const, approvedBy: initials, approvedAt: approvalTimestamp };
        }
        return req;
      });
      localStorage.setItem('change_requests', JSON.stringify(updatedRequests));
      
      loadAllData();
      window.dispatchEvent(new Event('storage'));

      toast({
        title: "Player(s) Withdrawn",
        description: `${withdrawnPlayerNames.join(', ')} has/have been removed and the invoice has been updated.`
      });

    } catch (error) {
      console.error("Failed to withdraw player(s):", error);
      const description = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: "destructive", title: "Withdrawal Failed", description });
    } finally {
      setIsUpdating(prev => ({ ...prev, [confId]: false }));
      setSelectedPlayersForWithdraw(prev => ({...prev, [confId]: [] }));
    }
  };
  
  const handleOpenRequestDialog = (conf: Confirmation) => {
    setConfToRequestChange(conf);
    setChangeRequestInputs({ requestType: '' });
    setIsRequestDialogOpen(true);
  };
  
  const handleByeChangeAction = (confId: string, playerId: string, newByes: { round1: string; round2: string }) => {
    setIsChangeAlertOpen(false);
    setIsUpdating(prev => ({ ...prev, [confId]: true }));
    const player = getPlayerById(playerId);

    const newConfirmations = confirmations.map(conf => {
        if (conf.id === confId) {
            const newSelections = JSON.parse(JSON.stringify(conf.selections));
            if (newSelections[playerId]) {
                newSelections[playerId].byes = newByes;
            }
            return { ...conf, selections: newSelections };
        }
        return conf;
    });
    localStorage.setItem('confirmations', JSON.stringify(newConfirmations));
    setConfirmations(newConfirmations);
    
    if (sponsorProfile?.role === 'organizer' && player) {
        const initials = `${sponsorProfile.firstName.charAt(0)}${sponsorProfile.lastName.charAt(0)}`;
        const approvalTimestamp = new Date().toISOString();

        const updatedRequests = changeRequests.map(req => {
            if (req.confirmationId === confId && req.player === `${player.firstName} ${player.lastName}` && req.type === 'Bye Request') {
                return { ...req, status: 'Approved' as const, approvedBy: initials, approvedAt: approvalTimestamp };
            }
            return req;
        });
        localStorage.setItem('change_requests', JSON.stringify(updatedRequests));
        setChangeRequests(updatedRequests);
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
        player: player ? `${player.firstName} ${player.lastName}` : 'Unknown Player',
        event: confToRequestChange.eventName,
        type: changeRequestInputs.requestType,
        details: changeRequestInputs.details || '',
        submitted: new Date().toISOString(),
        status: 'Pending',
    };
    
    // If organizer, auto-approve and perform action
    if (sponsorProfile.role === 'organizer') {
        const actionMap: Record<string, { title: string; description: string; action: () => void }> = {
            'Withdraw Player': {
                title: `Withdraw ${newRequest.player}?`,
                description: `This will remove ${newRequest.player} from the registration for "${newRequest.event}" and update the invoice. This action cannot be undone.`,
                action: () => handleWithdrawPlayerAction(newRequest.confirmationId, [changeRequestInputs.playerId!])
            },
            'Bye Request': {
                title: `Update Byes for ${newRequest.player}?`,
                description: `This will update the bye requests for ${newRequest.player}. This change will not affect the invoice.`,
                action: () => handleByeChangeAction(newRequest.confirmationId, changeRequestInputs.playerId!, { round1: changeRequestInputs.byeRound1 || 'none', round2: changeRequestInputs.byeRound2 || 'none' })
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
      // If sponsor, just submit the request
      const updatedRequests = [newRequest, ...changeRequests];
      setChangeRequests(updatedRequests);
      localStorage.setItem('change_requests', JSON.stringify(updatedRequests));
      toast({ title: 'Request Submitted', description: 'Your change request has been sent to the organizer for review.' });
    }

    setIsRequestDialogOpen(false);
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

        // This logic should be identical to the one in `events/page.tsx`
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
                 byes: { round1: 'none', round2: 'none' }, // Default byes
                 section: p.section, // Assume section is correct on player profile
                 uscfStatus: p.uscfId.toUpperCase() === 'NEW' ? 'new' : isExpired ? 'renewing' : 'current'
             }
        });

        // Add to original confirmation in local storage
        const updatedConfirmations = confirmations.map(c => {
            if (c.id === confToAddPlayer.id) {
                return { ...c, selections: { ...c.selections, ...newSelections } };
            }
            return c;
        });
        
        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
        loadAllData(); // Reload all data to reflect the change

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
            <CardTitle>Submission History</CardTitle>
            <CardDescription>Click on a submission to view its details.</CardDescription>
          </CardHeader>
          <CardContent>
            {confirmations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <ClipboardCheck className="h-12 w-12" />
                <p className="font-semibold">No Confirmations Yet</p>
                <p className="text-sm">When you register for an event, a confirmation will appear here.</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full" value={openAccordionItem} onValueChange={setOpenAccordionItem}>
                {confirmations.map((conf) => {
                  const currentInputs = confInputs[conf.id] || {};
                  const selectedMethod = currentInputs.paymentMethod || 'po';
                  const currentStatus = statuses[conf.id];
                  const isLoading = isUpdating[conf.id] || !isAuthReady;
                  const selectedWithdrawalIds = selectedPlayersForWithdraw[conf.id] || [];

                  return (
                  <AccordionItem key={conf.id} value={conf.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between items-center w-full pr-4">
                        <div className="flex flex-col items-start text-left">
                          <span className="font-semibold">{conf.eventName}</span>
                          <span className="text-sm text-muted-foreground"> Submitted on: {format(new Date(conf.submissionTimestamp), 'PPP p')} </span>
                        </div>
                        <div className="flex items-center gap-4">
                            {currentStatus && ( <Badge variant="default" className={cn('capitalize w-28 justify-center', getStatusBadgeVariant(currentStatus.status))}>
                                    {currentStatus.isLoading && currentStatus.status === 'LOADING' ? 'Loading...' : currentStatus.status?.replace(/_/g, ' ').toLowerCase() || 'Unknown'}
                                </Badge>
                            )}
                            <div className="text-right">
                                <span className="font-semibold">${conf.totalInvoiced.toFixed(2)}</span>
                                <span className="text-sm text-muted-foreground block"> {Object.keys(conf.selections).length} Player(s) </span>
                            </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <h4 className="font-semibold">Registered Players ({Object.keys(conf.selections).length})</h4>
                            <div className="flex items-center gap-2">
                                {sponsorProfile?.role === 'sponsor' && <Button variant="secondary" size="sm" onClick={() => handleOpenAddPlayerDialog(conf)} disabled={isLoading}> <UserPlus className="mr-2 h-4 w-4" /> Add Player </Button>}
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
                              <TableHead>Player</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead>USCF Status</TableHead>
                              <TableHead>Byes Requested</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(conf.selections).map(([playerId, details]) => {
                              const player = getPlayerById(playerId);
                              if (!player) return null;
                              
                              const relevantRequests = changeRequests.filter(req => req.confirmationId === conf.id && req.player === `${player.firstName} ${player.lastName}`);
                              const latestRequest = relevantRequests.length > 0 ? relevantRequests[0] : null;
                              
                              return (
                                <TableRow key={playerId} data-state={selectedWithdrawalIds.includes(playerId) ? 'selected' : undefined}>
                                  {sponsorProfile?.role === 'organizer' && (
                                      <TableCell>
                                          <Checkbox
                                              checked={selectedWithdrawalIds.includes(playerId)}
                                              onCheckedChange={() => handleWithdrawPlayerSelect(conf.id, playerId)}
                                              aria-label={`Select ${player.firstName} ${player.lastName} for withdrawal`}
                                              disabled={isLoading || !conf.invoiceId}
                                          />
                                      </TableCell>
                                  )}
                                  <TableCell className="font-medium flex items-center gap-2">
                                    {player.firstName} {player.lastName}
                                    {latestRequest && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Info className="h-4 w-4 text-blue-500" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                              <p className="font-semibold">{latestRequest.type} - {latestRequest.status}</p>
                                              {latestRequest.details && <p className="italic text-muted-foreground">"{latestRequest.details}"</p>}
                                              <p className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                                                  Submitted: {format(new Date(latestRequest.submitted), 'MM/dd/yy, p')}
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
                                  <TableCell>{details.section}</TableCell>
                                  <TableCell><Badge variant={details.uscfStatus === 'current' ? 'default' : 'secondary'} className={details.uscfStatus === 'current' ? 'bg-green-600' : ''}>{details.uscfStatus.charAt(0).toUpperCase() + details.uscfStatus.slice(1)}</Badge></TableCell>
                                  <TableCell>
                                    {[details.byes.round1, details.byes.round2].filter(b => b !== 'none').map(b => `R${b}`).join(', ') || 'None'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                         {sponsorProfile?.role === 'organizer' && (
                              <div className="flex justify-end pt-2">
                                  <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                          setChangeAlertContent({
                                              title: `Withdraw ${selectedWithdrawalIds.length} Player(s)?`,
                                              description: `This will remove the selected player(s) and update the invoice. This action cannot be undone.`
                                          });
                                          setChangeAction(() => () => handleWithdrawPlayerAction(conf.id, selectedWithdrawalIds));
                                          setIsChangeAlertOpen(true);
                                      }}
                                      disabled={isLoading || !conf.invoiceId || selectedWithdrawalIds.length === 0}
                                  >
                                      <UserMinus className="mr-2 h-4 w-4" /> Withdraw Selected ({selectedWithdrawalIds.length})
                                  </Button>
                              </div>
                          )}
                      </div>
                      
                      {currentStatus?.status === 'COMPED' ? (
                        <Alert variant="default" className="mt-6 bg-sky-50 border-sky-200"><Award className="h-4 w-4 text-sky-600" /><AlertTitle className="text-sky-800">Complimentary Registration</AlertTitle><AlertDescription className="text-sky-700">This registration was completed at no charge. No payment is required.</AlertDescription></Alert>
                      ) : (
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
                    </AccordionContent>
                  </AccordionItem>
                )})}
              </Accordion>
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

      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}><DialogContent><DialogHeader><DialogTitle>Request a Change</DialogTitle><DialogDescription>Submit a request to the tournament organizer regarding this registration for "{confToRequestChange?.eventName}".</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label htmlFor="request-player">Player</Label><Select value={changeRequestInputs.playerId} onValueChange={(value) => setChangeRequestInputs(prev => ({...prev, playerId: value, requestType: ''}))}><SelectTrigger id="request-player"><SelectValue placeholder="Select a player..." /></SelectTrigger><SelectContent>{confToRequestChange && Object.keys(confToRequestChange.selections).map(playerId => { const player = getPlayerById(playerId); return player ? <SelectItem key={playerId} value={playerId}>{player.firstName} {player.lastName}</SelectItem> : null; })}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="request-type">Request Type</Label><Select value={changeRequestInputs.requestType} onValueChange={(value) => setChangeRequestInputs(prev => ({...prev, requestType: value}))}><SelectTrigger id="request-type"><SelectValue placeholder="Select a request type..." /></SelectTrigger><SelectContent><SelectItem value="Withdraw Player">Withdraw Player</SelectItem><SelectItem value="Section Change">Section Change</SelectItem><SelectItem value="Bye Request">Bye Request</SelectItem><SelectItem value="Other">Other (Note)</SelectItem></SelectContent></Select></div>
      
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
    </AppLayout>
  );
}
