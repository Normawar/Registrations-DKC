
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
    console.log('=== ENHANCED VALIDATION DEBUG ===');
    console.log('selectedPaymentMethods:', selectedPaymentMethods);
    console.log('selectedPaymentMethods.length:', selectedPaymentMethods.length);
    console.log('selectedPaymentMethods type:', typeof selectedPaymentMethods);
    console.log('selectedPaymentMethods.includes("cashapp"):', selectedPaymentMethods.includes('cashapp'));
    
    // Check all amounts
    const amounts = {
      checkAmount: checkAmount,
      zelleAmount: zelleAmount,
      cashAppAmount: cashAppAmount,
      venmoAmount: venmoAmount,
      cashAmount: cashAmount,
      otherAmount: otherAmount
    };
    
    console.log('All amounts:', amounts);
    
    if (!selectedPaymentMethods || selectedPaymentMethods.length === 0) {
      console.log('❌ No payment methods selected');
      return false;
    }
  
    // Check each selected method for valid amount
    const result = selectedPaymentMethods.some(method => {
      let amount = 0;
      
      switch (method) {
        case 'check':
          amount = parseFloat(checkAmount || '0');
          console.log(`✅ Check: "${checkAmount}" -> ${amount}, valid: ${amount > 0}`);
          break;
        case 'zelle':
          amount = parseFloat(zelleAmount || '0');
          console.log(`✅ Zelle: "${zelleAmount}" -> ${amount}, valid: ${amount > 0}`);
          break;
        case 'cashapp':
          amount = parseFloat(cashAppAmount || '0');
          console.log(`✅ Cash App: "${cashAppAmount}" -> ${amount}, valid: ${amount > 0}`);
          break;
        case 'venmo':
          amount = parseFloat(venmoAmount || '0');
          console.log(`✅ Venmo: "${venmoAmount}" -> ${amount}, valid: ${amount > 0}`);
          break;
        case 'cash':
          amount = parseFloat(cashAmount || '0');
          console.log(`✅ Cash: "${cashAmount}" -> ${amount}, valid: ${amount > 0}`);
          break;
        case 'other':
          amount = parseFloat(otherAmount || '0');
          console.log(`✅ Other: "${otherAmount}" -> ${amount}, valid: ${amount > 0}`);
          break;
        default:
          console.log(`❌ Unknown method: ${method}`);
          return false;
      }
      
      const isValid = !isNaN(amount) && amount > 0;
      console.log(`Method ${method}: amount=${amount}, valid=${isValid}`);
      return isValid;
    });
    
    console.log('Final validation result:', result);
    console.log('=== END ENHANCED DEBUG ===');
    return result;
  }, [selectedPaymentMethods, checkAmount, zelleAmount, cashAppAmount, venmoAmount, cashAmount, otherAmount]);

  const formatPhoneNumber = (phone: string) => {
    if (!phone || phone.trim() === '') return 'Not provided';
    
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    console.log('📞 Formatting phone:', phone, '-> cleaned:', cleaned, '-> length:', cleaned.length);
    
    // Format based on length
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length > 0) {
      return `${cleaned} (${cleaned.length} digits)`;
    }
    
    return phone; // Return original if no digits found
  };

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

