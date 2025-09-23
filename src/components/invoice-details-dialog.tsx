
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, RefreshCw, Loader2, DollarSign, Calendar, Building, User } from 'lucide-react';
import { format } from "date-fns";
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { getInvoiceStatus as getInvoiceStatusFlow } from '@/ai/flows/get-invoice-status-flow';

interface InvoiceDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  confirmation?: any;
  confirmationId?: string;
}

export function InvoiceDetailsDialog({ isOpen, onClose, confirmation: initialConfirmation, confirmationId }: InvoiceDetailsDialogProps) {
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      } else if (confirmationId) {
        loadConfirmationData(confirmationId);
      }
    }
  }, [isOpen, initialConfirmation, confirmationId, loadConfirmationData]);

  const handleRefreshStatus = async () => {
    if (!confirmation?.invoiceId) return;
    setIsRefreshing(true);
    try {
      const result = await getInvoiceStatusFlow({ invoiceId: confirmation.invoiceId });
      const updatedConfirmation = {
        ...confirmation,
        status: result.status,
        invoiceStatus: result.status,
        totalPaid: result.totalPaid,
        totalAmount: result.totalAmount,
      };
      setConfirmation(updatedConfirmation);
      toast({ title: 'Status Updated', description: `Invoice status is now: ${result.status}` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Refresh Failed', description: 'Could not fetch latest invoice status.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || 'UNKNOWN').toUpperCase();
    const variants: { [key: string]: 'default' | 'destructive' | 'secondary' } = { 
      'PAID': 'default', 'COMPED': 'default', 'UNPAID': 'destructive', 
      'CANCELED': 'destructive', 'PARTIALLY_PAID': 'secondary' 
    };
    const className = s === 'PAID' || s === 'COMPED' ? 'bg-green-600 text-white' : '';
    return <Badge variant={variants[s] || 'secondary'} className={className}>{s.replace(/_/g, ' ')}</Badge>;
  };

  if (!confirmation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusBadge(confirmation?.invoiceStatus)}
            Invoice #{confirmation?.invoiceNumber || 'N/A'}
          </DialogTitle>
          <DialogDescription className="sr-only">Details for the selected invoice.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
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
        </div>
        
        <DialogFooter className="sm:justify-between">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleRefreshStatus} disabled={isRefreshing}>
                    {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh Status
                </Button>
                {confirmation?.invoiceUrl && (
                    <Button asChild variant="outline" size="sm">
                        <a href={confirmation.invoiceUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" /> View on Square
                        </a>
                    </Button>
                )}
            </div>
            <Button type="button" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
