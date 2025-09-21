
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { OrganizerGuard } from '@/components/auth-guard';
import { useEvents, type Event } from '@/hooks/use-events';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InvoiceDetailsDialog } from '@/components/invoice-details-dialog';


type Confirmation = {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  eventName: string;
  schoolName: string;
  totalInvoiced: number;
  paymentMethod?: 'po' | 'check' | 'cash-app' | 'zelle' | 'purchase-order' | 'cash';
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
  eventId?: string;
};

function PaymentAuthorizationPageContent() {
  const { toast } = useToast();
  const { events } = useEvents();
  const [allPendingPayments, setAllPendingPayments] = useState<Confirmation[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [selectedConfirmation, setSelectedConfirmation] = useState<Confirmation | null>(null);
  const [filter, setFilter] = useState<'real' | 'test'>('real');
  const [viewingInvoice, setViewingInvoice] = useState<Confirmation | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);


  // State for approval dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentNote, setPaymentNote] = useState<string>('');


  const loadPendingPayments = useCallback(async () => {
    if (!db) return;
    try {
      const invoicesCol = collection(db, 'invoices');
      const q = query(invoicesCol, where('paymentStatus', '==', 'pending-po'));
      const invoiceSnapshot = await getDocs(q);
      const allConfirmations: Confirmation[] = invoiceSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Confirmation));
      setAllPendingPayments(allConfirmations);
    } catch (error) {
      console.error("Failed to load pending payments:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load payment data.'
      });
    }
  }, [toast]);
  
    const pendingPayments = useMemo(() => {
        return allPendingPayments.filter(p => {
            const event = events.find(e => e.id === p.eventId);
            const isTestEvent = event?.name.toLowerCase().startsWith('test');
            if (filter === 'test') return isTestEvent;
            return !isTestEvent;
        });
    }, [allPendingPayments, events, filter]);

  useEffect(() => {
    loadPendingPayments();
  }, [loadPendingPayments]);
  
  const openApprovalDialog = (confirmation: Confirmation) => {
    setSelectedConfirmation(confirmation);
    setPaymentAmount(String(confirmation.totalInvoiced));
    setPaymentDate(new Date());
    
    const paymentMethodLabel = getPaymentMethodLabel(confirmation.paymentMethod);
    let note = paymentMethodLabel; 

    if (confirmation.paymentMethod === 'po' || confirmation.paymentMethod === 'purchase-order') {
        note = `${paymentMethodLabel}: PO #${confirmation.poNumber || 'N/A'}`;
    } else if (confirmation.paymentMethod === 'check') {
        note = `${paymentMethodLabel}: Check #${confirmation.checkNumber || 'N/A'}`;
    }
    
    setPaymentNote(note);
    setIsDialogOpen(true);
  };

  const openDetailsDialog = (confirmation: Confirmation) => {
    setViewingInvoice(confirmation);
    setIsDetailsDialogOpen(true);
  };
  
  const handleApprovePayment = async () => {
    if (!selectedConfirmation || !selectedConfirmation.invoiceId || !db) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selected invoice is invalid or database is not available.' });
        return;
    }
    
    setIsApproving(true);
    try {
      const result = await recordPayment({
        invoiceId: selectedConfirmation.invoiceId,
        amount: parseFloat(paymentAmount),
        note: paymentNote,
        paymentDate: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : undefined,
        requestingUserRole: 'organizer' // Assuming this page is for organizers
      });
      
      const invoiceRef = doc(db, 'invoices', selectedConfirmation.id);
      await setDoc(invoiceRef, { 
        status: result.status, 
        invoiceStatus: result.status, 
        totalPaid: result.totalPaid,
        paymentStatus: result.status.toLowerCase() === 'paid' ? 'paid' : 'unpaid'
      }, { merge: true });
      
      await loadPendingPayments();
      
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
    // Normalize the method to lowercase for comparison
    const normalizedMethod = method?.toLowerCase();
    
    switch (normalizedMethod) {
        case 'po':
        case 'purchase-order':
        case 'purchaseorder':
        case 'purchase_order':
             return 'Purchase Order';
        case 'check':
        case 'checks':
        case 'bank-check':
        case 'bankcheck':
        case 'bank_check':
             return 'Check';
        case 'cash-app':
        case 'cashapp':
        case 'cash_app':
        case '$cashtag':
        case 'cashtag':
             return 'Cash App';
        case 'zelle':
        case 'zell':
        case 'zellepay':
        case 'zelle-pay':
        case 'zelle_pay':
             return 'Zelle';
        case 'cash':
        case 'currency':
        case 'bills':
        case 'paper-money':
        case 'cash-payment':
             return 'Cash';
        case 'credit-card':
        case 'creditcard':
        case 'credit_card':
        case 'cc':
        case 'card':
             return 'Credit Card';
        case 'debit-card':
        case 'debitcard':
        case 'debit_card':
        case 'debit':
             return 'Debit Card';
        case 'venmo':
        case 'ven-mo':
        case 'paypal-venmo':
             return 'Venmo';
        case 'paypal':
        case 'pay-pal':
        case 'pay_pal':
        case 'pp':
             return 'PayPal';
        case 'wire-transfer':
        case 'wiretransfer':
        case 'wire_transfer':
        case 'wire':
        case 'bank-wire':
        case 'bankwire':
        case 'bank_wire':
             return 'Wire Transfer';
        case 'ach':
        case 'ach-transfer':
        case 'ach_transfer':
        case 'electronic-transfer':
        case 'e-transfer':
             return 'ACH Transfer';
        case 'money-order':
        case 'moneyorder':
        case 'money_order':
        case 'mo':
             return 'Money Order';
        case 'apple-pay':
        case 'applepay':
        case 'apple_pay':
             return 'Apple Pay';
        case 'google-pay':
        case 'googlepay':
        case 'google_pay':
        case 'gpay':
             return 'Google Pay';
        default: 
             return 'Unknown';
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
              <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Pending Verifications ({pendingPayments.length})</CardTitle>
                    <CardDescription>
                        Review these submissions and mark them as paid once the funds have been confirmed.
                    </CardDescription>
                  </div>
                   <RadioGroup value={filter} onValueChange={(v) => setFilter(v as 'real' | 'test')} className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="real" id="real-events" /><Label htmlFor="real-events">Real</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="test" id="test-events" /><Label htmlFor="test-events">Test</Label></div>
                    </RadioGroup>
              </div>
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
                              <TableHead>Invoice #</TableHead>
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
                                  <TableCell>
                                    <Button variant="link" className="p-0 h-auto font-medium" onClick={() => openDetailsDialog(p)}>
                                        #{p.invoiceNumber}
                                    </Button>
                                  </TableCell>
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
      <InvoiceDetailsDialog
          isOpen={isDetailsDialogOpen}
          onClose={() => setIsDetailsDialogOpen(false)}
          confirmation={viewingInvoice}
      />
    </>
  );
}

export default function GuardedPaymentAuthorizationPage() {
    return (
        <OrganizerGuard>
            <PaymentAuthorizationPageContent />
        </OrganizerGuard>
    )
}

    