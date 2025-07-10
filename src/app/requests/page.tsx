
'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function RequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);

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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Change Requests</h1>
          <p className="text-muted-foreground">
            View the status of player-submitted requests.
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
