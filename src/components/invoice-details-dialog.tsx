
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
import { useSponsorProfile, type SponsorProfile } from "@/hooks/use-sponsor-profile";
import { useMasterDb } from "@/context/master-db-context";
import { Upload, ExternalLink, CreditCard, Check, DollarSign, RefreshCw, Loader2, Download, File as FileIcon, X, Trash2, History, MessageSquare, Shield, CheckCircle, UploadCloud } from 'lucide-react';
import { format } from "date-fns";
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { recordPayment } from '@/ai/flows/record-payment-flow';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { getInvoiceStatusWithPayments } from '@/ai/flows/get-invoice-status-flow';
import { PaymentHistoryDisplay } from '@/components/unified-payment-system';
import { Checkbox } from './ui/checkbox';

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

interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  confirmationId: string;
}

const getKnownSponsorPhone = (email: string): string | null => {
  const knownSponsors: Record<string, string> = {
    'normaguerra@yahoo.com': '(111) 111-1111',
    // Add more sponsors here
  };
  
  if (!email) return null;
  
  // Try case-insensitive match
  const emailLower = email.toLowerCase();
  const foundEntry = Object.entries(knownSponsors).find(
    ([key]) => key.toLowerCase() === emailLower
  );
  
  return foundEntry ? foundEntry[1] : null;
};


const formatPhoneNumber = (phone: string) => {
  if (!phone || phone.trim() === '') return 'Not provided';
  
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length > 0) {
    return phone; // Return original format if it doesn't match standard patterns
  }
  
  return 'Invalid phone format';
};

const getPhoneFromProfile = (profile: any) => {
  if (!profile) return null;
  
  // Try different access patterns
  const phonePatterns = [
    profile.phone,
    profile.cellPhone,
    profile.phoneNumber,
    profile.cellPhoneNumber,
    profile.mobile,
    profile.tel,
    profile.telephone,
    profile['phone'],
    profile['cellPhone'],
    profile['phoneNumber'],
    profile['cell_phone'],
    profile['phone_number'],
    profile['Cell Phone Number'], // Exact match from UI
    profile['cellPhoneNumber'],
    profile.contact?.phone,
    profile.personalInfo?.phone,
    profile.details?.phone
  ];
  
  // Return the first non-empty value
  return phonePatterns.find(phone => phone && phone.trim() !== '');
};


