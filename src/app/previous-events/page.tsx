
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
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
import { FileText, ImageIcon, History, Eye } from "lucide-react";
import { useEvents } from '@/hooks/use-events';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { InvoiceDetailsDialog } from '@/components/invoice-details-dialog';

export default function PreviousEventsPage() {
    const { events } = useEvents();
    const { profile } = useSponsorProfile();
    const [confirmations, setConfirmations] = useState<any[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    useEffect(() => {
        const storedConfirmations = localStorage.getItem('confirmations');
        if (storedConfirmations) {
            setConfirmations(JSON.parse(storedConfirmations));
        }
    }, []);

    const previousEvents = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Set to start of today for comparison

        return events
            .filter(event => new Date(event.date) < now)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [events]);
    
    const findConfirmationForEvent = (eventId: string) => {
        if (!profile) return null;
        
        return confirmations.find(conf => 
            conf.eventId === eventId &&
            conf.schoolName === profile.school &&
            conf.district === profile.district
        );
    };
    
    const handleViewInvoice = (confirmation: any) => {
        setSelectedInvoice(confirmation);
        setShowInvoiceModal(true);
    };

    return (
        <>
            <AppLayout>
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Previous Events</h1>
                        <p className="text-muted-foreground">
                            A history of past tournaments.
                        </p>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Completed Events ({previousEvents.length})</CardTitle>
                            <CardDescription>Browse through the archive of past events.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {previousEvents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                                    <History className="h-12 w-12" />
                                    <p className="font-semibold">No Past Events Found</p>
                                    <p className="text-sm">The event archive is currently empty.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Event Name</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Actions & Attachments</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previousEvents.map((event) => {
                                            const confirmation = findConfirmationForEvent(event.id);
                                            return (
                                                <TableRow key={event.id}>
                                                    <TableCell className="font-medium">{event.name}</TableCell>
                                                    <TableCell>{format(new Date(event.date), 'PPP')}</TableCell>
                                                    <TableCell>{event.location}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-4">
                                                            {confirmation && (
                                                                <Button variant="outline" size="sm" onClick={() => handleViewInvoice(confirmation)} className="gap-1">
                                                                    <Eye className="h-4 w-4" />
                                                                    View Invoice
                                                                </Button>
                                                            )}
                                                            {event.imageUrl && (
                                                                <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-primary">
                                                                    <a href={event.imageUrl} target="_blank" rel="noopener noreferrer" title={event.imageName}>
                                                                        <ImageIcon className="mr-2 h-4 w-4" /> {event.imageName || 'Image'}
                                                                    </a>
                                                                </Button>
                                                            )}
                                                            {event.pdfUrl && event.pdfUrl !== '#' && (
                                                                <Button asChild variant="link" className="p-0 h-auto text-muted-foreground hover:text-primary">
                                                                    <a href={event.pdfUrl} target="_blank" rel="noopener noreferrer" title={event.pdfName}>
                                                                        <FileText className="mr-2 h-4 w-4" /> {event.pdfName || 'PDF'}
                                                                    </a>
                                                                </Button>
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
            </AppLayout>
            {showInvoiceModal && selectedInvoice && (
              <InvoiceDetailsDialog
                isOpen={showInvoiceModal}
                onClose={() => {
                  setShowInvoiceModal(false);
                  setSelectedInvoice(null);
                }}
                confirmationId={selectedInvoice.id}
              />
            )}
        </>
    );
}
