'use server';
/**
 * @fileOverview Records a payment against a Square invoice using proper Square API methods.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError, type Money, type Payment } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';

const RecordPaymentInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to record a payment for.'),
  amount: z.number().describe('The payment amount in dollars.'),
  note: z.string().optional().describe('A note for the payment, e.g., check number or transaction ID.'),
  paymentDate: z.string().optional().describe('The date of the payment in YYYY-MM-DD format.'),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentInputSchema>;

const RecordPaymentOutputSchema = z.object({
  invoiceId: z.string(),
  paymentId: z.string(),
  status: z.string(),
  totalPaid: z.number(),
  totalInvoiced: z.number(),
  isPartialPayment: z.boolean(),
});
export type RecordPaymentOutput = z.infer<typeof RecordPaymentOutputSchema>;

export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentOutput> {
  return recordPaymentFlow(input);
}

const recordPaymentFlow = ai.defineFlow(
  {
    name: 'recordPaymentFlow',
    inputSchema: RecordPaymentInputSchema,
    outputSchema: RecordPaymentOutputSchema,
  },
  async (input) => {
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
      console.log(`Square not configured. Mock-recording payment for invoice ${input.invoiceId}.`);
      
      // For mock mode, simulate realistic behavior
      const mockTotalInvoiced = 40; // Use a realistic amount
      const isPartial = input.amount < mockTotalInvoiced;
      
      return {
        invoiceId: input.invoiceId,
        paymentId: `MOCK_PAY_${randomUUID()}`,
        status: isPartial ? 'PARTIALLY_PAID' : 'PAID',
        totalPaid: input.amount,
        totalInvoiced: mockTotalInvoiced,
        isPartialPayment: isPartial,
      };
    }

    const squareClient = await getSquareClient();
    const { invoicesApi, paymentsApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${input.invoiceId} to get current details...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!invoice || !invoice.version) {
        throw new Error(`Could not find invoice or version for invoice: ${input.invoiceId}`);
      }

      if (!invoice.paymentRequests || invoice.paymentRequests.length === 0) {
        throw new Error(`Invoice ${input.invoiceId} has no payment requests to apply payment to.`);
      }

      // Get the total invoice amount
      const paymentRequest = invoice.paymentRequests[0];
      const totalInvoicedCents = paymentRequest.requestedMoney?.amount ? Number(paymentRequest.requestedMoney.amount) : 0;
      const totalInvoicedDollars = totalInvoicedCents / 100;

      // Get current paid amount
      const currentPaidCents = paymentRequest.totalCompletedAmountMoney?.amount ? Number(paymentRequest.totalCompletedAmountMoney.amount) : 0;
      const currentPaidDollars = currentPaidCents / 100;

      console.log(`Invoice details - Total: $${totalInvoicedDollars}, Currently Paid: $${currentPaidDollars}, New Payment: $${input.amount}`);

      // Create the external payment record
      const paymentAmount: Money = {
          amount: BigInt(Math.round(input.amount * 100)),
          currency: 'USD',
      };
      
      const createPaymentResponse = await paymentsApi.createPayment({
          idempotencyKey: randomUUID(),
          sourceId: 'EXTERNAL', 
          amountMoney: paymentAmount,
          note: input.note || 'Manual payment entry',
          externalDetails: {
            type: 'EXTERNAL',
            source: input.note || 'Manual Payment',
            sourceFeeMoney: {
              amount: BigInt(0),
              currency: 'USD'
            }
          }
      });

      const payment = createPaymentResponse.result.payment as Payment;
      if (!payment || !payment.id) {
        throw new Error("Failed to create payment record in Square.");
      }
      
      console.log(`Successfully created payment ${payment.id}. Now linking to invoice...`);
      
      // Use the Square Invoices API to record the payment properly
      // This should use the recordPayment endpoint as per Square documentation
      try {
        const recordResponse = await invoicesApi.recordPayment(input.invoiceId, {
          paymentId: payment.id,
          requestMethod: 'EXTERNAL'
        });
        
        console.log('Payment recorded via recordPayment API:', recordResponse.result);
      } catch (recordError) {
        console.log('recordPayment API failed, falling back to updateInvoice method:', recordError);
        
        // Fallback to updating the invoice manually
        await invoicesApi.updateInvoice(input.invoiceId, {
          invoice: {
              paymentRequests: [{
                  uid: paymentRequest.uid,
                  requestType: paymentRequest.requestType,
                  dueDate: paymentRequest.dueDate,
                  reminders: paymentRequest.reminders,
                  paymentId: payment.id,
              }],
              version: invoice.version,
          },
          idempotencyKey: randomUUID(),
        });
      }

      // Fetch the updated invoice to get the final status
      const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!finalInvoice) {
        throw new Error("Failed to fetch updated invoice after payment recording.");
      }

      // Calculate the new total paid amount
      const newTotalPaidDollars = currentPaidDollars + input.amount;
      const isPartialPayment = newTotalPaidDollars < totalInvoicedDollars;

      // Determine the correct status
      let status = finalInvoice.status || 'UNPAID';
      if (newTotalPaidDollars >= totalInvoicedDollars) {
        status = 'PAID';
      } else if (newTotalPaidDollars > 0) {
        status = 'PARTIALLY_PAID';
      }

      console.log(`Payment processing complete:
        - Payment ID: ${payment.id}
        - Status: ${status}
        - Total Paid: $${newTotalPaidDollars}
        - Invoice Total: $${totalInvoicedDollars}
        - Is Partial: ${isPartialPayment}`);

      return {
        invoiceId: finalInvoice.id!,
        paymentId: payment.id,
        status: status,
        totalPaid: newTotalPaidDollars,
        totalInvoiced: totalInvoicedDollars,
        isPartialPayment: isPartialPayment,
      };
      
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('Square API Error in recordPaymentFlow:', JSON.stringify(error.result, null, 2));
        const errors = Array.isArray(error.result.errors) ? error.result.errors : [];
        const errorMessage = errors.map((e: any) => `[${e.code}] ${e.detail}`).join(', ');
        throw new Error(`Square Error: ${errorMessage}`);
      }
      console.error('An unexpected error occurred during payment recording:', error);
      throw new Error(error instanceof Error ? error.message : 'An unexpected error occurred.');
    }
  }
);
