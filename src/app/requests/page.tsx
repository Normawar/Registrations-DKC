
'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

export default function RequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const { profile } = useSponsorProfile();

  const loadRequests = useCallback(() => {
    try {
      const storedRequestsRaw = localStorage.getItem('change_requests');
      const parsedRequests: ChangeRequest[] = storedRequestsRaw ? JSON.parse(storedRequestsRaw) : initialRequestsData;
      
      const allRequests = (Array.isArray(parsedRequests) ? parsedRequests : initialRequestsData).map((req, index) => ({
        ...req,
        id: req.id || `${req.confirmationId}-${req.player.replace(/\s/g, '')}-${index}` 
      }));

      const sortedRequests = allRequests.sort((a, b) => new Date(b.submitted).getTime() - new Date(a.submitted).getTime());
      setRequests(sortedRequests);
    } catch (e) {
      console.error("Failed to parse change requests from localStorage", e);
      setRequests(initialRequestsData);
    }
  }, []);

  useEffect(() => {
    loadRequests();

    const handleStorageChange = () => {
      loadRequests();
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadRequests]);

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
                    <TableHead>Player</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Request Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    {profile?.role === 'organizer' && <TableHead>Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests.map((request, index) => (
                    <TableRow key={request.id || `${request.player}-${request.submitted}-${index}`}>
                        <TableCell className="font-medium">{request.player}</TableCell>
                        <TableCell>{request.event}</TableCell>
                        <TableCell>{request.type}</TableCell>
                        <TableCell>{request.details || '—'}</TableCell>
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
                    ))}
                </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

    
