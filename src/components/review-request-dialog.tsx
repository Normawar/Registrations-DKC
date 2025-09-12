'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
import { recreateInvoiceFromRoster } from '@/ai/flows/recreate-invoice-from-roster-flow';

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
      if (isOpen && request.confirmationId && db) {
        const docRef = doc(db, 'invoices', request.confirmationId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOriginalConfirmation({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.error(`Confirmation with ID ${request.confirmationId} not found.`);
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
      } else { // Handle Deny
        const requestRef = doc(db, 'requests', request.id);
        await updateDoc(requestRef, {
          status: 'Denied',
          approvedBy: `${profile.firstName} ${profile.lastName}`,
          approvedAt: new Date().toISOString(),
        });
        toast({ title: "Request Denied", description: "The change request has been marked as denied." });
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
    if (!originalConfirmation || !request || !profile) {
      throw new Error("Missing required data to process the request.");
    }
    const eventDetails = events.find(e => e.id === originalConfirmation.eventId);
    if (!eventDetails) throw new Error('Original event not found.');

    // 1. Construct the new player roster based on the request
    let newSelections = { ...(originalConfirmation.selections || {}) };
    let playerNameToRemove = request.player;
    
    if (request.type === 'Substitution') {
      const playerToRemoveId = Object.keys(newSelections).find(id => {
          const player = allPlayers.find(p => p.id === id);
          return player && `${player.firstName} ${player.lastName}`.trim().toLowerCase() === playerNameToRemove.toLowerCase();
      });
      
      const detailsMatch = request.details?.match(/with (.*)/);
      const newPlayerName = detailsMatch ? detailsMatch[1].replace(/\..*/, '').trim() : null;

      if (!playerToRemoveId || !newPlayerName) throw new Error("Could not identify players for substitution.");

      delete newSelections[playerToRemoveId];
      
      const newPlayer = allPlayers.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === newPlayerName.toLowerCase());
      if (!newPlayer) throw new Error(`Player to add "${newPlayerName}" not found in master database.`);

      newSelections[newPlayer.id] = { 
        section: newPlayer.section, 
        uscfStatus: newPlayer.uscfId.toUpperCase() === 'NEW' ? 'new' : 'current', // Simplified status
        status: 'active' 
      };

    } else if (request.type === 'Withdrawal') {
      const playerToRemoveId = Object.keys(newSelections).find(id => {
        const player = allPlayers.find(p => p.id === id);
        return player && `${player.firstName} ${player.lastName}`.trim().toLowerCase() === playerNameToRemove.toLowerCase();
      });
      if (playerToRemoveId) {
        delete newSelections[playerToRemoveId];
      } else {
        throw new Error(`Could not find player "${playerNameToRemove}" in original invoice to withdraw.`);
      }
    }
    // Note: Other request types like "Section Change" or "Bye" can be handled here by modifying `newSelections`.
    // For now, they result in a recreation with the same roster but a new invoice number.

    const newPlayerRoster = Object.keys(newSelections).map(playerId => {
        const player = allPlayers.find(p => p.id === playerId)!;
        return {
            playerName: `${player.firstName} ${player.lastName}`,
            uscfId: player.uscfId,
            baseRegistrationFee: eventDetails.regularFee,
            lateFee: 0, // Late fees could be recalculated here if needed
            uscfAction: newSelections[playerId].uscfStatus !== 'current',
            isGtPlayer: player.studentType === 'gt'
        };
    });

    // 2. Call the reliable recreate flow
    const result = await recreateInvoiceFromRoster({
        originalInvoiceId: originalConfirmation.invoiceId,
        players: newPlayerRoster,
        uscfFee: 24,
        requestingUserRole: profile.role,
        sponsorName: originalConfirmation.purchaserName,
        sponsorEmail: originalConfirmation.sponsorEmail,
        schoolName: originalConfirmation.schoolName,
        teamCode: originalConfirmation.teamCode,
        eventName: originalConfirmation.eventName,
        eventDate: originalConfirmation.eventDate,
        district: originalConfirmation.district,
    });

    // 3. Update local Firestore records
    const batch = writeBatch(db);

    // Mark old invoice as CANCELED
    const oldInvoiceRef = doc(db, 'invoices', originalConfirmation.id);
    batch.update(oldInvoiceRef, { status: 'CANCELED', invoiceStatus: 'CANCELED', notes: `Canceled and replaced by invoice ${result.newInvoiceNumber}` });
    
    // Create new invoice record
    const newInvoiceRef = doc(db, 'invoices', result.newInvoiceId);
    batch.set(newInvoiceRef, {
        ...originalConfirmation,
        id: result.newInvoiceId,
        invoiceId: result.newInvoiceId,
        invoiceNumber: result.newInvoiceNumber,
        invoiceUrl: result.newInvoiceUrl,
        status: result.newStatus,
        invoiceStatus: result.newStatus,
        totalInvoiced: result.newTotalAmount,
        selections: newSelections,
        submissionTimestamp: new Date().toISOString(),
        previousVersionId: originalConfirmation.id,
    });

    // Update the request status
    const requestRef = doc(db, 'requests', request.id);
    batch.update(requestRef, { 
      status: 'Approved',
      approvedBy: `${profile.firstName} ${profile.lastName}`,
      approvedAt: new Date().toISOString(),
      processedInBatch: result.newInvoiceId,
    });
    
    await batch.commit();

    toast({ title: "Request Approved & Invoice Updated", description: `New invoice #${result.newInvoiceNumber} has been created.` });
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
          {request.status === 'Pending' && (
            <>
              <Button variant="destructive" onClick={() => handleDecision('Denied')} disabled={isSubmitting}>Deny</Button>
              <Button onClick={() => handleDecision('Approved')} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve Request
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
