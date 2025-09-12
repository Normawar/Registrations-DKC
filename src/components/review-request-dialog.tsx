
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { type SponsorProfile } from "@/hooks/use-sponsor-profile";
import { type ChangeRequest } from '@/lib/data/requests-data';
import { Loader2 } from 'lucide-react';
import { useEvents } from '@/hooks/use-events';
import { format } from 'date-fns';
import { processBatchedRequests } from '@/ai/flows/process-batched-requests-flow';

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
        await handleProcessRequest();
      } else {
        const requestRef = doc(db, 'requests', request.id);
        await updateDoc(requestRef, {
          status: decision,
          approvedBy: `${profile.firstName} ${profile.lastName}`,
          approvedAt: new Date().toISOString(),
        });
        toast({ title: `Request ${decision}`, description: `The change request has been ${decision.toLowerCase()}.` });
      }
      
      onRequestUpdated();
      onOpenChange(false);

    } catch (error) {
      console.error('Error processing request:', error);
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to process the request.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleProcessRequest = async () => {
    const eventDetails = events.find(e => e.id === originalConfirmation.eventId);
    if (!eventDetails) throw new Error('Original event not found.');
    
    let playerToAdd;
    if (request.type === 'Substitution') {
      const detailsMatch = request.details?.match(/with (.*)/);
      const newPlayerName = detailsMatch ? detailsMatch[1].trim() : null;
      if (newPlayerName) {
        const newPlayer = allPlayers.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === newPlayerName.toLowerCase());
        if (newPlayer) {
          playerToAdd = {
            id: newPlayer.id,
            firstName: newPlayer.firstName,
            lastName: newPlayer.lastName,
            uscfId: newPlayer.uscfId,
            section: newPlayer.section || 'High School K-12',
            uscfStatus: 'current',
            studentType: newPlayer.studentType,
          };
        }
      }
    }

    const result = await processBatchedRequests({
      confirmationId: originalConfirmation.id,
      requests: [{
        requestId: request.id,
        type: request.type as 'Withdrawal' | 'Substitution',
        playerNameToRemove: request.player,
        playerToAdd: playerToAdd
      }],
      event: {
        regularFee: eventDetails.regularFee,
        lateFee: eventDetails.lateFee,
        uscfFee: 24,
      }
    });

    if (result.success) {
      toast({ title: "Request Approved & Invoice Updated", description: result.message });
    } else {
      throw new Error(result.message);
    }
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
