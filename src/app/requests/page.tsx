
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
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
import { Badge } from "@/components/ui/badge";
import type { ChangeRequest } from "@/lib/data/requests-data";
import { Button } from '@/components/ui/button';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import Link from 'next/link';
import { ClipboardList, ArrowUpDown, ArrowUp, ArrowDown, PlusCircle, Eye, Check, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ChangeRequestDialog } from '@/components/change-request-dialog';
import { ReviewRequestDialog } from '@/components/review-request-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { processBatchedRequests } from '@/ai/flows/process-batched-requests-flow';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


type SortableColumnKey = 'player' | 'event' | 'type' | 'submitted' | 'status' | 'submittedBy' | 'eventDate' | 'action' | 'invoiceNumber';

export default function RequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const { profile } = useSponsorProfile();
  const { toast } = useToast();
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'submitted', direction: 'descending' });
  const [confirmationsMap, setConfirmationsMap] = useState<Map<string, any>>(new Map());
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<ChangeRequest | null>(null);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const loadData = useCallback(async () => {
    if (!db || !profile) return;
    try {
      const requestsCol = collection(db, 'requests');
      const requestSnapshot = await getDocs(requestsCol);
      const allRequests = requestSnapshot.docs.map(doc => doc.data() as ChangeRequest);

      const invoicesCol = collection(db, 'invoices');
      const invoiceSnapshot = await getDocs(invoicesCol);
      const confirmationMap = new Map();
      invoiceSnapshot.docs.forEach(doc => confirmationMap.set(doc.id, doc.data()));
      setConfirmationsMap(confirmationMap);

      if (profile.role === 'district_coordinator') {
          const districtConfirmationIds = new Set(
              Array.from(confirmationMap.values())
                  .filter((c: any) => c.district === profile.district)
                  .map((c: any) => c.id)
          );
          setRequests(allRequests.filter(req => districtConfirmationIds.has(req.confirmationId)));
      } else if (profile.role === 'sponsor') {
          const sponsorConfirmationIds = new Set(
              Array.from(confirmationMap.values())
                  .filter((c: any) => c.sponsorEmail === profile.email)
                  .map((c: any) => c.id)
          );
          setRequests(allRequests.filter(req => sponsorConfirmationIds.has(req.confirmationId)));
      } else { // Organizer
          setRequests(allRequests);
      }

    } catch (e) {
      console.error("Failed to load data from Firestore", e);
      setRequests([]);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
        loadData();
    }
  }, [loadData, profile]);

  const sortedRequests = useMemo(() => {
    const sortableRequests = [...requests];
    if (sortConfig) {
      sortableRequests.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        if (sortConfig.key === 'action') {
            aValue = a.status === 'Pending' ? 0 : 1;
            bValue = b.status === 'Pending' ? 0 : 1;
        } else if (sortConfig.key === 'submitted' || sortConfig.key === 'eventDate') {
            aValue = a[sortConfig.key] ? new Date(a[sortConfig.key]!).getTime() : 0;
            bValue = b[sortConfig.key] ? new Date(b[sortConfig.key]!).getTime() : 0;
        } else if (sortConfig.key === 'invoiceNumber') {
            aValue = confirmationsMap.get(a.confirmationId)?.invoiceNumber || '';
            bValue = confirmationsMap.get(b.confirmationId)?.invoiceNumber || '';
        } else {
            aValue = a[sortConfig.key];
            bValue = b[sortConfig.key];
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
    return sortableRequests;
  }, [requests, sortConfig, confirmationsMap]);

  const requestSort = (key: SortableColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const handleRequestCreatedOrUpdated = () => {
    loadData();
  };

  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequests(prev => {
        const newSet = new Set(prev);
        if (newSet.has(requestId)) {
            newSet.delete(requestId);
        } else {
            newSet.add(requestId);
        }
        return newSet;
    });
  };

  const toggleAllPending = () => {
    const pendingRequestIds = sortedRequests.filter(r => r.status === 'Pending').map(r => r.id);
    if (selectedRequests.size === pendingRequestIds.length) {
        setSelectedRequests(new Set());
    } else {
        setSelectedRequests(new Set(pendingRequestIds));
    }
  };

  const handleBulkProcess = async (decision: 'Approved' | 'Denied') => {
    if (selectedRequests.size === 0 || !profile) return;
    setIsBulkProcessing(true);
    try {
        const result = await processBatchedRequests({
            requestIds: Array.from(selectedRequests),
            decision,
            processingUser: {
                uid: profile.uid,
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email
            },
        });
        
        toast({
            title: 'Bulk Processing Complete',
            description: `${result.processedCount} requests processed, ${result.failedCount} failed.`
        });
        
        if (result.errors && result.errors.length > 0) {
            console.error('Bulk processing errors:', result.errors);
        }

        setSelectedRequests(new Set());
        loadData();

    } catch(error) {
        toast({ variant: 'destructive', title: 'Bulk Processing Error', description: error instanceof Error ? error.message : 'An unknown error occurred.' });
    } finally {
        setIsBulkProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold font-headline">Change Requests</h1>
                <p className="text-muted-foreground">
                    View and manage player-submitted change requests.
                </p>
            </div>
            <div className="flex gap-2">
                {profile?.role === 'organizer' && selectedRequests.size > 0 && (
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleBulkProcess('Approved')} disabled={isBulkProcessing}>
                            {isBulkProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                            Approve ({selectedRequests.size})
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleBulkProcess('Denied')} disabled={isBulkProcessing}>
                             {isBulkProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                            Deny ({selectedRequests.size})
                        </Button>
                    </div>
                )}
                <Button onClick={() => setIsRequestDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Make A Change Request
                </Button>
            </div>
        </div>

        <Card>
           <CardHeader>
            <CardTitle>All Submitted Requests</CardTitle>
            <CardDescription>Review requests submitted by sponsors.</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
                 <div className="flex flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                    <ClipboardList className="h-12 w-12" />
                    <p className="font-semibold">No Change Requests</p>
                    <p className="text-sm">There are currently no change requests from sponsors.</p>
                </div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-8">
                          {profile?.role === 'organizer' && (
                            <Checkbox 
                                onCheckedChange={toggleAllPending} 
                                checked={sortedRequests.filter(r => r.status === 'Pending').length > 0 && sortedRequests.filter(r => r.status === 'Pending').every(r => selectedRequests.has(r.id))}
                            />
                          )}
                        </TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('player')} className="w-full justify-start px-4">Player {getSortIcon('player')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('event')} className="w-full justify-start px-4">Event {getSortIcon('event')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('eventDate')} className="w-full justify-start px-4">Event Date {getSortIcon('eventDate')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('invoiceNumber')} className="w-full justify-start px-4">Invoice # {getSortIcon('invoiceNumber')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('type')} className="w-full justify-start px-4">Request Type {getSortIcon('type')}</Button></TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('submittedBy')} className="w-full justify-start px-4">Submitted By {getSortIcon('submittedBy')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('submitted')} className="w-full justify-start px-4">Submitted Date {getSortIcon('submitted')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('status')} className="w-full justify-start px-4">Status {getSortIcon('status')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('action')} className="w-full justify-start px-4">Action {getSortIcon('action')}</Button></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedRequests.map((request, index) => {
                        const confirmation = confirmationsMap.get(request.confirmationId);
                        const isPending = request.status === 'Pending';
                        return (
                            <TableRow key={request.id || `${request.player}-${request.submitted}-${index}`} data-state={selectedRequests.has(request.id) ? 'selected' : ''}>
                                <TableCell>
                                    {isPending && profile?.role === 'organizer' && (
                                        <Checkbox 
                                            checked={selectedRequests.has(request.id)} 
                                            onCheckedChange={() => toggleRequestSelection(request.id)} 
                                        />
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">{request.player}</TableCell>
                                <TableCell>{request.event}</TableCell>
                                <TableCell>{request.eventDate ? format(new Date(request.eventDate), 'PPP') : 'N/A'}</TableCell>
                                <TableCell className="font-mono">{confirmation?.invoiceNumber || 'N/A'}</TableCell>
                                <TableCell>{request.type}</TableCell>
                                <TableCell>{request.details || '—'}</TableCell>
                                <TableCell>{request.submittedBy || 'N/A'}</TableCell>
                                <TableCell>{format(new Date(request.submitted), 'MM/dd/yy, p')}</TableCell>
                                <TableCell>
                                <Badge
                                    variant={
                                    request.status === "Pending" ? "secondary" :
                                    request.status === "Approved" ? "default" :
                                    request.status === "Denied" || request.status === "Failed" ? "destructive" : "secondary"
                                    }
                                    className={request.status === 'Approved' ? 'bg-green-600 text-white' : ''}
                                >
                                    {request.status}
                                </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {profile?.role === 'organizer' && (
                                          <>
                                            <Button variant="outline" size="sm" onClick={() => setReviewingRequest(request)}>
                                                {request.status === 'Pending' ? 'Review' : <Eye className="h-4 w-4" />}
                                            </Button>
                                          </>
                                        )}
                                        {request.status !== 'Pending' && (
                                            <div className="text-xs text-muted-foreground">
                                                <p>By {request.approvedBy || 'N/A'}</p>
                                                {request.approvedAt && <p>{format(new Date(request.approvedAt), 'MM/dd/yy')}</p>}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>

       {profile && (
        <ChangeRequestDialog
          isOpen={isRequestDialogOpen}
          onOpenChange={setIsRequestDialogOpen}
          profile={profile}
          onRequestCreated={handleRequestCreatedOrUpdated}
        />
      )}
      
      {profile?.role === 'organizer' && reviewingRequest && (
        <ReviewRequestDialog
          isOpen={!!reviewingRequest}
          onOpenChange={(open) => {
            if (!open) setReviewingRequest(null);
          }}
          request={reviewingRequest}
          profile={profile}
          onRequestUpdated={handleRequestCreatedOrUpdated}
        />
      )}
    </AppLayout>
  );
}
