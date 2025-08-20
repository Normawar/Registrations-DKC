
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
  const [poNumber, setPONumber] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  const [cashAmount, setCashAmount] = useState('');
  const [checkAmount, setCheckAmount] = useState('');
  const [cashAppAmount, setCashAppAmount] = useState('');
  const [zelleAmount, setZelleAmount] = useState('');
  const [poAmount, setPoAmount] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sponsorNote, setSponsorNote] = useState('');
  const [organizerNote, setOrganizerNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Load specific confirmation details
    const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
    const currentConf = allInvoices.find((c: any) => c.id === confirmationId);
    if (currentConf) {
      setConfirmation(currentConf);
      setSelectedPaymentMethod(currentConf.paymentMethod || 'purchase-order');
      setPONumber(currentConf.poNumber || '');
      setCashAmount('');
      setCheckAmount('');
      setCashAppAmount('');
      setZelleAmount('');
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
    // await handleRefreshStatusWithPaymentSync(confirmation, setConfirmation, toast, setIsRefreshing);
  };
  
  const getSquareDashboardUrl = (invoiceNumber: string) => {
    const baseUrl = 'https://squareup.com/dashboard/invoices';
    if (invoiceNumber) {
      return `${baseUrl}/${invoiceNumber}`;
    }
    return baseUrl;
  }

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

            const result = await recordPayment({
                invoiceId: confirmation.invoiceId,
                amount: paymentAmount,
                note: `${selectedPaymentMethod.replace('-', ' ')} payment recorded by ${profile?.firstName || 'organizer'}`,
                paymentDate: format(new Date(), 'yyyy-MM-dd'),
            });

            const newTotalPaid = result.totalPaid;
            const totalInvoiced = result.totalInvoiced || confirmation.totalAmount || confirmation.totalInvoiced || 0;
            
            let actualStatus = 'UNPAID';
            if (newTotalPaid >= totalInvoiced) actualStatus = 'PAID';
            else if (newTotalPaid > 0) actualStatus = 'PARTIALLY_PAID';

            const newPaymentEntry = {
                id: result.paymentId,
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

            const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
            const updatedAllInvoices = allInvoices.map((inv: any) => inv.id === confirmation.id ? updatedConfirmationData : inv);
            localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));

            const confirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
            const updatedConfirmations = confirmations.map((conf: any) => conf.id === confirmation.id ? updatedConfirmationData : conf);
            localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));

            setConfirmation(updatedConfirmationData);
            
            setCashAmount('');
            setCheckAmount('');
            setCashAppAmount('');
            setZelleAmount('');
            setPoAmount('');

            const squareDashboardUrl = getSquareDashboardUrl(confirmation.invoiceNumber);
            window.open(squareDashboardUrl, '_blank');
            
            toast({ 
                title: 'Payment Recorded & Square Opened', 
                description: `${selectedPaymentMethod.replace('-', ' ')} payment of $${paymentAmount.toFixed(2)} recorded locally. Square Dashboard opened - find invoice #${confirmation.invoiceNumber || confirmation.id.slice(-8)} and click "Mark as paid" with amount $${paymentAmount.toFixed(2)}.`,
                duration: 8000
            });

            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('all_invoices_updated'));
            setIsUpdating(false);
            return;
        }

        let updatedConfirmationData = { ...confirmation };

        if (fileToUpload) {
            if (!currentUser) {
                toast({ 
                    variant: 'destructive', 
                    title: 'Authentication Not Ready', 
                    description: authError || "Cannot submit payment information at this time. Please refresh the page."
                });
                setIsUpdating(false);
                return;
            }

            const isPoUpload = selectedPaymentMethod === 'purchase-order';
            const uploadFolder = isPoUpload ? 'purchase-orders' : 'payment-proofs';
            const recordId = confirmation.id;
            const storageRef = ref(storage, `${uploadFolder}/${recordId}/${fileToUpload.name}`);
            
            const snapshot = await uploadBytes(storageRef, fileToUpload);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            if (isPoUpload) {
                updatedConfirmationData.poFileUrl = downloadUrl;
                updatedConfirmationData.poFileName = fileToUpload.name;
            } else {
                updatedConfirmationData.paymentFileUrl = downloadUrl;
                updatedConfirmationData.paymentFileName = fileToUpload.name;
            }
        }

        const formattedEventDate = format(new Date(updatedConfirmationData.eventDate), 'MM/dd/yyyy');
        let newTitle = `${updatedConfirmationData.teamCode || updatedConfirmationData.schoolName} @ ${formattedEventDate} ${updatedConfirmationData.eventName}`;
        
        const finalPoNumber = selectedPaymentMethod === 'purchase-order' ? poNumber : updatedConfirmationData.poNumber;
        if (finalPoNumber) {
            newTitle += ` PO: ${finalPoNumber}`;
        }
      
        if (updatedConfirmationData.invoiceId) {
            await updateInvoiceTitle({ invoiceId: updatedConfirmationData.invoiceId, title: newTitle });
        }

        updatedConfirmationData = {
            ...updatedConfirmationData,
            paymentMethod: selectedPaymentMethod,
            poNumber: finalPoNumber,
            invoiceTitle: newTitle,
            paymentStatus: 'pending-po',
            status: 'PENDING-PO',
            invoiceStatus: 'PENDING-PO',
            lastUpdated: new Date().toISOString(),
        };

        const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
        const updatedAllInvoices = allInvoices.map((inv: any) => inv.id === confirmation.id ? updatedConfirmationData : inv);
        localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));

        const confirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
        const existingConfirmationIndex = confirmations.findIndex((conf: any) => conf.id === confirmation.id);
        if (existingConfirmationIndex >= 0) {
            confirmations[existingConfirmationIndex] = updatedConfirmationData;
        } else {
            confirmations.push(updatedConfirmationData);
        }
        localStorage.setItem('confirmations', JSON.stringify(updatedConfirmations));

        setConfirmation(updatedConfirmationData);
        setFileToUpload(null);

        toast({ title: 'Payment Info Submitted', description: "An organizer will verify your payment once the monetary transfer has been verified." });

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('all_invoices_updated'));

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

  if (!isOpen || !confirmation) return null;

  const players = getRegisteredPlayers(confirmation);
  const isPaymentApproved = ['PAID', 'COMPED'].includes(confirmation.invoiceStatus?.toUpperCase());
  const isIndividualInvoice = confirmation.schoolName === 'Individual Registration';
  const totalPaid = confirmation.totalPaid || 0;
  const totalInvoiced = confirmation.totalAmount || confirmation.totalInvoiced || 0;
  const balanceDue = totalInvoiced - totalPaid;

  const invoiceUrl = confirmation.publicUrl || confirmation.invoiceUrl;
  
  const PaymentHistorySection = () => {
    const paymentHistory = confirmation.paymentHistory || [];
    
    const getPaymentMethodIcon = (method: string) => {
      switch (method) {
        case 'credit_card': return '💳';
        case 'cash': return '💵';
        case 'check': return '📝';
        case 'cash_app': return '📱';
        case 'zelle': return '🏦';
        case 'external': return '🔗';
        default: return '💰';
      }
    };
    
    const getPaymentMethodLabel = (payment: any) => {
      if (payment.method === 'credit_card' && payment.cardBrand && payment.last4) {
        return `${payment.cardBrand.toUpperCase()} ****${payment.last4}`;
      }
      
      const methodLabels: Record<string, string> = {
        credit_card: 'Credit Card',
        cash: 'Cash Payment',
        check: 'Check',
        cash_app: 'Cash App',
        zelle: 'Zelle',
        external: 'External Payment',
      };
      
      return methodLabels[payment.method as keyof typeof methodLabels] || 'Payment';
    };
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paymentHistory.length > 0 ? (
            <div className='space-y-3'>
              {paymentHistory.map((payment: any, index: number) => (
                <div key={payment.id || index} className="flex justify-between items-center border-b pb-3 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{getPaymentMethodIcon(payment.method)}</span>
                    <div>
                      <p className="text-sm font-medium">
                        {getPaymentMethodLabel(payment)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.date ? format(new Date(payment.date), 'MMM dd, yyyy \\'at\\' h:mm a') : 'Unknown date'}
                      </p>
                      {payment.note && (
                        <p className="text-xs text-muted-foreground italic">
                          {payment.note}
                        </p>
                      )}
                      {payment.source === 'square' && (
                        <Badge variant="outline" className="text-xs mt-1">
                          Synced from Square
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className='font-semibold text-green-600'>
                      ${payment.amount?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Paid</span>
                  <span className="font-semibold text-green-600">${totalPaid.toFixed(2)}</span>
                </div>
                
                {balanceDue > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Balance Due</span>
                    <span className="font-semibold text-destructive">${balanceDue.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Invoice Total</span>
                  <span>${totalInvoiced.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className='text-sm text-muted-foreground text-center py-4'>
              <History className="mx-auto h-6 w-6 mb-2" />
              No payments have been recorded for this invoice yet.
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const NotesSection = () => {
    const notes = confirmation.notes || [];
    const sponsorNotes = notes.filter((note: any) => note.type === 'sponsor');
    const organizerNotes = notes.filter((note: any) => note.type === 'organizer');
    
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Sponsor Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {sponsorNotes.length > 0 ? (
                sponsorNotes.map((note: any) => (
                  <div key={note.id} className="border-l-2 border-blue-200 pl-3 py-2">
                    <p className="text-sm">{note.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {note.author} • {format(new Date(note.timestamp), 'MMM dd, yyyy \\'at\\' h:mm a')}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No sponsor notes yet.</p>
              )}
            </div>
            
            {(profile?.role === 'sponsor' || profile?.role === 'individual') && (
              <div className="space-y-2">
                <Label htmlFor="sponsor-note">Add Sponsor Note</Label>
                <div className="flex gap-2">
                  <Input
                    id="sponsor-note"
                    placeholder="Enter note..."
                    value={sponsorNote || ''}
                    onChange={(e) => setSponsorNote(e.target.value || '')}
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => addNote(sponsorNote, 'sponsor')}
                    disabled={!sponsorNote.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Organizer Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {organizerNotes.length > 0 ? (
                organizerNotes.map((note: any) => (
                  <div key={note.id} className="border-l-2 border-green-200 pl-3 py-2">
                    <p className="text-sm">{note.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {note.author} • {format(new Date(note.timestamp), 'MMM dd, yyyy \\'at\\' h:mm a')}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No organizer notes yet.</p>
              )}
            </div>
            
            {profile?.role === 'organizer' && (
              <div className="space-y-2">
                <Label htmlFor="organizer-note">Add Organizer Note</Label>
                <div className="flex gap-2">
                  <Input
                    id="organizer-note"
                    placeholder="Enter note..."
                    value={organizerNote || ''}
                    onChange={(e) => setOrganizerNote(e.target.value || '')}
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => addNote(organizerNote, 'organizer')}
                    disabled={!organizerNote.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPaymentMethodInputs = () => {
    const isOrganizer = profile?.role === 'organizer';
    
    if (selectedPaymentMethod === 'credit-card') {
        return (
            <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-3">
                    Pay securely with your credit card through Square. After payment, please use the refresh button to update the status here.
                </p>
                {invoiceUrl ? (
                    <Button asChild className="bg-blue-600 hover:bg-blue-700">
                        <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                            Pay Now with Credit Card <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                ) : (
                    <p className="text-sm text-red-600">Payment link not available</p>
                )}
            </div>
        );
    }

    if (selectedPaymentMethod === 'cash') {
        return (
            <div>
                <Label htmlFor="cash-amount">
                    {isOrganizer ? 'Cash Amount Received' : 'Cash Amount Paid'}
                </Label>
                <Input 
                    id="cash-amount" 
                    type="number" 
                    step="0.01" 
                    placeholder="Enter amount" 
                    value={cashAmount || ''} 
                    onChange={(e) => setCashAmount(e.target.value || '')} 
                    disabled={isPaymentApproved} 
                />
                {isOrganizer && (
                    <p className="text-xs text-muted-foreground mt-1">
                        This will also open Square invoice for manual "Mark as paid" confirmation.
                    </p>
                )}
            </div>
        );
    }

    if (selectedPaymentMethod === 'check') {
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
                        placeholder="Enter amount" 
                        value={checkAmount || ''} 
                        onChange={(e) => setCheckAmount(e.target.value || '')} 
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
                     {confirmation.paymentFileUrl && !fileToUpload && (
                        <div className="text-sm mt-2 flex items-center justify-between">
                          <a href={confirmation.paymentFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <Download className="h-4 w-4" />
                            View {confirmation.paymentFileName || 'File'}
                          </a>
                          {!isPaymentApproved && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={handleDeleteFile} disabled={isUpdating}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                      {fileToUpload && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <FileIcon className="h-4 w-4 inline-block mr-1" />
                          New file selected: {fileToUpload.name}
                        </p>
                      )}
                </div>
                {isOrganizer && (
                    <p className="text-xs text-muted-foreground">
                        This will also open Square invoice for manual "Mark as paid" confirmation.
                    </p>
                )}
            </div>
        );
    }

    if (selectedPaymentMethod === 'cash-app') {
        return (
            <div className="space-y-4">
                <div>
                    <Label htmlFor="cashapp-amount">
                        {isOrganizer ? 'Cash App Amount Received' : 'Cash App Amount'}
                    </Label>
                    <Input 
                        id="cashapp-amount" 
                        type="number" 
                        step="0.01" 
                        placeholder="Enter amount" 
                        value={cashAppAmount || ''} 
                        onChange={(e) => setCashAppAmount(e.target.value || '')} 
                        disabled={isPaymentApproved} 
                    />
                </div>
                <div>
                    <Label htmlFor="cashapp-proof">Upload Cash App Screenshot</Label>
                    <Input 
                        id="cashapp-proof" 
                        type="file" 
                        accept="image/*,.pdf" 
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} 
                        disabled={isPaymentApproved}
                    />
                     {confirmation.paymentFileUrl && !fileToUpload && (
                        <div className="text-sm mt-2 flex items-center justify-between">
                          <a href={confirmation.paymentFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <Download className="h-4 w-4" />
                            View {confirmation.paymentFileName || 'File'}
                          </a>
                          {!isPaymentApproved && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={handleDeleteFile} disabled={isUpdating}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                      {fileToUpload && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <FileIcon className="h-4 w-4 inline-block mr-1" />
                          New file selected: {fileToUpload.name}
                        </p>
                      )}
                </div>
                {isOrganizer && (
                    <p className="text-xs text-muted-foreground">
                        This will also open Square invoice for manual "Mark as paid" confirmation.
                    </p>
                )}
            </div>
        );
    }

    if (selectedPaymentMethod === 'zelle') {
        return (
            <div className="space-y-4">
                <div>
                    <Label htmlFor="zelle-amount">
                        {isOrganizer ? 'Zelle Amount Received' : 'Zelle Amount'}
                    </Label>
                    <Input 
                        id="zelle-amount" 
                        type="number" 
                        step="0.01" 
                        placeholder="Enter amount" 
                        value={zelleAmount || ''} 
                        onChange={(e) => setZelleAmount(e.target.value || '')} 
                        disabled={isPaymentApproved} 
                    />
                </div>
                <div>
                    <Label htmlFor="zelle-proof">Upload Zelle Confirmation</Label>
                    <Input 
                        id="zelle-proof" 
                        type="file" 
                        accept="image/*,.pdf" 
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} 
                        disabled={isPaymentApproved}
                    />
                     {confirmation.paymentFileUrl && !fileToUpload && (
                        <div className="text-sm mt-2 flex items-center justify-between">
                          <a href={confirmation.paymentFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <Download className="h-4 w-4" />
                            View {confirmation.paymentFileName || 'File'}
                          </a>
                          {!isPaymentApproved && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={handleDeleteFile} disabled={isUpdating}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                      {fileToUpload && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <FileIcon className="h-4 w-4 inline-block mr-1" />
                          New file selected: {fileToUpload.name}
                        </p>
                      )}
                </div>
                {isOrganizer && (
                    <p className="text-xs text-muted-foreground">
                        This will also open Square invoice for manual "Mark as paid" confirmation.
                    </p>
                )}
            </div>
        );
    }

    if (selectedPaymentMethod === 'purchase-order' && !isIndividualInvoice) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="po-amount">
                        {isOrganizer ? 'PO Amount' : 'Purchase Order Amount'}
                    </Label>
                    <Input 
                        id="po-amount" 
                        type="number" 
                        step="0.01" 
                        placeholder="Enter amount" 
                        value={poAmount || ''} 
                        onChange={(e) => setPoAmount(e.target.value || '')} 
                        disabled={isPaymentApproved} 
                    />
                </div>
                <div>
                    <Label htmlFor="po-number">PO Number</Label>
                    <Input 
                        id="po-number" 
                        placeholder="Enter PO Number" 
                        value={poNumber || ''} 
                        onChange={(e) => setPONumber(e.target.value || '')} 
                        disabled={isPaymentApproved} 
                    />
                </div>
                <div className="md:col-span-2">
                    <Label htmlFor="po-document">Upload PO Document</Label>
                    <Input 
                        id="po-document" 
                        type="file" 
                        accept=".pdf,.doc,.docx,.jpg,.png" 
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} 
                        disabled={isPaymentApproved} 
                    />
                    {confirmation.poFileUrl && !fileToUpload && (
                        <div className="text-sm mt-2 flex items-center justify-between">
                            <a href={confirmation.poFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <Download className="h-4 w-4" />
                                View {confirmation.poFileName || 'File'}
                            </a>
                            {!isPaymentApproved && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={handleDeleteFile} disabled={isUpdating}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                    {fileToUpload && (
                        <p className="text-sm text-muted-foreground mt-2">New file selected: {fileToUpload.name}</p>
                    )}
                </div>
                {isOrganizer && (
                    <div className="md:col-span-2">
                        <p className="text-xs text-muted-foreground">
                            This will also open Square invoice for manual "Mark as paid" confirmation.
                        </p>
                    </div>
                )}
            </div>
        );
    }

    return null;
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
                                <p className="font-semibold">${(totalInvoiced).toFixed(2)}</p>
                            </div>
                            {totalPaid > 0 && (
                                <>
                                    <div className="flex justify-between items-center text-green-600">
                                        <p className="font-medium">Amount Paid</p>
                                        <p className="font-semibold">${(totalPaid).toFixed(2)}</p>
                                    </div>
                                    <div className="flex justify-between items-center text-destructive font-bold text-lg">
                                        <p>Balance Due</p>
                                        <p>${(balanceDue).toFixed(2)}</p>
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
                                    ? (isUpdating ? 'Recording Payment...' : 'Record Payment & Open Square')
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
                <NotesSection />
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

    