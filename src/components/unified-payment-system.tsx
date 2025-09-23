'use client';

import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { getInvoiceStatus as getInvoiceStatusFlow } from '@/ai/flows/get-invoice-status-flow';
import { useToast } from '@/hooks/use-toast';

const handleRefreshStatusWithPaymentSync = async (
  confirmation: any,
  setConfirmation: Function,
  toast: ReturnType<typeof useToast>['toast'],
  setIsRefreshing: Function
) => {
  if (!confirmation?.invoiceId) {
    toast({ variant: 'destructive', title: 'Cannot Refresh', description: 'No invoice ID available for this confirmation' });
    return;
  }

  setIsRefreshing(true);
  try {
    // Get comprehensive invoice status including payment history
    const result = await getInvoiceStatusFlow({ invoiceId: confirmation.invoiceId });
    
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

const handleInvoiceWebhook = async (webhookData: any) => {
  if (webhookData.type === 'invoice.payment_updated' || webhookData.type === 'invoice.updated') {
    const invoiceId = webhookData.data?.object?.invoice?.id;
    
    if (invoiceId && db) {
      try {
        // Get updated invoice data from Square
        const result = await getInvoiceStatusFlow({ invoiceId });
        
        // Find and update the local invoice in Firestore
        const invoiceRef = doc(db, 'invoices', invoiceId);
        const docSnap = await getDoc(invoiceRef);
        
        if (docSnap.exists()) {
          const existingInvoice = docSnap.data();
          
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
          
          const updatedData = {
            status: result.status,
            invoiceStatus: result.status,
            totalPaid: result.totalPaid,
            paymentHistory: unifiedPaymentHistory,
            lastSquareSync: new Date().toISOString(),
          };

          await setDoc(invoiceRef, updatedData, { merge: true });
          
          console.log(`Invoice ${invoiceId} synced via webhook`);
          window.dispatchEvent(new Event('all_invoices_updated'));
        }
      } catch (error) {
        console.error('Error handling invoice webhook:', error);
      }
    }
  }
};

export { getInvoiceStatusFlow, handleRefreshStatusWithPaymentSync, handleInvoiceWebhook };