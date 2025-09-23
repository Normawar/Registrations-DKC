
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
import { getInvoiceStatus as getInvoiceStatusFlow } from '@/ai/flows/get-invoice-status-flow';
import { PaymentHistoryDisplay } from '@/components/payment-history-display';
import { Checkbox } from './ui/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { useEvents } from '@/hooks/use-events';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import Image from 'next/image';
import { handleRefreshStatusWithPaymentSync } from '@/components/unified-payment-system';


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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Payment method specific fields
  const [paymentAmount, setPaymentAmount] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [payByCheckAtTournament, setPayByCheckAtTournament] = useState(false);

  useEffect(() => {
    if (!auth || !storage) {
        setAuthError("Firebase is not configured, so file uploads are disabled.");
        setIsAuthReady(true); // Still allow form to be used, but uploads will fail gracefully
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log("🔐 Auth state changed:", {
            authenticated: !!user,
            uid: user?.uid,
            isAnonymous: user?.isAnonymous
        });
        
        if (user) {
            setIsAuthReady(true);
            setAuthError(null);
        } else {
            console.log("🔐 No user, attempting anonymous sign-in...");
            try {
                await signInAnonymously(auth);
                console.log("✅ Anonymous sign-in initiated");
            } catch (error) {
                console.error("❌ Anonymous sign-in failed:", error);
                setAuthError("Authentication error. File uploads are disabled.");
                setIsAuthReady(true); // Still allow form usage
            }
        }
    });
    
    return () => unsubscribe();
}, []);

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
    // ... validation code ...
    if (!selectedPaymentMethod) { toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a payment method.' }); return; }
    if (!paymentAmount) { toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter the payment amount.' }); return; }
    if (selectedPaymentMethod === 'PO' && !poNumber) { toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter the PO number.' }); return; }
    if (selectedPaymentMethod === 'Check' && !payByCheckAtTournament && !checkNumber) { toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter the check number.' }); return; }


    setIsSubmitting(true);

    try {
        let uploadedFileUrl: string | undefined;
        let uploadedFileName: string | undefined;

        if (uploadedFiles.length > 0) {
            if (!storage) {
                toast({ variant: 'destructive', title: 'Upload Failed', description: 'Firebase Storage is not configured.' });
                setIsSubmitting(false);
                return;
            }

            // ENHANCED AUTH CHECK - Wait for authentication to complete
            console.log("🔐 Checking authentication before upload...");
            
            if (!auth.currentUser) {
                console.log("❌ No user authenticated, attempting anonymous sign-in...");
                try {
                    const userCredential = await signInAnonymously(auth);
                    console.log("✅ Anonymous sign-in successful:", userCredential.user.uid);
                } catch (authError) {
                    console.error("❌ Anonymous sign-in failed:", authError);
                    toast({ variant: 'destructive', title: 'Authentication Failed', description: 'Cannot authenticate for file upload.' });
                    setIsSubmitting(false);
                    return;
                }
            }

            // Double-check authentication
            const currentUser = auth.currentUser;
            console.log("🔐 Current user before upload:", {
                uid: currentUser?.uid,
                isAnonymous: currentUser?.isAnonymous,
                authenticated: !!currentUser
            });

            if (!currentUser) {
                toast({ variant: 'destructive', title: 'Upload Failed', description: 'User not authenticated.' });
                setIsSubmitting(false);
                return;
            }

            const file = uploadedFiles[0];
            const sanitizedConfirmationId = confirmation.id.replace(/:/g, '-');
            
            console.log("📁 Upload path:", `payment-proofs/${sanitizedConfirmationId}/${file.name}`);
            
            const storageRef = ref(storage, `payment-proofs/${sanitizedConfirmationId}/${file.name}`);
            
            try {
                console.log("⬆️ Starting file upload...");
                const snapshot = await uploadBytes(storageRef, file);
                uploadedFileUrl = await getDownloadURL(snapshot.ref);
                uploadedFileName = file.name;
                console.log("✅ Upload successful:", uploadedFileUrl);
            } catch (uploadError: any) {
                console.error("❌ Upload failed:", uploadError);
                toast({ 
                    variant: 'destructive', 
                    title: 'Upload Failed', 
                    description: `Upload error: ${uploadError.message}` 
                });
                setIsSubmitting(false);
                return;
            }
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
  
  const isSubmitDisabled = isSubmitting || !isAuthReady || !selectedPaymentMethod || !paymentAmount;

  return (
    <div className="space-y-6">
       {confirmation.invoiceUrl && (
        <Button asChild className="w-full">
          <a href={confirmation.invoiceUrl} target="_blank" rel="noopener noreferrer">
            <CreditCard className="mr-2 h-4 w-4" /> Pay by Credit Card
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
                        <p className="text-sm text-gray-600">Scan the QR code or use cash app code below and enter the total amount due. Upload a screenshot of the confirmation.</p>
                        <p className="font-bold text-lg mt-1">$DKChess</p>
                    </div>
                    <div className="text-center">
                        <a href="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" target="_blank" rel="noopener noreferrer">
                            <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/CashApp%20QR%20Code.jpg?alt=media&token=a30aa7de-0064-4b49-8b0e-c58f715b6cdd" alt="CashApp QR Code" width={100} height={100} className="rounded-md transition-transform duration-200 ease-in-out hover:scale-125" data-ai-hint="QR code" />
                        </a>
                        <p className="text-xs text-muted-foreground mt-1">click image to enlarge</p>
                    </div>
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
                     <div className="text-center">
                        <a href="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" target="_blank" rel="noopener noreferrer">
                            <Image src="https://firebasestorage.googleapis.com/v0/b/chessmate-w17oa.firebasestorage.app/o/Zelle%20QR%20code.jpg?alt=media&token=2b1635bd-180e-457d-8e1e-f91f71bcff89" alt="Zelle QR Code" width={100} height={100} className="rounded-md transition-transform duration-200 ease-in-out hover:scale-125" data-ai-hint="QR code" />
                        </a>
                        <p className="text-xs text-muted-foreground mt-1">click image to enlarge</p>
                    </div>
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
          {authError && (
              <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Uploads Disabled</AlertTitle>
                  <AlertDescription>{authError}</AlertDescription>
              </Alert>
          )}
          <div className="space-y-3 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-sm text-amber-800 font-medium">📋 Review & Approval Process</p><p className="text-xs text-amber-700 mt-1">All payment submissions will be reviewed and approved by the Tournament Organizer. You will receive confirmation once your payment is verified.</p></div>
            <Button onClick={handleSubmitProof} disabled={isSubmitDisabled} className="w-full">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : !isAuthReady ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isSubmitting ? 'Submitting...' : !isAuthReady ? 'Authenticating...' : 'Submit Payment Information'}
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isIndividualInvoice = confirmation?.schoolName === 'Individual Registration';

  const loadConfirmationData = useCallback(async (id: string) => {
    if (!db) return;
    const docRef = doc(db, "invoices", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      setConfirmation(data);
      handleRefreshStatusWithPaymentSync(data, setConfirmation, toast, setIsRefreshing);
    } else {
      onClose();
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load invoice details.' });
    }
  }, [onClose, toast]);
  
  useEffect(() => {
    if (isOpen) {
      if (initialConfirmation) {
        setConfirmation(initialConfirmation);
        handleRefreshStatusWithPaymentSync(initialConfirmation, setConfirmation, toast, setIsRefreshing);
      } else if (confirmationId) {
        loadConfirmationData(confirmationId);
      }
    }
  }, [isOpen, initialConfirmation, confirmationId, loadConfirmationData, toast]);

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
  
  const getStatusBadge = (status: string, totalPaid?: number, totalInvoiced?: number) => {
    let displayStatus = (status || '').toUpperCase();
    if (totalPaid !== undefined && totalInvoiced !== undefined) { if (totalPaid >= totalInvoiced && totalPaid > 0) displayStatus = 'PAID'; else if (totalPaid > 0 && totalPaid < totalInvoiced) displayStatus = 'PARTIALLY_PAID'; }
    const variants: { [key: string]: 'default' | 'destructive' | 'secondary' } = { 'PAID': 'default', 'COMPED': 'default', 'UNPAID': 'destructive', 'OVERDUE': 'destructive', 'CANCELED': 'destructive', 'PARTIALLY_PAID': 'secondary', 'PENDING-PO': 'secondary' };
    let className = '';
    if (displayStatus === 'PAID' || displayStatus === 'COMPED') className = 'bg-green-600 text-white';
    if (displayStatus === 'PARTIALLY_PAID') className = 'bg-blue-600 text-white';
    if (displayStatus === 'PENDING-PO') className = 'bg-yellow-500 text-black';
    return <Badge variant={variants[displayStatus] || 'secondary'} className={className}>{displayStatus.replace(/_/g, ' ')}</Badge>
  };
      
  const eventDetails = events.find(e => e.id === confirmation?.eventId); const uscfFee = 24;

  if (!confirmation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="flex items-center gap-2">
              {getStatusBadge(confirmation?.invoiceStatus, confirmation?.totalPaid, confirmation?.totalAmount)}
              Invoice #{confirmation?.invoiceNumber || 'Unknown'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {confirmation?.invoiceUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={confirmation.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> View on Square
                  </a>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => handleRefreshStatusWithPaymentSync(confirmation, setConfirmation, toast, setIsRefreshing)} disabled={isRefreshing}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                  Refresh
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">Dialog for viewing invoice details.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Registration Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Event</span><span className="font-medium text-right">{confirmation.eventName || 'Chess Tournament'}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Date</span><span className="font-medium">{confirmation.eventDate ? format(new Date(confirmation.eventDate), 'PPP') : 'TBD'}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Sponsor</span><span className="font-medium">{confirmation.purchaserName || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">School</span><span className="font-medium">{confirmation.schoolName || 'N/A'}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Registered Players ({registeredPlayers.length})</CardTitle></CardHeader>
              <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>USCF ID</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {registeredPlayers.map(player => { 
                            const playerDetails = confirmation?.selections?.[player.id]; 
                            if (!playerDetails) return null;
                            const regFee = eventDetails?.regularFee || 0;
                            const lateFee = (confirmation.totalInvoiced / Object.keys(confirmation.selections).length) - regFee - ((playerDetails?.uscfStatus !== 'current' && player.studentType !== 'gt') ? uscfFee : 0);
                            const playerUscfFee = (playerDetails?.uscfStatus !== 'current' && player.studentType !== 'gt') ? uscfFee : 0;
                            const playerTotal = regFee + (lateFee > 0 ? lateFee : 0) + playerUscfFee;
                            return (
                                <TableRow key={player.id}>
                                    <TableCell>{player.firstName} {player.lastName}</TableCell>
                                    <TableCell>{player.uscfId}</TableCell>
                                    <TableCell className="text-right font-medium">${playerTotal.toFixed(2)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
              </CardContent>
            </Card>

             <PaymentHistoryDisplay confirmation={confirmation} />

          </div>
          <div>
            <Card>
                <CardHeader>
                  <CardTitle>Payment</CardTitle>
                </CardHeader>
                <CardContent>
                  <SponsorPaymentComponent confirmation={confirmation} onPaymentSubmitted={setConfirmation} />
                </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
