
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from "@/components/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DollarSign, Download, Check, ExternalLink, ShieldCheck, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { recordPayment } from '@/ai/flows/record-payment-flow';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';


type Confirmation = {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  eventName: string;
  schoolName: string;
  totalInvoiced: number;
  paymentMethod?: 'po' | 'check' | 'cash-app' | 'zelle' | 'purchase-order';
  paymentStatus: 'pending-po' | 'paid' | 'unpaid';
  poNumber?: string;
  poFileUrl?: string;
  poFileName?: string;
  checkNumber?: string;
  checkDate?: string;
  amountPaid?: string;
  totalPaid?: number;
  paymentFileUrl?: string;
  paymentFileName?: string;
  invoiceUrl?: string;
};

export default function PaymentAuthorizationPage() {
  const { toast } = useToast();
  const [pendingPayments, setPendingPayments] = useState<Confirmation[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [selectedConfirmation, setSelectedConfirmation] = useState<Confirmation | null>(null);

  // State for approval dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentNote, setPaymentNote] = useState<string>('');


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
  
  const openApprovalDialog = (confirmation: Confirmation) => {
    setSelectedConfirmation(confirmation);
    setPaymentAmount(String(confirmation.totalInvoiced));
    setPaymentDate(new Date());
    let note = '';
    if (confirmation.paymentMethod === 'po' || confirmation.paymentMethod === 'purchase-order') {
        note = `PO: ${confirmation.poNumber || 'N/A'}`;
    } else if (confirmation.paymentMethod === 'check') {
        note = `Check: ${confirmation.checkNumber || 'N/A'}`;
    }
    setPaymentNote(note);
    setIsDialogOpen(true);
  };
  
  const handleApprovePayment = async () => {
    if (!selectedConfirmation || !selectedConfirmation.invoiceId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selected invoice is invalid.' });
        return;
    }
    
    setIsApproving(true);
    try {
      const result = await recordPayment({
        invoiceId: selectedConfirmation.invoiceId,
        amount: parseFloat(paymentAmount),
        note: paymentNote,
        paymentDate: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : undefined,
      });

      const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
      const updatedInvoices = allInvoices.map((inv: any) =>
        inv.id === selectedConfirmation.id ? { ...inv, status: result.status, invoiceStatus: result.status, totalPaid: result.totalPaid, paymentStatus: result.status === 'PAID' ? 'paid' : 'unpaid' } : inv
      );
      localStorage.setItem('all_invoices', JSON.stringify(updatedInvoices));
      
      const storedConfirmations = localStorage.getItem('confirmations') || '[]';
      const allConfirmations: Confirmation[] = JSON.parse(storedConfirmations);
      const updatedConfirmations = allConfirmations.map(c => 
          c.id === selectedConfirmation.id ? { ...c, paymentStatus: result.status === 'PAID' ? 'paid' : 'unpaid', invoiceStatus: result.status } : c
      );
      localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
      
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('all_invoices_updated'));
      
      toast({
        title: 'Payment Recorded',
        description: `Payment for invoice #${selectedConfirmation.invoiceNumber} has been successfully recorded in Square. Status: ${result.status}`,
      });
      setIsDialogOpen(false);
      setSelectedConfirmation(null);
    } catch (error) {
      console.error("Failed to approve payment:", error);
      toast({ variant: 'destructive', title: 'Approval Failed', description: error instanceof Error ? error.message : 'Could not approve payment.' });
    } finally {
      setIsApproving(false);
    }
  };
  
  const getPaymentMethodLabel = (method: string | undefined) => {
    switch (method) {
        case 'po':
        case 'purchase-order':
             return 'Purchase Order';
        case 'check': return 'Check';
        case 'cash-app': return 'Cash App';
        case 'zelle': return 'Zelle';
        default: return 'Unknown';
    }
  };

  return (
    <>
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
                                      {(p.paymentMethod === 'po' || p.paymentMethod === 'purchase-order') && (
                                          <div className="flex items-center gap-2">
                                              <span>PO #: {p.poNumber || 'N/A'}</span>
                                              {p.poFileUrl && (
                                                  <Button asChild variant="link" size="sm" className="p-0 h-auto">
                                                      <a href={p.poFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                                          <Download className="h-4 w-4" /> View Document
                                                      </a>
                                                  </Button>
                                              )}
                                          </div>
                                      )}
                                      {p.paymentMethod === 'check' && (
                                          <span>Check #: {p.checkNumber}, Dated: {p.checkDate ? format(new Date(p.checkDate), 'PPP') : 'N/A'}</span>
                                      )}
                                      {(p.paymentMethod === 'cash-app' || p.paymentMethod === 'zelle') && (
                                           p.paymentFileUrl && (
                                              <Button asChild variant="link" size="sm" className="p-0 h-auto">
                                                  <a href={p.paymentFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                                      <Download className="h-4 w-4" /> View Proof
                                                  </a>
                                              </Button>
                                          )
                                      )}
                                  </TableCell>
                                  <TableCell className="flex gap-2">
                                      <Button size="sm" onClick={() => openApprovalDialog(p)}>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Record Payment & Approve</DialogTitle>
                  <DialogDescription>
                    Confirm the payment details to be recorded on the Square invoice. This will mark the invoice as paid.
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label htmlFor="payment-amount">Payment Amount</Label>
                      <Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="payment-date">Payment Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {paymentDate ? format(paymentDate, 'PPP') : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus />
                        </PopoverContent>
                      </Popover>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="payment-note">Note (e.g., Check #, Transaction ID)</Label>
                      <Input id="payment-note" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} />
                  </div>
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                  <Button onClick={handleApprovePayment} disabled={isApproving}>
                      {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Record Payment
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
