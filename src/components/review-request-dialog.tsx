
'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
import { recreateInvoiceAction } from '@/app/requests/actions';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';

interface ReviewRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  request: ChangeRequest & { schoolName?: string; invoiceNumber?: string };
  profile: SponsorProfile;
  onRequestUpdated: () => void;
}

export function ReviewRequestDialog({ isOpen, onOpenChange, request, profile, onRequestUpdated }: ReviewRequestDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalConfirmation, setOriginalConfirmation] = useState<any>(null);
  const { events } = useEvents();
  const { database: allPlayers, isDbLoaded } = useMasterDb();
  const [chargeSummary, setChargeSummary] = useState<{ credit: number; newCharges: number; netChange: number } | null>(null);
  const [waiveFees, setWaiveFees] = useState(false);

  useEffect(() => {
    const fetchConfirmation = async () => {
      if (isOpen && request.confirmationId && db) {
        const docRef = doc(db, 'invoices', request.confirmationId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const confirmationData = { id: docSnap.id, ...docSnap.data() };
          setOriginalConfirmation(confirmationData);
          calculateChargeSummary(confirmationData, request, false);
        } else {
          console.error(`Confirmation with ID ${request.confirmationId} not found.`);
        }
      } else if (!isOpen) {
        // Reset state on close
        setWaiveFees(false);
        setChargeSummary(null);
        setOriginalConfirmation(null);
      }
    };
    fetchConfirmation();
  }, [isOpen, request]);
  
  useEffect(() => {
    if(originalConfirmation && request) {
      calculateChargeSummary(originalConfirmation, request, waiveFees);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiveFees, originalConfirmation, request]);

  const calculateChargeSummary = (confirmation: any, currentRequest: ChangeRequest, shouldWaiveFees: boolean) => {
    if (!confirmation || !currentRequest) {
      setChargeSummary(null);
      return;
    }

    const eventDetails = events.find(e => e.id === confirmation.eventId);
    if (!eventDetails) return;

    let credit = 0;
    let newCharges = 0;
    const uscfFee = 24;

    const getPlayerFee = (player: MasterPlayer, selections: any) => {
      let fee = eventDetails.regularFee;
      if (selections[player.id]?.uscfStatus !== 'current') {
        fee += uscfFee;
      }
      return fee;
    };
    
    if (currentRequest.type === 'Withdrawal') {
      const playerToRemove = allPlayers.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === currentRequest.player.toLowerCase());
      if (playerToRemove && confirmation.selections[playerToRemove.id]) {
        credit = getPlayerFee(playerToRemove, confirmation.selections);
      }
    } else if (currentRequest.type === 'Substitution') {
      const playerToRemove = allPlayers.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === currentRequest.player.toLowerCase());
      if (playerToRemove && confirmation.selections[playerToRemove.id]) {
        credit = getPlayerFee(playerToRemove, confirmation.selections);
      }
      
      const detailsMatch = currentRequest.details?.match(/with (.*)/);
      const newPlayerName = detailsMatch ? detailsMatch[1].replace(/\..*/, '').trim() : null;
      const playerToAdd = allPlayers.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === newPlayerName?.toLowerCase());
      
      if (playerToAdd) {
        let charge = eventDetails.regularFee;
        if (!shouldWaiveFees) {
            // Apply late fee logic here if necessary in the future
        }
        if (playerToAdd.uscfId.toUpperCase() === 'NEW' || !playerToAdd.uscfExpiration || new Date(playerToAdd.uscfExpiration) < new Date(eventDetails.date)) {
            charge += uscfFee;
        }
        newCharges = charge;
      }
    }

    setChargeSummary({ credit, newCharges, netChange: newCharges - credit });
  };

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
    
    if (!isDbLoaded) {
      throw new Error("Master player database is not loaded yet. Please try again.");
    }

    let newSelections = { ...(originalConfirmation.selections || {}) };
    let playerNameToRemove = request.player;
    
    if (request.type === 'Substitution') {
      const playerToRemoveId = Object.keys(newSelections).find(id => {
          const player = allPlayers.find(p => p.id === id);
          if (!player) {
              console.warn(`Player with ID ${id} not found, skipping.`);
              return false;
          }
          return `${player.firstName} ${player.lastName}`.trim().toLowerCase() === playerNameToRemove.toLowerCase();
      });
      
      const detailsMatch = request.details?.match(/with (.*)/);
      const newPlayerName = detailsMatch ? detailsMatch[1].replace(/\..*/, '').trim() : null;

      if (!playerToRemoveId) {
        throw new Error(`Could not find player "${playerNameToRemove}" in current selections to substitute.`);
      }
      if (!newPlayerName) {
        throw new Error(`Could not extract replacement player name from details: "${request.details}"`);
      }

      delete newSelections[playerToRemoveId];
      
      const newPlayer = allPlayers.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === newPlayerName.toLowerCase());
      if (!newPlayer) throw new Error(`Player to add "${newPlayerName}" not found in master database.`);

      newSelections[newPlayer.id] = { 
        section: newPlayer.section, 
        uscfStatus: newPlayer.uscfId.toUpperCase() === 'NEW' ? 'new' : 'current',
        status: 'active' 
      };

    } else if (request.type === 'Withdrawal') {
      const playerToRemoveId = Object.keys(newSelections).find(id => {
        const player = allPlayers.find(p => p.id === id);
        if (!player) {
            console.warn(`Player with ID ${id} not found, skipping.`);
            return false;
        }
        return `${player.firstName} ${player.lastName}`.trim().toLowerCase() === playerNameToRemove.toLowerCase();
      });
      if (playerToRemoveId) {
        delete newSelections[playerToRemoveId];
      } else {
        throw new Error(`Could not find player "${playerNameToRemove}" in original invoice to withdraw.`);
      }
    }

    const newPlayerRoster = Object.keys(newSelections).map(playerId => {
        const player = allPlayers.find(p => p.id === playerId);
        if (!player) {
            throw new Error(`Player with ID ${playerId} not found in master database`);
        }
        return {
            playerName: `${player.firstName} ${player.lastName}`,
            uscfId: player.uscfId,
            baseRegistrationFee: eventDetails.regularFee,
            lateFee: 0,
            uscfAction: newSelections[playerId].uscfStatus !== 'current',
            isGtPlayer: player.studentType === 'gt',
            waiveLateFee: waiveFees, // Pass the waiver flag
            section: newSelections[playerId].section
        };
    });

    const actionResult = await recreateInvoiceAction({
        originalInvoiceId: originalConfirmation.invoiceId,
        players: newPlayerRoster,
        uscfFee: 24,
        requestingUserRole: 'organizer',
        sponsorName: request.submittedBy,
        sponsorEmail: originalConfirmation.sponsorEmail,
        schoolName: originalConfirmation.schoolName,
        teamCode: originalConfirmation.teamCode,
        eventName: originalConfirmation.eventName,
        eventDate: originalConfirmation.eventDate,
        revisionMessage: `Request #${request.id} processed: ${request.type} for ${request.player}`
    });

    if (!actionResult.success) {
      throw new Error(actionResult.error);
    }

    const { newInvoiceNumber } = actionResult.data;

    const requestRef = doc(db, 'requests', request.id);
    await updateDoc(requestRef, { 
      status: 'Approved',
      approvedBy: `${profile.firstName} ${profile.lastName}`,
      approvedAt: new Date().toISOString(),
    });

    toast({ title: "Request Approved & Invoice Recreated", description: `New invoice ${newInvoiceNumber} has replaced the old one.` });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Change Request</DialogTitle>
          <DialogDescription>Review the details below and approve or deny the request.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="font-semibold text-muted-foreground">Invoice #:</span> {request.invoiceNumber || 'N/A'}</div>
                <div><span className="font-semibold text-muted-foreground">School:</span> {request.schoolName || 'N/A'}</div>
                <div><span className="font-semibold text-muted-foreground">Event Date:</span> {request.eventDate ? format(new Date(request.eventDate), 'PPP') : 'N/A'}</div>
                <div><span className="font-semibold text-muted-foreground">Player:</span> {request.player}</div>
            </div>
            <div><span className="font-semibold text-muted-foreground">Request Type:</span> {request.type}</div>
            <div><span className="font-semibold text-muted-foreground">Details:</span> <p className="text-sm p-2 bg-muted rounded-md mt-1">{request.details}</p></div>
            <div><span className="font-semibold text-muted-foreground">Submitted By:</span> {request.submittedBy} on {format(new Date(request.submitted), 'PPP p')}</div>

            {chargeSummary && (
                <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold mb-2">Charge Summary</h4>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Credit for removed items:</span> <span>-${chargeSummary.credit.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>New item charges:</span> <span>+${chargeSummary.newCharges.toFixed(2)}</span></div>
                        <div className="border-t my-1"></div>
                        <div className={`flex justify-between font-bold ${chargeSummary.netChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <span>Net Change to Invoice:</span>
                            <span>{chargeSummary.netChange < 0 ? `-$${Math.abs(chargeSummary.netChange).toFixed(2)}` : `+$${chargeSummary.netChange.toFixed(2)}`}</span>
                        </div>
                    </div>
                    {chargeSummary.netChange > 0 && (
                        <div className="flex items-center space-x-2 mt-4">
                            <Checkbox id="waive-fees" checked={waiveFees} onCheckedChange={(checked) => setWaiveFees(!!checked)} />
                            <Label htmlFor="waive-fees" className="text-sm font-medium">
                                Waive Additional Fees
                            </Label>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Note: This is an estimate. The final invoice will reflect exact charges.</p>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          {request.status === 'Pending' && (
            <>
              <Button variant="destructive" onClick={() => handleDecision('Denied')} disabled={isSubmitting}>Deny</Button>
              <Button onClick={() => handleDecision('Approved')} disabled={isSubmitting || !isDbLoaded}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isDbLoaded ? 'Confirm & Process Change' : 'Loading Players...'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
