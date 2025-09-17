
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, X, Loader2, RefreshCw, PlusCircle } from 'lucide-react';
import { ReviewRequestDialog } from '@/components/review-request-dialog';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { type ChangeRequest } from '@/lib/data/requests-data';
import { processBatchedRequests } from './actions';
import { ChangeRequestDialog } from '@/components/change-request-dialog';
import { useEvents } from '@/hooks/use-events';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


type EnrichedChangeRequest = ChangeRequest & {
    schoolName?: string;
    invoiceNumber?: string;
    isTestEvent?: boolean;
};

export default function RequestsPage() {
    const { profile, isProfileLoaded } = useSponsorProfile();
    const { toast } = useToast();
    const { events } = useEvents();
    const [requests, setRequests] = useState<EnrichedChangeRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('Pending');
    const [eventTypeFilter, setEventTypeFilter] = useState<'real' | 'test'>('real');
    const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const [selectedRequest, setSelectedRequest] = useState<EnrichedChangeRequest | null>(null);
    const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    
    const loadRequests = useCallback(async () => {
        if (!db || !profile || events.length === 0) return;
        setIsLoading(true);

        try {
            let q = collection(db, 'requests');
            let queries: any[] = [orderBy('submitted', 'desc'), limit(200)];
            
            if (profile.role !== 'organizer') {
                queries.unshift(where('submittedBy', '==', `${profile.firstName} ${profile.lastName}`));
            }

            const requestSnapshot = await getDocs(query(q, ...queries));
            const requestList = requestSnapshot.docs.map(doc => doc.data() as ChangeRequest);
            
            // Enrich requests with invoice data
            const enrichedRequests: EnrichedChangeRequest[] = await Promise.all(
                requestList.map(async (req) => {
                    let schoolName: string | undefined;
                    let invoiceNumber: string | undefined;
                    let isTestEvent = false;

                    if (req.confirmationId) {
                        const isValidId = req.confirmationId && !req.confirmationId.includes(':');
                        if (isValidId) {
                            try {
                                const invoiceDoc = await getDoc(doc(db, 'invoices', req.confirmationId));
                                if (invoiceDoc.exists()) {
                                    const invoiceData = invoiceDoc.data();
                                    schoolName = invoiceData.schoolName;
                                    invoiceNumber = invoiceData.invoiceNumber;
                                    const eventDetails = events.find(e => e.id === invoiceData.eventId);
                                    if(eventDetails && eventDetails.name.toLowerCase().startsWith('test')) {
                                        isTestEvent = true;
                                    }
                                }
                            } catch (e) {
                                console.error(`Could not fetch invoice ${req.confirmationId} for request ${req.id}`, e);
                            }
                        }
                    }
                    return { ...req, schoolName, invoiceNumber, isTestEvent };
                })
            );

            setRequests(enrichedRequests);
        } catch (error) {
            console.error("Error loading change requests:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch change requests.' });
        } finally {
            setIsLoading(false);
        }
    }, [profile, toast, events]);

    useEffect(() => {
        if (isProfileLoaded && events.length > 0) {
            loadRequests();
        }
    }, [isProfileLoaded, loadRequests, events]);
    
    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            const statusMatch = filter === 'All' || r.status === filter;
            const typeMatch = eventTypeFilter === 'real' ? !r.isTestEvent : r.isTestEvent;
            return statusMatch && typeMatch;
        });
    }, [requests, filter, eventTypeFilter]);

    const handleSelectRequest = (requestId: string) => {
        setSelectedRequestIds(prev =>
            prev.includes(requestId)
                ? prev.filter(id => id !== requestId)
                : [...prev, requestId]
        );
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRequestIds(filteredRequests.map(r => r.id));
        } else {
            setSelectedRequestIds([]);
        }
    };
    
    const handleBatchAction = async (decision: 'Approved' | 'Denied') => {
        if (selectedRequestIds.length === 0) {
            toast({ title: 'No Requests Selected', description: 'Please select one or more requests to process.'});
            return;
        }
        
        if (!profile) {
            toast({ variant: 'destructive', title: 'Error', description: 'User profile not available.'});
            return;
        }

        setIsProcessing(true);
        try {
            const result = await processBatchedRequests({
                requestIds: selectedRequestIds,
                decision,
                processingUser: {
                    uid: profile.uid,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    email: profile.email
                },
                waiveFees: false, // Defaulting, could be an option later
            });

            if (result.failedCount > 0) {
                 toast({ variant: 'destructive', title: `Batch process partially failed`, description: `${result.failedCount} request(s) could not be processed. ${result.errors?.[0] || ''}` });
            } else {
                 toast({ title: 'Batch Process Successful', description: `${result.processedCount} request(s) have been ${decision.toLowerCase()}.` });
            }

            setSelectedRequestIds([]);
            loadRequests(); // Refresh the list
        } catch (error) {
            console.error("Batch action failed:", error);
            toast({ variant: 'destructive', title: 'Batch Action Failed', description: error instanceof Error ? error.message : 'An unknown error occurred.' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReviewRequest = (request: ChangeRequest) => {
        setSelectedRequest(request);
        setIsReviewDialogOpen(true);
    };
    
    const isOrganizer = profile?.role === 'organizer';

    return (
        <>
            <AppLayout>
                <div className="space-y-8">
                    <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-3xl font-bold font-headline">Change Requests</h1>
                        <p className="text-muted-foreground">
                            {isOrganizer ? "Review and process change requests submitted by sponsors." : "Track the status of your submitted change requests."}
                        </p>
                      </div>
                      <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Make A Change Request
                      </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Requests</CardTitle>
                                    <CardDescription>
                                        {isOrganizer ? `Showing ${filteredRequests.length} of ${requests.length} total requests.` : `Your submitted requests.`}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-4">
                                    <RadioGroup value={eventTypeFilter} onValueChange={(v) => setEventTypeFilter(v as 'real' | 'test')} className="flex items-center space-x-2">
                                        <div className="flex items-center space-x-1"><RadioGroupItem value="real" id="real-events" /><Label htmlFor="real-events">Real</Label></div>
                                        <div className="flex items-center space-x-1"><RadioGroupItem value="test" id="test-events" /><Label htmlFor="test-events">Test</Label></div>
                                    </RadioGroup>
                                    <Select value={filter} onValueChange={setFilter}>
                                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Approved">Approved</SelectItem>
                                            <SelectItem value="Denied">Denied</SelectItem>
                                            <SelectItem value="All">All</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" onClick={loadRequests} disabled={isLoading}>
                                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>
                            {isOrganizer && (
                                <div className="flex items-center gap-2 mt-4 border-t pt-4">
                                    <Button size="sm" onClick={() => handleBatchAction('Approved')} disabled={selectedRequestIds.length === 0 || isProcessing}>
                                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}
                                        <Check className="h-4 w-4 mr-2"/> Approve Selected
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleBatchAction('Denied')} disabled={selectedRequestIds.length === 0 || isProcessing}>
                                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}
                                        <X className="h-4 w-4 mr-2"/> Deny Selected
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {isOrganizer && (
                                                <TableHead className="w-12">
                                                    <Checkbox
                                                      onCheckedChange={handleSelectAll}
                                                      checked={selectedRequestIds.length === filteredRequests.length && filteredRequests.length > 0}
                                                      aria-label="Select all"
                                                    />
                                                </TableHead>
                                            )}
                                            <TableHead>Invoice #</TableHead>
                                            <TableHead>School</TableHead>
                                            <TableHead>Event Date</TableHead>
                                            <TableHead>Player</TableHead>
                                            <TableHead>Request Type</TableHead>
                                            <TableHead>Submitted</TableHead>
                                            <TableHead>Status</TableHead>
                                            {isOrganizer && <TableHead>Action</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow><TableCell colSpan={isOrganizer ? 9 : 8} className="h-24 text-center">Loading requests...</TableCell></TableRow>
                                        ) : filteredRequests.length === 0 ? (
                                            <TableRow><TableCell colSpan={isOrganizer ? 9 : 8} className="h-24 text-center">No requests found matching your filter.</TableCell></TableRow>
                                        ) : (
                                            filteredRequests.map(req => (
                                                <TableRow key={req.id}>
                                                    {isOrganizer && (
                                                        <TableCell>
                                                            <Checkbox
                                                                checked={selectedRequestIds.includes(req.id)}
                                                                onCheckedChange={() => handleSelectRequest(req.id)}
                                                                aria-label={`Select request ${req.id}`}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    <TableCell>{req.invoiceNumber || 'N/A'}</TableCell>
                                                    <TableCell>{req.schoolName || 'N/A'}</TableCell>
                                                    <TableCell>
                                                        {req.eventDate ? format(new Date(req.eventDate), 'PPP') : 'N/A'}
                                                    </TableCell>
                                                    <TableCell>{req.player}</TableCell>
                                                    <TableCell>{req.type}</TableCell>
                                                    <TableCell>{format(new Date(req.submitted), 'PPP')}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={req.status === 'Approved' ? 'default' : req.status === 'Denied' ? 'destructive' : 'secondary'} className={req.status === 'Approved' ? 'bg-green-600' : ''}>
                                                            {req.status}
                                                        </Badge>
                                                    </TableCell>
                                                    {isOrganizer && (
                                                        <TableCell>
                                                            <Button variant="outline" size="sm" onClick={() => handleReviewRequest(req)}>
                                                                Review
                                                            </Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
            
            {profile && (
              <ChangeRequestDialog
                isOpen={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                profile={profile}
                onRequestCreated={loadRequests}
              />
            )}

            {profile && selectedRequest && (
                <ReviewRequestDialog 
                    isOpen={isReviewDialogOpen}
                    onOpenChange={setIsReviewDialogOpen}
                    request={selectedRequest}
                    profile={profile}
                    onRequestUpdated={loadRequests}
                />
            )}
        </>
    );
}
