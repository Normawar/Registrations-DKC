
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
import { ExternalLink, Upload, CreditCard, Check, DollarSign, RefreshCw, Loader2, Download, File as FileIcon, X, Trash2, History, MessageSquare, Shield, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { recordPayment } from '@/ai/flows/record-payment-flow';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { getInvoiceStatusWithPayments } from '@/ai/flows/get-invoice-status-flow';
import { PaymentHistoryDisplay } from '@/components/unified-payment-system';
import { Checkbox } from './ui/checkbox';


interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  confirmationId: string;
}

const safeString = (value: any): string => {
  if (value === null || value === undefined || value === false || Number.isNaN(value)) {
    return '';
  }
  const str = String(value);
  return str === 'undefined' || str === 'null' ? '' : str;
};

const createSafeOnChange = (setter: (value: string) => void) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setter(safeString(value));
  };
};

export function InvoiceDetailsDialog({ isOpen, onClose, confirmationId }: InvoiceDetailsDialogProps) {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const { database: masterDatabase } = useMasterDb();
  
  const [confirmation, setConfirmation] = useState<any>(null);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  const [cashAmount, setCashAmount] = useState<string>('');
  const [checkAmount, setCheckAmount] = useState<string>('');
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [creditCardAmount, setCreditCardAmount] = useState<string>('');
  const [creditCardLast4, setCreditCardLast4] = useState<string>('');
  const [cashAppAmount, setCashAppAmount] = useState<string>('');
  const [cashAppHandle, setCashAppHandle] = useState<string>('');
  const [venmoAmount, setVenmoAmount] = useState<string>('');
  const [venmoHandle, setVenmoHandle] = useState<string>('');
  const [otherAmount, setOtherAmount] = useState<string>('');
  const [otherDescription, setOtherDescription] = useState<string>('');
  const [zelleAmount, setZelleAmount] = useState<string>('');
  const [zelleEmail, setZelleEmail] = useState<string>('');
  const [poAmount, setPoAmount] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  const [initialPaymentValuesSet, setInitialPaymentValuesSet] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sponsorNote, setSponsorNote] = useState<string>('');
  const [organizerNote, setOrganizerNote] = useState<string>('');
  const [showReminder, setShowReminder] = useState(true);

  const getRegisteredPlayers = (conf: any) => {
    if (!conf?.selections) return [];
    const playerIds = Object.keys(conf.selections);
    return masterDatabase.filter(player => playerIds.includes(player.id));
  };

  const players = getRegisteredPlayers(confirmation);
  const isPaymentApproved = ['PAID', 'COMPED'].includes(confirmation?.invoiceStatus?.toUpperCase() || '');
  const isIndividualInvoice = confirmation?.schoolName === 'Individual Registration';
  
  const paymentHistory = confirmation?.paymentHistory || [];
  const calculatedTotalPaid = paymentHistory.reduce((sum: number, payment: any) => {
    return sum + (payment.amount || 0);
  }, 0);
  const totalInvoiced = confirmation?.totalAmount || confirmation?.totalInvoiced || 0;
  const totalPaid = Math.max(calculatedTotalPaid, confirmation?.totalPaid || 0);
  const balanceDue = Math.max(0, totalInvoiced - totalPaid);
  const invoiceUrl = confirmation?.publicUrl || confirmation?.invoiceUrl;

  useEffect(() => {
    if (!isOpen) {
      setInitialPaymentValuesSet(false); // Reset on close
      return;
    };
  
    const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
    const currentConf = allInvoices.find((c: any) => c.id === confirmationId);
    if (currentConf) {
      setConfirmation(currentConf);
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

  useEffect(() => {
    if (confirmation && !initialPaymentValuesSet) {
      setCheckAmount(safeString(confirmation.checkAmount || ''));
      setCheckNumber(safeString(confirmation.checkNumber || ''));
      setZelleAmount(safeString(confirmation.zelleAmount || ''));
      setZelleEmail(safeString(confirmation.zelleEmail || ''));
      setCashAppAmount(safeString(confirmation.cashAppAmount || ''));
      setCashAppHandle(safeString(confirmation.cashAppHandle || ''));
      setVenmoAmount(safeString(confirmation.venmoAmount || ''));
      setVenmoHandle(safeString(confirmation.venmoHandle || ''));
      setCashAmount(safeString(confirmation.cashAmount || ''));
      setOtherAmount(safeString(confirmation.otherAmount || ''));
      setOtherDescription(safeString(confirmation.otherDescription || ''));
      
      setInitialPaymentValuesSet(true);
    }
  }, [confirmation, initialPaymentValuesSet]);

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
    try {
      const paymentData = {
        checkAmount: parseFloat(safeString(checkAmount)) || 0,
        checkNumber: safeString(checkNumber),
        zelleAmount: parseFloat(safeString(zelleAmount)) || 0,
        zelleEmail: safeString(zelleEmail),
        cashAppAmount: parseFloat(safeString(cashAppAmount)) || 0,
        cashAppHandle: safeString(cashAppHandle),
        venmoAmount: parseFloat(safeString(venmoAmount)) || 0,
        venmoHandle: safeString(venmoHandle),
        cashAmount: parseFloat(safeString(cashAmount)) || 0,
        otherAmount: parseFloat(safeString(otherAmount)) || 0,
        otherDescription: safeString(otherDescription),
      };

      // ... rest of your payment update logic
    } catch (error) {
      console.error('Error updating payment:', error);
    }
  };
  
  const handleDeleteFile = async () => {
      // This function needs to be adapted for multiple payment methods
      // For now, let's assume it targets a generic `paymentFileUrl`
      if (!confirmation?.paymentFileUrl) return;

      const fileUrl = confirmation.paymentFileUrl;
      
      setIsUpdating(true);
      try {
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);

          const updatedConfirmationData = { ...confirmation };
          delete updatedConfirmationData.paymentFileUrl;
          delete updatedConfirmationData.paymentFileName;

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
  
  const renderPaymentMethodInputs = () => {
    return (
      <div className="space-y-4">
        {/* Check Payment */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="check"
            checked={selectedPaymentMethods.includes('check')}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedPaymentMethods(prev => [...prev, 'check']);
              } else {
                setSelectedPaymentMethods(prev => prev.filter(method => method !== 'check'));
                setCheckAmount('');
                setCheckNumber('');
              }
            }}
          />
          <label htmlFor="check" className="text-sm font-medium">Check</label>
        </div>
        {selectedPaymentMethods.includes('check') && (
          <div className="ml-6 space-y-2">
            <Input
              placeholder="Check amount"
              value={safeString(checkAmount)}
              onChange={createSafeOnChange(setCheckAmount)}
            />
            <Input
              placeholder="Check number"
              value={safeString(checkNumber)}
              onChange={createSafeOnChange(setCheckNumber)}
            />
          </div>
        )}

        {/* Zelle Payment */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="zelle"
            checked={selectedPaymentMethods.includes('zelle')}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedPaymentMethods(prev => [...prev, 'zelle']);
              } else {
                setSelectedPaymentMethods(prev => prev.filter(method => method !== 'zelle'));
                setZelleAmount('');
                setZelleEmail('');
              }
            }}
          />
          <label htmlFor="zelle" className="text-sm font-medium">Zelle</label>
        </div>
        {selectedPaymentMethods.includes('zelle') && (
          <div className="ml-6 space-y-2">
            <Input
              placeholder="Zelle amount"
              value={safeString(zelleAmount)}
              onChange={createSafeOnChange(setZelleAmount)}
            />
            <Input
              placeholder="Zelle email"
              value={safeString(zelleEmail)}
              onChange={createSafeOnChange(setZelleEmail)}
            />
          </div>
        )}

        {/* Cash App Payment */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="cashapp"
            checked={selectedPaymentMethods.includes('cashapp')}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedPaymentMethods(prev => [...prev, 'cashapp']);
              } else {
                setSelectedPaymentMethods(prev => prev.filter(method => method !== 'cashapp'));
                setCashAppAmount('');
                setCashAppHandle('');
              }
            }}
          />
          <label htmlFor="cashapp" className="text-sm font-medium">Cash App</label>
        </div>
        {selectedPaymentMethods.includes('cashapp') && (
          <div className="ml-6 space-y-2">
            <Input
              placeholder="Cash App amount"
              value={safeString(cashAppAmount)}
              onChange={createSafeOnChange(setCashAppAmount)}
            />
            <Input
              placeholder="Cash App handle"
              value={safeString(cashAppHandle)}
              onChange={createSafeOnChange(setCashAppHandle)}
            />
          </div>
        )}

        {/* Venmo Payment */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="venmo"
            checked={selectedPaymentMethods.includes('venmo')}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedPaymentMethods(prev => [...prev, 'venmo']);
              } else {
                setSelectedPaymentMethods(prev => prev.filter(method => method !== 'venmo'));
                setVenmoAmount('');
                setVenmoHandle('');
              }
            }}
          />
          <label htmlFor="venmo" className="text-sm font-medium">Venmo</label>
        </div>
        {selectedPaymentMethods.includes('venmo') && (
          <div className="ml-6 space-y-2">
            <Input
              placeholder="Venmo amount"
              value={safeString(venmoAmount)}
              onChange={createSafeOnChange(setVenmoAmount)}
            />
            <Input
              placeholder="Venmo handle"
              value={safeString(venmoHandle)}
              onChange={createSafeOnChange(setVenmoHandle)}
            />
          </div>
        )}

        {/* Cash Payment */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="cash"
            checked={selectedPaymentMethods.includes('cash')}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedPaymentMethods(prev => [...prev, 'cash']);
              } else {
                setSelectedPaymentMethods(prev => prev.filter(method => method !== 'cash'));
                setCashAmount('');
              }
            }}
          />
          <label htmlFor="cash" className="text-sm font-medium">Cash</label>
        </div>
        {selectedPaymentMethods.includes('cash') && (
          <div className="ml-6 space-y-2">
            <Input
              placeholder="Cash amount"
              value={safeString(cashAmount)}
              onChange={createSafeOnChange(setCashAmount)}
            />
          </div>
        )}

        {/* Other Payment */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="other"
            checked={selectedPaymentMethods.includes('other')}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedPaymentMethods(prev => [...prev, 'other']);
              } else {
                setSelectedPaymentMethods(prev => prev.filter(method => method !== 'other'));
                setOtherAmount('');
                setOtherDescription('');
              }
            }}
          />
          <label htmlFor="other" className="text-sm font-medium">Other</label>
        </div>
        {selectedPaymentMethods.includes('other') && (
          <div className="ml-6 space-y-2">
            <Input
              placeholder="Other amount"
              value={safeString(otherAmount)}
              onChange={createSafeOnChange(setOtherAmount)}
            />
            <Input
              placeholder="Description"
              value={safeString(otherDescription)}
              onChange={createSafeOnChange(setOtherDescription)}
            />
          </div>
        )}
      </div>
    );
  };

  const SquareDashboardButton = () => {
    if (profile?.role !== 'organizer') return null;
  
    const openDeveloperConsole = () => {
      window.open('https://developer.squareup.com/apps', '_blank');
      
      toast({
        title: 'Square Developer Console Opened',
        description: `Opening Developer Console. Look for your app (likely "registrations"), then navigate to sandbox data to find invoice #${confirmation?.invoiceNumber || confirmation?.id.slice(-8)}.`,
        duration: 20000
      });
    };
  
    const openAPIExplorer = () => {
      window.open('https://developer.squareup.com/explorer/square/invoices-api', '_blank');
      
      toast({
        title: 'Square API Explorer Opened',
        description: 'Use the API Explorer to search for and update invoices directly.',
        duration: 15000
      });
    };
  
    const openSandboxTestAccounts = () => {
      window.open('https://developer.squareup.com/console/en/apps/sandbox', '_blank');
      
      toast({
        title: 'Sandbox Test Accounts Opened',
        description: 'Access sandbox test accounts to view transactions and invoices.',
        duration: 12000
      });
    };
  
    return (
      <div className="border-t pt-4 mt-4">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm">Square Developer Console</h4>
            <p className="text-xs text-muted-foreground">Access sandbox invoice management tools</p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="default" onClick={openDeveloperConsole} size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Developer Console
            </Button>
            
            <Button variant="outline" onClick={openAPIExplorer} size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              API Explorer
            </Button>
  
            <Button variant="outline" onClick={openSandboxTestAccounts} size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Sandbox Accounts
            </Button>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-800 font-medium mb-2">
              🔧 Developer Console Steps:
            </p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li><strong>Click "Open" on your application</strong> (likely "registrations")</li>
              <li><strong>Navigate to sandbox data/webhooks</strong> section</li>
              <li><strong>Look for invoice data</strong> or webhook logs</li>
              <li><strong>Find invoice #{confirmation?.invoiceNumber || confirmation?.id.slice(-8)}</strong></li>
              <li><strong>Use API Explorer</strong> to update invoice status if needed</li>
            </ol>
          </div>
  
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-xs text-green-800 font-medium mb-2">
              📋 API Explorer Method (Recommended):
            </p>
            <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside">
              <li>Open <strong>"API Explorer"</strong> button above</li>
              <li>Select <strong>"Invoices API"</strong> from dropdown</li>
              <li>Choose <strong>"Search Invoices"</strong> endpoint</li>
              <li>Add filter: <code>invoice_number = "{confirmation?.invoiceNumber || confirmation?.id.slice(-8)}"</code></li>
              <li>Click <strong>"Run request"</strong> to find your invoice</li>
              <li>Copy the <strong>invoice ID</strong> from results</li>
              <li>Use <strong>"Update Invoice"</strong> endpoint to mark as paid</li>
              <li>Return here and click <strong>"Sync with Square"</strong></li>
            </ol>
          </div>
  
          <div className="bg-orange-50 border border-orange-200 rounded p-3">
            <p className="text-xs text-orange-800 font-medium mb-2">
              🎯 Quick Invoice Details:
            </p>
            <div className="text-xs text-orange-700 space-y-1">
              <p><strong>Invoice Number:</strong> {confirmation?.invoiceNumber || confirmation?.id.slice(-8)}</p>
              <p><strong>Invoice ID:</strong> {confirmation?.invoiceId || 'Use Search Invoices to find'}</p>
              <p><strong>Amount to mark paid:</strong> ${balanceDue.toFixed(2)}</p>
              <p><strong>Application:</strong> Likely "registrations" (based on your setup)</p>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const getOrganizerInstructions = (method: string) => {
    if (profile?.role !== 'organizer') return null;
    
    return (
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
        <p className="text-sm text-blue-800 font-medium mb-2">
          📋 Organizer Workflow for Square Sandbox:
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-blue-700 font-medium">Step 1: Record Payment Locally</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside ml-2">
              <li>Enter ${balanceDue.toFixed(2)} in the {method} amount field above</li>
              <li>Click "Record Payment" to save locally and open API Explorer</li>
            </ol>
          </div>
          
          <div>
            <p className="text-xs text-blue-700 font-medium">Step 2: Update Square via API Explorer</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside ml-2">
              <li>API Explorer will open automatically</li>
              <li>Select "Invoices API" → "Search Invoices"</li>
              <li>Add filter: invoice_number = "{confirmation?.invoiceNumber || confirmation?.id.slice(-8)}"</li>
              <li>Run request to find your invoice</li>
              <li>Copy the invoice ID from results</li>
              <li>Use "Update Invoice" to mark as paid</li>
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
  
  const SquareReminderBanner = () => {
    if (profile?.role !== 'organizer' || !showReminder) return null;
    
    const hasRecentPayment = confirmation?.paymentHistory?.some((payment: any) => {
      if (payment.source !== 'manual') return false;
      const paymentTime = new Date(payment.date);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return paymentTime > fiveMinutesAgo;
    });
  
    if (!hasRecentPayment) return null;
  
    const openSquareNow = () => {
        window.open('https://developer.squareup.com/apps', '_blank');
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

  if (!isOpen || !confirmation) return null;
  
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
                                {renderPaymentMethodInputs()}
                            </div>
    
                            <Separator />
                            
                        </CardContent>
                         <CardFooter>
                            <Button 
                                onClick={handlePaymentUpdate} 
                                disabled={
                                    isUpdating || 
                                    !isAuthReady || 
                                    (!!authError && !selectedPaymentMethods.includes('cash')) || 
                                    isPaymentApproved ||
                                    (profile?.role === 'organizer' && selectedPaymentMethods.length === 0)
                                } 
                                className="flex items-center gap-2"
                            >
                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {profile?.role === 'organizer' 
                                    ? (isUpdating ? 'Recording...' : 'Record Payment')
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
                    <PaymentHistoryDisplay confirmation={confirmation} />
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
