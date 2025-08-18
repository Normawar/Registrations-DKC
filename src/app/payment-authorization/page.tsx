
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DollarSign, Download, Check, ExternalLink, ShieldCheck } from 'lucide-react';

type Confirmation = {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  eventName: string;
  schoolName: string;
  totalInvoiced: number;
  paymentMethod?: 'po' | 'check' | 'cashapp' | 'zelle';
  paymentStatus: 'pending-po' | 'paid' | 'unpaid';
  poNumber?: string;
  poFileUrl?: string;
  poFileName?: string;
  checkNumber?: string;
  checkDate?: string;
  amountPaid?: string;
  paymentFileUrl?: string;
  paymentFileName?: string;
  invoiceUrl?: string;
};

export default function PaymentAuthorizationPage() {
  const { toast } = useToast();
  const [pendingPayments, setPendingPayments] = useState<Confirmation[]>([]);

  const loadPendingPayments = useCallback(() => {
    try {
      const storedConfirmations = localStorage.getItem('confirmations');
      const allConfirmations: Confirmation[] = storedConfirmations ? JSON.parse(storedConfirmations) : [];
      const pending = allConfirmations.filter(c => c.paymentStatus === 'pending-po');
      setPendingPayments(pending);
    } catch (error) {
      console.error("Failed to load pending payments:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load payment data.'
      });
    }
  }, [toast]);

  useEffect(() => {
    loadPendingPayments();
    // Listen for storage changes to keep data fresh
    const handleStorageChange = () => loadPendingPayments();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadPendingPayments]);
  
  const handleApprovePayment = (confirmationId: string) => {
    try {
        const storedConfirmations = localStorage.getItem('confirmations');
        const allConfirmations: Confirmation[] = storedConfirmations ? JSON.parse(storedConfirmations) : [];
        
        const updatedConfirmations = allConfirmations.map(c => {
            if (c.id === confirmationId) {
                return { ...c, paymentStatus: 'paid', invoiceStatus: 'PAID' }; // Update both statuses
            }
            return c;
        });

        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
        
        // Also update the master invoice list
        const storedInvoices = localStorage.getItem('all_invoices');
        const allInvoices = storedInvoices ? JSON.parse(storedInvoices) : [];
        const updatedInvoices = allInvoices.map((inv: any) => {
            if (inv.id === confirmationId) {
                return { ...inv, paymentStatus: 'paid', invoiceStatus: 'PAID', status: 'PAID' };
            }
            return inv;
        });
        localStorage.setItem('all_invoices', JSON.stringify(updatedInvoices));

        // Manually trigger storage event to notify other components/tabs
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('all_invoices_updated'));
        
        loadPendingPayments(); // Refresh the current page's view
        
        toast({
            title: 'Payment Approved',
            description: 'The payment has been marked as paid and the invoice status updated.',
        });
    } catch (error) {
        console.error("Failed to approve payment:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not approve payment.' });
    }
  };
  
  const getPaymentMethodLabel = (method: string | undefined) => {
    switch (method) {
        case 'po': return 'Purchase Order';
        case 'check': return 'Check';
        case 'cashapp': return 'Cash App';
        case 'zelle': return 'Zelle';
        default: return 'Unknown';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Payment Authorization</h1>
          <p className="text-muted-foreground">
            Verify and approve payments submitted by sponsors.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Verifications ({pendingPayments.length})</CardTitle>
            <CardDescription>
              Review these submissions and mark them as paid once the funds have been confirmed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">All Caught Up!</h3>
                    <p>There are no pending payments that require authorization.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>School</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pendingPayments.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.schoolName}</TableCell>
                                <TableCell>{p.eventName}</TableCell>
                                <TableCell>
                                    <span className="flex items-center gap-1">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        {(p.totalInvoiced || 0).toFixed(2)}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{getPaymentMethodLabel(p.paymentMethod)}</Badge>
                                </TableCell>
                                <TableCell>
                                    {p.paymentMethod === 'po' && (
                                        <div className="flex items-center gap-2">
                                            <span>PO #: {p.poNumber}</span>
                                            {p.poFileUrl && (
                                                <a href={p.poFileUrl} target="_blank" rel="noopener noreferrer">
                                                    <Download className="h-4 w-4" />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    {p.paymentMethod === 'check' && (
                                        <span>Check #: {p.checkNumber}, Dated: {p.checkDate ? format(new Date(p.checkDate), 'PPP') : 'N/A'}</span>
                                    )}
                                    {(p.paymentMethod === 'cashapp' || p.paymentMethod === 'zelle') && (
                                         p.paymentFileUrl && (
                                            <a href={p.paymentFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                                                <Download className="h-4 w-4" /> View Proof
                                            </a>
                                        )
                                    )}
                                </TableCell>
                                <TableCell className="flex gap-2">
                                    <Button size="sm" onClick={() => handleApprovePayment(p.id)}>
                                        <Check className="mr-2 h-4 w-4" /> Approve
                                    </Button>
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </TableCell>
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

