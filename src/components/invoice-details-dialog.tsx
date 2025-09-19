'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Upload, ExternalLink, CreditCard, Check, DollarSign, RefreshCw, Loader2, Download, File as FileIcon, X, Trash2, History, MessageSquare, Shield, CheckCircle, UploadCloud, Award } from 'lucide-react';
import { format } from "date-fns";
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { recordPayment } from '@/ai/flows/record-payment-flow';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { getInvoiceStatusWithPayments } from '@/ai/flows/get-invoice-status-flow';
import { PaymentHistoryDisplay } from '@/components/unified-payment-system';
import { Checkbox } from './ui/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { useEvents } from '@/hooks/use-events';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import Image from 'next/image';


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

const SponsorPaymentComponent = ({ confirmation, onPaymentSubmitted }: { confirmation: any, onPaymentSubmitted: (updatedConfirmation: any) => void }) => {
  const { toast } = useToast();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Payment method specific fields
  const [paymentAmount, setPaymentAmount] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [payByCheckAtTournament, setPayByCheckAtTournament] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
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

  const handleSubmitProof = async () => {
    if (!db) {
        toast({ variant: 'destructive', title: 'Error', description: 'Database not initialized.' });
        return;
    }
    // Validation
    if (!selectedPaymentMethod) { toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a payment method.' }); return; }
    if (!paymentAmount) { toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter the payment amount.' }); return; }
    if (selectedPaymentMethod === 'PO' && !poNumber) { toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter the PO number.' }); return; }
    if (selectedPaymentMethod === 'Check' && !payByCheckAtTournament && !checkNumber) { toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter the check number.' }); return; }

    setIsSubmitting(true);

    try {
        let uploadedFileUrl: string | undefined;
        let uploadedFileName: string | undefined;

        if (uploadedFiles.length > 0) {
            const file = uploadedFiles[0];
            const storageRef = ref(storage, `payment_proof/${confirmation.id}/${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            uploadedFileUrl = await getDownloadURL(snapshot.ref);
            uploadedFileName = file.name;
        }

        const invoiceRef = doc(db, 'invoices', confirmation.id);
        const updateData: any = {
            paymentStatus: 'pending-po',
            paymentMethod: selectedPaymentMethod.toLowerCase().replace(/\s/g, '-'),
            paymentSubmittedAt: new Date().toISOString(),
            amountPaid: parseFloat(paymentAmount),
        };

        if (selectedPaymentMethod === 'PO') updateData.poNumber = poNumber;
        if (selectedPaymentMethod === 'Check') {
            updateData.checkNumber = checkNumber;
            updateData.payByCheckAtTournament = payByCheckAtTournament;
        }
        if (uploadedFileUrl) {
            updateData.paymentFileUrl = uploadedFileUrl;
            updateData.paymentFileName = uploadedFileName;
        }

        await setDoc(invoiceRef, updateData, { merge: true });
        
        onPaymentSubmitted({ ...confirmation, ...updateData });

        toast({
            title: 'Proof of Payment Submitted',
            description: 'Your payment information has been sent for review.',
        });

        // Reset form
        setSelectedPaymentMethod(null);
        setPaymentAmount('');
        setPoNumber('');
        setCheckNumber('');
        setPayByCheckAtTournament(false);
        setUploadedFiles([]);
        fileUrls.forEach(url => URL.revokeObjectURL(url));
        setFileUrls([]);

    } catch (error) {
        console.error("Failed to submit payment proof:", error);
        toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit payment information.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
       {confirmation.invoiceUrl && (
        <Button asChild className="w-full">
          <a href={confirmation.invoiceUrl} target="_blank" rel="noopener noreferrer">
            <CreditCard className="mr-2 h-4 w-4" /> View Invoice on Square
          </a>
        </Button>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Offline Payment Instructions</h3>
        <p className="text-sm text-blue-700 mb-3">
          Alternatively, submit payment using one of the methods below, then upload proof for verification.
        </p>
      </div>

      <Accordion type="single" collapsible value={selectedPaymentMethod || undefined} onValueChange={setSelectedPaymentMethod}>
        <AccordionItem value="PO">
          <AccordionTrigger>Purchase Order (PO)</AccordionTrigger>
          <AccordionContent className="space-y-3">
              <p className="text-sm text-gray-600">Submit a purchase order through your school's accounting department</p>
              <div><Label htmlFor="po-amount">Payment Amount ($)</Label><Input id="po-amount" type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} step="0.01" min="0" /></div>
              <div><Label htmlFor="po-number">PO Number</Label><Input id="po-number" type="text" placeholder="Enter PO number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} /></div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="Check">
          <AccordionTrigger>Pay by Check</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <p className="text-sm text-gray-600">Submit payment information for check processing</p>
            <div className="flex items-center space-x-2"><Checkbox id="pay-at-tournament" checked={payByCheckAtTournament} onCheckedChange={(checked) => setPayByCheckAtTournament(!!checked)} /><Label htmlFor="pay-at-tournament" className="text-sm">Pay by check at tournament</Label></div>
            <div><Label htmlFor="check-amount">Check Amount ($)</Label><Input id="check-amount" type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} step="0.01" min="0" /></div>
            {!payByCheckAtTournament && (<div><Label htmlFor="check-number">Check Number</Label><Input id="check-number" type="text" placeholder="Enter check number" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} /></div>)}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="CashApp">
            <AccordionTrigger>Cash App</AccordionTrigger>
            <AccordionContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div>
                        <p className="text-sm text-gray-600">Scan the QR code and enter the total amount due. Upload a screenshot of the confirmation.</p>
                        <p className="font-bold text-lg mt-1">$DKChess</p>
                    </div>
                    <a href="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" target="_blank" rel="noopener noreferrer">
                        <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" alt="CashApp QR Code" width={100} height={100} className="rounded-md transition-transform duration-200 ease-in-out hover:scale-125" data-ai-hint="QR code" />
                    </a>
                </div>
                <div><Label htmlFor="cashapp-amount">Payment Amount ($)</Label><Input id="cashapp-amount" type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} step="0.01" min="0" /></div>
            </AccordionContent>
        </AccordionItem>
        <AccordionItem value="Zelle">
            <AccordionTrigger>Zelle</AccordionTrigger>
            <AccordionContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div>
                        <p className="text-sm text-gray-600">Scan the QR code or use the phone number to send the total amount due. Upload a screenshot of the confirmation.</p>
                        <p className="font-bold text-lg mt-1">956-393-8875</p>
                    </div>
                     <a href="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" target="_blank" rel="noopener noreferrer">
                        <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" alt="Zelle QR Code" width={100} height={100} className="rounded-md transition-transform duration-200 ease-in-out hover:scale-125" data-ai-hint="QR code" />
                    </a>
                </div>
                <div><Label htmlFor="zelle-amount">Payment Amount ($)</Label><Input id="zelle-amount" type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} step="0.01" min="0" /></div>
            </AccordionContent>
        </AccordionItem>
      </Accordion>

      {selectedPaymentMethod && (
        <div className="space-y-3">
          <h4 className="font-medium">Upload Proof of Payment</h4>
          <p className="text-sm text-gray-600">{selectedPaymentMethod === 'PO' ? 'Upload a copy of your purchase order or confirmation' : selectedPaymentMethod === 'Check' && payByCheckAtTournament ? 'No upload required for pay at tournament option' : 'Upload a photo or screenshot of your payment confirmation'}</p>
          
          {!(selectedPaymentMethod === 'Check' && payByCheckAtTournament) && (
            <><input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" multiple className="hidden" /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full"><Upload className="w-4 h-4 mr-2" />{selectedPaymentMethod === 'PO' ? 'Upload PO Copy' : 'Upload Proof'}</Button></>
          )}

          {fileUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Uploaded files:</p>
              <div className="grid grid-cols-2 gap-3">
                {fileUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between"><span className="text-sm truncate">{uploadedFiles[index]?.name || `File ${index + 1}`}</span><Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></Button></div>
                      {uploadedFiles[index]?.type.startsWith('image/') && (<img src={url} alt="Payment proof" className="mt-2 w-full h-20 object-cover rounded" />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-sm text-amber-800 font-medium">📋 Review & Approval Process</p><p className="text-xs text-amber-700 mt-1">All payment submissions will be reviewed and approved by the Tournament Organizer. You will receive confirmation once your payment is verified.</p></div>
            <Button onClick={handleSubmitProof} disabled={isSubmitting || !selectedPaymentMethod || !paymentAmount} className="w-full">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Submit Payment Information
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};


interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  confirmation?: any;
  confirmationId?: string;
}

export function InvoiceDetailsDialog({ isOpen, onClose, confirmation: initialConfirmation, confirmationId }: InvoiceDetailsDialogProps) {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const { database: masterDatabase } = useMasterDb();
  const { events } = useEvents();
  
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

  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [initialPaymentValuesSet, setInitialPaymentValuesSet] = useState(false);

  // Payment fields
  const [checkAmount, setCheckAmount] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [zelleAmount, setZelleAmount] = useState('');
  const [zelleEmail, setZelleEmail] = useState('');
  const [cashAppAmount, setCashAppAmount] = useState('');
  const [cashAppHandle, setCashAppHandle] = useState('');
  const [venmoAmount, setVenmoAmount] = useState('');
  const [venmoHandle, setVenmoHandle] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [otherAmount, setOtherAmount] = useState('');
  const [otherDescription, setOtherDescription] = useState('');
  const [poAmount, setPoAmount] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [creditCardAmount, setCreditCardAmount] = useState('');
  const [creditCardLast4, setCreditCardLast4] = useState('');

  const registeredPlayers = useMemo(() => {
    if (!confirmation || !confirmation.selections || typeof confirmation.selections !== 'object') {
        return [];
    }
    const playerIds = Object.keys(confirmation.selections);
    return playerIds.map(id => {
      const player = masterDatabase.find(p => p.id === id);
      if (player) {
        return player;
      }
      return { id, firstName: 'Unknown', lastName: 'Player', uscfId: 'N/A' }; // Fallback with USCF ID
    }) as ({ id: string; firstName: string; lastName: string; uscfId: string; })[];
  }, [confirmation, masterDatabase]);
  
  const calculatedTotalPaid = useMemo(() => {
    if (!confirmation?.paymentHistory) return 0;
    return confirmation.paymentHistory.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
  }, [confirmation?.paymentHistory]);
  
  const totalInvoiced = confirmation?.totalAmount || confirmation?.totalInvoiced || 0;
  const totalPaid = Math.max(calculatedTotalPaid, confirmation?.totalPaid || 0);
  const balanceDue = Math.max(0, totalInvoiced - totalPaid);

  const isPaymentApproved = ['PAID', 'COMPED'].includes(confirmation?.invoiceStatus?.toUpperCase() || '');
  const isIndividualInvoice = confirmation?.schoolName === 'Individual Registration';

  const loadConfirmationData = useCallback(async (id: string) => {
    if (!db) return;
    const docRef = doc(db, "invoices", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setConfirmation({ id: docSnap.id, ...docSnap.data() });
    } else {
      onClose();
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load invoice details.' });
    }
  }, [onClose, toast]);

  useEffect(() => {
    if (isOpen) {
      if (initialConfirmation) {
        setConfirmation(initialConfirmation);
        const savedMethods = initialConfirmation.selectedPaymentMethods || [];
        setSelectedPaymentMethods(savedMethods);
        setInitialPaymentValuesSet(false);
      } else if (confirmationId) {
        loadConfirmationData(confirmationId);
      }
    }
    if (!auth || !storage) { setAuthError("Firebase is not configured, so file uploads are disabled."); setIsAuthReady(true); return; }
    const unsubscribe = onAuthStateChanged(auth, (user) => { if (user) { setCurrentUser(user); setAuthError(null); } else { signInAnonymously(auth).catch((error) => { console.error("Anonymous sign-in failed:", error); setAuthError("Authentication error. File uploads are disabled."); setCurrentUser(null); }); } setIsAuthReady(true); });
    return () => unsubscribe();
  }, [isOpen, initialConfirmation, confirmationId, loadConfirmationData]);

  useEffect(() => {
    if (confirmation && !initialPaymentValuesSet) {
      setCheckAmount(safeString(confirmation.checkAmount || '')); setCheckNumber(safeString(confirmation.checkNumber || '')); setZelleAmount(safeString(confirmation.zelleAmount || '')); setZelleEmail(safeString(confirmation.zelleEmail || '')); setCashAppAmount(safeString(confirmation.cashAppAmount || '')); setCashAppHandle(safeString(confirmation.cashAppHandle || '')); setVenmoAmount(safeString(confirmation.venmoAmount || '')); setVenmoHandle(safeString(confirmation.venmoHandle || '')); setCashAmount(safeString(confirmation.cashAmount || '')); setOtherAmount(safeString(confirmation.otherAmount || '')); setOtherDescription(safeString(confirmation.otherDescription || '')); setPoNumber(safeString(confirmation.poNumber || '')); setPoAmount(safeString(confirmation.poAmount || ''));
      setInitialPaymentValuesSet(true);
    }
  }, [confirmation, initialPaymentValuesSet]);

  const addNote = async (noteText: string, noteType: 'sponsor' | 'organizer') => {
    if (!noteText.trim() || !db) return;
    const newNote = { id: `note_${Date.now()}`, text: noteText.trim(), type: noteType, author: noteType === 'sponsor' ? (profile?.email || 'Sponsor') : (profile?.firstName || 'Organizer'), timestamp: new Date().toISOString() };
    const updatedConfirmationData = { ...confirmation, notes: [...(confirmation.notes || []), newNote], lastUpdated: new Date().toISOString() };
    await setDoc(doc(db, "invoices", confirmation.id), updatedConfirmationData, { merge: true });
    setConfirmation(updatedConfirmationData);
    if (noteType === 'sponsor') setSponsorNote(''); else setOrganizerNote('');
    toast({ title: 'Note Added', description: `${noteType === 'sponsor' ? 'Sponsor' : 'Organizer'} note has been saved.` });
  };
  
  const handleDeleteFile = async () => {
    if (!confirmation?.paymentFileUrl || !db) return;
    setIsUpdating(true);
    try {
      const fileRef = ref(storage, confirmation.paymentFileUrl); await deleteObject(fileRef);
      const updatedConfirmationData = { ...confirmation };
      delete updatedConfirmationData.paymentFileUrl; delete updatedConfirmationData.paymentFileName;
      await setDoc(doc(db, "invoices", confirmation.id), updatedConfirmationData, { merge: true });
      setConfirmation(updatedConfirmationData);
      toast({ title: 'File Deleted', description: 'The uploaded document has been removed.' });
    } catch (error) {
      console.error("Failed to delete file:", error);
      toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Could not delete the file.' });
    } finally { setIsUpdating(false); }
  };

  const getStatusBadge = (status: string, totalPaid?: number, totalInvoiced?: number) => {
    let displayStatus = (status || '').toUpperCase();
    if (totalPaid !== undefined && totalInvoiced !== undefined) { if (totalPaid >= totalInvoiced && totalPaid > 0) displayStatus = 'PAID'; else if (totalPaid > 0 && totalPaid < totalInvoiced) displayStatus = 'PARTIALLY_PAID'; }
    const variants: { [key: string]: 'default' | 'destructive' | 'secondary' } = { 'PAID': 'default', 'COMPED': 'default', 'UNPAID': 'destructive', 'OVERDUE': 'destructive', 'CANCELED': 'destructive', 'PARTIALLY_PAID': 'secondary', 'PENDING-PO': 'secondary' };
    let className = '';
    if (displayStatus === 'PAID' || displayStatus === 'COMPED') className = 'bg-green-600 text-white';
    if (displayStatus === 'PARTIALLY_PAID') className = 'bg-blue-600 text-white';
    if (displayStatus === 'PENDING-PO') className = 'bg-yellow-500 text-black';
    return <Badge variant={variants[displayStatus] || 'secondary'} className={className}>{displayStatus.replace(/_/g, ' ')}</Badge>;
  };
  
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => { const isValidType = file.type.startsWith('image/'); const isValidSize = file.size <= 5 * 1024 * 1024; return isValidType && isValidSize; });
    if (validFiles.length > 0) { setFileToUpload(validFiles[0]); setFileUrls(validFiles.map(file => URL.createObjectURL(file))); }
    if (fileInputRef.current) { fileInputRef.current.value = ''; }
  };

  const removeFile = (index: number) => { setFileToUpload(null); setFileUrls(prev => { URL.revokeObjectURL(prev[index]); return prev.filter((_, i) => i !== index); }); };

    const getKnownSponsorPhone = (email: string): string | null => {
        const knownSponsors: Record<string, string> = { 'normaguerra@yahoo.com': '(111) 111-1111' };
        if (!email) return null;
        const emailLower = email.toLowerCase();
        const foundEntry = Object.entries(knownSponsors).find(([key]) => key.toLowerCase() === emailLower);
        return foundEntry ? foundEntry[1] : null;
    };

    const RegistrationDetailsSection = ({ invoice, profile }: { invoice: any, profile: SponsorProfile | null }) => {
        const sponsorEmail = invoice.purchaserEmail || invoice.sponsorEmail || invoice.email;
        const knownPhone = getKnownSponsorPhone(sponsorEmail);
        return (
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-600">Event</span><span className="font-medium">{invoice.eventName || 'Chess Tournament'}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Date</span><span className="font-medium">{invoice.eventDate ? format(new Date(invoice.eventDate), 'PPP') : 'TBD'}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Sponsor Name</span><span className="font-medium">{invoice.purchaserName || invoice.sponsorName || 'FirstName LName'}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Sponsor Email</span><span className="font-medium">{sponsorEmail}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Sponsor Phone</span><span className="font-medium">{knownPhone ? `${knownPhone} (from records)` : invoice.purchaserPhone || invoice.sponsorPhone || 'Phone not provided'}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">School</span><span className="font-medium">{invoice.schoolName || 'SHARYLAND PIONEER H S'}</span></div>
            {profile?.role === 'organizer' && knownPhone && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">📞 Organizer Contact Info</h4>
                <div className="text-sm space-y-1"><div><strong>Phone:</strong> {knownPhone}</div><div><strong>Email:</strong> {sponsorEmail}</div></div>
                <div className="flex gap-2 mt-2"><button onClick={() => window.open(`tel:${knownPhone.replace(/\D/g, '')}`)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">📞 Call</button><button onClick={() => window.open(`mailto:${sponsorEmail}`)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">✉️ Email</button></div>
              </div>
            )}
          </div>
        );
      };

    const PaymentSummarySection = () => (
        <div className="mt-4">
            <h4 className="text-md font-medium mb-2">Payment Summary</h4>
            <div className="p-3 bg-gray-50 border rounded-md space-y-2 text-sm">
                <div className="flex justify-between"><span>Total Invoiced</span><span className="font-medium">${totalInvoiced.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Total Paid</span><span className="font-semibold text-green-600">${totalPaid.toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between text-base font-semibold"><span>Balance Due</span><span>${balanceDue.toFixed(2)}</span></div>
            </div>
        </div>
    );

    const ProofOfPaymentSection = () => (
      <div className="mt-4">
        <h4 className="text-md font-medium mb-2">Proof of Payment</h4>
        <div className="mb-3"><input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full"><Upload className="w-4 h-4 mr-2" />Upload Screenshot/Photo</Button></div>
        {fileUrls.length > 0 && (<div className="space-y-2"><p className="text-sm text-gray-600">Uploaded files:</p><div className="grid grid-cols-2 gap-2">{fileUrls.map((url, index) => (<div key={index} className="relative"><img src={url} alt={`Proof ${index + 1}`} className="w-full h-20 object-cover rounded border" /><button onClick={() => removeFile(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">×</button></div>))}</div></div>)}
      </div>
    );
    
    const PaymentFormComponent = ({ invoice }: { invoice: any }) => {
        const [localSelectedMethods, setLocalSelectedMethods] = useState<string[]>([]); const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({});
        const totalSelectedAmount = Object.values(paymentAmounts).reduce((sum, amount) => sum + amount, 0); const balanceDue = Math.max(0, totalInvoiced - totalPaid);
        const isValidPayment = () => { const hasSelectedMethod = localSelectedMethods.length > 0; const hasValidAmount = totalSelectedAmount > 0; const amountNotExceedsBalance = totalSelectedAmount <= balanceDue; return hasSelectedMethod && hasValidAmount && amountNotExceedsBalance; };
        const handleMethodChange = (method: string, isChecked: boolean) => { if (isChecked) { setLocalSelectedMethods(prev => [...prev, method]); if (localSelectedMethods.length === 0) { setPaymentAmounts(prev => ({ ...prev, [method]: balanceDue })); } } else { setLocalSelectedMethods(prev => prev.filter(m => m !== method)); setPaymentAmounts(prev => { const newAmounts = { ...prev }; delete newAmounts[method]; return newAmounts; }); } };
        const handleAmountChange = (method: string, amount: number) => { setPaymentAmounts(prev => ({ ...prev, [method]: amount })); };
        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, method: string) => { e.stopPropagation(); handleAmountChange(method, parseFloat(e.target.value) || 0); };
        const handleRecordPayment = async () => { if (!isValidPayment()) { toast({ variant: 'destructive', title: 'Invalid Payment', description: 'Please select a payment method and enter a valid amount' }); return; } setIsUpdating(true); try { const organizerInitials = profile?.firstName && profile?.lastName ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() : profile?.email?.substring(0, 2).toUpperCase() || 'ORG'; const newPayments = localSelectedMethods.map(method => ({ id: `payment_${Date.now()}_${method.toLowerCase().replace(/\s+/g, '_')}`, amount: paymentAmounts[method] || 0, method: method, date: new Date().toISOString(), dateFormatted: format(new Date(), 'MMM dd, yyyy HH:mm'), source: 'manual', status: 'completed', organizerInitials: organizerInitials, organizerName: profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : profile?.email || 'Organizer', details: { ...(method === 'Check' && { checkNumber: checkNumber, checkAmount: paymentAmounts[method] }), ...(method === 'Cash App' && { cashAppHandle: cashAppHandle, cashAppAmount: paymentAmounts[method] }), ...(method === 'Zelle' && { zelleEmail: zelleEmail, zelleAmount: paymentAmounts[method] }), ...(method === 'Venmo' && { venmoHandle: venmoHandle, venmoAmount: paymentAmounts[method] }), ...(method === 'Cash' && { cashAmount: paymentAmounts[method] }), } })); const newTotalPaid = totalPaid + totalSelectedAmount; const newBalanceDue = Math.max(0, totalInvoiced - newTotalPaid); const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID'; const updatedConfirmationData = { ...confirmation, paymentHistory: [...(confirmation.paymentHistory || []), ...newPayments], totalPaid: newTotalPaid, invoiceStatus: newStatus, status: newStatus, lastUpdated: new Date().toISOString(), }; try { if (confirmation?.invoiceId) { await recordPayment({ invoiceId: confirmation.invoiceId, amount: totalSelectedAmount, note: `${newPayments.map(p => `${p.method}: $${p.amount}`).join(', ')} recorded by ${organizerInitials}`, requestingUserRole: 'organizer', }); toast({ title: `💳 Payment Synced to Square by ${organizerInitials}`, description: `$${totalSelectedAmount.toFixed(2)} recorded and synced to Square API`, duration: 5000, }); } else { toast({ title: `💳 Payment Recorded Locally by ${organizerInitials}`, description: `$${totalSelectedAmount.toFixed(2)} recorded. Square invoice may need to be created manually.`, duration: 5000, }); } } catch (squareError: any) { const errorMessage = squareError?.message || 'Unknown error'; if (errorMessage.includes('not found') || errorMessage.includes('404')) { toast({ title: `💳 Payment Recorded Locally by ${organizerInitials}`, description: `$${totalSelectedAmount.toFixed(2)} recorded. The invoice wasn't found in Square. This usually means the invoice needs to be created manually in Square first.`, duration: 8000, }); } else { toast({ title: `💳 Payment Recorded Locally by ${organizerInitials}`, description: `$${totalSelectedAmount.toFixed(2)} recorded. Square sync failed: ${errorMessage}`, duration: 7000, }); } } await setDoc(doc(db, "invoices", confirmation.id), updatedConfirmationData, { merge: true }); setConfirmation(updatedConfirmationData); setLocalSelectedMethods([]); setPaymentAmounts({}); setCheckAmount(''); setCheckNumber(''); setCashAppAmount(''); setCashAppHandle(''); setZelleAmount(''); setZelleEmail(''); setVenmoAmount(''); setVenmoHandle(''); setCashAmount(''); window.dispatchEvent(new Event('storage')); window.dispatchEvent(new Event('all_invoices_updated')); if (newStatus === 'PAID') { setTimeout(() => { toast({ title: `🎉 Invoice Fully Paid!`, description: `Marked as PAID by ${organizerInitials} on ${format(new Date(), 'MMM dd, yyyy')}`, }); }, 1500); } } catch (error) { console.error('Error recording payment:', error); toast({ variant: 'destructive', title: 'Payment Recording Failed', description: 'Failed to record payment. Please try again.', }); } finally { setIsUpdating(false); } };
        return (
          <div className="space-y-4">
            <div className="space-y-3"><h3 className="font-medium">Payment Method</h3>
              <div className="flex items-center justify-between p-2 border rounded"><label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Cash App')} onChange={(e) => handleMethodChange('Cash App', e.target.checked)} className="mr-2" /> <span className="font-medium">Cash App</span> </label>{localSelectedMethods.includes('Cash App') && (<div className="flex gap-2"><input type="number" value={paymentAmounts['Cash App'] || ''} onChange={(e) => handleInputChange(e, 'Cash App')} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} /><input type="text" value={cashAppHandle} onChange={(e) => { e.stopPropagation(); setCashAppHandle(e.target.value); }} placeholder="$handle" className="w-24 px-2 py-1 border rounded text-sm" /></div>)}</div>
              <div className="flex items-center justify-between p-2 border rounded"><label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Check')} onChange={(e) => handleMethodChange('Check', e.target.checked)} className="mr-2" /> <span className="font-medium">Check</span> </label>{localSelectedMethods.includes('Check') && (<div className="flex gap-2"><input type="number" value={paymentAmounts['Check'] || ''} onChange={(e) => handleInputChange(e, 'Check')} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} /><input type="text" value={checkNumber} onChange={(e) => { e.stopPropagation(); setCheckNumber(e.target.value); }} placeholder="Check #" className="w-20 px-2 py-1 border rounded text-sm" /></div>)}</div>
              <div className="flex items-center justify-between p-2 border rounded"><label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Cash')} onChange={(e) => handleMethodChange('Cash', e.target.checked)} className="mr-2" /> <span className="font-medium">Cash</span> </label>{localSelectedMethods.includes('Cash') && ( <input type="number" value={paymentAmounts['Cash'] || ''} onChange={(e) => handleInputChange(e, 'Cash')} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} /> )}</div>
              <div className="flex items-center justify-between p-2 border rounded"><label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Zelle')} onChange={(e) => handleMethodChange('Zelle', e.target.checked)} className="mr-2" /> <span className="font-medium">Zelle</span> </label>{localSelectedMethods.includes('Zelle') && (<div className="flex gap-2"><input type="number" value={paymentAmounts['Zelle'] || ''} onChange={(e) => handleInputChange(e, 'Zelle')} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} /><input type="email" value={zelleEmail} onChange={(e) => { e.stopPropagation(); setZelleEmail(e.target.value); }} placeholder="Email" className="w-28 px-2 py-1 border rounded text-sm" /></div>)}</div>
              <div className="flex items-center justify-between p-2 border rounded"><label className="flex items-center"> <input type="checkbox" checked={localSelectedMethods.includes('Venmo')} onChange={(e) => handleMethodChange('Venmo', e.target.checked)} className="mr-2" /> <span className="font-medium">Venmo</span> </label>{localSelectedMethods.includes('Venmo') && (<div className="flex gap-2"><input type="number" value={paymentAmounts['Venmo'] || ''} onChange={(e) => handleInputChange(e, 'Venmo')} placeholder="Amount" className="w-24 px-2 py-1 border rounded" step="0.01" min="0" max={balanceDue} /><input type="text" value={venmoHandle} onChange={(e) => { e.stopPropagation(); setVenmoHandle(e.target.value); }} placeholder="@handle" className="w-24 px-2 py-1 border rounded text-sm" /></div>)}</div>
            </div>
            <button onClick={handleRecordPayment} disabled={!isValidPayment() || isUpdating} className={`w-full py-2 px-4 rounded font-medium transition-colors ${isValidPayment() && !isUpdating ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>{isUpdating ? (<> <Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Recording Payment... </>) : isValidPayment() ? '💳 Record Payment' : '⏸️ Select Payment Method'}</button>
            {confirmation?.paymentHistory && confirmation.paymentHistory.length > 0 && (<div className="mt-4 p-3 bg-gray-50 border rounded"><h4 className="font-medium mb-2">💳 Payment History</h4><div className="space-y-2 max-h-32 overflow-y-auto">{confirmation.paymentHistory.map((payment: any, index: number) => (<div key={payment.id || index} className="text-sm flex justify-between items-center p-2 bg-white rounded border"><div> <span className="font-medium">{payment.method}</span> <span className="text-gray-600 ml-2">${payment.amount.toFixed(2)}</span> </div><div className="text-xs text-gray-500"> {payment.organizerInitials && <span className="bg-blue-100 px-1 rounded mr-1">{payment.organizerInitials}</span>} {payment.dateFormatted || format(new Date(payment.date), 'MMM dd, HH:mm')} </div></div>))}</div></div>)}
            <ProofOfPaymentSection />
          </div>
        );
    };
      
      const EnhancedSquareDeveloperConsole = () => {
        if (profile?.role !== 'organizer') return null;
        const invoiceNumber = confirmation?.invoiceNumber || confirmation?.id.slice(-8);
        const openDeveloperConsole = () => { window.open('https://developer.squareup.com/apps', '_blank'); toast({ title: '🛠️ Square Developer Console', description: 'Opening Square Developer Apps. Click your app, then "Sandbox" tab to manage test invoices.', duration: 10000 }); };
        const openAPIExplorer = () => { window.open('https://developer.squareup.com/explorer/square/invoices-api', '_blank'); setTimeout(() => { toast({ title: '🔧 Step-by-Step Fix:', description: `1. Select "Search Invoices" → 2. Add filter: invoice_number = "${invoiceNumber}" → 3. Run request`, duration: 20000 }); }, 1000); };
        const openSquareDashboard = () => { window.open('https://squareupsandbox.com/dashboard/invoices', '_blank'); toast({ title: '🧪 Sandbox Dashboard', description: 'Opening Square SANDBOX dashboard', duration: 5000 }); };
        return (
          <div className="border-t pt-4 mt-4">
            <div className="space-y-3">
              <div><h4 className="font-medium text-sm">🛠️ Square Developer Tools</h4><p className="text-xs text-muted-foreground">Manually find or create this invoice in Square</p></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2"><Button variant="default" onClick={openSquareDashboard} size="sm"><ExternalLink className="mr-1 h-3 w-3" />Square Dashboard</Button><Button variant="outline" onClick={openDeveloperConsole} size="sm"><ExternalLink className="mr-1 h-3 w-3" />Developer Console</Button><Button variant="outline" onClick={openAPIExplorer} size="sm"><ExternalLink className="mr-1 h-3 w-3" />API Explorer</Button></div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3"><h5 className="text-xs font-medium text-blue-800 mb-2">🎯 Quick Fix Options:</h5><div className="space-y-2 text-xs text-blue-700"><div className="bg-white p-2 rounded border-l-2 border-blue-400"><p className="font-medium">Option 1: Find Existing Invoice</p><ol className="list-decimal list-inside mt-1 space-y-1"><li>Click "Square Dashboard" above</li><li>Search for invoice #{invoiceNumber}</li><li>If found, copy the correct URL</li></ol></div><div className="bg-white p-2 rounded border-l-2 border-green-400"><p className="font-medium">Option 2: Create New Invoice (Recommended)</p><ol className="list-decimal list-inside mt-1 space-y-1"><li>Click "API Explorer" above</li><li>Select "Create Invoice" endpoint</li><li>Fill: amount = ${confirmation?.totalAmount || 48}, invoice_number = "{invoiceNumber}"</li><li>Run request to create invoice</li><li>Copy the returned invoice ID</li><li>Return here and click "Sync with Square"</li></ol></div></div></div>
              <div className="bg-orange-50 border border-orange-200 rounded p-3"><h5 className="text-xs font-medium text-orange-800 mb-2">📋 Invoice Details for Square:</h5><div className="grid grid-cols-2 gap-2 text-xs text-orange-700"><div><strong>Invoice #:</strong> {invoiceNumber}</div><div><strong>Amount:</strong> ${confirmation?.totalAmount || 48}</div><div><strong>Customer:</strong> {confirmation?.purchaserEmail || 'N/A'}</div><div><strong>Status Needed:</strong> {confirmation?.totalPaid >= confirmation?.totalAmount ? 'PAID' : 'PARTIALLY_PAID'}</div></div></div>
            </div>
          </div>
        );
      };

  if (!confirmation) return null;
  const eventDetails = events.find(e => e.id === confirmation.eventId); const uscfFee = 24;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle><div className="flex items-center gap-2">{getStatusBadge(confirmation?.invoiceStatus || confirmation?.status || 'UNPAID', totalPaid, totalInvoiced)}Invoice #{confirmation?.invoiceNumber || 'Unknown'}</div></DialogTitle>
          <DialogDescription className="sr-only">Dialog for viewing invoice details.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><div className="bg-white rounded-lg border p-4"><h3 className="text-lg font-semibold mb-4">Registration Details</h3><RegistrationDetailsSection invoice={confirmation} profile={profile} /><div className="mt-4"><h4 className="text-md font-medium mb-2">Registered Players</h4><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>USCF ID</TableHead><TableHead className="text-right">Reg. Fee</TableHead><TableHead className="text-right">Late Fee</TableHead><TableHead className="text-right">USCF Fee</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{registeredPlayers.length === 0 && (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No players on this invoice.</TableCell></TableRow>)}{registeredPlayers.map(player => { const playerDetails = confirmation?.selections?.[player.id]; if (!playerDetails) return null; const regFee = eventDetails?.regularFee || 0; const lateFee = (confirmation.totalInvoiced / Object.keys(confirmation.selections).length) - regFee - ((playerDetails?.uscfStatus !== 'current' && ('studentType' in player && player.studentType !== 'gt')) ? uscfFee : 0); const playerUscfFee = (playerDetails?.uscfStatus !== 'current' && ('studentType' in player && player.studentType !== 'gt')) ? uscfFee : 0; const playerTotal = regFee + lateFee + playerUscfFee; return (<TableRow key={player.id}><TableCell>{player.firstName} {player.lastName}</TableCell><TableCell>{player.uscfId}</TableCell><TableCell className="text-right">${regFee.toFixed(2)}</TableCell><TableCell className="text-right">${lateFee > 0 ? lateFee.toFixed(2) : '0.00'}</TableCell><TableCell className="text-right">${playerUscfFee.toFixed(2)}</TableCell><TableCell className="text-right font-medium">${playerTotal.toFixed(2)}</TableCell></TableRow>);})}</TableBody></Table></div><PaymentSummarySection /></div></div>
          <div><div className="bg-white rounded-lg border p-4"><h3 className="text-lg font-semibold mb-4">Submit Payment Information</h3>{profile?.role === 'sponsor' || isIndividualInvoice ? (<SponsorPaymentComponent confirmation={confirmation} onPaymentSubmitted={setConfirmation} />) : (<PaymentFormComponent invoice={confirmation} />)}</div></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