export function InvoiceDetailsDialog({ isOpen, onClose, confirmationId }: InvoiceDetailsDialogProps) {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const { database: masterDatabase } = useMasterDb();
  
  const [confirmation, setConfirmation] = useState<any>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sponsorNote, setSponsorNote] = useState<string>('');
  const [organizerNote, setOrganizerNote] = useState<string>('');
  const [showReminder, setShowReminder] = useState(true);

  // Core payment method selection
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [initialPaymentValuesSet, setInitialPaymentValuesSet] = useState(false);

  // Check payment fields
  const [checkAmount, setCheckAmount] = useState('');
  const [checkNumber, setCheckNumber] = useState('');

  // Zelle payment fields  
  const [zelleAmount, setZelleAmount] = useState('');
  const [zelleEmail, setZelleEmail] = useState('');

  // Cash App payment fields
  const [cashAppAmount, setCashAppAmount] = useState('');
  const [cashAppHandle, setCashAppHandle] = useState('');

  // Venmo payment fields
  const [venmoAmount, setVenmoAmount] = useState('');
  const [venmoHandle, setVenmoHandle] = useState('');

  // Cash payment fields
  const [cashAmount, setCashAmount] = useState('');

  // Other payment fields
  const [otherAmount, setOtherAmount] = useState('');
  const [otherDescription, setOtherDescription] = useState('');
  
  const [poAmount, setPoAmount] = useState('');
  const [poNumber, setPoNumber] = useState('');

  const [creditCardAmount, setCreditCardAmount] = useState('');
  const [creditCardLast4, setCreditCardLast4] = useState('');

  const getRegisteredPlayers = (conf: any) => {
    if (!conf?.selections) return [];
    const playerIds = Object.keys(conf.selections);
    return masterDatabase.filter(player => playerIds.includes(player.id));
  };
  
  const calculatedTotalPaid = useMemo(() => {
    if (!confirmation?.paymentHistory) return 0;
    return confirmation.paymentHistory.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
  }, [confirmation?.paymentHistory]);
  
  const totalInvoiced = confirmation?.totalAmount || confirmation?.totalInvoiced || 0;
  const totalPaid = Math.max(calculatedTotalPaid, confirmation?.totalPaid || 0);
  const balanceDue = Math.max(0, totalInvoiced - totalPaid);

  const isPaymentApproved = ['PAID', 'COMPED'].includes(confirmation?.invoiceStatus?.toUpperCase() || '');
  const isIndividualInvoice = confirmation?.schoolName === 'Individual Registration';

  // Invoice URL
  const invoiceUrl = confirmation?.publicUrl || confirmation?.invoiceUrl;


  useEffect(() => {
    if (!isOpen) return;

    const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
    const currentConf = allInvoices.find((c: any) => c.id === confirmationId);
    if (currentConf) {
        console.log('📋 Loading confirmation:', currentConf);
        console.log('📋 ALL CONFIRMATION KEYS:', Object.keys(currentConf).sort());
        console.log('📋 FULL CONFIRMATION OBJECT:', JSON.stringify(currentConf, null, 2));
        setConfirmation(currentConf);
        
        // Load selected payment methods
        const savedMethods = currentConf.selectedPaymentMethods || [];
        console.log('📋 Loading saved payment methods:', savedMethods);
        setSelectedPaymentMethods(savedMethods);
    }
  
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
      setPoNumber(safeString(confirmation.poNumber || ''));
      setPoAmount(safeString(confirmation.poAmount || ''));
      
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
                    method: squarePayment.method,
                    source: 'square'
                });
            }
        }
        unifiedPaymentHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const totalPaidFromHistory = unifiedPaymentHistory.reduce((sum, p) => sum + p.amount, 0);
        const totalPaid = Math.max(result.totalPaid, totalPaidFromHistory);
        
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
    console.log('handlePaymentUpdate called');
    setIsUpdating(true);
    
    try {
      const paymentData = {
        confirmationId: confirmation.id,
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
        uploadedFiles: uploadedFiles
      };
  
      console.log('Payment data to record:', paymentData);
      
      toast({
        title: 'Payment Recorded',
        description: `Successfully recorded ${Object.keys(selectedPaymentMethods).length} payment method(s)`,
      });
  
      setSelectedPaymentMethods([]);
      setCheckAmount('');
      setCheckNumber('');
      setZelleAmount('');
      setZelleEmail('');
      setCashAppAmount('');
      setCashAppHandle('');
      setVenmoAmount('');
      setVenmoHandle('');
      setCashAmount('');
      setOtherAmount('');
      setOtherDescription('');
      setUploadedFiles([]);
      setFileUrls([]);
  
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to record payment. Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDeleteFile = async () => {
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
    // Check all amounts
    const amounts = {
      checkAmount: checkAmount,
      zelleAmount: zelleAmount,
      cashAppAmount: cashAppAmount,
      venmoAmount: venmoAmount,
      cashAmount: cashAmount,
      otherAmount: otherAmount
    };
    
    if (!selectedPaymentMethods || selectedPaymentMethods.length === 0) {
      return false;
    }
  
    // Check each selected method for valid amount
    const result = selectedPaymentMethods.some(method => {
      let amount = 0;
      
      switch (method) {
        case 'check':
          amount = parseFloat(checkAmount || '0');
          break;
        case 'zelle':
          amount = parseFloat(zelleAmount || '0');
          break;
        case 'cashapp':
          amount = parseFloat(cashAppAmount || '0');
          break;
        case 'venmo':
          amount = parseFloat(venmoAmount || '0');
          break;
        case 'cash':
          amount = parseFloat(cashAmount || '0');
          break;
        case 'other':
          amount = parseFloat(otherAmount || '0');
          break;
        default:
          return false;
      }
      
      const isValid = !isNaN(amount) && amount > 0;
      return isValid;
    });
    
    return result;
  }, [selectedPaymentMethods, checkAmount, zelleAmount, cashAppAmount, venmoAmount, cashAmount, otherAmount]);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB limit
      return isValidType && isValidSize;
    });
  
    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
      
      const newUrls = validFiles.map(file => URL.createObjectURL(file));
      setFileUrls(prev => [...prev, ...newUrls]);
    }
  
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFileUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

