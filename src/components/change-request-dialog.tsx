
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMasterDb, type MasterPlayer } from "@/context/master-db-context";
import { type SponsorProfile } from "@/hooks/use-sponsor-profile";
import { type ChangeRequest } from '@/lib/data/requests-data';
import { Loader2 } from 'lucide-react';

interface ChangeRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  profile: SponsorProfile;
  onRequestCreated: () => void;
}

export function ChangeRequestDialog({ isOpen, onOpenChange, profile, onRequestCreated }: ChangeRequestDialogProps) {
  const { toast } = useToast();
  const { database: masterDb } = useMasterDb();
  
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [selectedConfirmationId, setSelectedConfirmationId] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [requestType, setRequestType] = useState<string>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const allConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
      const sponsorConfirmations = allConfirmations.filter((c: any) => 
        c.schoolName === profile.school && c.district === profile.district
      );
      setConfirmations(sponsorConfirmations);
    } else {
      // Reset form on close
      setSelectedConfirmationId('');
      setSelectedPlayerId('');
      setRequestType('');
      setDetails('');
    }
  }, [isOpen, profile.school, profile.district]);

  const availablePlayers = useMemo(() => {
    if (!selectedConfirmationId) return [];
    const conf = confirmations.find(c => c.id === selectedConfirmationId);
    if (!conf || !conf.selections) return [];
    
    return Object.keys(conf.selections).map(playerId => {
      const player = masterDb.find(p => p.id === playerId);
      return player || { id: playerId, firstName: 'Unknown', lastName: 'Player' };
    }).filter(Boolean) as MasterPlayer[];
  }, [selectedConfirmationId, confirmations, masterDb]);

  const handleSubmit = () => {
    if (!selectedConfirmationId || !selectedPlayerId || !requestType) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill out all fields.' });
      return;
    }
    setIsSubmitting(true);

    const confirmation = confirmations.find(c => c.id === selectedConfirmationId);
    const player = availablePlayers.find(p => p.id === selectedPlayerId);
    if (!confirmation || !player) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected registration or player.' });
      setIsSubmitting(false);
      return;
    }
    
    const newRequest: ChangeRequest = {
        id: `req-${Date.now()}`,
        confirmationId: confirmation.id,
        player: `${player.firstName} ${player.lastName}`,
        event: confirmation.eventName,
        eventDate: confirmation.eventDate,
        type: requestType,
        details,
        submitted: new Date().toISOString(),
        submittedBy: `${profile.firstName} ${profile.lastName}`,
        status: 'Pending',
    };

    const allRequests = JSON.parse(localStorage.getItem('change_requests') || '[]');
    allRequests.push(newRequest);
    localStorage.setItem('change_requests', JSON.stringify(allRequests));

    toast({ title: 'Request Submitted', description: 'Your change request has been sent for review.' });
    
    setIsSubmitting(false);
    onOpenChange(false);
    onRequestCreated();
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make a Change Request</DialogTitle>
          <DialogDescription>
            Select a registration and describe the change you need.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirmation-select">Select Registration</Label>
            <Select value={selectedConfirmationId} onValueChange={setSelectedConfirmationId}>
              <SelectTrigger id="confirmation-select">
                <SelectValue placeholder="Choose an event registration..." />
              </SelectTrigger>
              <SelectContent>
                {confirmations.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.eventName} - Invoice #{c.invoiceNumber || c.id.slice(-6)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {availablePlayers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="player-select">Select Player</Label>
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger id="player-select">
                  <SelectValue placeholder="Choose a player..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="request-type-select">Request Type</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger id="request-type-select">
                <SelectValue placeholder="Choose request type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Withdrawal">Withdrawal</SelectItem>
                <SelectItem value="Substitution">Substitution</SelectItem>
                <SelectItem value="Section Change">Section Change</SelectItem>
                <SelectItem value="Bye Request">Bye Request</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details-textarea">Details</Label>
            <Textarea
              id="details-textarea"
              placeholder="Provide details for your request (e.g., 'Substitute with John Doe, USCF ID: 12345')."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
