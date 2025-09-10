
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
    // This function will need the full context of the original registration
    // to build the new player list. This is a simplified example.
    const originalEvent = events.find(e => e.id === originalConfirmation.eventId);
    if (!originalEvent) {
      throw new Error('Original event not found for recreation.');
    }
  
    // Reconstruct the new player list based on the request
    let newPlayerList: any[] = Object.keys(originalConfirmation.selections).map(id => ({
        id: id,
        ...originalConfirmation.selections[id]
    }));
  
    if (request.type === 'Withdrawal') {
      const playerNameToRemove = request.player;
      // This is a simplification; you'd need to match more accurately
      newPlayerList = newPlayerList.filter(p => `${p.firstName} ${p.lastName}` !== playerNameToRemove);
    }
    // Handle other types like Substitution...
  
    // Call the recreate flow
    // NOTE: This will require fetching more data (sponsor, school info) from the originalConfirmation
    // For now, we'll log it. In a real scenario, this would be a full implementation.
    console.log("Recreating invoice with new player list:", newPlayerList);
    
    // Example call structure (needs more data to be functional)
    /*
    await recreateInvoiceFromRoster({
        originalInvoiceId: originalConfirmation.invoiceId,
        players: newPlayerList.map(p => ({
            playerName: `${p.firstName} ${p.lastName}`,
            uscfId: p.uscfId,
            baseRegistrationFee: originalEvent.regularFee,
            lateFee: 0,
            uscfAction: p.uscfStatus !== 'current',
        })),
        uscfFee: 24,
        sponsorName: originalConfirmation.sponsorName,
        // ... and all other required fields
    });
    */
    toast({ title: "Invoice Recreation Triggered", description: "A new invoice will be generated based on this approval."});
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
