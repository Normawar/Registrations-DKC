
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
    // Use the production Square dashboard - it handles both sandbox and production
    const baseUrl = 'https://squareup.com/dashboard/invoices';
    
    if (invoiceNumber) {
      return `${baseUrl}/${invoiceNumber}`;
    }
    return baseUrl;
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
  
        // ✅ FIXED: Open Square dashboard with better timing and instructions
        const squareDashboardUrl = getSquareDashboardUrl(confirmation.invoiceNumber);
        
        // Add a small delay to ensure state is updated
        setTimeout(() => {
          window.open(squareDashboardUrl, '_blank');
        }, 500);
  
        // Show detailed instructions for Square
        toast({ 
          title: '✅ Payment Recorded - Now Update Square', 
          description: `$${paymentAmount.toFixed(2)} saved locally. Square opening - look for invoice #${confirmation.invoiceNumber || confirmation.id.slice(-8)}. Click on the invoice, then "Mark as paid" to record the ${selectedPaymentMethod.replace('-', ' ')} payment.`,
          duration: 20000
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
      <p>Test Notes Section</p>
    );
  };

  const PaymentHistorySection = () => {
    return (
      <PaymentHistoryDisplay confirmation={confirmation} />
    );
  };

  const SquareDashboardButton = () => {
    if (profile?.role !== 'organizer') return null;
  
    const openSquareDashboard = () => {
      // Direct to Square dashboard where they can mark invoices as paid
      const dashboardUrl = getSquareDashboardUrl(confirmation?.invoiceNumber || '');
      window.open(dashboardUrl, '_blank');
      
      toast({
        title: 'Square Dashboard Opened',
        description: `Opening Square dashboard. Find invoice #${confirmation?.invoiceNumber || confirmation?.id.slice(-8)}, click on it, then click "Mark as paid" button.`,
        duration: 15000
      });
    };
  
    const openSpecificInvoice = () => {
      // Try to open the specific invoice URL
      const invoiceUrl = `https://squareup.com/dashboard/invoices/${confirmation?.invoiceNumber || confirmation?.id}`;
      window.open(invoiceUrl, '_blank');
      
      toast({
        title: 'Opening Specific Invoice',
        description: `Attempting to open invoice #${confirmation?.invoiceNumber || confirmation?.id.slice(-8)} directly. If not found, navigate manually in the dashboard.`,
        duration: 12000
      });
    };
  
    return (
      <div className="border-t pt-4 mt-4">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm">Square Dashboard Access</h4>
            <p className="text-xs text-muted-foreground">Open Square to mark invoice as paid</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="default" onClick={openSquareDashboard} size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Square Dashboard
            </Button>
            
            <Button variant="outline" onClick={openSpecificInvoice} size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Try Direct Invoice Link
            </Button>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded p-3">
            <p className="text-xs text-orange-800 font-medium mb-2">
              🎯 Square Dashboard Steps:
            </p>
            <ol className="text-xs text-orange-700 space-y-1 list-decimal list-inside">
              <li><strong>Sign in</strong> to Square dashboard</li>
              <li><strong>Search for</strong> invoice #{confirmation?.invoiceNumber || confirmation?.id.slice(-8)}</li>
              <li><strong>Click on the invoice</strong> to open it</li>
              <li><strong>Look for "Mark as paid"</strong> button (usually at the top)</li>
              <li><strong>Enter amount:</strong> ${Math.max(0, (confirmation?.totalAmount || 0) - (confirmation?.totalPaid || 0)).toFixed(2)}</li>
              <li><strong>Select payment method</strong> and add details</li>
              <li><strong>Save</strong> the payment</li>
              <li><strong>Return here</strong> and click "Sync with Square"</li>
            </ol>
          </div>
  
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-xs text-red-800 font-medium mb-1">
              ⚠️ If Square Dashboard Doesn't Open:
            </p>
            <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
              <li>Check if pop-ups are blocked in your browser</li>
              <li>Manually go to <strong>squareup.com</strong> and sign in</li>
              <li>Navigate to Invoices → Find #{confirmation?.invoiceNumber || confirmation?.id.slice(-8)}</li>
              <li>Use the search bar in Square to find the invoice</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const getOrganizerInstructions = (method: string) => {
    if (profile?.role !== 'organizer') return null;
    
    const balanceDue = Math.max(0, (confirmation?.totalAmount || 0) - (confirmation?.totalPaid || 0));
    
    return (
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
        <p className="text-sm text-blue-800 font-medium mb-2">
          📋 Organizer Payment Recording Process:
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-blue-700 font-medium">Step 1: Record in This App</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside ml-2">
              <li>Enter ${balanceDue.toFixed(2)} in the {method} amount field above</li>
              <li>Click "Record Payment" to save locally</li>
            </ol>
          </div>
          
          <div>
            <p className="text-xs text-blue-700 font-medium">Step 2: Mark as Paid in Square</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside ml-2">
              <li>Click "Open Invoice" button below</li>
              <li>Sign in to Square dashboard</li>
              <li>Find invoice #{confirmation?.invoiceNumber || confirmation?.id.slice(-8)}</li>
              <li>Click "Mark as paid" button</li>
              <li>Enter amount: ${balanceDue.toFixed(2)}</li>
              <li>Select payment method: {method}</li>
              <li>Add note: "Payment recorded by {profile?.firstName || 'organizer'}"</li>
              <li>Save the payment</li>
            </ol>
          </div>
  
          <div>
            <p className="text-xs text-blue-700 font-medium">Step 3: Sync Back</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside ml-2">
              <li>Return to this app</li>
              <li>Click "Sync with Square" button</li>
              <li>Verify the payment status updated</li>
            </ol>
          </div>
        </div>
      </div>
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
  
      // ... Add similar updates for other payment methods (cash-app, zelle, etc.)
      
      default:
        return null;
    }
  };


  if (!isOpen || !confirmation) return null;

  const totalInvoiced = confirmation?.totalAmount || confirmation?.totalInvoiced || 0;
  const paymentHistory = confirmation?.paymentHistory || [];
  const calculatedTotalPaid = paymentHistory.reduce((sum: number, payment: any) => {
    return sum + (payment.amount || 0);
  }, 0);
  const totalPaid = Math.max(calculatedTotalPaid, confirmation?.totalPaid || 0);
  const balanceDue = Math.max(0, totalInvoiced - totalPaid);
  
  const players = getRegisteredPlayers(confirmation);
  const isPaymentApproved = ['PAID', 'COMPED'].includes(confirmation.invoiceStatus?.toUpperCase());
  const isIndividualInvoice = confirmation.schoolName === 'Individual Registration';
  
  const invoiceUrl = confirmation.publicUrl || confirmation.invoiceUrl;

  const SquareReminderBanner = () => {
    const [showReminder, setShowReminder] = useState(true);

    if (profile?.role !== 'organizer' || !showReminder) return null;
    
    const hasRecentPayment = confirmation?.paymentHistory?.some((payment: any) => {
      if (payment.source !== 'manual') return false;
      const paymentTime = new Date(payment.date);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return paymentTime > fiveMinutesAgo;
    });
  
    if (!hasRecentPayment) return null;
  
    const openSquareNow = () => {
      const dashboardUrl = getSquareDashboardUrl(confirmation?.invoiceNumber || '');
      window.open(dashboardUrl, '_blank');
    };
  
    return (
      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="text-yellow-600 mt-1">
            <ExternalLink className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-800 mb-1">
              📌 Don't Forget: Update Square Dashboard
            </h4>
            <p className="text-xs text-yellow-700 mb-3">
              You just recorded a payment locally. Now mark it as paid in Square to keep both systems synchronized.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={openSquareNow} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                Open Square Now
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReminder(false)}>
                I'll do it later
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
                
                <SquareReminderBanner />
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
                                    ? (isUpdating ? 'Recording...' : 'Record Payment & Open Square')
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
                {profile?.role === 'organizer' && (
                  <SquareDashboardButton />
                )}
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

    