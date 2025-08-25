
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

  useEffect(() => {
    if (!isOpen) return;

    const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
    const currentConf = allInvoices.find((c: any) => c.id === confirmationId);
    if (currentConf) {
        setConfirmation(currentConf);
        
        // Load selected payment methods
        const savedMethods = currentConf.selectedPaymentMethods || [];
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

    const PaymentSummarySection = () => (
        <div className="mt-4">
            <h4 className="text-md font-medium mb-2">Payment Summary</h4>
            <div className="p-3 bg-gray-50 border rounded-md space-y-2 text-sm">
                <div className="flex justify-between">
                    <span>Total Invoiced</span>
                    <span className="font-medium">${totalInvoiced.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Total Paid</span>
                    <span className="font-medium text-green-600">${totalPaid.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                    <span>Balance Due</span>
                    <span>${balanceDue.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );

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
        const [localSelectedMethods, setLocalSelectedMethods] = useState<string[]>([]);
        const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({});
        
        const totalSelectedAmount = Object.values(paymentAmounts).reduce((sum, amount) => sum + amount, 0);
        
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
            const organizerInitials = profile?.firstName && profile?.lastName 
              ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
              : profile?.email?.substring(0, 2).toUpperCase() || 'ORG';
        
            // Create payment entries
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
        
            // Calculate new totals
            const newTotalPaid = totalPaid + totalSelectedAmount;
            const newBalanceDue = Math.max(0, totalInvoiced - newTotalPaid);
            const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
        
            // 🎯 DEFINE updatedConfirmationData HERE (before it's used)
            const updatedConfirmationData = {
              ...confirmation,
              paymentHistory: [...(confirmation.paymentHistory || []), ...newPayments],
              totalPaid: newTotalPaid,
              invoiceStatus: newStatus,
              status: newStatus,
              lastUpdated: new Date().toISOString(),
            };
        
            // Try Square sync (optional, won't block if it fails)
            try {
              console.log('🔄 Attempting Square sync...');
              
              if (confirmation?.invoiceId) {
                await recordPayment({
                  invoiceId: confirmation.invoiceId,
                  amount: totalSelectedAmount,
                  note: `${newPayments.map(p => `${p.method}: $${p.amount}`).join(', ')} recorded by ${organizerInitials}`,
                  paymentMethod: newPayments.map(p => p.method).join(', '),
                  organizerInitials: organizerInitials
                });
                
                console.log('✅ Square sync successful');
                toast({
                  title: `💳 Payment Synced to Square by ${organizerInitials}`,
                  description: `$${totalSelectedAmount.toFixed(2)} recorded and synced to Square API`,
                  duration: 5000,
                });
              } else {
                console.log('ℹ️ No Square invoice ID, recording locally only');
                toast({
                  title: `💳 Payment Recorded Locally by ${organizerInitials}`,
                  description: `$${totalSelectedAmount.toFixed(2)} recorded. Square invoice may need to be created manually.`,
                  duration: 5000,
                });
              }
        
            } catch (squareError: any) {
              console.log('⚠️ Square sync failed, but local recording successful:', squareError);
              
              const errorMessage = squareError?.message || 'Unknown error';
              if (errorMessage.includes('not found') || errorMessage.includes('404')) {
                toast({
                  title: `💳 Payment Recorded Locally by ${organizerInitials}`,
                  description: `$${totalSelectedAmount.toFixed(2)} recorded. The invoice wasn't found in Square. This usually means the invoice needs to be created manually in Square first.`,
                  duration: 8000,
                });
              } else {
                toast({
                  title: `💳 Payment Recorded Locally by ${organizerInitials}`,
                  description: `$${totalSelectedAmount.toFixed(2)} recorded. Square sync failed: ${errorMessage}`,
                  duration: 7000,
                });
              }
            }
        
            // Update localStorage (always do this, regardless of Square sync)
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
            <div className="p-3 bg-gray-100 border rounded text-sm">
              <div><strong>Balance Due:</strong> ${balanceDue.toFixed(2)}</div>
              <div><strong>Selected Methods:</strong> {localSelectedMethods.join(', ') || 'None'}</div>
              <div><strong>Total Selected:</strong> ${totalSelectedAmount.toFixed(2)}</div>
              <div><strong>Valid Payment:</strong> {isValidPayment() ? '🟢 YES' : '🔴 NO'}</div>
              <div><strong>Recording as:</strong> {profile?.firstName ? `${profile.firstName.charAt(0)}${profile?.lastName?.charAt(0) || ''}`.toUpperCase() : 'ORG'}</div>
            </div>
      
            <div className="p-3 bg-yellow-100 border border-yellow-300 rounded">
              <h4 className="font-medium mb-2">🧪 Quick Test (Remove after testing):</h4>
              <div className="flex gap-2">
                <button onClick={quickTestCashApp} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Cash App ${balanceDue.toFixed(2)}</button>
                <button onClick={quickTestCheck} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Check ${balanceDue.toFixed(2)}</button>
              </div>
            </div>
      
            <div className="space-y-3">
              <h3 className="font-medium">Payment Method</h3>
              
              <div className="flex items-center justify-between p-2 border rounded">
                <label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Cash App')} onChange={(e) => handleMethodChange('Cash App', e.target.checked)} className="mr-2" /> <span className="font-medium">Cash App</span> </label>
                {localSelectedMethods.includes('Cash App') && (
                  <div className="flex gap-2">
                    <input type="number" value={paymentAmounts['Cash App'] || ''} onChange={(e) => handleAmountChange('Cash App', parseFloat(e.target.value) || 0)} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} />
                    <input type="text" value={cashAppHandle} onChange={(e) => setCashAppHandle(e.target.value)} placeholder="$handle" className="w-24 px-2 py-1 border rounded text-sm" />
                  </div>
                )}
              </div>
      
              <div className="flex items-center justify-between p-2 border rounded">
                <label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Check')} onChange={(e) => handleMethodChange('Check', e.target.checked)} className="mr-2" /> <span className="font-medium">Check</span> </label>
                {localSelectedMethods.includes('Check') && (
                  <div className="flex gap-2">
                    <input type="number" value={paymentAmounts['Check'] || ''} onChange={(e) => handleAmountChange('Check', parseFloat(e.target.value) || 0)} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} />
                    <input type="text" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="Check #" className="w-20 px-2 py-1 border rounded text-sm" />
                  </div>
                )}
              </div>
      
              <div className="flex items-center justify-between p-2 border rounded">
                <label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Cash')} onChange={(e) => handleMethodChange('Cash', e.target.checked)} className="mr-2" /> <span className="font-medium">Cash</span> </label>
                {localSelectedMethods.includes('Cash') && ( <input type="number" value={paymentAmounts['Cash'] || ''} onChange={(e) => handleAmountChange('Cash', parseFloat(e.target.value) || 0)} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} /> )}
              </div>
      
              <div className="flex items-center justify-between p-2 border rounded">
                <label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Zelle')} onChange={(e) => handleMethodChange('Zelle', e.target.checked)} className="mr-2" /> <span className="font-medium">Zelle</span> </label>
                {localSelectedMethods.includes('Zelle') && (
                  <div className="flex gap-2">
                    <input type="number" value={paymentAmounts['Zelle'] || ''} onChange={(e) => handleAmountChange('Zelle', parseFloat(e.target.value) || 0)} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} />
                    <input type="email" value={zelleEmail} onChange={(e) => setZelleEmail(e.target.value)} placeholder="Email" className="w-28 px-2 py-1 border rounded text-sm" />
                  </div>
                )}
              </div>
      
              <div className="flex items-center justify-between p-2 border rounded">
                <label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Venmo')} onChange={(e) => handleMethodChange('Venmo', e.target.checked)} className="mr-2" /> <span className="font-medium">Venmo</span> </label>
                {localSelectedMethods.includes('Venmo') && (
                  <div className="flex gap-2">
                    <input type="number" value={paymentAmounts['Venmo'] || ''} onChange={(e) => handleAmountChange('Venmo', parseFloat(e.target.value) || 0)} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} />
                    <input type="text" value={venmoHandle} onChange={(e) => setVenmoHandle(e.target.value)} placeholder="@handle" className="w-24 px-2 py-1 border rounded text-sm" />
                  </div>
                )}
              </div>
            </div>
      
            {totalSelectedAmount > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex justify-between"> <span>Total Payment:</span> <span className="font-medium">${totalSelectedAmount.toFixed(2)}</span> </div>
                <div className="flex justify-between"> <span>Remaining Balance:</span> <span className="font-medium">${(balanceDue - totalSelectedAmount).toFixed(2)}</span> </div>
                <div className="flex justify-between"> <span>New Status:</span> <span className="font-medium">{(balanceDue - totalSelectedAmount) <= 0 ? '🟢 PAID' : '🔵 PARTIALLY_PAID'}</span> </div>
                <div className="flex justify-between text-sm text-gray-600"> <span>Recorded by:</span> <span>{profile?.firstName ? `${profile.firstName.charAt(0)}${profile?.lastName?.charAt(0) || ''}`.toUpperCase() : 'ORG'} on {format(new Date(), 'MMM dd, yyyy')}</span> </div>
              </div>
            )}
      
            <button onClick={handleRecordPayment} disabled={!isValidPayment() || isUpdating} className={`w-full py-2 px-4 rounded font-medium transition-colors ${isValidPayment() && !isUpdating ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                {isUpdating ? (<> <Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Recording Payment... </>) : isValidPayment() ? '💳 Record Payment' : '⏸️ Select Payment Method'}
            </button>
      
            {confirmation?.paymentHistory && confirmation.paymentHistory.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 border rounded">
                <h4 className="font-medium mb-2">💳 Payment History</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {confirmation.paymentHistory.map((payment: any, index: number) => (
                    <div key={payment.id || index} className="text-sm flex justify-between items-center p-2 bg-white rounded border">
                      <div> <span className="font-medium">{payment.method}</span> <span className="text-gray-600 ml-2">${payment.amount.toFixed(2)}</span> </div>
                      <div className="text-xs text-gray-500"> {payment.organizerInitials && <span className="bg-blue-100 px-1 rounded mr-1">{payment.organizerInitials}</span>} {payment.dateFormatted || format(new Date(payment.date), 'MMM dd, HH:mm')} </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
      
            <ProofOfPaymentSection />
          </div>
        );
    };

    const handleEnhancedSquareSync = async () => {
      console.log('🔄 Enhanced Square Sync starting...');
      
      if (!confirmation?.invoiceId) {
        console.log('❌ No invoice ID found');
        
        // Try to find the invoice in Square by searching
        toast({
          variant: 'destructive',
          title: 'No Square Invoice ID',
          description: 'This invoice may not exist in Square yet. Use the Developer Console to create or find it.',
          duration: 10000
        });
        
        // Show the developer console for manual lookup
        if (profile?.role === 'organizer') {
          setTimeout(() => {
            toast({
              title: '🛠️ Manual Square Lookup Required',
              description: `Search for invoice #${confirmation?.invoiceNumber || confirmation?.id.slice(-8)} in Square Developer Console.`,
              duration: 15000
            });
          }, 2000);
        }
        
        return;
      }
    
      setIsRefreshing(true);
      
      try {
        console.log('🔄 Syncing with Square invoice ID:', confirmation.invoiceId);
        
        // Try the sync
        const result = await getInvoiceStatusWithPayments({ 
          invoiceId: confirmation.invoiceId 
        });
        
        console.log('📥 Square sync successful:', result);
        
        // Process the result (same as before)
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
              method: squarePayment.method || 'credit_card',
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
          // Update URLs if provided
          invoiceUrl: result.invoiceUrl || confirmation.invoiceUrl,
          publicUrl: result.publicUrl || confirmation.publicUrl,
        };
        
        // Update localStorage
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
        
        toast({ 
          title: '✅ Square Sync Successful!', 
          description: `Status: ${result.status}, Total Paid: $${totalPaid.toFixed(2)}` 
        });
        
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('all_invoices_updated'));
        
      } catch (error: any) {
        console.error('❌ Square sync failed:', error);
        
        // More detailed error messages
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          toast({ 
            variant: 'destructive', 
            title: 'Invoice Not Found in Square', 
            description: `Invoice #${confirmation?.invoiceNumber || confirmation?.id.slice(-8)} was not found in Square. It may need to be created manually.`,
            duration: 10000
          });
        } else if (error.message?.includes('unauthorized') || error.message?.includes('401')) {
          toast({ 
            variant: 'destructive', 
            title: 'Square Authentication Error', 
            description: 'Could not authenticate with Square. Check your API credentials.',
            duration: 8000
          });
        } else {
          toast({ 
            variant: 'destructive', 
            title: 'Square Sync Failed', 
            description: `Error: ${error.message || 'Unknown error'}. Check console for details.`,
            duration: 8000
          });
        }
      } finally {
        setIsRefreshing(false);
      }
    };
    
    const EnhancedSquareButton = () => {
      const handleOpenSquare = () => {
        const invoiceUrl = confirmation?.invoiceUrl;
        const invoiceNumber = confirmation?.invoiceNumber || confirmation?.id.slice(-8);
        
        console.log('🔗 Square button clicked:', { invoiceUrl, invoiceNumber });
        
        if (invoiceUrl) {
          // Check if it's a sandbox URL
          const isSandbox = invoiceUrl.includes('squareupsandbox.com');
          
          console.log('🔗 Opening URL:', invoiceUrl);
          console.log('🔗 Environment:', isSandbox ? 'SANDBOX' : 'PRODUCTION');
          
          window.open(invoiceUrl, '_blank');
          
          // Show environment-specific message
          toast({
            title: `Opening ${isSandbox ? 'Sandbox' : 'Production'} Square Invoice`,
            description: `Invoice #${invoiceNumber} in ${isSandbox ? 'sandbox' : 'production'} environment`,
            duration: 8000
          });
          
        } else {
          toast({
            variant: 'destructive',
            title: 'No Square URL Available',
            description: `Invoice #${invoiceNumber} may not be created in Square yet.`,
            duration: 10000
          });
        }
      };
    
      return (
        <div className="mt-4">
          <label className="text-sm text-gray-600">Invoice Link</label>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenSquare}
              >
                💳 Open Square Invoice
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.open('https://squareupsandbox.com/dashboard/invoices', '_blank');
                  toast({
                    title: '📊 Square Dashboard',
                    description: `Look for invoice #${confirmation?.invoiceNumber || confirmation?.id.slice(-8)} and click "Collect Payment"`,
                    duration: 10000
                  });
                }}
              >
                📊 Open Square Dashboard
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
              
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <p className="font-medium text-blue-800">🎯 To record payment in Square:</p>
                <p className="text-blue-700">1. Click button above → 2. Find invoice #{confirmation?.invoiceNumber || 'Unknown'} → 3. Click "Collect Payment" → 4. Enter ${balanceDue.toFixed(2)} → 5. Record payment</p>
              </div>
            </div>
          
          {/* Environment indicator */}
          {confirmation?.invoiceUrl && (
            <div className="mt-2 text-xs text-center">
              <span className={`px-2 py-1 rounded text-white ${
                confirmation.invoiceUrl.includes('sandbox') ? 'bg-orange-500' : 'bg-green-500'
              }`}>
                {confirmation.invoiceUrl.includes('sandbox') ? '🧪 SANDBOX' : '🚀 PRODUCTION'}
              </span>
            </div>
          )}
        </div>
      );
    };
      
      const EnhancedSquareDeveloperConsole = () => {
        if (profile?.role !== 'organizer') return null;
      
        const invoiceNumber = confirmation?.invoiceNumber || confirmation?.id.slice(-8);
        const invoiceId = confirmation?.invoiceId;
      
        const openDeveloperConsole = () => {
          window.open('https://developer.squareup.com/apps', '_blank');
          
          toast({
            title: '🛠️ Square Developer Console',
            description: `Look for invoice #${invoiceNumber} or ID: ${invoiceId || 'N/A'}`,
            duration: 15000
          });
        };
      
        const openAPIExplorer = () => {
          window.open('https://developer.squareup.com/explorer/square/invoices-api', '_blank');
          
          setTimeout(() => {
            toast({
              title: '🔧 Step-by-Step Fix:',
              description: `1. Select "Search Invoices" → 2. Add filter: invoice_number = "${invoiceNumber}" → 3. Run request`,
              duration: 20000
            });
          }, 1000);
        };
      
        const openSquareDashboard = () => {
            // Always open sandbox
            const sandboxUrl = 'https://squareupsandbox.com/dashboard/invoices';
            
            console.log('🔗 Opening hardcoded sandbox URL:', sandboxUrl);
            
            window.open(sandboxUrl, '_blank');
            
            toast({
              title: '🧪 Sandbox Dashboard',
              description: 'Opening Square SANDBOX dashboard',
              duration: 5000
            });
        };
      
        return (
          <div className="border-t pt-4 mt-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">🛠️ Square Developer Tools</h4>
                <p className="text-xs text-muted-foreground">Manually find or create this invoice in Square</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button variant="default" onClick={openSquareDashboard} size="sm">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Square Dashboard
                </Button>
                
                <Button variant="outline" onClick={openDeveloperConsole} size="sm">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Developer Console
                </Button>
                
                <Button variant="outline" onClick={openAPIExplorer} size="sm">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  API Explorer
                </Button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <h5 className="text-xs font-medium text-blue-800 mb-2">🎯 Quick Fix Options:</h5>
                
                <div className="space-y-2 text-xs text-blue-700">
                  <div className="bg-white p-2 rounded border-l-2 border-blue-400">
                    <p className="font-medium">Option 1: Find Existing Invoice</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Click "Square Dashboard" above</li>
                      <li>Search for invoice #{invoiceNumber}</li>
                      <li>If found, copy the correct URL</li>
                    </ol>
                  </div>
                  
                  <div className="bg-white p-2 rounded border-l-2 border-green-400">
                    <p className="font-medium">Option 2: Create New Invoice (Recommended)</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Click "API Explorer" above</li>
                      <li>Select "Create Invoice" endpoint</li>
                      <li>Fill: amount = ${confirmation?.totalAmount || 48}, invoice_number = "{invoiceNumber}"</li>
                      <li>Run request to create invoice</li>
                      <li>Copy the returned invoice ID</li>
                      <li>Return here and click "Sync with Square"</li>
                    </ol>
                  </div>
                </div>
              </div>
      
              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                <h5 className="text-xs font-medium text-orange-800 mb-2">📋 Invoice Details for Square:</h5>
                <div className="grid grid-cols-2 gap-2 text-xs text-orange-700">
                  <div><strong>Invoice #:</strong> {invoiceNumber}</div>
                  <div><strong>Amount:</strong> ${confirmation?.totalAmount || 48}</div>
                  <div><strong>Customer:</strong> {confirmation?.purchaserEmail || 'N/A'}</div>
                  <div><strong>Status Needed:</strong> {confirmation?.totalPaid >= confirmation?.totalAmount ? 'PAID' : 'PARTIALLY_PAID'}</div>
                </div>
              </div>
            </div>
          </div>
        );
      };
      
    const SquareConfigDebug = () => {
        useEffect(() => {
          console.log('🔧 SQUARE CONFIGURATION DEBUG:');
          console.log('- Environment:', process.env.NODE_ENV);
          console.log('- Square Location ID exists:', !!process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID);
          console.log('- Square Token exists:', !!process.env.SQUARE_SANDBOX_TOKEN);
          console.log('- Expected Location ID:', process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID);
          
          // Check if we're using sandbox or production URLs
          const invoiceUrl = confirmation?.invoiceUrl || confirmation?.publicUrl;
          if (invoiceUrl) {
            const environment = invoiceUrl.includes('sandbox') ? 'SANDBOX' : 'PRODUCTION';
            console.log('- Invoice Environment:', environment);
            console.log('- Invoice URL:', invoiceUrl);
            
            if (environment === 'PRODUCTION' && process.env.NODE_ENV !== 'production') {
              console.warn('⚠️ WARNING: Production Square invoice detected in development environment!');
            }
          }
          
          // Validate configuration
          const issues = [];
          if (!process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID) {
            issues.push('Missing NEXT_PUBLIC_SQUARE_LOCATION_ID');
          }
          if (!process.env.SQUARE_SANDBOX_TOKEN) {
            issues.push('Missing SQUARE_SANDBOX_TOKEN');
          }
          
          if (issues.length > 0) {
            console.error('❌ Configuration Issues:', issues);
          } else {
            console.log('✅ Square configuration appears valid');
          }
          
        }, [confirmation]);
      
        return (
          <div className="bg-orange-100 border border-orange-300 p-3 rounded-md text-sm">
            <h4 className="font-bold text-orange-800">🔧 Square Config Debug</h4>
            <div className="mt-2 space-y-1 text-orange-700">
              <div>Location ID: {process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ? '✅ Set' : '❌ Missing'}</div>
              <div>Sandbox Token: {process.env.SQUARE_SANDBOX_TOKEN ? '✅ Set' : '❌ Missing'}</div>
              <div>Invoice Environment: {confirmation?.invoiceUrl?.includes('sandbox') ? '🧪 Sandbox' : confirmation?.invoiceUrl ? '🚀 Production' : '❓ Unknown'}</div>
              <div>Invoice ID Format: {confirmation?.invoiceId?.startsWith('inv:') ? '✅ Correct' : '❌ Invalid'}</div>
            </div>
          </div>
        );
      };

  if (!confirmation) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="py-8 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const ButtonStyles = () => (
    <style>{`
      .payment-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 0.75rem;
        border-radius: 0.375rem;
        font-weight: 500;
        transition: background-color 0.2s;
      }
      .payment-button.enabled {
        background-color: #16a34a; /* green-600 */
        color: white;
        cursor: pointer;
      }
      .payment-button.enabled:hover {
        background-color: #15803d; /* green-700 */
      }
      .payment-button.disabled {
        background-color: #d1d5db; /* gray-300 */
        color: #6b7280; /* gray-500 */
        cursor: not-allowed;
      }
    `}</style>
  );

  const ProfileDebugComponent = () => {
    return (
      <div className="bg-yellow-100 border border-yellow-300 p-2 my-2 rounded-md text-xs">
        <h4 className="font-bold">🧪 Debug - Profile Data</h4>
        <p><strong>Role:</strong> {profile?.role}</p>
        <p><strong>Email:</strong> {profile?.email}</p>
        <p><strong>Name:</strong> {profile?.firstName} {profile?.lastName}</p>
        <p><strong>Phone:</strong> {profile?.phone || 'N/A'}</p>
      </div>
    )
  }

  
  const SquareDebugComponent = () => {
    useEffect(() => {
      console.log('🔍 SQUARE DEBUG INFO:');
      console.log('confirmation.invoiceId:', confirmation?.invoiceId);
      console.log('confirmation.invoiceUrl:', confirmation?.invoiceUrl);
      console.log('confirmation.publicUrl:', confirmation?.publicUrl);
      console.log('confirmation.invoiceNumber:', confirmation?.invoiceNumber);
      console.log('Full confirmation object keys:', Object.keys(confirmation || {}));
      
      // Check for any URL patterns
      const allKeys = Object.keys(confirmation || {});
      const urlKeys = allKeys.filter(key => 
        key.toLowerCase().includes('url') || 
        key.toLowerCase().includes('link') ||
        key.toLowerCase().includes('square')
      );
      console.log('URL-related keys:', urlKeys);
      urlKeys.forEach(key => {
        console.log(`${key}:`, confirmation[key]);
      });
    }, []);
  
    return null; // Just for debugging, doesn't render anything
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ButtonStyles />
        <ProfileDebugComponent />
        <SquareDebugComponent />
        <SquareConfigDebug />
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
            <EnhancedSquareButton />
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
          <EnhancedSquareDeveloperConsole />
        )}

        <div className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleEnhancedSquareSync}
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