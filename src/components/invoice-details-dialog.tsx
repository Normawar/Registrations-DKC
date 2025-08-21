
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { ExternalLink, Upload, CreditCard, Check, DollarSign, RefreshCw, Loader2, Download, File as FileIcon, X, Trash2, History, MessageSquare, Shield, CheckCircle, UploadCloud } from "lucide-react";
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
      // Initialize ALL fields as empty strings to prevent controlled/uncontrolled issues
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
  
  const canRecordPayment = useMemo(() => {
    // Check if at least one payment method is selected
    const hasSelectedMethod = selectedPaymentMethods.length > 0;
    
    // Check if selected methods have valid amounts
    const hasValidAmount = selectedPaymentMethods.some(method => {
      switch (method) {
        case 'check':
          return parseFloat(safeString(checkAmount)) > 0;
        case 'zelle':
          return parseFloat(safeString(zelleAmount)) > 0;
        case 'cashapp':
          return parseFloat(safeString(cashAppAmount)) > 0;
        case 'venmo':
          return parseFloat(safeString(venmoAmount)) > 0;
        case 'cash':
          return parseFloat(safeString(cashAmount)) > 0;
        case 'other':
          return parseFloat(safeString(otherAmount)) > 0;
        default:
          return false;
      }
    });
  
    return hasSelectedMethod && hasValidAmount;
  }, [selectedPaymentMethods, checkAmount, zelleAmount, cashAppAmount, venmoAmount, cashAmount, otherAmount]);

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return 'N/A';
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX if 10 digits
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // Return as-is if not standard format
  };

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file types (images only)
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB limit
      return isValidType && isValidSize;
    });
  
    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
      
      // Create preview URLs
      const newUrls = validFiles.map(file => URL.createObjectURL(file));
      setFileUrls(prev => [...prev, ...newUrls]);
    }
  
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFileUrls(prev => {
      // Revoke URL to prevent memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const RegistrationDetailsSection = () => (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold mb-4">Registration Details</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Event</span>
          <span>{confirmation?.invoiceTitle || confirmation?.eventName || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Date</span>
          <span>{confirmation?.eventDate ? format(new Date(confirmation.eventDate), 'PPP') : 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Sponsor Name</span>
          <span>{confirmation?.purchaserName || (confirmation?.firstName + ' ' + confirmation?.lastName) || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Sponsor Email</span>
          <span>{confirmation?.sponsorEmail || confirmation?.email || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Sponsor Phone</span>
          <span>{formatPhoneNumber(confirmation?.sponsorPhone || confirmation?.phone || '')}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">School</span>
          <span>{confirmation?.schoolName || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between font-semibold text-lg border-t pt-3">
          <span>Total Amount</span>
          <span className="text-blue-600">${totalInvoiced.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  const ProofOfPaymentSection = () => (
    <div className="mt-4">
      <h4 className="text-md font-medium mb-2">Proof of Payment</h4>
      
      {/* Upload Button */}
      <div className="mb-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          multiple
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Screenshot/Photo
        </Button>
      </div>
  
      {/* Uploaded Files Preview */}
      {fileUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Uploaded files:</p>
          <div className="grid grid-cols-2 gap-2">
            {fileUrls.map((url, index) => (
              <div key={index} className="relative">
                <img
                  src={url}
                  alt={`Proof ${index + 1}`}
                  className="w-full h-20 object-cover rounded border"
                />
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const RecordPaymentButton = () => (
    <Button
      onClick={handlePaymentUpdate}
      disabled={!canRecordPayment || isUpdating}
      className="w-full"
    >
      {isUpdating ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Recording Payment...
        </>
      ) : (
        'Record Payment'
      )}
    </Button>
  );

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

  const handleSync = () => {
    // Placeholder for sync logic
    console.log("Syncing with Square...");
  };

  const isSyncing = isRefreshing;


  if (!isOpen || !confirmation) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                PARTIALLY PAID
              </Badge>
              Invoice #{confirmation?.invoiceNumber || 'Unknown'}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Registration Details */}
          <div>
            <RegistrationDetailsSection />
            
            {/* Payment Summary */}
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-green-600 font-medium">Amount Paid</span>
                <span className="text-green-600 font-bold">${totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600 font-medium">Balance Due</span>
                <span className="text-red-600 font-bold">${balanceDue.toFixed(2)}</span>
              </div>
            </div>

            {/* Square Invoice Link */}
            <div className="mt-4">
              <label className="text-sm text-gray-600">Invoice Link</label>
              <Button
                variant="outline"
                className="w-full mt-1"
                onClick={() => window.open(confirmation?.invoiceUrl, '_blank')}
              >
                View on Square
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Right Column - Payment Methods */}
          <div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-lg font-semibold mb-4">Submit Payment Information</h3>
              <p className="text-sm text-gray-600 mb-4">
                Record payments or submit payment information for verification.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Payment Method</label>
                  <div className="mt-2">
                    {renderPaymentMethodInputs()}
                  </div>
                </div>

                {/* Add Proof of Payment Section */}
                {selectedPaymentMethods.length > 0 && <ProofOfPaymentSection />}

                {/* Record Payment Button */}
                <RecordPaymentButton />
              </div>
            </div>
          </div>
        </div>

        {/* Sync Button */}
        <div className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync with Square
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    