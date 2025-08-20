
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';
import { Payment, ApiError } from 'square';

const GetInvoiceStatusInputSchema = z.object({
  invoiceId: z.string().describe('The Square invoice ID to check'),
});

const GetInvoiceStatusOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
  invoiceNumber: z.string().optional(),
  totalAmount: z.number(),
  totalPaid: z.number(),
  paymentHistory: z.array(z.object({
    id: z.string(),
    amount: z.number(),
    method: z.string(),
    date: z.string(),
    cardBrand: z.string().optional(),
    last4: z.string().optional(),
    note: z.string().optional(),
  })),
  lastUpdated: z.string(),
});

export type GetInvoiceStatusInput = z.infer<typeof GetInvoiceStatusInputSchema>;
export type GetInvoiceStatusOutput = z.infer<typeof GetInvoiceStatusOutputSchema>;

// This function is kept for backward compatibility if needed, but the new flow is preferred.
export async function getInvoiceStatus(input: GetInvoiceStatusInput): Promise<any> {
  return getInvoiceStatusWithPayments(input);
}


function getPaymentMethodFromSquarePayment(payment: Payment): string {
  if (payment.sourceType === 'CARD') {
    return 'credit_card';
  } else if (payment.sourceType === 'CASH') {
    return 'cash';
  } else if (payment.sourceType === 'EXTERNAL') {
    return 'external';
  } else if (payment.sourceType === 'BANK_ACCOUNT') {
    return 'bank_transfer';
  }
  return 'other';
}

export const getInvoiceStatusWithPayments = ai.defineFlow(
  {
    name: 'getInvoiceStatusWithPayments',
    inputSchema: GetInvoiceStatusInputSchema,
    outputSchema: GetInvoiceStatusOutputSchema,
  },
  async (input) => {
    const { isConfigured } = await checkSquareConfig();
    
    if (!isConfigured) {
      console.log(`Square not configured. Mocking status for invoice ${input.invoiceId}.`);
      return {
        invoiceId: input.invoiceId,
        status: 'UNPAID',
        totalAmount: 0,
        totalPaid: 0,
        paymentHistory: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const squareClient = await getSquareClient();
    const { invoicesApi, ordersApi, paymentsApi } = squareClient;

    try {
      // Get the invoice details
      const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!invoice) {
        throw new Error(`Invoice ${input.invoiceId} not found`);
      }

      const paymentRequest = invoice.paymentRequests?.[0];
      const totalAmount = paymentRequest?.computedAmountMoney?.amount ? Number(paymentRequest.computedAmountMoney.amount) / 100 : 0;
      const totalPaid = paymentRequest?.totalCompletedAmountMoney?.amount ? Number(paymentRequest.totalCompletedAmountMoney.amount) / 100 : 0;

      // Get payment history from the associated order
      const paymentHistory: z.infer<typeof GetInvoiceStatusOutputSchema>['paymentHistory'] = [];
      
      if (invoice.orderId) {
        try {
          const { result: { order } } = await ordersApi.retrieveOrder(invoice.orderId);
          
          if (order?.tenders) {
            for (const tender of order.tenders) {
              if (tender.paymentId) {
                try {
                  const { result: { payment } } = await paymentsApi.getPayment(tender.paymentId);
                  
                  if (payment) {
                    const paymentEntry = {
                      id: payment.id!,
                      amount: Number(payment.amountMoney?.amount || 0) / 100,
                      method: getPaymentMethodFromSquarePayment(payment),
                      date: payment.createdAt || new Date().toISOString(),
                      cardBrand: payment.cardDetails?.card?.cardBrand?.toLowerCase(),
                      last4: payment.cardDetails?.card?.last4,
                      note: payment.note || undefined,
                    };
                    paymentHistory.push(paymentEntry);
                  }
                } catch (paymentError) {
                  // It's possible to not find a payment if it was deleted, so we just warn
                  if (paymentError instanceof ApiError && paymentError.statusCode === 404) {
                    console.warn(`Could not fetch payment ${tender.paymentId}: Not found. It may have been deleted.`);
                  } else {
                     console.error(`Error fetching payment ${tender.paymentId}:`, paymentError);
                  }
                }
              }
            }
          }
        } catch (orderError) {
          console.warn(`Could not fetch order ${invoice.orderId}:`, orderError);
        }
      }

      return {
        invoiceId: input.invoiceId,
        status: invoice.status || 'UNKNOWN',
        invoiceNumber: invoice.invoiceNumber,
        totalAmount,
        totalPaid,
        paymentHistory: paymentHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        lastUpdated: invoice.updatedAt || new Date().toISOString(),
      };
      
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
         throw new Error(`Invoice ${input.invoiceId} not found in Square.`);
      }
      console.error('Error getting invoice status with payments:', error);
      throw error;
    }
  }
);
