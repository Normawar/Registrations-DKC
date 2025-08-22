
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
    return phone;
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
  // Use the existing state variables from the main component
  const [localSelectedMethods, setLocalSelectedMethods] = useState<string[]>([]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({});
  
  const totalSelectedAmount = Object.values(paymentAmounts).reduce((sum, amount) => sum + amount, 0);
  
  // Calculate balance due from the main component's values
  const balanceDue = Math.max(0, totalInvoiced - totalPaid);
  
  const isValidPayment = () => {
    const hasSelectedMethod = localSelectedMethods.length > 0;
    const hasValidAmount = totalSelectedAmount > 0;
    const amountNotExceedsBalance = totalSelectedAmount <= balanceDue;
    
    console.log('🔍 Payment Validation:', {
      hasSelectedMethod,
      hasValidAmount,
      amountNotExceedsBalance,
      localSelectedMethods,
      totalSelectedAmount,
      balanceDue
    });
    
    return hasSelectedMethod && hasValidAmount && amountNotExceedsBalance;
  };

  const handleMethodChange = (method: string, isChecked: boolean) => {
    if (isChecked) {
      setLocalSelectedMethods(prev => [...prev, method]);
      // Auto-fill with remaining balance if it's the first method selected
      if (localSelectedMethods.length === 0) {
        setPaymentAmounts(prev => ({ ...prev, [method]: balanceDue }));
      }
    } else {
      setLocalSelectedMethods(prev => prev.filter(m => m !== method));
      setPaymentAmounts(prev => {
        const newAmounts = { ...prev };
        delete newAmounts[method];
        return newAmounts;
      });
    }
  };

  const handleAmountChange = (method: string, amount: number) => {
    setPaymentAmounts(prev => ({ ...prev, [method]: amount }));
  };

  const quickTestCashApp = () => {
    setLocalSelectedMethods(['Cash App']);
    setPaymentAmounts({ 'Cash App': balanceDue });
    setCashAppAmount(balanceDue.toString());
  };

  const quickTestCheck = () => {
    setLocalSelectedMethods(['Check']);
    setPaymentAmounts({ 'Check': balanceDue });
    setCheckAmount(balanceDue.toString());
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
      // Get organizer initials from profile
      const organizerInitials = profile?.firstName && profile?.lastName 
        ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
        : profile?.email?.substring(0, 2).toUpperCase() || 'ORG';

      // Create individual payment entries for each method
      const newPayments = localSelectedMethods.map(method => ({
        id: `payment_${Date.now()}_${method.toLowerCase().replace(/\s+/g, '_')}`,
        amount: paymentAmounts[method] || 0,
        method: method,
        date: new Date().toISOString(),
        dateFormatted: format(new Date(), 'MMM dd, yyyy HH:mm'),
        source: 'manual',
        status: 'completed',
        organizerInitials: organizerInitials,
        organizerName: profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : profile?.email || 'Organizer',
        details: {
          // Store method-specific details
          ...(method === 'Check' && { 
            checkNumber: checkNumber,
            checkAmount: paymentAmounts[method]
          }),
          ...(method === 'Cash App' && { 
            cashAppHandle: cashAppHandle,
            cashAppAmount: paymentAmounts[method]
          }),
          ...(method === 'Zelle' && { 
            zelleEmail: zelleEmail,
            zelleAmount: paymentAmounts[method]
          }),
          ...(method === 'Venmo' && { 
            venmoHandle: venmoHandle,
            venmoAmount: paymentAmounts[method]
          }),
          ...(method === 'Cash' && { 
            cashAmount: paymentAmounts[method]
          }),
        }
      }));

      // Update confirmation data
      const updatedPaymentHistory = [...(confirmation.paymentHistory || []), ...newPayments];
      const newTotalPaid = totalPaid + totalSelectedAmount;
      const newBalanceDue = Math.max(0, totalInvoiced - newTotalPaid);
      
      // Determine new status
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
        lastPaymentBy: organizerInitials,
        lastPaymentDate: new Date().toISOString(),
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

      // Update component state
      setConfirmation(updatedConfirmationData);

      // Show success message with payment details
      const paymentSummary = newPayments.map(p => `${p.method}: $${p.amount.toFixed(2)}`).join(', ');
      toast({
        title: `💳 Payment Recorded by ${organizerInitials}`,
        description: `${paymentSummary}. New balance: $${newBalanceDue.toFixed(2)}`,
        duration: 5000,
      });

      // Reset form
      setLocalSelectedMethods([]);
      setPaymentAmounts({});
      
      // Clear all payment fields
      setCheckAmount('');
      setCheckNumber('');
      setCashAppAmount('');
      setCashAppHandle('');
      setZelleAmount('');
      setZelleEmail('');
      setVenmoAmount('');
      setVenmoHandle('');
      setCashAmount('');

      // Trigger storage events to update other components
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('all_invoices_updated'));

      // If fully paid, show special message
      if (newStatus === 'PAID') {
        setTimeout(() => {
          toast({
            title: `🎉 Invoice Fully Paid!`,
            description: `Marked as PAID by ${organizerInitials} on ${format(new Date(), 'MMM dd, yyyy')}`,
          });
        }, 1500);
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
      {/* Debug Info - Shows current balance and validation status */}
      <div className="p-3 bg-gray-100 border rounded text-sm">
        <div><strong>Balance Due:</strong> ${balanceDue.toFixed(2)}</div>
        <div><strong>Selected Methods:</strong> {localSelectedMethods.join(', ') || 'None'}</div>
        <div><strong>Total Selected:</strong> ${totalSelectedAmount.toFixed(2)}</div>
        <div><strong>Valid Payment:</strong> {isValidPayment() ? '🟢 YES' : '🔴 NO'}</div>
        <div><strong>Recording as:</strong> {profile?.firstName ? `${profile.firstName.charAt(0)}${profile?.lastName?.charAt(0) || ''}`.toUpperCase() : 'ORG'}</div>
      </div>

      {/* Quick Test Buttons - Remove these in production */}
      <div className="p-3 bg-yellow-100 border border-yellow-300 rounded">
        <h4 className="font-medium mb-2">🧪 Quick Test (Remove after testing):</h4>
        <div className="flex gap-2">
          <button 
            onClick={quickTestCashApp}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm"
          >
            Cash App ${balanceDue.toFixed(2)}
          </button>
          <button 
            onClick={quickTestCheck}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
          >
            Check ${balanceDue.toFixed(2)}
          </button>
        </div>
      </div>

      {/* Payment Method Selection - ALL OPTIONS */}
      <div className="space-y-3">
        <h3 className="font-medium">Payment Method</h3>
        
        {/* Cash App */}
        <div className="flex items-center justify-between p-2 border rounded">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={localSelectedMethods.includes('Cash App')}
              onChange={(e) => handleMethodChange('Cash App', e.target.checked)}
              className="mr-2"
            />
            <span className="font-medium">Cash App</span>
          </label>
          {localSelectedMethods.includes('Cash App') && (
            <div className="flex gap-2">
              <input
                type="number"
                value={paymentAmounts['Cash App'] || ''}
                onChange={(e) => handleAmountChange('Cash App', parseFloat(e.target.value) || 0)}
                placeholder="Amount"
                className="w-24 px-2 py-1 border rounded"
                step="0.01"
                min="0"
                max={balanceDue}
              />
              <input
                type="text"
                value={cashAppHandle}
                onChange={(e) => setCashAppHandle(e.target.value)}
                placeholder="$handle"
                className="w-24 px-2 py-1 border rounded text-sm"
              />
            </div>
          )}
        </div>

        {/* Check */}
        <div className="flex items-center justify-between p-2 border rounded">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={localSelectedMethods.includes('Check')}
              onChange={(e) => handleMethodChange('Check', e.target.checked)}
              className="mr-2"
            />
            <span className="font-medium">Check</span>
          </label>
          {localSelectedMethods.includes('Check') && (
            <div className="flex gap-2">
              <input
                type="number"
                value={paymentAmounts['Check'] || ''}
                onChange={(e) => handleAmountChange('Check', parseFloat(e.target.value) || 0)}
                placeholder="Amount"
                className="w-24 px-2 py-1 border rounded"
                step="0.01"
                min="0"
                max={balanceDue}
              />
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Check #"
                className="w-20 px-2 py-1 border rounded text-sm"
              />
            </div>
          )}
        </div>

        {/* Cash */}
        <div className="flex items-center justify-between p-2 border rounded">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={localSelectedMethods.includes('Cash')}
              onChange={(e) => handleMethodChange('Cash', e.target.checked)}
              className="mr-2"
            />
            <span className="font-medium">Cash</span>
          </label>
          {localSelectedMethods.includes('Cash') && (
            <input
              type="number"
              value={paymentAmounts['Cash'] || ''}
              onChange={(e) => handleAmountChange('Cash', parseFloat(e.target.value) || 0)}
              placeholder="Amount"
              className="w-24 px-2 py-1 border rounded"
              step="0.01"
              min="0"
              max={balanceDue}
            />
          )}
        </div>

        {/* Zelle */}
        <div className="flex items-center justify-between p-2 border rounded">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={localSelectedMethods.includes('Zelle')}
              onChange={(e) => handleMethodChange('Zelle', e.target.checked)}
              className="mr-2"
            />
            <span className="font-medium">Zelle</span>
          </label>
          {localSelectedMethods.includes('Zelle') && (
            <div className="flex gap-2">
              <input
                type="number"
                value={paymentAmounts['Zelle'] || ''}
                onChange={(e) => handleAmountChange('Zelle', parseFloat(e.target.value) || 0)}
                placeholder="Amount"
                className="w-24 px-2 py-1 border rounded"
                step="0.01"
                min="0"
                max={balanceDue}
              />
              <input
                type="email"
                value={zelleEmail}
                onChange={(e) => setZelleEmail(e.target.value)}
                placeholder="Email"
                className="w-28 px-2 py-1 border rounded text-sm"
              />
            </div>
          )}
        </div>

        {/* Venmo */}
        <div className="flex items-center justify-between p-2 border rounded">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={localSelectedMethods.includes('Venmo')}
              onChange={(e) => handleMethodChange('Venmo', e.target.checked)}
              className="mr-2"
            />
            <span className="font-medium">Venmo</span>
          </label>
          {localSelectedMethods.includes('Venmo') && (
            <div className="flex gap-2">
              <input
                type="number"
                value={paymentAmounts['Venmo'] || ''}
                onChange={(e) => handleAmountChange('Venmo', parseFloat(e.target.value) || 0)}
                placeholder="Amount"
                className="w-24 px-2 py-1 border rounded"
                step="0.01"
                min="0"
                max={balanceDue}
              />
              <input
                type="text"
                value={venmoHandle}
                onChange={(e) => setVenmoHandle(e.target.value)}
                placeholder="@handle"
                className="w-24 px-2 py-1 border rounded text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Payment Summary */}
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
          <div className="flex justify-between">
            <span>New Status:</span>
            <span className="font-medium">
              {(balanceDue - totalSelectedAmount) <= 0 ? '🟢 PAID' : '🔵 PARTIALLY_PAID'}
            </span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Recorded by:</span>
            <span>{profile?.firstName ? `${profile.firstName.charAt(0)}${profile?.lastName?.charAt(0) || ''}`.toUpperCase() : 'ORG'} on {format(new Date(), 'MMM dd, yyyy')}</span>
          </div>
        </div>
      )}

      {/* Record Payment Button */}
      <button
        onClick={handleRecordPayment}
        disabled={!isValidPayment() || isUpdating}
        className={`w-full py-2 px-4 rounded font-medium transition-colors ${
          isValidPayment() && !isUpdating
            ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isUpdating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
            Recording Payment...
          </>
        ) : isValidPayment() ? (
          '💳 Record Payment'
        ) : (
          '⏸️ Select Payment Method'
        )}
      </button>

      {/* Payment History Display */}
      {confirmation?.paymentHistory && confirmation.paymentHistory.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 border rounded">
          <h4 className="font-medium mb-2">💳 Payment History</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {confirmation.paymentHistory.map((payment: any, index: number) => (
              <div key={payment.id || index} className="text-sm flex justify-between items-center p-2 bg-white rounded border">
                <div>
                  <span className="font-medium">{payment.method}</span>
                  <span className="text-gray-600 ml-2">${payment.amount.toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {payment.organizerInitials && <span className="bg-blue-100 px-1 rounded mr-1">{payment.organizerInitials}</span>}
                  {payment.dateFormatted || format(new Date(payment.date), 'MMM dd, HH:mm')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proof of Payment Upload */}
      <ProofOfPaymentSection />
    </div>
  );
};
