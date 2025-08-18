
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { useMasterDb } from "@/context/master-db-context";
import { ExternalLink, Upload, CreditCard, Check, DollarSign, RefreshCw, Users, Calendar, Loader2, Download, File as FileIcon } from "lucide-react";
import { format } from "date-fns";
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';
import { getInvoiceStatus } from '@/ai/flows/get-invoice-status-flow';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";


export default function ConfirmedRegistrationsPage() {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const { database: masterDatabase } = useMasterDb();
  
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [selectedConfirmation, setSelectedConfirmation] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('purchase-order');
  const [poNumber, setPONumber] = useState('');
  const [poDocument, setPODocument] = useState<File | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
                setAuthError("Authentication error. File uploads are disabled.");
                setIsAuthReady(false);
            });
        }
    });
    return () => unsubscribe();
  }, []);

  const loadConfirmations = useCallback(() => {
    try {
      const storedConfirmations = localStorage.getItem('confirmations');
      if (storedConfirmations) {
        const allConfirmations = JSON.parse(storedConfirmations);
        
        let userConfirmations = [];
        if (profile?.role === 'sponsor') {
          userConfirmations = allConfirmations.filter((conf: any) => 
            conf.schoolName === profile.school && conf.district === profile.district
          );
        } else if (profile?.role === 'individual') {
          userConfirmations = allConfirmations.filter((conf: any) => 
            conf.parentEmail === profile.email
          );
        } else {
          userConfirmations = allConfirmations;
        }
        
        setConfirmations(userConfirmations);
      }
    } catch (error) {
      console.error('Failed to load confirmations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load registration confirmations'
      });
    }
  }, [profile, toast]);


  useEffect(() => {
    if (profile) {
      loadConfirmations();
    }
    const handleStorageChange = () => {
      if(profile) loadConfirmations();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [profile, loadConfirmations]);

  const getRegisteredPlayers = (confirmation: any) => {
    if (!confirmation.selections) return [];
    
    const playerIds = Object.keys(confirmation.selections);
    
    let players = masterDatabase.filter(player => playerIds.includes(player.id));
    
    if (players.length === 0 && playerIds.length > 0) {
      players = playerIds.map(id => ({
        id,
        firstName: 'Player',
        lastName: id.substring(0, 8),
        ...(confirmation.playerNames && confirmation.playerNames[id] ? {
          firstName: confirmation.playerNames[id].split(' ')[0] || 'Player',
          lastName: confirmation.playerNames[id].split(' ').slice(1).join(' ') || id.substring(0, 8)
        } : {})
      }));
    }
    
    return players;
  };

  const handleRefreshStatus = async (confirmation: any) => {
    if (!confirmation.invoiceId) {
      toast({
        variant: 'destructive',
        title: 'Cannot Refresh',
        description: 'No invoice ID available for this confirmation'
      });
      return;
    }

    setIsRefreshing(true);
    try {
      const { status, invoiceNumber } = await getInvoiceStatus({ invoiceId: confirmation.invoiceId });
      
      const updatedStatus = status;
      if (updatedStatus) {
        const updatedConfirmations = confirmations.map(conf => 
          conf.id === confirmation.id 
            ? { ...conf, invoiceStatus: updatedStatus, invoiceNumber: invoiceNumber }
            : conf
        );
        
        setConfirmations(updatedConfirmations);
        
        const storedConfirmations = localStorage.getItem('confirmations');
        if (storedConfirmations) {
          const allConfirmations = JSON.parse(storedConfirmations);
          const updatedAllConfirmations = allConfirmations.map((conf: any) => 
            conf.id === confirmation.id 
              ? { ...conf, invoiceStatus: updatedStatus, invoiceNumber: invoiceNumber }
              : conf
          );
          localStorage.setItem('confirmations', JSON.stringify(updatedAllConfirmations));
        }
        
        toast({
          title: 'Status Updated',
          description: `Invoice status updated to: ${updatedStatus}`
        });
      } else {
        throw new Error('Failed to get status');
      }
    } catch (error) {
      console.error('Failed to refresh status:', error);
      toast({
        variant: 'destructive',
        title: 'Refresh Failed',
        description: 'Could not refresh invoice status. The invoice may still be processing.'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePaymentUpdate = async () => {
    if (!selectedConfirmation) return;
    if (!isAuthReady) {
        toast({ variant: 'destructive', title: 'Authentication Not Ready', description: authError || "Cannot submit payment information at this time."});
        return;
    }
  
    setIsUpdating(true);
    try {
        const { teamCode, eventDate, eventName, invoiceId, id } = selectedConfirmation;
        const formattedEventDate = format(new Date(eventDate), 'MM/dd/yyyy');
        let newTitle = `${teamCode} @ ${formattedEventDate} ${eventName}`;
        
        let poFileUrl: string | undefined = selectedConfirmation.poFileUrl;
        let poFileName: string | undefined = selectedConfirmation.poFileName;
        let paymentFileUrl: string | undefined = selectedConfirmation.paymentFileUrl;
        let paymentFileName: string | undefined = selectedConfirmation.paymentFileName;
        
        const fileToUpload = selectedPaymentMethod === 'purchase-order' ? poDocument : paymentProof;
        const uploadFolder = selectedPaymentMethod === 'purchase-order' ? 'purchase-orders' : 'payment-proofs';
        
        if (fileToUpload) {
            if (!storage) throw new Error("Firebase Storage is not configured.");
            const recordId = selectedConfirmation.invoiceId || selectedConfirmation.id;
            const storageRef = ref(storage, `${uploadFolder}/${recordId}/${fileToUpload.name}`);
            const snapshot = await uploadBytes(storageRef, fileToUpload);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            if (selectedPaymentMethod === 'purchase-order') {
                poFileUrl = downloadUrl;
                poFileName = fileToUpload.name;
            } else {
                paymentFileUrl = downloadUrl;
                paymentFileName = fileToUpload.name;
            }
        }
        
        if (selectedPaymentMethod === 'purchase-order' && poNumber) {
            newTitle += ` PO: ${poNumber}`;
        }
      
        if (selectedConfirmation.invoiceId) {
            await updateInvoiceTitle({ invoiceId: selectedConfirmation.invoiceId, title: newTitle });
        }
  
        const updatedConfirmation = {
            ...selectedConfirmation,
            paymentMethod: selectedPaymentMethod,
            poNumber: poNumber,
            poFileUrl: poFileUrl,
            poFileName: poFileName,
            paymentFileUrl: paymentFileUrl,
            paymentFileName: paymentFileName,
            invoiceTitle: newTitle,
            paymentStatus: selectedPaymentMethod === 'purchase-order' ? 'pending-po' : selectedConfirmation.paymentStatus,
            lastUpdated: new Date().toISOString()
        };
  
        const allConfirmations = JSON.parse(localStorage.getItem('confirmations') || '[]');
        const updatedAllConfirmations = allConfirmations.map((conf: any) =>
            conf.id === selectedConfirmation.id ? updatedConfirmation : conf
        );
        localStorage.setItem('confirmations', JSON.stringify(updatedAllConfirmations));
      
        const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
        const updatedAllInvoices = allInvoices.map((inv: any) =>
            inv.id === selectedConfirmation.id ? { ...inv, ...updatedConfirmation, invoiceTitle: newTitle } : inv
        );
        localStorage.setItem('all_invoices', JSON.stringify(updatedAllInvoices));

        setConfirmations(prev => prev.map(c => c.id === updatedConfirmation.id ? updatedConfirmation : c));
        setSelectedConfirmation(updatedConfirmation);
  
        if (selectedPaymentMethod === 'purchase-order') {
            toast({
                title: 'Payment Info Submitted - Authorization Pending',
                duration: 10000,
                description: (
                  <div className="flex flex-col gap-2 text-sm">
                    <p>For your payment to be fully authorized, please ensure the following steps are completed:</p>
                    <ol className="list-decimal list-inside space-y-1 pl-2 font-medium">
                      <li>A copy of the PO document is uploaded.</li>
                      <li>The PO is submitted for payment with your school's bookkeeper.</li>
                      <li>The actual monetary payment has been sent and received.</li>
                    </ol>
                    <p className="mt-2 text-xs text-muted-foreground">An organizer will mark the invoice as "Paid" once funds are verified.</p>
                  </div>
                ),
            });
        } else {
             toast({
                title: 'Payment Info Submitted',
                description: "An organizer will mark this payment as received once the monetary transfer has been verified.",
            });
        }
  
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('all_invoices_updated'));
  
    } catch (error) {
        console.error('Failed to update payment:', error);
        let description = 'Failed to update payment information. Please check the console for details.';
        if (error instanceof Error && (error as any).code === 'storage/unauthorized') {
            description = "You do not have permission to upload this file. Please check your Firebase Storage security rules in the Firebase Console to allow writes.";
        }
        toast({
            variant: 'destructive',
            title: 'Error',
            description: description
        });
    } finally {
        setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return <Badge className="bg-green-600 text-white">Paid</Badge>;
      case 'unpaid':
        return <Badge variant="destructive">Unpaid</Badge>;
      case 'pending-po':
        return <Badge variant="secondary">Pending Verification</Badge>;
      case 'comped':
        return <Badge className="bg-blue-600 text-white">Comped</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Confirmed Registrations</h1>
          <p className="text-muted-foreground">
            Manage your event registrations and payment information
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Registration Confirmations ({confirmations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {confirmations.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Registrations Found</h3>
                <p className="text-muted-foreground">
                  You haven't registered for any events yet.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Players</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmations.map((confirmation) => {
                    const playerCount = Object.keys(confirmation.selections || {}).length;
                    
                    return (
                      <TableRow 
                        key={confirmation.id}
                        className={selectedConfirmation?.id === confirmation.id ? 'bg-primary/5 border-primary' : ''}
                      >
                        <TableCell className="font-medium">
                          {confirmation.eventName}
                        </TableCell>
                        <TableCell>
                          {format(new Date(confirmation.eventDate), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {playerCount} player{playerCount !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            ${confirmation.totalInvoiced?.toFixed(2) || '0.00'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(confirmation.invoiceStatus || confirmation.paymentStatus)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedConfirmation(confirmation);
                                setPONumber(confirmation.poNumber || '');
                                setPODocument(null);
                                setPaymentProof(null);
                                setTimeout(() => {
                                  document.querySelector('[data-payment-section]')?.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                              }}
                              className="hover:bg-primary hover:text-primary-foreground"
                            >
                              Manage
                            </Button>
                            
                            {confirmation.invoiceUrl && (
                              <Button asChild variant="outline" size="sm">
                                <a 
                                  href={confirmation.invoiceUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  title="View Invoice"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            
                            {confirmation.invoiceId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefreshStatus(confirmation)}
                                disabled={isRefreshing}
                                title="Refresh Status"
                              >
                                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selectedConfirmation && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Registration Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="font-medium text-muted-foreground">Event</p><p>{selectedConfirmation.eventName}</p></div>
                  <div><p className="font-medium text-muted-foreground">Date</p><p>{format(new Date(selectedConfirmation.eventDate), 'PPP')}</p></div>
                  <div><p className="font-medium text-muted-foreground">Invoice #</p><p>{selectedConfirmation.invoiceNumber || selectedConfirmation.id}</p></div>
                  <div><p className="font-medium text-muted-foreground">Total Amount</p><p className="text-lg font-semibold">${selectedConfirmation.totalInvoiced?.toFixed(2) || '0.00'}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Registered Players</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const players = getRegisteredPlayers(selectedConfirmation);
                  const playerIds = Object.keys(selectedConfirmation.selections || {});
                  
                  if (players.length > 0) {
                    return (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {players.map((player) => {
                          const selectionInfo = selectedConfirmation.selections[player.id] || {};
                          return (
                            <div key={player.id} className="flex justify-between items-center border-b pb-2 text-sm">
                              <div>
                                <p className="font-medium">{player.firstName} {player.lastName}</p>
                                <p className="text-muted-foreground">Section: {selectionInfo.section || player.section || 'N/A'}</p>
                              </div>
                              <p>USCF: {selectionInfo.uscfStatus || 'Current'}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else if (playerIds.length > 0) {
                    return (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground mb-2">{playerIds.length} player(s) registered:</p>
                        {playerIds.map((playerId) => (
                          <div key={playerId} className="flex justify-between items-center border-b pb-2">
                            <p className="font-medium">Player ID: {playerId.substring(0, 12)}...</p>
                          </div>
                        ))}
                      </div>
                    );
                  } else {
                    return <p className="text-muted-foreground">No player information available</p>;
                  }
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {selectedConfirmation && (
          <div data-payment-section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Submit Payment Information
                  <Button variant="outline" size="sm" onClick={() => setSelectedConfirmation(null)}>Close</Button>
                </CardTitle>
                 <CardDescription>Select a payment method and provide the necessary details. An organizer will verify your payment.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-medium mb-4 block">Payment Method</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button variant={selectedPaymentMethod === 'purchase-order' ? 'default' : 'outline'} onClick={() => setSelectedPaymentMethod('purchase-order')} className="h-auto py-4 flex flex-col items-center gap-2"><Upload className="h-5 w-5" /><span>Purchase Order</span></Button>
                    <Button variant={selectedPaymentMethod === 'check' ? 'default' : 'outline'} onClick={() => setSelectedPaymentMethod('check')} className="h-auto py-4 flex flex-col items-center gap-2"><Check className="h-5 w-5" /><span>Pay with Check</span></Button>
                    <Button variant={selectedPaymentMethod === 'cash-app' ? 'default' : 'outline'} onClick={() => setSelectedPaymentMethod('cash-app')} className="h-auto py-4 flex flex-col items-center gap-2"><DollarSign className="h-5 w-5" /><span>Cash App</span></Button>
                    <Button variant={selectedPaymentMethod === 'zelle' ? 'default' : 'outline'} onClick={() => setSelectedPaymentMethod('zelle')} className="h-auto py-4 flex flex-col items-center gap-2"><CreditCard className="h-5 w-5" /><span>Zelle</span></Button>
                  </div>
                </div>

                <Separator />

                {selectedPaymentMethod === 'purchase-order' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="po-number">PO Number</Label>
                      <Input id="po-number" placeholder="Enter PO Number" value={poNumber} onChange={(e) => setPONumber(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="po-document">Upload PO Document</Label>
                      <Input id="po-document" type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => setPODocument(e.target.files?.[0] || null)} />
                      {selectedConfirmation.poFileUrl && !poDocument && (
                        <div className="text-sm mt-2">
                          <a href={selectedConfirmation.poFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <Download className="h-4 w-4" />
                            View previously uploaded document: {selectedConfirmation.poFileName || 'View File'}
                          </a>
                        </div>
                      )}
                      {poDocument && (
                        <p className="text-sm text-muted-foreground mt-2">New file selected: {poDocument.name}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {(selectedPaymentMethod === 'cash-app' || selectedPaymentMethod === 'zelle') && (
                    <div>
                      <Label htmlFor="payment-proof">Upload Payment Screenshot</Label>
                      <Input id="payment-proof" type="file" accept="image/*,.pdf" onChange={(e) => setPaymentProof(e.target.files?.[0] || null)} />
                      {selectedConfirmation.paymentFileUrl && !paymentProof && (
                        <div className="text-sm mt-2">
                          <a href={selectedConfirmation.paymentFileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <Download className="h-4 w-4" />
                            View uploaded proof: {selectedConfirmation.paymentFileName || 'View File'}
                          </a>
                        </div>
                      )}
                      {paymentProof && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <FileIcon className="h-4 w-4 inline-block mr-1" />
                          New file selected: {paymentProof.name}
                        </p>
                      )}
                    </div>
                )}


                <div className="flex justify-end">
                  <Button onClick={handlePaymentUpdate} disabled={isUpdating || !isAuthReady} className="flex items-center gap-2">
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isUpdating ? 'Submitting...' : 'Submit Information for Verification'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
 