
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, DollarSign, Calendar, Building, User, History, UploadCloud, File as FileIcon, Download, Calendar as CalendarIcon } from 'lucide-react';
import { format } from "date-fns";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { auth, storage } from '@/lib/firebase';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';


interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  confirmation?: any;
  confirmationId?: string;
}

type PaymentMethod = 'po' | 'check' | 'cashapp' | 'zelle';

type PaymentInputs = {
  paymentMethod: PaymentMethod;
  poNumber: string;
  checkNumber: string;
  checkDate?: Date;
  amountPaid: string;
  file: File | null;
  paymentFileName?: string;
  paymentFileUrl?: string;
};

export function InvoiceDetailsDialog({ isOpen, onClose, confirmation: initialConfirmation, confirmationId }: InvoiceDetailsDialogProps) {
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState<any>(null);
  const [paymentInputs, setPaymentInputs] = useState<Partial<PaymentInputs>>({ paymentMethod: 'po' });
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { database: allPlayers } = useMasterDb();

  const loadConfirmationData = useCallback(async (id: string) => {
    if (!db) return;
    const docRef = doc(db, "invoices", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      setConfirmation(data);
      setPaymentInputs({
        paymentMethod: data.paymentMethod || 'po',
        poNumber: data.poNumber || '',
        checkNumber: data.checkNumber || '',
        checkDate: data.checkDate ? new Date(data.checkDate) : undefined,
        amountPaid: data.amountPaid || '',
        paymentFileName: data.paymentFileName,
        paymentFileUrl: data.paymentFileUrl,
        file: null,
      });
    } else {
      onClose();
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load invoice details.' });
    }
  }, [onClose, toast]);
  
  useEffect(() => {
    if (isOpen) {
      if (initialConfirmation) {
        loadConfirmationData(initialConfirmation.id);
      } else if (confirmationId) {
        loadConfirmationData(confirmationId);
      }
    }
  }, [isOpen, initialConfirmation, confirmationId, loadConfirmationData]);

  useEffect(() => {
    if (!auth || !storage) {
      setIsAuthReady(false);
      setAuthError("Firebase is not configured, so file uploads are disabled.");
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthReady(true);
        setAuthError(null);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("Anonymous sign-in failed:", error);
          setAuthError("Auth error, uploads disabled.");
          setIsAuthReady(false);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (field: keyof PaymentInputs, value: any) => {
    setPaymentInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleInputChange('file', file);
  };

  const handleSavePayment = async () => {
    if (!confirmation) return;
    setIsUpdatingPayment(true);
    const { paymentMethod = 'po', file } = paymentInputs;

    try {
        let paymentFileName = paymentInputs.paymentFileName;
        let paymentFileUrl = paymentInputs.paymentFileUrl;

        if (file) {
            if (!isAuthReady) throw new Error(authError || "Authentication not ready.");
            if (!storage) throw new Error('Firebase Storage is not configured.');
            
            const storageRef = ref(storage, `payment-proof/${confirmation.id}/${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            paymentFileUrl = await getDownloadURL(snapshot.ref);
            paymentFileName = file.name;
        }
        
        let newTitle = confirmation.invoiceTitle || confirmation.eventName || '';
        let toastMessage = "Payment information has been saved.";

        let updatedData: any = {
          paymentMethod,
          paymentFileName,
          paymentFileUrl,
          poNumber: paymentInputs.poNumber || null,
          checkNumber: paymentInputs.checkNumber || null,
          checkDate: paymentInputs.checkDate ? paymentInputs.checkDate.toISOString() : null,
          amountPaid: paymentInputs.amountPaid || null,
          paymentStatus: 'pending-po', // Always set to pending for organizer review
        };

        const invoiceRef = doc(db, 'invoices', confirmation.id);
        await setDoc(invoiceRef, updatedData, { merge: true });

        if (paymentMethod === 'po' && paymentInputs.poNumber && confirmation.invoiceId) {
            newTitle += ` PO: ${paymentInputs.poNumber}`;
            await updateInvoiceTitle({ invoiceId: confirmation.invoiceId, title: newTitle });
            toastMessage = "PO information saved and invoice title updated.";
        }

        setConfirmation((prev: any) => ({ ...prev, ...updatedData, invoiceTitle: newTitle }));
        setPaymentInputs(prev => ({ ...prev, file: null, paymentFileName: paymentFileName, paymentFileUrl: paymentFileUrl }));
        
        toast({ title: "Success", description: toastMessage });

    } catch (error) {
        console.error("Failed to update payment information:", error);
        toast({ variant: "destructive", title: "Update Failed", description: error instanceof Error ? error.message : 'An unknown error occurred.' });
    } finally {
        setIsUpdatingPayment(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || 'UNKNOWN').toUpperCase();
    const variants: { [key: string]: 'default' | 'destructive' | 'secondary' } = { 
      'PAID': 'default', 'COMPED': 'default', 'UNPAID': 'destructive', 
      'CANCELED': 'destructive', 'PARTIALLY_PAID': 'secondary', 'PENDING-PO': 'secondary'
    };
    let className = '';
    if (s === 'PAID' || s === 'COMPED') className = 'bg-green-600 text-white';
    if (s === 'PENDING-PO') className = 'bg-yellow-500 text-black';

    return <Badge variant={variants[s] || 'secondary'} className={className}>{s.replace(/_/g, ' ')}</Badge>;
  };

  const registeredPlayers = useMemo(() => {
    if (!confirmation?.selections) return [];
    return Object.keys(confirmation.selections).map(playerId => {
      const player = allPlayers.find(p => p.id === playerId);
      return {
        ...player,
        ...confirmation.selections[playerId]
      } as MasterPlayer & { section: string, uscfStatus: string };
    });
  }, [confirmation, allPlayers]);
  
  const selectedMethod = paymentInputs.paymentMethod || 'po';
  const isLoading = isUpdatingPayment || !isAuthReady;

  if (!confirmation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <DialogTitle className="flex items-center gap-2">
              {getStatusBadge(confirmation?.invoiceStatus)}
              Invoice #{confirmation?.invoiceNumber || 'N/A'}
            </DialogTitle>
             {confirmation?.invoiceUrl && (
              <Button asChild variant="outline" size="sm">
                  <a href={confirmation.invoiceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Pay with Card via Square
                  </a>
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 -mr-4 grid md:grid-cols-2 gap-6 py-4">
            {/* Left side: Invoice Summary & Player Details */}
            <div className="space-y-4">
                <h3 className="font-semibold text-lg">Invoice Summary</h3>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><User className="h-4 w-4"/>Sponsor</span>
                    <span className="font-medium">{confirmation.purchaserName || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><Building className="h-4 w-4"/>School</span>
                    <span className="font-medium">{confirmation.schoolName || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4"/>Invoice Date</span>
                    <span className="font-medium">
                        {confirmation.submissionTimestamp ? format(new Date(confirmation.submissionTimestamp), 'PPP') : 'N/A'}
                    </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-lg font-bold">
                    <span className="text-muted-foreground flex items-center gap-2"><DollarSign className="h-5 w-5"/>Total Amount</span>
                    <span>${(confirmation.totalAmount || 0).toFixed(2)}</span>
                </div>

                <div className="pt-4">
                    <h3 className="font-semibold text-lg mb-2">Registered Players ({registeredPlayers.length})</h3>
                    <div className="border rounded-md max-h-60 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Name</TableHead><TableHead>Section</TableHead><TableHead>USCF Status</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {registeredPlayers.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.firstName} {p.lastName}</TableCell>
                                        <TableCell>{p.section}</TableCell>
                                        <TableCell><Badge variant={p.uscfStatus === 'current' ? 'default' : 'secondary'} className={cn(p.uscfStatus === 'current' && 'bg-green-600')}>{p.uscfStatus}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* Right side: Payment Options */}
            <div className="space-y-4 border-l md:pl-6">
                <Accordion type="single" collapsible defaultValue="item-1">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="font-semibold text-lg">Offline Payment Options</AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <div className="space-y-4">
                        <RadioGroup value={selectedMethod} onValueChange={(value) => handleInputChange('paymentMethod', value as PaymentMethod)} className="grid grid-cols-2 gap-4" disabled={isLoading}>
                            <div><RadioGroupItem value="po" id={`po-${confirmation.id}`} className="peer sr-only" /><Label htmlFor={`po-${confirmation.id}`} className="payment-label">Purchase Order</Label></div>
                            <div><RadioGroupItem value="check" id={`check-${confirmation.id}`} className="peer sr-only" /><Label htmlFor={`check-${confirmation.id}`} className="payment-label">Check</Label></div>
                            <div><RadioGroupItem value="cashapp" id={`cashapp-${confirmation.id}`} className="peer sr-only" /><Label htmlFor={`cashapp-${confirmation.id}`} className="payment-label">Cash App</Label></div>
                            <div><RadioGroupItem value="zelle" id={`zelle-${confirmation.id}`} className="peer sr-only" /><Label htmlFor={`zelle-${confirmation.id}`} className="payment-label">Zelle</Label></div>
                        </RadioGroup>
                        
                        {selectedMethod === 'po' && (
                            <div className="space-y-4">
                                <div className="space-y-1"><Label htmlFor={`po-number-${confirmation.id}`}>PO Number</Label><Input id={`po-number-${confirmation.id}`} placeholder="Enter PO Number" value={paymentInputs.poNumber || ''} onChange={(e) => handleInputChange('poNumber', e.target.value)} disabled={isLoading} /></div>
                                <div className="space-y-1"><Label htmlFor={`po-file-${confirmation.id}`}>Upload PO Document</Label><Input id={`po-file-${confirmation.id}`} type="file" onChange={handleFileChange} disabled={isLoading} /></div>
                            </div>
                        )}
                        {selectedMethod === 'check' && (
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1"><Label htmlFor={`check-number-${confirmation.id}`}>Check #</Label><Input id={`check-number-${confirmation.id}`} placeholder="Enter Check #" value={paymentInputs.checkNumber || ''} onChange={(e) => handleInputChange('checkNumber', e.target.value)} disabled={isLoading} /></div>
                                <div className="space-y-1"><Label>Check Date</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{paymentInputs.checkDate ? format(paymentInputs.checkDate, 'PPP') : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={paymentInputs.checkDate} onSelect={(date) => handleInputChange('checkDate', date)} initialFocus /></PopoverContent></Popover></div>
                            </div>
                        )}
                        {(selectedMethod === 'cashapp' || selectedMethod === 'zelle') && (
                            <div className="space-y-1"><Label htmlFor={`payment-file-${confirmation.id}`}>Upload Confirmation Screenshot</Label><Input id={`payment-file-${confirmation.id}`} type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} /></div>
                        )}
                        
                        <div className="space-y-1"><Label htmlFor={`amount-paid-${confirmation.id}`}>Amount Paid</Label><Input id={`amount-paid-${confirmation.id}`} type="number" placeholder={(confirmation.totalAmount || 0).toFixed(2)} value={paymentInputs.amountPaid || ''} onChange={(e) => handleInputChange('amountPaid', e.target.value)} disabled={isLoading} /></div>

                        {(paymentInputs.file || paymentInputs.paymentFileUrl) && (
                        <div className="text-sm text-muted-foreground flex items-center gap-2 pt-1">
                            {paymentInputs.file ? <FileIcon className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                            <span>{paymentInputs.file ? `Selected: ${paymentInputs.file.name}` : (<a href={paymentInputs.paymentFileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">View {paymentInputs.paymentFileName}</a>)}</span>
                        </div>
                        )}

                        <Button onClick={handleSavePayment} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                            {isLoading ? 'Saving...' : 'Submit Payment Information'}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
            </div>
        </div>
        
        <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </DialogFooter>
        <style jsx>{`
            .payment-label {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; border-radius: 0.375rem; border: 2px solid hsl(var(--muted));
                background-color: hsl(var(--popover)); padding: 1rem; cursor: pointer; transition: all 0.2s;
            }
            .payment-label:hover { background-color: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
            .peer[data-state=checked] + .payment-label { border-color: hsl(var(--primary)); }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

    