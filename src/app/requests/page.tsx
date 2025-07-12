

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { requestsData as initialRequestsData } from "@/lib/data/requests-data";
import { Button } from '@/components/ui/button';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ClipboardList, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';

type SortableColumnKey = 'player' | 'event' | 'type' | 'submitted' | 'status' | 'submittedBy' | 'eventDate' | 'action' | 'invoiceNumber';

export default function RequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const { profile } = useSponsorProfile();
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'submitted', direction: 'descending' });
  const [confirmationsMap, setConfirmationsMap] = useState<Map<string, any>>(new Map());


  const loadData = useCallback(() => {
    try {
      const storedRequestsRaw = localStorage.getItem('change_requests');
      const parsedRequests: ChangeRequest[] = storedRequestsRaw ? JSON.parse(storedRequestsRaw) : initialRequestsData;
      
      const allRequests = (Array.isArray(parsedRequests) ? parsedRequests : initialRequestsData).map((req, index) => ({
        ...req,
        id: req.id || `${req.confirmationId}-${req.player.replace(/\s/g, '')}-${index}` 
      }));

      setRequests(allRequests);

      const storedConfirmationsRaw = localStorage.getItem('confirmations');
      const storedConfirmations = storedConfirmationsRaw ? JSON.parse(storedConfirmationsRaw) : [];
      const map = new Map();
      storedConfirmations.forEach((conf: any) => map.set(conf.id, conf));
      setConfirmationsMap(map);

    } catch (e) {
      console.error("Failed to parse data from localStorage", e);
      setRequests(initialRequestsData);
    }
  }, []);

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

  useEffect(() => {
    const handleStorageChange = () => {
      loadData();
    };

    loadData();
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadData]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Change Requests</h1>
          <p className="text-muted-foreground">
            View and manage player-submitted change requests.
          </p>
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
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('player')} className="w-full justify-start px-4">Player {getSortIcon('player')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('event')} className="w-full justify-start px-4">Event {getSortIcon('event')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('eventDate')} className="w-full justify-start px-4">Event Date {getSortIcon('eventDate')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('invoiceNumber')} className="w-full justify-start px-4">Invoice # {getSortIcon('invoiceNumber')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('type')} className="w-full justify-start px-4">Request Type {getSortIcon('type')}</Button></TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('submittedBy')} className="w-full justify-start px-4">Submitted By {getSortIcon('submittedBy')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('submitted')} className="w-full justify-start px-4">Submitted Date {getSortIcon('submitted')}</Button></TableHead>
                        <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('status')} className="w-full justify-start px-4">Status {getSortIcon('status')}</Button></TableHead>
                        {profile?.role === 'organizer' && <TableHead className="p-0"><Button variant="ghost" onClick={() => requestSort('action')} className="w-full justify-start px-4">Action {getSortIcon('action')}</Button></TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedRequests.map((request, index) => {
                        const confirmation = confirmationsMap.get(request.confirmationId);
                        return (
                            <TableRow key={request.id || `${request.player}-${request.submitted}-${index}`}>
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
                                    request.status === "Denied" ? "destructive" : "secondary"
                                    }
                                    className={request.status === 'Approved' ? 'bg-green-600 text-white' : ''}
                                >
                                    {request.status}
                                </Badge>
                                </TableCell>
                                {profile?.role === 'organizer' && (
                                    <TableCell>
                                        {request.status === 'Pending' ? (
                                            <Button asChild variant="outline" size="sm">
                                              <Link href={`/confirmations#${request.confirmationId}`}>Review Request</Link>
                                            </Button>
                                        ) : (
                                            <div className="text-xs text-muted-foreground">
                                                <p>By {request.approvedBy || 'N/A'}</p>
                                                <p>{request.approvedAt ? format(new Date(request.approvedAt), 'MM/dd/yy, p') : ''}</p>
                                            </div>
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
