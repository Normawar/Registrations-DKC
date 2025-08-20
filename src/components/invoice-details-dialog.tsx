
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
import { ExternalLink, Upload, CreditCard, Check, DollarSign, RefreshCw, Loader2, Download, File as FileIcon, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { getInvoiceStatus } from '@/ai/flows/get-invoice-status-flow';
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
    }

    // Firebase Auth
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
    if (!confirmation?.invoiceId) {
      toast({ variant: 'destructive', title: 'Cannot Refresh', description: 'No invoice ID available for this confirmation' });
      return;
    }

    setIsRefreshing(true);
    try {
      const { status, invoiceNumber } = await getInvoiceStatus({ invoiceId: confirmation.invoiceId });
      
      const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
      const updatedAllInvoices = allInvoices.map((inv: any) => 
        inv.id === confirmation.id 
          ? { ...inv, invoiceStatus: status, status: status, invoiceNumber: invoiceNumber }
          : inv
      );
      localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));
      
      setConfirmation((prev: any) => ({ ...prev, invoiceStatus: status, status: status, invoiceNumber }));

      toast({ title: 'Status Updated', description: `Invoice status updated to: ${status}` });
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('all_invoices_updated'));
    } catch (error) {
      console.error('Failed to refresh status:', error);
      toast({ variant: 'destructive', title: 'Refresh Failed', description: 'Could not refresh invoice status.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePaymentUpdate = async () => {
    if (!confirmation) {
        return;
    }

    setIsUpdating(true);

    try {
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
        const updatedAllInvoices = allInvoices.map((inv: any) =>
            inv.id === confirmation.id ? updatedConfirmationData : inv
        );
        localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));

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


  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    const variants: { [key: string]: 'default' | 'destructive' | 'secondary' } = {
        'PAID': 'default',
        'COMPED': 'default',
        'UNPAID': 'destructive',
        'OVERDUE': 'destructive',
        'CANCELED': 'destructive',
    };
    let className = '';
    if (s === 'PAID' || s === 'COMPED') className = 'bg-green-600 text-white';
    if (s === 'PENDING-PO') className = 'bg-yellow-500 text-black';
    return <Badge variant={variants[s] || 'secondary'} className={className}>{s.replace(/_/g, ' ')}</Badge>;
  };

  if (!isOpen || !confirmation) return null;

  const players = getRegisteredPlayers(confirmation);
  const isPaymentApproved = ['PAID', 'COMPED'].includes(confirmation.invoiceStatus?.toUpperCase());
  const isIndividualInvoice = confirmation.schoolName === 'Individual Registration';

  const invoiceUrl = confirmation.publicUrl || confirmation.invoiceUrl;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <div className="flex justify-between items-start">
                    <div>
                        <DialogTitle className="text-2xl">{confirmation.invoiceTitle || confirmation.eventName}</DialogTitle>
                         <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                            {getStatusBadge(confirmation.invoiceStatus || confirmation.status)}
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
                             <div className="flex justify-between items-center">
                                <p className="font-medium text-muted-foreground">Total Amount</p>
                                <p className="text-lg font-semibold">${(confirmation.totalAmount || confirmation.totalInvoiced || 0).toFixed(2)}</p>
                            </div>
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
                            <CardDescription>Select a payment method and provide the necessary details. An organizer will verify your payment.</CardDescription>
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
                                  >
                                    <Check className="h-5 w-5" />
                                    <span className="text-center">Pay with<br/>Check</span>
                                  </Button>
                                  <Button 
                                    variant={selectedPaymentMethod === 'cash-app' ? 'default' : 'outline'} 
                                    onClick={() => setSelectedPaymentMethod('cash-app')} 
                                    className="h-auto py-4 flex flex-col items-center gap-2"
                                  >
                                    <DollarSign className="h-5 w-5" />
                                    <span>Cash App</span>
                                  </Button>
                                  <Button 
                                    variant={selectedPaymentMethod === 'zelle' ? 'default' : 'outline'} 
                                    onClick={() => setSelectedPaymentMethod('zelle')} 
                                    className="h-auto py-4 flex flex-col items-center gap-2"
                                  >
                                    <CreditCard className="h-5 w-5" />
                                    <span>Zelle</span>
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
                            <Button onClick={handlePaymentUpdate} disabled={isUpdating || !isAuthReady || !!authError || isPaymentApproved} className="flex items-center gap-2">
                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {isUpdating ? 'Submitting...' : 'Submit Information for Verification'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

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
            </div>
            <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button variant="outline" onClick={handleRefreshStatus} disabled={isRefreshing} className="mr-auto">
                    {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh to see updated payment status
                </Button>
                <Button variant="ghost" onClick={onClose}>Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
