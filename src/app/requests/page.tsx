
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from "@/components/app-layout";
import {
  Card,
  CardContent,
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

export default function RequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const { profile } = useSponsorProfile();
  const { toast } = useToast();
  const router = useRouter();

  const loadRequests = useCallback(() => {
    try {
      const storedRequests = localStorage.getItem('change_requests');
      const parsedRequests = storedRequests ? JSON.parse(storedRequests) : initialRequestsData;
      const sortedRequests = (Array.isArray(parsedRequests) ? parsedRequests : initialRequestsData)
          .sort((a, b) => new Date(b.submitted).getTime() - new Date(a.submitted).getTime());
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

  const handleRequestUpdate = (index: number, newStatus: 'Approved' | 'Denied') => {
    const updatedRequests = [...requests];
    const requestToUpdate = updatedRequests[index];
    
    if (!requestToUpdate) return;
    
    requestToUpdate.status = newStatus;
    
    setRequests(updatedRequests);
    localStorage.setItem('change_requests', JSON.stringify(updatedRequests));

    toast({
      title: `Request ${newStatus}`,
      description: `The request for ${requestToUpdate.player} has been marked as ${newStatus.toLowerCase()}.`,
    });

    if (newStatus === 'Approved' && requestToUpdate.confirmationId) {
        router.push(`/confirmations#${requestToUpdate.confirmationId}`);
    }
  };

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
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  {profile?.role === 'organizer' && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request, index) => (
                  <TableRow key={`${request.player}-${request.submitted}-${index}`}>
                    <TableCell className="font-medium">{request.player}</TableCell>
                    <TableCell>{request.event}</TableCell>
                    <TableCell>{request.type}</TableCell>
                    <TableCell>{request.details || '—'}</TableCell>
                    <TableCell>{request.submitted}</TableCell>
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
                        <TableCell className="text-right">
                            {request.status === 'Pending' ? (
                                <div className="flex gap-2 justify-end">
                                    <Button variant="outline" size="sm" onClick={() => handleRequestUpdate(index, 'Approved')}>Review & Approve</Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleRequestUpdate(index, 'Denied')}>Deny</Button>
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground">Actioned</span>
                            )}
                        </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