const RegistrationDetailsSection = ({ invoice, profile }: { invoice: any, profile: SponsorProfile | null }) => {
  const sponsorEmail = invoice.purchaserEmail || invoice.sponsorEmail || invoice.email;
  const knownPhone = getKnownSponsorPhone(sponsorEmail);

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <span className="text-gray-600">Event</span>
        <span className="font-medium">{invoice.eventName || 'Chess Tournament'}</span>
      </div>
      
      <div className="flex justify-between">
        <span className="text-gray-600">Date</span>
        <span className="font-medium">{invoice.eventDate ? format(new Date(invoice.eventDate), 'PPP') : 'TBD'}</span>
      </div>
      
      <div className="flex justify-between">
        <span className="text-gray-600">Sponsor Name</span>
        <span className="font-medium">{invoice.purchaserName || invoice.sponsorName || 'FirstName LName'}</span>
      </div>
      
      <div className="flex justify-between">
        <span className="text-gray-600">Sponsor Email</span>
        <span className="font-medium">{sponsorEmail}</span>
      </div>
      
      <div className="flex justify-between">
        <span className="text-gray-600">Sponsor Phone</span>
        <span className="font-medium">
          {knownPhone 
            ? `${knownPhone} (from records)`
            : invoice.purchaserPhone || invoice.sponsorPhone || 'Phone not provided'
          }
        </span>
      </div>
      
      <div className="flex justify-between">
        <span className="text-gray-600">School</span>
        <span className="font-medium">{invoice.schoolName || 'SHARYLAND PIONEER H S'}</span>
      </div>

      {profile?.role === 'organizer' && knownPhone && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">📞 Organizer Contact Info</h4>
          <div className="text-sm space-y-1">
            <div><strong>Phone:</strong> {knownPhone}</div>
            <div><strong>Email:</strong> {sponsorEmail}</div>
          </div>
          <div className="flex gap-2 mt-2">
            <button 
              onClick={() => window.open(`tel:${knownPhone.replace(/\D/g, '')}`)}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              📞 Call
            </button>
            <button 
              onClick={() => window.open(`mailto:${sponsorEmail}`)}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              ✉️ Email
            </button>
          </div>
        </div>
      )}
    </div>
  );
};



