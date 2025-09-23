'use client';

import { format } from "date-fns";
import { getInvoiceStatus } from '@/ai/flows/get-invoice-status-flow';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { History } from "lucide-react";

const handleRefreshStatusWithPaymentSync = async (
  confirmation: any,
  setConfirmation: Function,
  toast: Function,
  setIsRefreshing: Function
) => {
  if (!confirmation?.invoiceId) {
    toast({ variant: 'destructive', title: 'Cannot Refresh', description: 'No invoice ID available for this confirmation' });
    return;
  }

  setIsRefreshing(true);
  try {
    // Get comprehensive invoice status including payment history
    const result = await getInvoiceStatus({ invoiceId: confirmation.invoiceId });
    
    // Merge Square payment history with local payment history
    const localPayments = confirmation.paymentHistory || [];
    const squarePayments = result.paymentHistory || [];
    
    // Create a unified payment history, prioritizing Square payments for credit cards
    const unifiedPaymentHistory = [...localPayments];
    
    // Add Square payments that aren't already tracked locally
    for (const squarePayment of squarePayments) {
      const existsLocally = localPayments.some((local: any) => 
        local.squarePaymentId === squarePayment.id || 
        (local.method === 'credit_card' && Math.abs(local.amount - squarePayment.amount) < 0.01)
      );
      
      if (!existsLocally) {
        unifiedPaymentHistory.push({
          ...squarePayment,
          squarePaymentId: squarePayment.id,
          method: squarePayment.method,
          source: 'square'
        });
      }
    }
    
    // Sort by date
    unifiedPaymentHistory.sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate totals
    const totalPaidFromHistory = unifiedPaymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
    const totalPaid = Math.max(result.totalPaid, totalPaidFromHistory);
    
    // Update confirmation with synced data
    const updatedConfirmation = {
      ...confirmation,
      invoiceStatus: result.status,
      status: result.status,
      invoiceNumber: result.invoiceNumber || confirmation.invoiceNumber,
      totalPaid: totalPaid,
      totalAmount: result.totalAmount || confirmation.totalAmount,
      paymentHistory: unifiedPaymentHistory,
      lastSquareSync: new Date().toISOString(),
    };
    
    setConfirmation(updatedConfirmation);

    const newPaymentCount = result.paymentHistory.length;
    const message = newPaymentCount > 0 
      ? `Status updated to: ${result.status}. Found ${newPaymentCount} payment(s) from Square.`
      : `Status updated to: ${result.status}`;
      
    toast({ title: 'Status Updated', description: message });
    
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('all_invoices_updated'));
  } catch (error) {
    console.error('Failed to refresh status:', error);
    toast({ variant: 'destructive', title: 'Refresh Failed', description: 'Could not refresh invoice status.' });
  } finally {
    setIsRefreshing(false);
  }
};

const PaymentHistoryDisplay = ({ confirmation }: { confirmation: any }) => {
  const totalPaid = confirmation.totalPaid || 0;
  const paymentHistory = confirmation.paymentHistory || [];
  const totalInvoiced = confirmation.totalAmount || confirmation.totalInvoiced || 0;
  const balanceDue = totalInvoiced - totalPaid;
  
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

const handleInvoiceWebhook = async (webhookData: any) => {
  if (webhookData.type === 'invoice.payment_updated' || webhookData.type === 'invoice.updated') {
    const invoiceId = webhookData.data?.object?.invoice?.id;
    
    if (invoiceId) {
      try {
        // Get updated invoice data
        const result = await getInvoiceStatus({ invoiceId });
        
        // Find and update the local invoice
        const allInvoices = JSON.parse(localStorage.getItem('all_invoices') || '[]');
        const invoiceIndex = allInvoices.findIndex((inv: any) => inv.invoiceId === invoiceId);
        
        if (invoiceIndex >= 0) {
          const existingInvoice = allInvoices[invoiceIndex];
          
          // Merge payment histories
          const localPayments = existingInvoice.paymentHistory || [];
          const squarePayments = result.paymentHistory || [];
          
          const unifiedPaymentHistory = [...localPayments];
          for (const squarePayment of squarePayments) {
            const existsLocally = localPayments.some((local: any) => 
              local.squarePaymentId === squarePayment.id
            );
            
            if (!existsLocally) {
              unifiedPaymentHistory.push({
                ...squarePayment,
                squarePaymentId: squarePayment.id,
                source: 'square'
              });
            }
          }
          
          allInvoices[invoiceIndex] = {
            ...existingInvoice,
            status: result.status,
            invoiceStatus: result.status,
            totalPaid: result.totalPaid,
            paymentHistory: unifiedPaymentHistory,
            lastSquareSync: new Date().toISOString(),
          };
          
          localStorage.setItem('all_invoices', JSON.stringify(allInvoices));
          window.dispatchEvent(new Event('all_invoices_updated'));
          
          console.log(`Invoice ${invoiceId} synced via webhook`);
        }
      } catch (error) {
        console.error('Error handling invoice webhook:', error);
      }
    }
  }
};

export { getInvoiceStatus, handleRefreshStatusWithPaymentSync, PaymentHistoryDisplay, handleInvoiceWebhook };
