
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { type SponsorProfile } from "@/hooks/use-sponsor-profile";
import { type ChangeRequest } from '@/lib/data/requests-data';
import { Loader2 } from 'lucide-react';
import { recreateInvoiceFromRoster } from '@/ai/flows/recreate-invoice-from-roster-flow';
import { useEvents } from '@/hooks/use-events';
import { format } from 'date-fns';

interface ReviewRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  request: ChangeRequest;
  profile: SponsorProfile;
  onRequestUpdated: () => void;
}

export function ReviewRequestDialog({ isOpen, onOpenChange, request, profile, onRequestUpdated }: ReviewRequestDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalConfirmation, setOriginalConfirmation] = useState<any>(null);
  const { events } = useEvents();
  const { database: allPlayers } = useMasterDb();


  useEffect(() => {
    const fetchConfirmation = async () => {
      if (isOpen && request.confirmationId) {
        const docRef = doc(db, 'invoices', request.confirmationId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOriginalConfirmation({ id: docSnap.id, ...docSnap.data() });
        }
      }
    };
    fetchConfirmation();
  }, [isOpen, request.confirmationId]);

  const handleDecision = async (decision: 'Approved' | 'Denied') => {
    setIsSubmitting(true);
    try {
      if (decision === 'Approved' && originalConfirmation) {
        // If applicable, trigger invoice recreation
        if (request.type === 'Substitution' || request.type === 'Withdrawal') {
            await handleRecreateInvoice();
        }
      }
      
      // Update the request status
      const requestRef = doc(db, 'requests', request.id);
      await updateDoc(requestRef, {
        status: decision,
        approvedBy: `${profile.firstName} ${profile.lastName}`,
        approvedAt: new Date().toISOString(),
      });
      
      toast({ title: `Request ${decision}`, description: `The change request has been ${decision.toLowerCase()}.` });
      onRequestUpdated();
      onOpenChange(false);

    } catch (error) {
      console.error('Error processing request:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to process the request.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleRecreateInvoice = async () => {
    const originalEvent = events.find(e => e.id === originalConfirmation.eventId);
    if (!originalEvent) {
      throw new Error('Original event not found for recreation.');
    }
  
    const fullPlayerDetails = Object.keys(originalConfirmation.selections).map(id => {
        const player = allPlayers.find(p => p.id === id);
        return {
            ...player,
            ...originalConfirmation.selections[id], // Add section, uscfStatus, etc.
            id: id,
        } as MasterPlayer & { uscfStatus: string; section: string };
    });

    let newPlayerList = [...fullPlayerDetails];
  
    if (request.type === 'Withdrawal') {
      const playerNameToRemove = request.player.toLowerCase();
      newPlayerList = fullPlayerDetails.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase() !== playerNameToRemove);
    }
    
    if (request.type === 'Substitution') {
        const playerNameToRemove = request.player.toLowerCase();
        
        // This detail must come from the request form, which needs to be updated to provide the new player's ID
        const newPlayerId = request.details?.split('with ')[1]; 
        const newPlayer = allPlayers.find(p => p.id === newPlayerId);

        if (newPlayer) {
            newPlayerList = fullPlayerDetails.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase() !== playerNameToRemove);
            newPlayerList.push({ ...newPlayer, uscfStatus: 'current', section: newPlayer.section || 'High School K-12' });
        } else {
            throw new Error('New player for substitution not found in database.');
        }
    }
    
    const recreationResult = await recreateInvoiceFromRoster({
        originalInvoiceId: originalConfirmation.invoiceId,
        players: newPlayerList.map(p => ({
            playerName: `${p.firstName} ${p.lastName}`,
            uscfId: p.uscfId,
            baseRegistrationFee: originalEvent.regularFee,
            lateFee: (originalConfirmation.totalInvoiced / Object.keys(originalConfirmation.selections).length) - originalEvent.regularFee,
            uscfAction: p.uscfStatus !== 'current',
            isGtPlayer: p.studentType === 'gt'
        })),
        uscfFee: 24, // Standard USCF fee
        sponsorName: originalConfirmation.sponsorName || originalConfirmation.purchaserName,
        sponsorEmail: originalConfirmation.sponsorEmail || originalConfirmation.purchaserEmail,
        schoolName: originalConfirmation.schoolName,
        district: originalConfirmation.district,
        teamCode: originalConfirmation.teamCode,
        eventName: originalConfirmation.eventName,
        eventDate: originalConfirmation.eventDate,
        requestingUserRole: 'organizer',
        revisionMessage: `Invoice revised on ${format(new Date(), 'PPP')} to reflect: ${request.type} of ${request.player}.`,
    });

    const newConfirmationRecord = {
        id: recreationResult.newInvoiceId, 
        invoiceId: recreationResult.newInvoiceId,
        eventId: originalConfirmation.eventId,
        eventName: originalConfirmation.eventName,
        eventDate: originalConfirmation.eventDate,
        submissionTimestamp: new Date().toISOString(),
        invoiceNumber: recreationResult.newInvoiceNumber,
        invoiceUrl: recreationResult.newInvoiceUrl,
        invoiceStatus: recreationResult.newStatus,
        totalInvoiced: recreationResult.newTotalAmount,
        selections: newPlayerList.reduce((acc, p) => ({ ...acc, [p.id]: { uscfStatus: p.uscfStatus, section: p.section, status: 'active' } }), {}),
        previousVersionId: originalConfirmation.id, 
        teamCode: originalConfirmation.teamCode,
        schoolName: originalConfirmation.schoolName,
        district: originalConfirmation.district,
        sponsorName: originalConfirmation.sponsorName,
        sponsorEmail: originalConfirmation.sponsorEmail,
    };

    await setDoc(doc(db, 'invoices', recreationResult.newInvoiceId), newConfirmationRecord);
    await setDoc(doc(db, 'invoices', originalConfirmation.id), { status: 'CANCELED', invoiceStatus: 'CANCELED' }, { merge: true });

    toast({ title: "Invoice Successfully Revised", description: `New invoice #${recreationResult.newInvoiceNumber} has been created.`});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Change Request</DialogTitle>
          <DialogDescription>Review the details below and approve or deny the request.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div><span className="font-semibold">Event:</span> {request.event}</div>
            <div><span className="font-semibold">Player:</span> {request.player}</div>
            <div><span className="font-semibold">Request Type:</span> {request.type}</div>
            <div><span className="font-semibold">Details:</span> <p className="text-sm text-muted-foreground p-2 bg-muted rounded-md">{request.details}</p></div>
            <div><span className="font-semibold">Submitted By:</span> {request.submittedBy} on {format(new Date(request.submitted), 'PPP p')}</div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => handleDecision('Denied')} disabled={isSubmitting}>Deny</Button>
          <Button onClick={() => handleDecision('Approved')} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