const ProofOfPaymentSection = () => (
    <div className="mt-4">
      <h4 className="text-md font-medium mb-2">Proof of Payment</h4>
      
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

const PaymentFormComponent = ({ invoice }: { invoice: any }) => {
    const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
    const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({});
    
    const totalSelectedAmount = Object.values(paymentAmounts).reduce((sum, amount) => sum + amount, 0);
    
    const balanceDue = invoice.totalAmount - (invoice.totalPaid || 0);
    
    const isValidPayment = () => {
      const hasSelectedMethod = selectedMethods.length > 0;
      const hasValidAmount = totalSelectedAmount > 0;
      const amountNotExceedsBalance = totalSelectedAmount <= balanceDue;
      
      return hasSelectedMethod && hasValidAmount && amountNotExceedsBalance;
    };
  
    const handleMethodChange = (method: string, isChecked: boolean) => {
      let newSelectedMethods: string[];
      if (isChecked) {
        newSelectedMethods = [...selectedMethods, method];
      } else {
        newSelectedMethods = selectedMethods.filter(m => m !== method);
      }
      setSelectedMethods(newSelectedMethods);
      setSelectedPaymentMethods(newSelectedMethods);
    };
  
    const handleAmountChange = (method: string, amount: number) => {
        const newAmounts = { ...paymentAmounts, [method]: amount };
        setPaymentAmounts(newAmounts);

        if (method === 'Cash App') setCashAppAmount(amount.toString());
        if (method === 'Check') setCheckAmount(amount.toString());
        if (method === 'Cash') setCashAmount(amount.toString());
        if (method === 'Zelle') setZelleAmount(amount.toString());
        if (method === 'Venmo') setVenmoAmount(amount.toString());
    };
  
    const handleRecordPayment = async () => {
      if (!isValidPayment()) {
        toast({
          variant: 'destructive',
          title: 'Invalid Payment',
          description: 'Please select a payment method and enter a valid amount'
        });
        return;
      }
  
      setIsUpdating(true);
  
      try {
        const newPayment = {
          id: `payment_${Date.now()}`,
          amount: totalSelectedAmount,
          method: selectedMethods.join(', '),
          date: new Date().toISOString(),
          source: 'manual',
          status: 'completed',
          details: {
            selectedMethods,
            amounts: paymentAmounts,
            checkNumber: checkNumber,
            zelleEmail: zelleEmail,
            cashAppHandle: cashAppHandle,
            venmoHandle: venmoHandle,
          }
        };
  
        const updatedPaymentHistory = [...(confirmation.paymentHistory || []), newPayment];
        const newTotalPaid = totalPaid + totalSelectedAmount;
        const newBalanceDue = Math.max(0, totalInvoiced - newTotalPaid);
        
        let newStatus = confirmation.invoiceStatus || 'UNPAID';
        if (newTotalPaid >= totalInvoiced && newTotalPaid > 0) {
          newStatus = 'PAID';
        } else if (newTotalPaid > 0 && newTotalPaid < totalInvoiced) {
          newStatus = 'PARTIALLY_PAID';
        }
  
        const updatedConfirmationData = {
          ...confirmation,
          paymentHistory: updatedPaymentHistory,
          totalPaid: newTotalPaid,
          invoiceStatus: newStatus,
          status: newStatus,
          lastUpdated: new Date().toISOString(),
          checkAmount: selectedMethods.includes('Check') ? checkAmount : confirmation.checkAmount,
          checkNumber: selectedMethods.includes('Check') ? checkNumber : confirmation.checkNumber,
          cashAppAmount: selectedMethods.includes('Cash App') ? cashAppAmount : confirmation.cashAppAmount,
          cashAppHandle: selectedMethods.includes('Cash App') ? cashAppHandle : confirmation.cashAppHandle,
          zelleAmount: selectedMethods.includes('Zelle') ? zelleAmount : confirmation.zelleAmount,
          zelleEmail: selectedMethods.includes('Zelle') ? zelleEmail : confirmation.zelleEmail,
          venmoAmount: selectedMethods.includes('Venmo') ? venmoAmount : confirmation.venmoAmount,
          venmoHandle: selectedMethods.includes('Venmo') ? venmoHandle : confirmation.venmoHandle,
          cashAmount: selectedMethods.includes('Cash') ? cashAmount : confirmation.cashAmount,
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
  
        toast({
          title: 'Payment Recorded Successfully! 💳',
          description: `Recorded $${totalSelectedAmount.toFixed(2)} payment. New balance: $${newBalanceDue.toFixed(2)}`,
        });
  
        setSelectedMethods([]);
        setPaymentAmounts({});
        setCheckAmount(''); setCheckNumber('');
        setCashAppAmount(''); setCashAppHandle('');
        setZelleAmount(''); setZelleEmail('');
        setVenmoAmount(''); setVenmoHandle('');
        setCashAmount('');
  
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('all_invoices_updated'));
  
        if (newStatus === 'PAID') {
          setTimeout(() => {
            toast({
              title: '🎉 Invoice Fully Paid!',
              description: 'This invoice has been marked as PAID.',
            });
          }, 1000);
        }
  
      } catch (error) {
        console.error('Error recording payment:', error);
        toast({
          variant: 'destructive',
          title: 'Payment Recording Failed',
          description: 'Failed to record payment. Please try again.',
        });
      } finally {
        setIsUpdating(false);
      }
    };
  
    return (
      <div className="space-y-4">
        <div className="p-3 bg-gray-100 border rounded text-sm">
          <div><strong>Balance Due:</strong> ${balanceDue.toFixed(2)}</div>
        </div>
  
        <div className="space-y-3">
          <h3 className="font-medium">Payment Method</h3>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input type="checkbox" checked={selectedMethods.includes('Cash App')} onChange={(e) => handleMethodChange('Cash App', e.target.checked)} className="mr-2" />
              Cash App
            </label>
            {selectedMethods.includes('Cash App') && (
              <input type="number" value={paymentAmounts['Cash App'] || ''} onChange={(e) => handleAmountChange('Cash App', parseFloat(e.target.value) || 0)} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} />
            )}
          </div>
  
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input type="checkbox" checked={selectedMethods.includes('Check')} onChange={(e) => handleMethodChange('Check', e.target.checked)} className="mr-2" />
              Check
            </label>
            {selectedMethods.includes('Check') && (
              <div className="flex gap-2">
                <input type="number" value={paymentAmounts['Check'] || ''} onChange={(e) => handleAmountChange('Check', parseFloat(e.target.value) || 0)} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} />
                <input type="text" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="Check #" className="w-20 px-2 py-1 border rounded text-sm" />
              </div>
            )}
          </div>
        </div>
  
        {totalSelectedAmount > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex justify-between">
              <span>Total Payment:</span>
              <span className="font-medium">${totalSelectedAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining Balance:</span>
              <span className="font-medium">${(balanceDue - totalSelectedAmount).toFixed(2)}</span>
            </div>
          </div>
        )}
  
        <button onClick={handleRecordPayment} disabled={!isValidPayment() || isUpdating} className={`w-full py-2 px-4 rounded font-medium transition-colors ${isValidPayment() && !isUpdating ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
          {isUpdating ? 'Recording...' : 'Record Payment'}
        </button>
  
        <ProofOfPaymentSection />
      </div>
    );
  };


const isSyncing = isRefreshing;

const PaymentSummarySection = () => (
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
);

  const ButtonStyles = () => (
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  );

  if (!isOpen || !confirmation) return null;
  
  const ProfileDebugComponent = () => {
    useEffect(() => {
        console.log('🔍 PROFILE DEBUGGING:');
        console.log('Profile exists:', !!profile);
        console.log('Profile type:', typeof profile);
        
        if (profile) {
          console.log('Profile keys:', Object.keys(profile));
          console.log('Full profile object:', JSON.stringify(profile, null, 2));
          
          const phoneKeys = Object.keys(profile).filter(key => 
            key.toLowerCase().includes('phone') || 
            key.toLowerCase().includes('cell') ||
            key.toLowerCase().includes('mobile') ||
            key.toLowerCase().includes('tel')
          );
          console.log('Phone-related keys in profile:', phoneKeys);
          
          phoneKeys.forEach(key => {
            console.log(`Profile.${key}:`, (profile as any)[key]);
          });
        }
    }, [profile]);
  
    return null;
  };

  
  const SquareDeveloperConsoleButton = () => {
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
              <li>Run request to find your invoice</li>
              <li>Copy the <strong>invoice ID</strong> from results</li>
              <li>Use <strong>"Update Invoice"</strong> to mark as paid</li>
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
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ButtonStyles />
        <ProfileDebugComponent />
        <DialogHeader>
          
          <DialogTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(confirmation?.invoiceStatus || confirmation?.status || 'UNPAID', totalPaid, totalInvoiced)}
              Invoice #{confirmation?.invoiceNumber || 'Unknown'}
            </div>
          </DialogTitle>
        </DialogHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="bg-white rounded-lg border p-4">
              <h3 className="text-lg font-semibold mb-4">Registration Details</h3>
              <RegistrationDetailsSection invoice={confirmation} profile={profile} />
          </div>
          <PaymentSummarySection />
          <div className="mt-4">
            <label className="text-sm text-gray-600">Invoice Link</label>
            <Button
              variant="outline"
              className="w-full mt-1"
              onClick={() => window.open(confirmation?.invoiceUrl || confirmation?.publicUrl, '_blank')}
            >
              View on Square
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        <div>
            <div className="bg-white rounded-lg border p-4">
                <h3 className="text-lg font-semibold mb-4">Submit Payment Information</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Record payments or submit payment information for verification.
                </p>
                <PaymentFormComponent invoice={confirmation} />
            </div>
        </div>
      </div>

        {profile?.role === 'organizer' && (
            <SquareDeveloperConsoleButton />
        )}

        <div className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync with Square
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