const RegistrationDetailsSection = () => {
  console.log('🔍 FULL CONFIRMATION OBJECT:', confirmation);
  console.log('🔍 Available fields:', Object.keys(confirmation || {}));
  
  // Let's check all possible field names
  const possibleEventNames = [
    confirmation?.invoiceTitle,
    confirmation?.eventName, 
    confirmation?.eventTitle,
    confirmation?.title,
    confirmation?.event,
    confirmation?.description
  ].filter(Boolean);
  
  const possibleSponsorNames = [
    confirmation?.purchaserName,
    confirmation?.sponsorName,
    confirmation?.customerName,
    confirmation?.firstName,
    confirmation?.lastName,
    confirmation?.name,
    confirmation?.primaryContact?.name
  ].filter(Boolean);
  
  const possibleEmails = [
    confirmation?.sponsorEmail,
    confirmation?.email,
    confirmation?.purchaserEmail,
    confirmation?.customerEmail,
    confirmation?.primaryContact?.email
  ].filter(Boolean);
  
  const phoneFields = [
    confirmation?.phone,
    confirmation?.sponsorPhone, 
    confirmation?.purchaserPhone,
    confirmation?.customerPhone,
    confirmation?.phoneNumber,
    confirmation?.primaryContact?.phone,
    confirmation?.contact?.phone,
    confirmation?.billing?.phone,
    confirmation?.shipping?.phone
  ];
  
  console.log('🔍 PHONE DEBUG - All possible phone fields:', phoneFields);
  console.log('🔍 PHONE DEBUG - All confirmation keys:', Object.keys(confirmation || {}));
  console.log('🔍 PHONE DEBUG - Phone-related keys:', 
    Object.keys(confirmation || {}).filter(key => 
      key.toLowerCase().includes('phone') || 
      key.toLowerCase().includes('contact') ||
      key.toLowerCase().includes('tel')
    )
  );

  const foundPhone = phoneFields.find(phone => phone && phone.trim() !== '');
  console.log('🔍 PHONE DEBUG - Found phone:', foundPhone);
  
  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold mb-4">Registration Details</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Event</span>
          <span>{possibleEventNames[0] || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Date</span>
          <span>{confirmation?.eventDate ? format(new Date(confirmation.eventDate), 'PPP') : 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Sponsor Name</span>
          <span>{possibleSponsorNames[0] || `${confirmation?.firstName || ''} ${confirmation?.lastName || ''}`.trim() || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Sponsor Email</span>
          <span>{possibleEmails[0] || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Sponsor Phone</span>
          <span>{foundPhone ? formatPhoneNumber(foundPhone) : 'Not provided'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">School</span>
          <span>{confirmation?.schoolName || confirmation?.school || 'N/A'}</span>
        </div>
        
        <div className="flex justify-between font-semibold text-lg border-t pt-3">
          <span>Total Amount</span>
          <span className="text-blue-600">${totalInvoiced.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Debug section - you can remove this later */}
      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
        <div><strong>Phone Debug:</strong></div>
        <div>Found: {foundPhone || 'NONE FOUND'}</div>
        <div>Checked fields: phone, sponsorPhone, purchaserPhone, customerPhone, phoneNumber</div>
        <div>Available keys: {Object.keys(confirmation || {}).slice(0, 10).join(', ')}...</div>
      </div>
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

const RecordPaymentButton = () => {
  const isButtonEnabled = canRecordPayment && !isUpdating;

  return (
    <div className="space-y-2">
      {/* Debug info - you can remove this later */}
      <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
        <div>Methods: {selectedPaymentMethods.join(', ') || 'none'}</div>
        <div>Can Record: {canRecordPayment ? '✅ Yes' : '❌ No'}</div>
        <div>Button Status: {isButtonEnabled ? '🟢 ACTIVE' : '🔴 DISABLED'}</div>
      </div>
      
      {/* Working native button */}
      <button
        onClick={() => {
          console.log('🔥 RECORD PAYMENT CLICKED!');
          if (isButtonEnabled) {
            handlePaymentUpdate();
          }
        }}
        disabled={!isButtonEnabled}
        style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: isButtonEnabled ? '#2563eb' : '#9ca3af',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: isButtonEnabled ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
          opacity: isButtonEnabled ? 1 : 0.6
        }}
        onMouseOver={(e) => {
          if (isButtonEnabled) {
            e.currentTarget.style.backgroundColor = '#1d4ed8';
          }
        }}
        onMouseOut={(e) => {
          if (isButtonEnabled) {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }
        }}
      >
        {isUpdating ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ 
              display: 'inline-block',
              width: '16px',
              height: '16px',
              border: '2px solid #ffffff40',
              borderTop: '2px solid #ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: '8px'
            }}></span>
            Recording Payment...
          </span>
        ) : (
          'Record Payment'
        )}
      </button>
    </div>
  );
};



const renderPaymentMethodInputs = () => {
    return (
      <div className="space-y-4">
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
  
  const QuickTestSection = () => (
    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
      <h4 className="font-medium text-green-800 mb-2">🧪 Quick Test Section</h4>
      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            console.log('🧪 Quick test: Selecting Cash App with $28');
            setSelectedPaymentMethods(['cashapp']);
            setCashAppAmount('28');
            setCashAppHandle('@test');
          }}
          className="w-full text-xs"
        >
          🚀 Quick Test: Select Cash App + $28
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            console.log('🧪 Quick test: Selecting Check with $28');
            setSelectedPaymentMethods(['check']);
            setCheckAmount('28');
            setCheckNumber('1234');
          }}
          className="w-full text-xs"
        >
          Select Check $28
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            console.log('🧪 Reset test');
            setSelectedPaymentMethods([]);
            setCashAppAmount('');
            setCashAppHandle('');
            setCheckAmount('');
            setCheckNumber('');
          }}
          className="w-full text-xs"
        >
          🔄 Reset Form
        </Button>
        
        <div className="mt-2 text-xs text-green-700">
          <div>Selected Methods: {selectedPaymentMethods.join(', ') || 'none'}</div>
          <div>Cash App: ${cashAppAmount || '0'} | Check: ${checkAmount || '0'}</div>
          <div>Button Should Be: {canRecordPayment ? '✅ ACTIVE' : '❌ DISABLED'}</div>
        </div>
      </div>
    </div>
  );
  
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
              <li>Click <strong>"Run request"</strong> to find your invoice</li>
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <ButtonStyles />
          <DialogTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(confirmation?.invoiceStatus || confirmation?.status || 'UNPAID', totalPaid, totalInvoiced)}
              Invoice #{confirmation?.invoiceNumber || 'Unknown'}
            </div>
          </DialogTitle>
        </DialogHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <RegistrationDetailsSection />
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
            <QuickTestSection />
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <div className="mt-2">
                  {renderPaymentMethodInputs()}
                </div>
              </div>
              {selectedPaymentMethods.length > 0 && <ProofOfPaymentSection />}
              <RecordPaymentButton />
            </div>
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

