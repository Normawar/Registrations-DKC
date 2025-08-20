
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
import { ExternalLink, Upload, CreditCard, Check, DollarSign, RefreshCw, Loader2, Download, File as FileIcon, X, Trash2, History, Sync } from "lucide-react";
import { format } from "date-fns";
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
// import { getInvoiceStatusWithPayments, handleRefreshStatusWithPaymentSync, PaymentHistoryDisplay } from './unified-payment-system';
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

  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  // Enhanced refresh that syncs Square payments
  const handleRefreshStatus = async () => {
    // await handleRefreshStatusWithPaymentSync(confirmation, setConfirmation, toast, setIsRefreshing);
  };

  const handlePaymentUpdate = async () => {
    if (!confirmation) return;

    setIsUpdating(true);

    try {
        // For cash payments by organizers, record payment immediately
        if (selectedPaymentMethod === 'cash' && profile?.role === 'organizer') {
            if (!cashAmount || parseFloat(cashAmount) <= 0) {
                toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid cash amount.' });
                setIsUpdating(false);
                return;
            }

            if (!confirmation.invoiceId) {
                toast({ variant: 'destructive', title: 'Error', description: 'No invoice ID available for payment recording.' });
                setIsUpdating(false);
                return;
            }

            // Record the cash payment with enhanced tracking
            const result = await recordPayment({
                invoiceId: confirmation.invoiceId,
                amount: parseFloat(cashAmount),
                note: `Cash payment recorded by ${profile?.firstName || 'organizer'}`,
                paymentDate: format(new Date(), 'yyyy-MM-dd'),
            });

            console.log('Payment result:', result); // Debug log

            // Calculate the cumulative totals properly
            const newTotalPaid = result.totalPaid; // Use the total from Square
            const totalInvoiced = result.totalInvoiced || confirmation.totalAmount || confirmation.totalInvoiced || 0;
            
            // Determine actual status based on cumulative payments
            let actualStatus = 'UNPAID';
            if (newTotalPaid >= totalInvoiced) {
                actualStatus = 'PAID';
            } else if (newTotalPaid > 0) {
                actualStatus = 'PARTIALLY_PAID';
            }

            // Create new payment history entry with enhanced details
            const newPaymentEntry = {
                id: result.paymentId,
                amount: parseFloat(cashAmount),
                date: new Date().toISOString(),
                method: 'cash',
                note: `Cash payment recorded by ${profile?.firstName || 'organizer'}`,
                source: 'manual',
                recordedBy: profile?.firstName || 'organizer',
            };

            // Update local records with unified payment tracking
            const updatedConfirmationData = {
                ...confirmation,
                status: actualStatus,
                invoiceStatus: actualStatus,
                totalPaid: newTotalPaid,
                totalAmount: totalInvoiced,
                totalInvoiced: totalInvoiced,
                paymentStatus: actualStatus === 'PAID' ? 'paid' : 'partially-paid',
                lastUpdated: new Date().toISOString(),
                // Add payment history entry
                paymentHistory: [
                    ...(confirmation.paymentHistory || []),
                    newPaymentEntry
                ]
            };

            // Update both storage locations
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

            // Update local state
            setConfirmation(updatedConfirmationData);
            setCashAmount('');

            toast({ 
                title: 'Payment Recorded', 
                description: `Cash payment of $${cashAmount} recorded. New total paid: $${newTotalPaid.toFixed(2)}. Status: ${actualStatus}. Use "Sync with Square" to check for other payments.` 
            });

            // Trigger storage events
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('all_invoices_updated'));
            setIsUpdating(false);
            return;
        }

        // Handle non-cash payments (file uploads, etc.)
        let updatedConfirmationData = { ...confirmation };

        if (fileToUpload) {
            if (!currentUser) {
                toast({ variant: 'destructive', title: 'Authentication Not Ready', description: authError || "Cannot submit payment information at this time. Please refresh the page."});
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

        // Update invoice title with PO information
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

        // Update storage
        const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
        const updatedAllInvoices = allInvoices.map((inv: any) =>
            inv.id === confirmation.id ? updatedConfirmationData : inv
        );
        localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));

        // Also update confirmations store for payment authorization page
        const confirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
        const existingConfirmationIndex = confirmations.findIndex((conf: any) => conf.id === confirmation.id);
        if (existingConfirmationIndex >= 0) {
            confirmations[existingConfirmationIndex] = updatedConfirmationData;
        } else {
            confirmations.push(updatedConfirmationData);
        }
        localStorage.setItem('confirmations', JSON.stringify(confirmations));

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
          const updatedAllInvoices = allInvoices.map((inv: any) =>
              inv.id === confirmation.id ? updatedConfirmationData : inv
          );
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
    
    // Override status based on payment amounts if available
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

  // Determine button text and functionality
  const getSubmitButtonText = () => {
    if (selectedPaymentMethod === 'cash' && profile?.role === 'organizer') {
      return isUpdating ? 'Recording Payment...' : 'Record Payment';
    }
    return isUpdating ? 'Submitting...' : 'Submit Information for Verification';
  };

  const shouldShowCashAmount = selectedPaymentMethod === 'cash' && profile?.role === 'organizer';
  
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
        
        const methodLabels = {
            credit_card: 'Credit Card',
            cash: 'Cash Payment',
            check: 'Check',
            cash_app: 'Cash App',
            zelle: 'Zelle',
            external: 'External Payment',
        };
        
        return methodLabels[payment.method] || 'Payment';
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
                        {payment.date ? format(new Date(payment.date), 'MMM dd, yyyy \'at\' h:mm a') : 'Unknown date'}
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
              
              {/* Payment Summary */}
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

                            {selectedPaymentMethod === 'credit-card' && (
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
                            )}

                            {shouldShowCashAmount && (
                                <div>
                                    <Label htmlFor="cash-amount">Cash Amount Received</Label>
                                    <Input 
                                        id="cash-amount" 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="Enter amount" 
                                        value={cashAmount} 
                                        onChange={(e) => setCashAmount(e.target.value)} 
                                        disabled={isPaymentApproved} 
                                    />
                                </div>
                            )}
    
                            {selectedPaymentMethod === 'purchase-order' && !isIndividualInvoice && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="po-number">PO Number</Label>
                                        <Input id="po-number" placeholder="Enter PO Number" value={poNumber} onChange={(e) => setPONumber(e.target.value)} disabled={isPaymentApproved} />
                                    </div>
                                    <div>
                                        <Label htmlFor="po-document">Upload PO Document</Label>
                                        <Input id="po-document" type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} disabled={isPaymentApproved} />
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
                                </div>
                            )}
                            
                            {(selectedPaymentMethod === 'cash-app' || selectedPaymentMethod === 'zelle' || selectedPaymentMethod === 'check') && (
                                <div>
                                    <Label htmlFor="payment-proof">Upload Payment Proof/Check Image</Label>
                                    <Input id="payment-proof" type="file" accept="image/*,.pdf" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} disabled={isPaymentApproved}/>
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
                            )}
                        </CardContent>
                         <CardFooter>
                            <Button 
                                onClick={handlePaymentUpdate} 
                                disabled={
                                    isUpdating || 
                                    !isAuthReady || 
                                    (!!authError && selectedPaymentMethod !== 'cash') || 
                                    isPaymentApproved ||
                                    (shouldShowCashAmount && (!cashAmount || parseFloat(cashAmount) <= 0))
                                } 
                                className="flex items-center gap-2"
                            >
                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {getSubmitButtonText()}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle>Registered Players</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {players.map((player) => {
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
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button variant="outline" onClick={handleRefreshStatus} disabled={isRefreshing} className="mr-auto">
                    {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sync className="mr-2 h-4 w-4" />}
                    Sync with Square
                </Button>
                <Button variant="ghost" onClick={onClose}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
