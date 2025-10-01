
'use client';

import { useState, useEffect, useMemo } from 'react';
import { getUserRole } from '@/lib/role-utils';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
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
import { format } from 'date-fns';

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
  
  const [playerToRemove, setPlayerToRemove] = useState<string>('');
  const [playerToAdd, setPlayerToAdd] = useState<string>('');
  const [playerForSectionChange, setPlayerForSectionChange] = useState<string>('');
  const [newSection, setNewSection] = useState<string>('');
  const [playerForBye, setPlayerForBye] = useState<string>('');
  const [byeRound, setByeRound] = useState<string>('');
  const [playerToWithdraw, setPlayerToWithdraw] = useState<string>('');

  const [requestType, setRequestType] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadConfirmations = async () => {
        if (isOpen && db && profile) {
          const invoicesCol = collection(db, 'invoices');
          const invoiceSnapshot = await getDocs(invoicesCol);
          const allConfirmations = invoiceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          console.log('Sample invoice data:', allConfirmations[0]);

          let userConfirmations: any[] = [];
          
          if (getUserRole(profile) === 'organizer') {
            userConfirmations = allConfirmations;
          } else if (getUserRole(profile) === 'district_coordinator') {
            userConfirmations = allConfirmations.filter((c: any) => c.district === profile.district);
          } else if (getUserRole(profile) === 'sponsor') {
            // A sponsor should only see invoices they personally created
            userConfirmations = allConfirmations.filter((c: any) => c.sponsorEmail === profile.email);
          } else if (getUserRole(profile) === 'individual') {
            userConfirmations = allConfirmations.filter((c: any) => c.parentEmail === profile.email);
          }
          
          setConfirmations(userConfirmations);
        } else if (!isOpen) {
          // Reset state when dialog closes
          setSelectedConfirmationId('');
          setRequestType('');
          setPlayerToRemove('');
          setPlayerToAdd('');
          setPlayerForSectionChange('');
          setNewSection('');
          setPlayerForBye('');
          setByeRound('');
          setPlayerToWithdraw('');
          setAdditionalNotes('');
        }
    };
    loadConfirmations();
  }, [isOpen, profile]);

  const selectedConfirmation = useMemo(() => {
    return confirmations.find(c => c.id === selectedConfirmationId);
  }, [selectedConfirmationId, confirmations]);

  const registeredPlayers = useMemo(() => {
    if (!selectedConfirmation || !selectedConfirmation.selections) return [];
    
    return Object.keys(selectedConfirmation.selections).map(playerId => {
      const player = masterDb.find(p => p.id === playerId);
      return player || { id: playerId, firstName: 'Unknown', lastName: 'Player' };
    }).filter(p => p && selectedConfirmation.selections[p.id]?.status !== 'withdrawn') as MasterPlayer[];
  }, [selectedConfirmation, masterDb]);

  const availableRosterPlayers = useMemo(() => {
    if (!profile) return [];
    let roster = [];
    if (getUserRole(profile) === 'organizer') {
        roster = masterDb; // Organizers can see all players
    } else if (profile.isDistrictCoordinator) {
        roster = masterDb.filter(p => p.district === profile.district);
    } else {
        roster = masterDb.filter(p => p.school === profile.school && p.district === profile.district);
    }
    const registeredIds = new Set(registeredPlayers.map(p => p.id));
    return roster.filter(p => !registeredIds.has(p.id));
  }, [masterDb, profile, registeredPlayers]);
  
  const selectedPlayerToAddDetails = useMemo(() => {
    if (!playerToAdd) return null;
    return masterDb.find(p => p.id === playerToAdd);
  }, [playerToAdd, masterDb]);

  const handleSubmit = async () => {
    if (!selectedConfirmationId || !requestType || !db) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select an event and a request type.' });
      return;
    }
    
    setIsSubmitting(true);
    let details = additionalNotes;
    let player = 'N/A';

    switch (requestType) {
        case 'Substitution':
            const removing = masterDb.find(p => p.id === playerToRemove);
            const adding = masterDb.find(p => p.id === playerToAdd);
            if (!removing || !adding) { toast({ variant: 'destructive', title: 'Error', description: 'Selected players for substitution not found.' }); setIsSubmitting(false); return; }
            details = `Substitute ${removing.firstName} ${removing.lastName} with ${adding.firstName} ${adding.lastName}. ${additionalNotes}`;
            player = `${removing.firstName} ${removing.lastName}`;
            break;
        case 'Section Change':
            const playerToChange = masterDb.find(p => p.id === playerForSectionChange);
            if (!playerToChange || !newSection) { toast({ variant: 'destructive', title: 'Error', description: 'Player or new section not selected.' }); setIsSubmitting(false); return; }
            const currentSection = selectedConfirmation.selections[playerToChange.id]?.section || 'N/A';
            details = `Change section from ${currentSection} to ${newSection}. ${additionalNotes}`;
            player = `${playerToChange.firstName} ${playerToChange.lastName}`;
            break;
        case 'Bye Request':
            const playerForByeDetails = masterDb.find(p => p.id === playerForBye);
            if (!playerForByeDetails || !byeRound) { toast({ variant: 'destructive', title: 'Error', description: 'Player or bye round not selected.'}); setIsSubmitting(false); return; }
            details = `Requesting a bye for Round ${byeRound}. ${additionalNotes}`;
            player = `${playerForByeDetails.firstName} ${playerForByeDetails.lastName}`;
            break;
        case 'Withdrawal':
            const playerToWithdrawDetails = masterDb.find(p => p.id === playerToWithdraw);
            if (!playerToWithdrawDetails) { toast({ variant: 'destructive', title: 'Error', description: 'Player to withdraw not selected.' }); setIsSubmitting(false); return; }
            details = `Requesting to withdraw player from event. ${additionalNotes}`;
            player = `${playerToWithdrawDetails.firstName} ${playerToWithdrawDetails.lastName}`;
            break;
        case 'Other':
            if (!additionalNotes) { toast({ variant: 'destructive', title: 'Error', description: 'Please provide details for your request.'}); setIsSubmitting(false); return; }
            player = 'Multiple/N/A';
            break;
        default:
            toast({ variant: 'destructive', title: 'Error', description: 'Invalid request type.'});
            setIsSubmitting(false);
            return;
    }
    
    const id = `req-${Date.now()}`;
    const newRequest: ChangeRequest = {
        id,
        confirmationId: selectedConfirmation.id, // Use the correct Firestore document ID
        player,
        event: selectedConfirmation.eventName,
        eventDate: selectedConfirmation.eventDate,
        type: requestType,
        details: details,
        submitted: new Date().toISOString(),
        submittedBy: `${profile.firstName} ${profile.lastName}`,
        status: getUserRole(profile) === 'organizer' ? 'Approved' : 'Pending',
        ...(getUserRole(profile) === 'organizer' && {
            approvedBy: `${profile.firstName} ${profile.lastName}`,
            approvedAt: new Date().toISOString()
        })
    };
    
    const requestRef = doc(db, 'requests', id);
    await setDoc(requestRef, newRequest);

    toast({ title: 'Request Submitted', description: 'Your change request has been sent for review.' });
    
    setIsSubmitting(false);
    onOpenChange(false);
    onRequestCreated();
  };

  const getInvoiceDisplayTitle = (invoice: any): string => {
    let title = '';
    
    const hasContent = (str: any) => str && typeof str === 'string' && str.trim().length > 0;
    
    // Priority 1: Square API 'title' field (this is where Square stores the main title)
    if (hasContent(invoice.title)) {
      title = invoice.title.trim();
    }
    // Priority 2: Custom invoiceTitle field (for backward compatibility)
    else if (hasContent(invoice.invoiceTitle)) {
      title = invoice.invoiceTitle.trim();
    }
    // Priority 3: description field
    else if (hasContent(invoice.description)) {
      title = invoice.description.trim();
    }
    // Priority 4: purchaser name
    else if (hasContent(invoice.purchaserName)) {
      title = `Registration for ${invoice.purchaserName.trim()}`;
    }
    // Fallback: event name
    else {
      title = hasContent(invoice.eventName) ? invoice.eventName.trim() : 'Registration';
    }

    // Add school if it exists and adds meaningful information
    const school = invoice.schoolName;
    if (hasContent(school) && 
        school !== 'Individual Registration' && 
        !title.toLowerCase().includes(school.toLowerCase().trim())) {
      title = `${title} - ${school.trim()}`;
    }

    // Add invoice number for uniqueness
    const invoiceNum = hasContent(invoice.invoiceNumber) 
      ? invoice.invoiceNumber.trim()
      : (invoice.id ? invoice.id.slice(-6) : 'N/A');
    
    return `${title} - #${invoiceNum}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Make a Change Request</DialogTitle>
          <DialogDescription>
            Select a registration and describe the change you need. This will be sent to an organizer for approval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirmation-select">Select Event Registration</Label>
            <Select value={selectedConfirmationId} onValueChange={setSelectedConfirmationId}>
              <SelectTrigger id="confirmation-select">
                <SelectValue placeholder="Choose an event registration..." />
              </SelectTrigger>
              <SelectContent>
                {confirmations.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {getInvoiceDisplayTitle(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="request-type-select">Request Type</Label>
            <Select value={requestType} onValueChange={setRequestType} disabled={!selectedConfirmationId}>
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
          
          {requestType === 'Substitution' && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <h4 className="font-semibold text-sm">Substitution Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="player-remove-select">Player to Remove</Label>
                    <Select value={playerToRemove} onValueChange={setPlayerToRemove}><SelectTrigger id="player-remove-select"><SelectValue placeholder="Select player..." /></SelectTrigger>
                      <SelectContent>{registeredPlayers.map(p => (<SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="player-add-select">Player to Add</Label>
                    <Select value={playerToAdd} onValueChange={setPlayerToAdd}><SelectTrigger id="player-add-select"><SelectValue placeholder="Select player..." /></SelectTrigger>
                      <SelectContent>{availableRosterPlayers.map(p => (<SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
              </div>
              {selectedPlayerToAddDetails && (
                <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>New Player Info:</strong></p>
                    <p>USCF ID: {selectedPlayerToAddDetails.uscfId}</p>
                    <p>Expiration: {selectedPlayerToAddDetails.uscfExpiration ? format(new Date(selectedPlayerToAddDetails.uscfExpiration), 'PPP') : 'N/A'}</p>
                </div>
              )}
            </div>
          )}

          {requestType === 'Section Change' && (
             <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                <h4 className="font-semibold text-sm">Section Change Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Player</Label>
                        <Select value={playerForSectionChange} onValueChange={setPlayerForSectionChange}><SelectTrigger><SelectValue placeholder="Select player..." /></SelectTrigger>
                          <SelectContent>{registeredPlayers.map(p => (<SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label>New Section</Label>
                        <Select value={newSection} onValueChange={setNewSection}><SelectTrigger><SelectValue placeholder="Select new section..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Kinder-1st">Kinder-1st</SelectItem>
                            <SelectItem value="Primary K-3">Primary K-3</SelectItem>
                            <SelectItem value="Elementary K-5">Elementary K-5</SelectItem>
                            <SelectItem value="Middle School K-8">Middle School K-8</SelectItem>
                            <SelectItem value="High School K-12">High School K-12</SelectItem>
                            <SelectItem value="Championship">Championship</SelectItem>
                          </SelectContent>
                        </Select>
                    </div>
                </div>
                {playerForSectionChange && (<p className="text-xs text-muted-foreground">Current Section: {selectedConfirmation?.selections[playerForSectionChange]?.section || 'N/A'}</p>)}
             </div>
          )}

          {requestType === 'Bye Request' && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <h4 className="font-semibold text-sm">Bye Request Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label>Player</Label>
                      <Select value={playerForBye} onValueChange={setPlayerForBye}><SelectTrigger><SelectValue placeholder="Select player..." /></SelectTrigger>
                        <SelectContent>{registeredPlayers.map(p => (<SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>))}</SelectContent>
                      </Select>
                  </div>
                   <div className="space-y-2">
                      <Label>Bye for Round</Label>
                      <Select value={byeRound} onValueChange={setByeRound}><SelectTrigger><SelectValue placeholder="Select round..." /></SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: selectedConfirmation?.eventDetails?.rounds || 5 }, (_, i) => i + 1).map(r => (
                                <SelectItem key={r} value={String(r)}>Round {r}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                  </div>
              </div>
            </div>
          )}
          
          {requestType === 'Withdrawal' && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <h4 className="font-semibold text-sm">Withdrawal Details</h4>
              <div className="space-y-2">
                  <Label>Player to Withdraw</Label>
                  <Select value={playerToWithdraw} onValueChange={setPlayerToWithdraw}><SelectTrigger><SelectValue placeholder="Select player..." /></SelectTrigger>
                    <SelectContent>{registeredPlayers.map(p => (<SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>))}</SelectContent>
                  </Select>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Label htmlFor="details-textarea">Additional Notes</Label>
            <Textarea
              id="details-textarea"
              placeholder="Provide any other relevant details for your request..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
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
