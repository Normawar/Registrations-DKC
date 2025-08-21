
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { useMasterDb } from "@/context/master-db-context";
import { ExternalLink, Upload, CreditCard, Check, DollarSign, RefreshCw, Loader2, Download, File as FileIcon, X, Trash2, History, MessageSquare, Shield } from "lucide-react";
import { format } from "date-fns";
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { recordPayment } from '@/ai/flows/record-payment-flow';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { getInvoiceStatusWithPayments } from '@/ai/flows/get-invoice-status-flow';
import { PaymentHistoryDisplay } from '@/components/unified-payment-system';


interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  confirmationId: string;
}

export function InvoiceDetailsDialog({ isOpen, onClose, confirmationId }: InvoiceDetailsDialogProps) {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const { database: masterDatabase } = useMasterDb();
  
  const [confirmation, setConfirmation] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('purchase-order');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  const [cashAmount, setCashAmount] = useState<string>('');
  const [checkAmount, setCheckAmount] = useState<string>('');
  const [creditCardAmount, setCreditCardAmount] = useState<string>('');
  const [creditCardLast4, setCreditCardLast4] = useState<string>('');
  const [cashAppAmount, setCashAppAmount] = useState<string>('');
  const [cashAppHandle, setCashAppHandle] = useState<string>('');
  const [zelleAmount, setZelleAmount] = useState<string>('');
  const [zelleEmail, setZelleEmail] = useState<string>('');
  const [poAmount, setPoAmount] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sponsorNote, setSponsorNote] = useState<string>('');
  const [organizerNote, setOrganizerNote] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
  
    // Load specific confirmation details
    const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
    const currentConf = allInvoices.find((c: any) => c.id === confirmationId);
    if (currentConf) {
      setConfirmation(currentConf);
      setSelectedPaymentMethod(currentConf.paymentMethod || 'purchase-order');
      setPoNumber(currentConf.poNumber || '');
      
      // Force all to be empty strings
      setCashAmount('');
      setCheckAmount('');
      setCreditCardAmount('');
      setCreditCardLast4('');
      setCashAppAmount('');
      setCashAppHandle('');
      setZelleAmount('');
      setZelleEmail('');
      setPoAmount('');
      setSponsorNote('');
      setOrganizerNote('');
    }
  
    // Firebase Auth setup
    if (!auth || !storage) {
        setAuthError("Firebase is not configured, so file uploads are disabled.");
        setIsAuthReady(true);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            setCurrentUser(user);
            setAuthError(null);
        } else {
            signInAnonymously(auth).catch((error) => {
                console.error("Anonymous sign-in failed:", error);
                setAuthError("Authentication error. File uploads are disabled.");
                setCurrentUser(null);
            });
        }
        setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [isOpen, confirmationId]);

  const getRegisteredPlayers = (conf: any) => {
    if (!conf?.selections) return [];
    const playerIds = Object.keys(conf.selections);
    return masterDatabase.filter(player => playerIds.includes(player.id));
  };
  
  const handleRefreshStatus = async () => {
    if (!confirmation?.invoiceId) {
        toast({ variant: 'destructive', title: 'Cannot Refresh', description: 'No invoice ID available for this confirmation' });
        return;
    }
    setIsRefreshing(true);
    try {
        const result = await getInvoiceStatusWithPayments({ invoiceId: confirmation.invoiceId });
        
        const localPayments = confirmation.paymentHistory || [];
        const squarePayments = result.paymentHistory || [];
        
        const unifiedPaymentHistory = [...localPayments];
        
        for (const squarePayment of squarePayments) {
            const existsLocally = localPayments.some((local: any) => 
                local.squarePaymentId === squarePayment.id || 
                (local.method === 'credit_card' && Math.abs(local.amount - squarePayment.amount) < 0.01)
            );
            if (!existsLocally) {
                unifiedPaymentHistory.push({
                    ...squarePayment,
                    squarePaymentId: squarePayment.id,
                    source: 'square'
                });
            }
        }
        unifiedPaymentHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const totalPaid = Math.max(result.totalPaid, unifiedPaymentHistory.reduce((sum, p) => sum + p.amount, 0));
        
        const updatedConfirmation = {
            ...confirmation,
            invoiceStatus: result.status,
            status: result.status,
            invoiceNumber: result.invoiceNumber || confirmation.invoiceNumber,
            totalPaid: totalPaid,
            totalAmount: result.totalAmount || confirmation.totalAmount,
            paymentHistory: unifiedPaymentHistory,
            lastSquareSync: new Date().toISOString(),
        };
        
        const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
        const updatedAllInvoices = allInvoices.map((inv: any) => 
            inv.id === confirmation.id ? updatedConfirmation : inv
        );
        localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));
        
        const confirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
        const updatedConfirmations = confirmations.map((conf: any) =>
          conf.id === confirmation.id ? updatedConfirmation : conf
        );
        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
        
        setConfirmation(updatedConfirmation);
        toast({ title: 'Status Updated', description: `Status is now: ${result.status}` });
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('all_invoices_updated'));
    } catch (error) {
        console.error('Failed to refresh status:', error);
        toast({ variant: 'destructive', title: 'Refresh Failed', description: 'Could not refresh invoice status.' });
    } finally {
        setIsRefreshing(false);
    }
  };

  const getSquareDashboardUrl = (invoiceNumber: string) => {
    // ✅ CORRECTED: Square sandbox is accessed through Developer Console
    return 'https://developer.squareup.com/apps';
  };

  const addNote = async (noteText: string, noteType: 'sponsor' | 'organizer') => {
    if (!noteText.trim()) return;
    
    const newNote = {
      id: `note_${Date.now()}`,
      text: noteText.trim(),
      type: noteType,
      author: noteType === 'sponsor' ? (profile?.email || 'Sponsor') : (profile?.firstName || 'Organizer'),
      timestamp: new Date().toISOString(),
    };
    
    const updatedConfirmationData = {
      ...confirmation,
      notes: [...(confirmation.notes || []), newNote],
      lastUpdated: new Date().toISOString(),
    };
    
    const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
    const updatedAllInvoices = allInvoices.map((inv: any) =>
      inv.id === confirmation.id ? updatedConfirmationData : inv
    );
    localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));
    
    const confirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
    const updatedConfirmations = confirmations.map((conf: any) =>
      conf.id === confirmation.id ? updatedConfirmationData : conf
    );
    localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
    
    setConfirmation(updatedConfirmationData);
    
    if (noteType === 'sponsor') {
      setSponsorNote('');
    } else {
      setOrganizerNote('');
    }
    
    toast({
      title: 'Note Added',
      description: `${noteType === 'sponsor' ? 'Sponsor' : 'Organizer'} note has been saved.`
    });
    
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('all_invoices_updated'));
  };

  const handlePaymentUpdate = async () => {
    if (!confirmation) return;
  
    setIsUpdating(true);
  
    try {
      if (profile?.role === 'organizer' && selectedPaymentMethod !== 'credit-card') {
        
        let paymentAmount = 0;
        if (selectedPaymentMethod === 'cash') paymentAmount = parseFloat(cashAmount || '0');
        else if (selectedPaymentMethod === 'check') paymentAmount = parseFloat(checkAmount || '0');
        else if (selectedPaymentMethod === 'cash-app') paymentAmount = parseFloat(cashAppAmount || '0');
        else if (selectedPaymentMethod === 'zelle') paymentAmount = parseFloat(zelleAmount || '0');
        else if (selectedPaymentMethod === 'purchase-order') paymentAmount = parseFloat(poAmount || '0');
  
        if (!paymentAmount || paymentAmount <= 0) {
          toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid payment amount.' });
          setIsUpdating(false);
          return;
        }
  
        if (!confirmation.invoiceId) {
          toast({ variant: 'destructive', title: 'Error', description: 'No invoice ID available for payment recording.' });
          setIsUpdating(false);
          return;
        }
  
        // Record payment in your system
        const result = await recordPayment({
          invoiceId: confirmation.invoiceId,
          amount: paymentAmount,
          note: `${selectedPaymentMethod.replace('-', ' ')} payment recorded by ${profile?.firstName || 'organizer'}`,
          paymentDate: format(new Date(), 'yyyy-MM-dd'),
        });
  
        // Update local state (same logic as before)
        const paymentHistory = confirmation?.paymentHistory || [];
        const calculatedTotalPaid = paymentHistory.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
        const currentTotalPaid = Math.max(calculatedTotalPaid, confirmation?.totalPaid || 0);
        const newTotalPaid = currentTotalPaid + paymentAmount;
        const totalInvoiced = confirmation.totalAmount || confirmation.totalInvoiced || 0;
        
        let actualStatus = 'UNPAID';
        if (newTotalPaid >= totalInvoiced) actualStatus = 'PAID';
        else if (newTotalPaid > 0) actualStatus = 'PARTIALLY_PAID';
  
        const newPaymentEntry = {
          id: result.paymentId || `payment_${Date.now()}`,
          amount: paymentAmount,
          date: new Date().toISOString(),
          method: selectedPaymentMethod,
          note: `${selectedPaymentMethod.replace('-', ' ')} payment recorded by ${profile?.firstName || 'organizer'}`,
          source: 'manual',
          recordedBy: profile?.firstName || 'organizer',
        };
  
        const updatedConfirmationData = {
          ...confirmation,
          status: actualStatus,
          invoiceStatus: actualStatus,
          totalPaid: newTotalPaid,
          totalAmount: totalInvoiced,
          totalInvoiced: totalInvoiced,
          paymentStatus: actualStatus === 'PAID' ? 'paid' : 'partially-paid',
          lastUpdated: new Date().toISOString(),
          paymentHistory: [...(confirmation.paymentHistory || []), newPaymentEntry]
        };
  
        // Update localStorage
        const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
        const updatedAllInvoices = allInvoices.map((inv: any) => 
          inv.id === confirmation.id ? updatedConfirmationData : inv
        );
        localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));
  
        const confirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
        const updatedConfirmations = confirmations.map((conf: any) => 
          conf.id === confirmation.id ? updatedConfirmationData : conf
        );
        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));
  
        setConfirmation(updatedConfirmationData);
        
        // Clear form
        setCashAmount('');
        setCheckAmount('');
        setCashAppAmount('');
        setZelleAmount('');
        setPoAmount('');
  
        // ✅ UPDATED: Don't redirect, just show success message
        toast({ 
          title: 'Payment Recorded Successfully', 
          description: `Payment of $${paymentAmount.toFixed(2)} recorded in your system. Use the Square management tools below to sync with Square Sandbox.`,
          duration: 8000
        });
  
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('all_invoices_updated'));
        setIsUpdating(false);
        return;
      }
  
      // ... rest of your existing handlePaymentUpdate logic
    } catch (error) {
      console.error('Failed to update payment:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update payment information.' });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDeleteFile = async () => {
      if (!confirmation?.poFileUrl && !confirmation?.paymentFileUrl) return;

      const isPoFile = selectedPaymentMethod === 'purchase-order';
      const fileUrl = isPoFile ? confirmation.poFileUrl : confirmation.paymentFileUrl;
      
      if (!fileUrl) return;

      setIsUpdating(true);
      try {
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);

          const updatedConfirmationData = { ...confirmation };
          if (isPoFile) {
              delete updatedConfirmationData.poFileUrl;
              delete updatedConfirmationData.poFileName;
          } else {
              delete updatedConfirmationData.paymentFileUrl;
              delete updatedConfirmationData.paymentFileName;
          }

          const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
          const updatedAllInvoices = allInvoices.map((inv: any) => inv.id === confirmation.id ? updatedConfirmationData : inv);
          localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));
          setConfirmation(updatedConfirmationData);
          
          toast({ title: 'File Deleted', description: 'The uploaded document has been removed.' });
      } catch (error) {
          console.error("Failed to delete file:", error);
          toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Could not delete the file.' });
      } finally {
          setIsUpdating(false);
      }
  };

  const getStatusBadge = (status: string, totalPaid?: number, totalInvoiced?: number) => {
    let displayStatus = (status || '').toUpperCase();
    
    if (totalPaid !== undefined && totalInvoiced !== undefined) {
        if (totalPaid >= totalInvoiced && totalPaid > 0) {
            displayStatus = 'PAID';
        } else if (totalPaid > 0 && totalPaid < totalInvoiced) {
            displayStatus = 'PARTIALLY_PAID';
        }
    }
    
    const variants: { [key: string]: 'default' | 'destructive' | 'secondary' } = {
        'PAID': 'default', 'COMPED': 'default',
        'UNPAID': 'destructive', 'OVERDUE': 'destructive', 'CANCELED': 'destructive',
        'PARTIALLY_PAID': 'secondary',
    };
    
    let className = '';
    if (displayStatus === 'PAID' || displayStatus === 'COMPED') className = 'bg-green-600 text-white';
    if (displayStatus === 'PARTIALLY_PAID') className = 'bg-blue-600 text-white';
    if (displayStatus === 'PENDING-PO') className = 'bg-yellow-500 text-black';
    
    return <Badge variant={variants[displayStatus] || 'secondary'} className={className}>{displayStatus.replace(/_/g, ' ')}</Badge>;
  };

  const NotesSection = () => {
    return (
      <div>
        <p>Test Notes Section</p>
      </div>
    );
  };

  const PaymentHistorySection = () => {
    return (
      <PaymentHistoryDisplay confirmation={confirmation} />
    );
  };

  const renderPaymentMethodInputs = () => {
    const isOrganizer = profile?.role === 'organizer';
    const isPaymentApproved = ['PAID', 'COMPED'].includes(confirmation?.invoiceStatus?.toUpperCase() || '');
  
    const ensureString = (val: any): string => {
      if (val === null || val === undefined) return '';
      return String(val);
    };
  
    // Calculate actual balance due for payment
    const totalInvoiced = confirmation?.totalAmount || confirmation?.totalInvoiced || 0;
    const paymentHistory = confirmation?.paymentHistory || [];
    const calculatedTotalPaid = paymentHistory.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
    const totalPaid = Math.max(calculatedTotalPaid, confirmation?.totalPaid || 0);
    const actualBalanceDue = Math.max(0, totalInvoiced - totalPaid);
    
    // Check if Square invoice amount matches balance due
    const squareAmountMatches = Math.abs(totalInvoiced - actualBalanceDue) < 0.01;
  
    // Add organizer-specific messaging
    const getOrganizerInstructions = (method: string) => {
      if (!isOrganizer) return null;
      
      return (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
          <p className="text-sm text-blue-800 font-medium mb-1">
            📋 Organizer Instructions:
          </p>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>Enter the {method} amount received above</li>
            <li>Click "Record Payment & Open Square"</li>
            <li>In Square Sandbox, find invoice #{confirmation?.invoiceNumber || confirmation?.id.slice(-8)}</li>
            <li>Click "Mark as paid" or "Add payment" in Square</li>
            <li>Return here and click "Sync with Square" to update status</li>
          </ol>
        </div>
      );
    };
  
    switch (selectedPaymentMethod) {
      case 'credit-card':
        return (
          <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-3">
              <strong>Balance due: ${actualBalanceDue.toFixed(2)}</strong>
            </p>
            
            {!squareAmountMatches ? (
              // Show warning when Square amount doesn't match balance
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ Payment Amount Mismatch
                </p>
                <p className="text-xs text-yellow-700 mb-2">
                  The Square invoice shows ${totalInvoiced.toFixed(2)}, but your balance due is ${actualBalanceDue.toFixed(2)}.
                </p>
                <p className="text-xs text-yellow-700 mb-3">
                  <strong>Options:</strong>
                </p>
                <div className="text-left space-y-1 text-xs text-yellow-700">
                  <p>• Pay ${totalInvoiced.toFixed(2)} in Square (overpayment will be refunded)</p>
                  <p>• Use a different payment method for the exact amount</p>
                  <p>• Contact support to create a new invoice for ${actualBalanceDue.toFixed(2)}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-blue-600 mb-3">
                After payment, please use the refresh button to update the status here.
              </p>
            )}
            
            {confirmation?.invoiceUrl ? (
              <div className="space-y-2">
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <a href={confirmation.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Pay ${totalInvoiced.toFixed(2)} in Square <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                {!squareAmountMatches && (
                  <p className="text-xs text-blue-600">
                    (Will overpay by ${(totalInvoiced - actualBalanceDue).toFixed(2)})
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-600">Payment link not available</p>
            )}
          </div>
        );
  
      case 'cash':
        return (
          <div>
            <Label htmlFor="cash-amount">
              {isOrganizer ? 'Cash Amount Received' : 'Cash Amount Paid'}
            </Label>
            <Input 
              id="cash-amount" 
              type="number" 
              step="0.01" 
              placeholder={`Enter amount (Balance: $${actualBalanceDue.toFixed(2)})`}
              value={ensureString(cashAmount)}
              onChange={(e) => setCashAmount(ensureString(e.target.value))}
              disabled={isPaymentApproved} 
            />
            {getOrganizerInstructions('cash')}
          </div>
        );
  
      case 'check':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="check-amount">
                {isOrganizer ? 'Check Amount Received' : 'Check Amount'}
              </Label>
              <Input 
                id="check-amount" 
                type="number" 
                step="0.01" 
                placeholder={`Enter amount (Balance: $${actualBalanceDue.toFixed(2)})`}
                value={ensureString(checkAmount)}
                onChange={(e) => setCheckAmount(ensureString(e.target.value))}
                disabled={isPaymentApproved} 
              />
            </div>
            <div>
              <Label htmlFor="check-proof">Upload Check Image</Label>
              <Input 
                id="check-proof" 
                type="file" 
                accept="image/*,.pdf" 
                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} 
                disabled={isPaymentApproved}
              />
            </div>
            {getOrganizerInstructions('check')}
          </div>
        );
  
      default:
        return null;
    }
  };

  const SquareDashboardButton = () => {
    if (profile?.role !== 'organizer') return null;
  
    const openSquareDeveloperConsole = () => {
      window.open('https://developer.squareup.com/apps', '_blank');
      
      toast({
        title: 'Square Developer Console Opened',
        description: `Sign in to view your sandbox application. Navigate to your app → Webhooks/API to manage sandbox data. Invoice: #${confirmation?.invoiceNumber || confirmation?.id.slice(-8)}`,
        duration: 12000
      });
    };
  
    const openSquareAPIExplorer = () => {
      window.open('https://developer.squareup.com/explorer/square/invoices-api', '_blank');
      
      toast({
        title: 'Square API Explorer Opened',
        description: 'Use the API Explorer to view, update, or mark invoices as paid in sandbox environment.',
        duration: 10000
      });
    };
  
    return (
      <div className="border-t pt-4 mt-4">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm">Square Sandbox Management</h4>
            <p className="text-xs text-muted-foreground">Access sandbox tools for invoice management</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={openSquareDeveloperConsole} size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Developer Console
            </Button>
            
            <Button variant="outline" onClick={openSquareAPIExplorer} size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              API Explorer
            </Button>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-800 font-medium mb-2">
              📋 Square Sandbox Instructions:
            </p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li><strong>Developer Console:</strong> Sign in → Select your app → View webhook logs/data</li>
              <li><strong>API Explorer:</strong> Use "List Invoices" to find invoice #{confirmation?.invoiceNumber || confirmation?.id.slice(-8)}</li>
              <li><strong>Update Payment:</strong> Use "Update Invoice" or payment endpoints</li>
              <li><strong>Return here:</strong> Click "Sync with Square" to refresh status</li>
            </ol>
          </div>
        </div>
      </div>
    );
  };


  if (!isOpen || !confirmation) return null;

  // ✅ FIXED: Proper calculation using payment history
  const totalInvoiced = confirmation?.totalAmount || confirmation?.totalInvoiced || 0;
  
  // Calculate total paid from payment history (more reliable)
  const paymentHistory = confirmation?.paymentHistory || [];
  const calculatedTotalPaid = paymentHistory.reduce((sum: number, payment: any) => {
    return sum + (payment.amount || 0);
  }, 0);
  
  // Use the higher of the two values (in case one is outdated)
  const totalPaid = Math.max(calculatedTotalPaid, confirmation?.totalPaid || 0);
  const balanceDue = Math.max(0, totalInvoiced - totalPaid);
  
  const players = getRegisteredPlayers(confirmation);
  const isPaymentApproved = ['PAID', 'COMPED'].includes(confirmation.invoiceStatus?.toUpperCase());
  const isIndividualInvoice = confirmation.schoolName === 'Individual Registration';
  
  const invoiceUrl = confirmation.publicUrl || confirmation.invoiceUrl;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <DialogTitle className="text-2xl">{confirmation.invoiceTitle || confirmation.eventName}</DialogTitle>
                         <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                            {getStatusBadge(confirmation.invoiceStatus || confirmation.status, confirmation.totalPaid, confirmation.totalAmount || confirmation.totalInvoiced)}
                            <span>
                                Invoice #{confirmation.invoiceNumber || confirmation.id.slice(-8)}
                            </span>
                         </div>
                    </div>
                </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle>Registration Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between">
                                <p className="font-medium text-muted-foreground">Event</p>
                                <p>{confirmation.eventName}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-muted-foreground">Date</p>
                                <p>{confirmation.eventDate ? format(new Date(confirmation.eventDate), 'PPP') : 'N/A'}</p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-muted-foreground">Sponsor Name</p>
                                <p>{confirmation.purchaserName || 'N/A'}</p>
                            </div>
                             <div className="flex justify-between">
                                <p className="font-medium text-muted-foreground">Sponsor Email</p>
                                <p>
                                    {confirmation?.sponsorEmail || 
                                     confirmation?.purchaserEmail || 
                                     confirmation?.contactEmail || 
                                     profile?.email || 
                                     'N/A'}
                                </p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-muted-foreground">Sponsor Phone</p>
                                <p>
                                    {confirmation?.sponsorPhone || 
                                     confirmation?.purchaserPhone || 
                                     confirmation?.contactPhone || 
                                     profile?.phone || 
                                     'N/A'}
                                </p>
                            </div>
                            <div className="flex justify-between">
                                <p className="font-medium text-muted-foreground">School</p>
                                <p>{confirmation.schoolName || 'N/A'}</p>
                            </div>
                            <Separator/>
                            <div className="flex justify-between items-center text-base">
                              <p className="font-medium">Total Amount</p>
                              <p className="font-semibold">${totalInvoiced.toFixed(2)}</p>
                            </div>
                            {totalPaid > 0 && (
                              <>
                                <div className="flex justify-between items-center text-green-600">
                                  <p className="font-medium">Amount Paid</p>
                                  <p className="font-semibold">${totalPaid.toFixed(2)}</p>
                                </div>
                                <div className="flex justify-between items-center text-destructive font-bold text-lg">
                                  <p>Balance Due</p>
                                  <p>${balanceDue.toFixed(2)}</p>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between items-center">
                                <p className="font-medium text-muted-foreground">Invoice Link</p>
                                {invoiceUrl ? (
                                    <Button asChild variant="outline" size="sm">
                                    <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                                        View on Square <ExternalLink className="ml-2 h-4 w-4" />
                                    </a>
                                    </Button>
                                ) : (
                                    <span className="text-sm text-muted-foreground">No external link available</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Submit Payment Information</CardTitle>
                            <CardDescription>
                                {profile?.role === 'organizer' 
                                    ? 'Record payments or submit payment information for verification.' 
                                    : 'Select a payment method and provide the necessary details. An organizer will verify your payment.'
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {authError && (
                                <Alert variant="destructive">
                                    <AlertTitle>File Uploads Disabled</AlertTitle>
                                    <AlertDescription>{authError}</AlertDescription>
                                </Alert>
                            )}
                            <div>
                                <Label className="text-base font-medium mb-4 block">Payment Method</Label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {!isIndividualInvoice && (
                                    <Button 
                                      variant={selectedPaymentMethod === 'purchase-order' ? 'default' : 'outline'} 
                                      onClick={() => setSelectedPaymentMethod('purchase-order')} 
                                      className="h-auto py-2 flex flex-col items-center gap-1 leading-tight"
                                      disabled={isPaymentApproved}
                                    >
                                      <Upload className="h-5 w-5" />
                                      <span className="text-center">Purchase<br/>Order</span>
                                    </Button>
                                  )}
                                  <Button 
                                    variant={selectedPaymentMethod === 'credit-card' ? 'default' : 'outline'} 
                                    onClick={() => setSelectedPaymentMethod('credit-card')} 
                                    className="h-auto py-2 flex flex-col items-center gap-1 leading-tight"
                                  >
                                    <CreditCard className="h-5 w-5" />
                                    <span className="text-center">Credit<br/>Card</span>
                                  </Button>
                                  <Button 
                                    variant={selectedPaymentMethod === 'check' ? 'default' : 'outline'} 
                                    onClick={() => setSelectedPaymentMethod('check')} 
                                    className="h-auto py-2 flex flex-col items-center gap-1 leading-tight"
                                    disabled={isPaymentApproved}
                                  >
                                    <Check className="h-5 w-5" />
                                    <span className="text-center">Pay with<br/>Check</span>
                                  </Button>
                                  <Button 
                                    variant={selectedPaymentMethod === 'cash-app' ? 'default' : 'outline'} 
                                    onClick={() => setSelectedPaymentMethod('cash-app')} 
                                    className="h-auto py-4 flex flex-col items-center gap-2"
                                    disabled={isPaymentApproved}
                                  >
                                    <DollarSign className="h-5 w-5" />
                                    <span>Cash App</span>
                                  </Button>
                                  <Button 
                                    variant={selectedPaymentMethod === 'zelle' ? 'default' : 'outline'} 
                                    onClick={() => setSelectedPaymentMethod('zelle')} 
                                    className="h-auto py-4 flex flex-col items-center gap-2"
                                    disabled={isPaymentApproved}
                                  >
                                    <CreditCard className="h-5 w-5" />
                                    <span>Zelle</span>
                                  </Button>
                                  <Button 
                                    variant={selectedPaymentMethod === 'cash' ? 'default' : 'outline'} 
                                    onClick={() => setSelectedPaymentMethod('cash')} 
                                    className="h-auto py-4 flex flex-col items-center gap-2"
                                    disabled={isPaymentApproved}
                                  >
                                    <DollarSign className="h-5 w-5" />
                                    <span>Cash</span>
                                  </Button>
                                </div>
                            </div>
    
                            <Separator />
                            
                            {renderPaymentMethodInputs()}

                            {profile?.role === 'organizer' && (
                              <SquareDashboardButton />
                            )}
                            
                        </CardContent>
                         <CardFooter>
                            <Button 
                                onClick={handlePaymentUpdate} 
                                disabled={
                                    isUpdating || 
                                    !isAuthReady || 
                                    (!!authError && selectedPaymentMethod !== 'cash') || 
                                    isPaymentApproved ||
                                    (profile?.role === 'organizer' && selectedPaymentMethod !== 'credit-card' && (
                                        (selectedPaymentMethod === 'cash' && (!cashAmount || parseFloat(cashAmount || '0') <= 0)) ||
                                        (selectedPaymentMethod === 'check' && (!checkAmount || parseFloat(checkAmount || '0') <= 0)) ||
                                        (selectedPaymentMethod === 'cash-app' && (!cashAppAmount || parseFloat(cashAppAmount || '0') <= 0)) ||
                                        (selectedPaymentMethod === 'zelle' && (!zelleAmount || parseFloat(zelleAmount || '0') <= 0)) ||
                                        (selectedPaymentMethod === 'purchase-order' && (!poAmount || parseFloat(poAmount || '0') <= 0 || !poNumber))
                                    ))
                                } 
                                className="flex items-center gap-2"
                            >
                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {selectedPaymentMethod === 'credit-card' 
                                    ? (isUpdating ? 'Submitting...' : 'Submit Information for Verification')
                                    : profile?.role === 'organizer' 
                                    ? (isUpdating ? 'Recording Payment...' : 'Record Payment & Open Square')
                                    : (isUpdating ? 'Submitting...' : 'Submit Information for Verification')
                                }
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle>Registered Players</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {players.map((player: any) => {
                                    const selectionInfo = confirmation.selections[player.id] || {};
                                    return (
                                        <div key={player.id} className="flex justify-between items-center border-b pb-2 text-sm">
                                            <div>
                                                <p className="font-medium">{player.firstName} {player.lastName}</p>
                                                <p className="text-muted-foreground">Section: {selectionInfo.section || player.section || 'N/A'}</p>
                                            </div>
                                            <Badge variant="secondary">{selectionInfo.uscfStatus || 'Current'}</Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                    <PaymentHistorySection />
                </div>
                <NotesSection />
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button variant="outline" onClick={handleRefreshStatus} disabled={isRefreshing} className="mr-auto">
                    {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync with Square
                </Button>
                <Button variant="ghost" onClick={onClose}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
