'use client';

import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { useMasterDb } from "@/context/master-db-context";
import { ExternalLink, Upload, CreditCard, Check, DollarSign, RefreshCw, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { updateInvoiceTitle } from '@/ai/flows/update-invoice-title-flow';

export default function ConfirmedRegistrationsPage() {
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const { database: masterDatabase } = useMasterDb();
  
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [selectedConfirmation, setSelectedConfirmation] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('purchase-order');
  const [poNumber, setPONumber] = useState('');
  const [poDocument, setPODocument] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load confirmations safely without calling Square API immediately
  useEffect(() => {
    loadConfirmations();
    
    // Listen for storage changes
    const handleStorageChange = () => loadConfirmations();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [profile]);

  const loadConfirmations = () => {
    try {
      const storedConfirmations = localStorage.getItem('confirmations');
      if (storedConfirmations) {
        const allConfirmations = JSON.parse(storedConfirmations);
        
        // Filter confirmations based on user role
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
          // Organizer sees all
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
  };

  const getRegisteredPlayers = (confirmation: any) => {
    if (!confirmation.selections) return [];
    
    console.log('Getting players for confirmation:', confirmation.id);
    console.log('Selections:', confirmation.selections);
    console.log('Master database length:', masterDatabase.length);
    
    const playerIds = Object.keys(confirmation.selections);
    console.log('Player IDs to find:', playerIds);
    
    // Try to find players in master database
    let players = masterDatabase.filter(player => playerIds.includes(player.id));
    console.log('Found players from master DB:', players);
    
    // If no players found in master database, try to get from localStorage
    if (players.length === 0) {
      try {
        const storedMasterDb = localStorage.getItem('master_database');
        if (storedMasterDb) {
          const localPlayers = JSON.parse(storedMasterDb);
          players = localPlayers.filter((player: any) => playerIds.includes(player.id));
          console.log('Found players from localStorage:', players);
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    }
    
    // If still no players found, create placeholder entries with the IDs we have
    if (players.length === 0 && playerIds.length > 0) {
      console.log('No players found, creating placeholders');
      players = playerIds.map(id => ({
        id,
        firstName: 'Player',
        lastName: id.substring(0, 8), // Show part of the ID
        // Try to get info from the confirmation if available
        ...(confirmation.playerNames && confirmation.playerNames[id] ? {
          firstName: confirmation.playerNames[id].split(' ')[0] || 'Player',
          lastName: confirmation.playerNames[id].split(' ').slice(1).join(' ') || id.substring(0, 8)
        } : {})
      }));
    }
    
    return players;
  };

  // Safely refresh invoice status without crashing
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
      // Import the function dynamically to avoid server-side issues
      const { getInvoiceStatus } = await import('@/ai/flows/get-invoice-status-flow');
      
      const statusResult = await getInvoiceStatus({ invoiceId: confirmation.invoiceId });
      
      const updatedStatus = statusResult.status;
      if (updatedStatus) {
        // Update the confirmation with new status
        const updatedConfirmations = confirmations.map(conf => 
          conf.id === confirmation.id 
            ? { ...conf, invoiceStatus: updatedStatus }
            : conf
        );
        
        setConfirmations(updatedConfirmations);
        
        // Update localStorage
        const storedConfirmations = localStorage.getItem('confirmations');
        if (storedConfirmations) {
          const allConfirmations = JSON.parse(storedConfirmations);
          const updatedAllConfirmations = allConfirmations.map((conf: any) => 
            conf.id === confirmation.id 
              ? { ...conf, invoiceStatus: updatedStatus }
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
  
    setIsUpdating(true);
    try {
      const { teamCode, eventDate, eventName, invoiceId } = selectedConfirmation;
      const formattedEventDate = format(new Date(eventDate), 'MM/dd/yyyy');
      const newTitle = `${teamCode} @ ${formattedEventDate} ${eventName} PO: ${poNumber}`;
      
      // Update title in Square API
      await updateInvoiceTitle({ invoiceId, title: newTitle });
  
      const updatedConfirmation = {
        ...selectedConfirmation,
        paymentMethod: selectedPaymentMethod,
        poNumber: poNumber,
        invoiceTitle: newTitle, // Save the new title
        paymentStatus: 'pending-po',
        lastUpdated: new Date().toISOString()
      };
  
      // Update confirmations in state
      const updatedConfirmations = confirmations.map(conf => 
        conf.id === selectedConfirmation.id ? updatedConfirmation : conf
      );
      setConfirmations(updatedConfirmations);
      setSelectedConfirmation(updatedConfirmation);
  
      // Update all_invoices in localStorage
      const storedInvoices = localStorage.getItem('all_invoices');
      if (storedInvoices) {
        const allInvoices = JSON.parse(storedInvoices);
        const updatedInvoices = allInvoices.map((inv: any) => 
          inv.id === selectedConfirmation.id ? { ...inv, invoiceTitle: newTitle, poNumber: poNumber } : inv
        );
        localStorage.setItem('all_invoices', JSON.stringify(updatedInvoices));
      }
      
      // Update confirmations in localStorage
       const storedConfirmations = localStorage.getItem('confirmations');
       if (storedConfirmations) {
         const allConfirmations = JSON.parse(storedConfirmations);
         const updatedAllConfirmations = allConfirmations.map((conf: any) => 
           conf.id === selectedConfirmation.id ? updatedConfirmation : conf
         );
         localStorage.setItem('confirmations', JSON.stringify(updatedAllConfirmations));
       }
  
      toast({
        title: 'Payment Updated',
        description: 'Invoice has been updated with PO information.'
      });
  
      window.dispatchEvent(new Event('storage'));
  
    } catch (error) {
      console.error('Failed to update payment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update payment information. Please check the console for details.'
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
        return <Badge variant="secondary">Pending PO</Badge>;
      case 'comped':
        return <Badge className="bg-blue-600 text-white">Comped</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Confirmed Registrations</h1>
          <p className="text-muted-foreground">
            Manage your event registrations and payment information
          </p>
        </div>

        {/* Confirmations List */}
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
                                console.log('Managing confirmation:', confirmation);
                                setSelectedConfirmation(confirmation);
                                // Scroll to the payment section
                                setTimeout(() => {
                                  const paymentSection = document.querySelector('[data-payment-section]');
                                  if (paymentSection) {
                                    paymentSection.scrollIntoView({ behavior: 'smooth' });
                                  }
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

        {/* Selected Confirmation Details */}
        {selectedConfirmation && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Registration Details */}
            <Card>
              <CardHeader>
                <CardTitle>Registration Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Event</p>
                    <p>{selectedConfirmation.eventName}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Date</p>
                    <p>{format(new Date(selectedConfirmation.eventDate), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Invoice #</p>
                    <p>{selectedConfirmation.invoiceNumber || selectedConfirmation.id}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-semibold">
                      ${selectedConfirmation.totalInvoiced?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Registered Players */}
            <Card>
              <CardHeader>
                <CardTitle>Registered Players</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const players = getRegisteredPlayers(selectedConfirmation);
                  const playerIds = Object.keys(selectedConfirmation.selections || {});
                  
                  console.log('Rendering players:', players);
                  console.log('Player IDs:', playerIds);
                  
                  if (players.length > 0) {
                    return (
                      <div className="space-y-2">
                        {players.map((player) => {
                          const selectionInfo = selectedConfirmation.selections[player.id] || {};
                          return (
                            <div key={player.id} className="flex justify-between items-center border-b pb-2">
                              <div>
                                <p className="font-medium">{player.firstName} {player.lastName}</p>
                                <p className="text-sm text-muted-foreground">
                                  Section: {selectionInfo.section || player.section || 'Not specified'}
                                </p>
                                {player.uscfId && (
                                  <p className="text-xs text-muted-foreground">
                                    USCF ID: {player.uscfId}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm">
                                  USCF: {selectionInfo.uscfStatus || 'Current'}
                                </p>
                                {selectionInfo.byes && typeof selectionInfo.byes === 'object' && (
                                  <p className="text-xs text-muted-foreground">
                                    Byes: R1-{selectionInfo.byes.round1 || 'None'}, R2-{selectionInfo.byes.round2 || 'None'}
                                  </p>
                                )}
                                {selectionInfo.byes && typeof selectionInfo.byes === 'string' && selectionInfo.byes !== 'none' && (
                                  <p className="text-xs text-muted-foreground">
                                    Byes: {selectionInfo.byes}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else if (playerIds.length > 0) {
                    // Show player IDs if we can't find the actual player data
                    return (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground mb-2">
                          {playerIds.length} player(s) registered (player details not available):
                        </p>
                        {playerIds.map((playerId) => {
                          const selectionInfo = selectedConfirmation.selections[playerId] || {};
                          return (
                            <div key={playerId} className="flex justify-between items-center border-b pb-2">
                              <div>
                                <p className="font-medium">Player ID: {playerId.substring(0, 12)}...</p>
                                <p className="text-sm text-muted-foreground">
                                  Section: {selectionInfo.section || 'Not specified'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm">
                                  USCF: {selectionInfo.uscfStatus || 'Current'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
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

        {/* Payment Information Section */}
        {selectedConfirmation && (
          <div data-payment-section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Payment Information
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedConfirmation(null)}
                  >
                    Close
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payment Method Selection */}
                <div>
                  <Label className="text-base font-medium mb-4 block">Payment Method</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button
                      variant={selectedPaymentMethod === 'purchase-order' ? 'default' : 'outline'}
                      onClick={() => setSelectedPaymentMethod('purchase-order')}
                      className="h-auto py-4 flex flex-col items-center gap-2"
                    >
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">Purchase Order</span>
                    </Button>
                    
                    <Button
                      variant={selectedPaymentMethod === 'check' ? 'default' : 'outline'}
                      onClick={() => setSelectedPaymentMethod('check')}
                      className="h-auto py-4 flex flex-col items-center gap-2"
                    >
                      <Check className="h-5 w-5" />
                      <span className="text-sm">Pay with Check</span>
                    </Button>
                    
                    <Button
                      variant={selectedPaymentMethod === 'cash-app' ? 'default' : 'outline'}
                      onClick={() => setSelectedPaymentMethod('cash-app')}
                      className="h-auto py-4 flex flex-col items-center gap-2"
                    >
                      <DollarSign className="h-5 w-5" />
                      <span className="text-sm">Cash App</span>
                    </Button>
                    
                    <Button
                      variant={selectedPaymentMethod === 'zelle' ? 'default' : 'outline'}
                      onClick={() => setSelectedPaymentMethod('zelle')}
                      className="h-auto py-4 flex flex-col items-center gap-2"
                    >
                      <CreditCard className="h-5 w-5" />
                      <span className="text-sm">Zelle</span>
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Purchase Order Section */}
                {selectedPaymentMethod === 'purchase-order' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="po-number">PO Number</Label>
                      <Input
                        id="po-number"
                        placeholder="Enter PO Number"
                        value={poNumber}
                        onChange={(e) => setPONumber(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="po-document">Upload PO Document</Label>
                      <Input
                        id="po-document"
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setPODocument(file);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={handlePaymentUpdate}
                    disabled={isUpdating}
                    className="flex items-center gap-2"
                  >
                    {isUpdating ? 'Updating...' : 'Save Payment & Update Invoice'}
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
