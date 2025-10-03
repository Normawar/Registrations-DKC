'use client';

import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { History } from "lucide-react";

export const PaymentHistoryDisplay = ({ confirmation }: { confirmation: any }) => {
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