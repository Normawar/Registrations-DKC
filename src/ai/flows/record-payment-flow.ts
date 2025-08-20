
'use server';
/**
 * @fileOverview Records a payment against a Square invoice.
 *
 * - recordPayment - A function that handles adding a payment to an invoice.
 * - RecordPaymentInput - The input type for the recordPayment function.
 * - RecordPaymentOutput - The return type for the recordPayment function.
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
      
      // For mock mode, assume a total invoice amount for demonstration
      const mockTotalInvoiced = 100; // This would normally come from the invoice
      const newTotal = input.amount;
      const isPartial = newTotal < mockTotalInvoiced;
      
      return {
        invoiceId: input.invoiceId,
        paymentId: `MOCK_PAY_${randomUUID()}`,
        status: isPartial ? 'PARTIALLY_PAID' : 'PAID',
        totalPaid: newTotal,
        totalInvoiced: mockTotalInvoiced,
        isPartialPayment: isPartial,
      };
    }

    const squareClient = await getSquareClient();
    const { invoicesApi, paymentsApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${input.invoiceId} to get current version and order ID...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!invoice || !invoice.version) {
        throw new Error(`Could not find invoice or version for invoice: ${input.invoiceId}`);
      }

      if (!invoice.paymentRequests || invoice.paymentRequests.length === 0) {
        throw new Error(`Invoice ${input.invoiceId} has no payment requests to apply payment to.`);
      }

      // Get the total invoice amount for comparison
      const invoiceRequestedAmount = invoice.paymentRequests[0]?.requestedMoney?.amount 
        ? Number(invoice.paymentRequests[0].requestedMoney.amount) / 100 
        : 0;

      console.log(`Recording external payment of $${input.amount} for invoice ID: ${input.invoiceId}`);

      const paymentAmount: Money = {
          amount: BigInt(Math.round(input.amount * 100)),
          currency: 'USD',
      };
      
      const createPaymentResponse = await paymentsApi.createPayment({
          idempotencyKey: randomUUID(),
          sourceId: 'EXTERNAL', 
          amountMoney: paymentAmount,
          note: input.note,
          externalDetails: {
            type: 'EXTERNAL',
            source: input.note || 'Manual Payment',
          }
      });

      const payment = createPaymentResponse.result.payment as Payment;
      if (!payment || !payment.id) {
        throw new Error("Failed to create payment record in Square.");
      }
      
      console.log(`Successfully created payment ${payment.id}. Now adding to invoice...`);
      
      const existingPaymentRequest = invoice.paymentRequests[0];

      const { result: { invoice: finalInvoice } } = await invoicesApi.updateInvoice(input.invoiceId, {
        invoice: {
            paymentRequests: [{
                uid: existingPaymentRequest.uid,
                requestType: existingPaymentRequest.requestType,
                dueDate: existingPaymentRequest.dueDate,
                reminders: existingPaymentRequest.reminders,
                paymentId: payment.id, // This is how you link the created payment
            }],
            version: invoice.version,
        },
        idempotencyKey: randomUUID(),
      });

      // Calculate total paid amount from all completed payment requests
      const totalPaidAmount = finalInvoice?.paymentRequests
        ?.flatMap(pr => pr.totalCompletedAmountMoney?.amount ? [pr.totalCompletedAmountMoney.amount] : [])
        .reduce((sum, current) => sum + current, BigInt(0)) || BigInt(0);

      const totalPaidDollars = Number(totalPaidAmount) / 100;
      const isPartialPayment = totalPaidDollars < invoiceRequestedAmount;

      // Determine the correct status based on payment completion
      let status = finalInvoice!.status!;
      if (totalPaidDollars >= invoiceRequestedAmount) {
        status = 'PAID';
      } else if (totalPaidDollars > 0) {
        status = 'PARTIALLY_PAID';
      }

      console.log(`Payment recorded. Status: ${status}, Total Paid: $${totalPaidDollars}, Invoice Total: $${invoiceRequestedAmount}`);

      return {
        invoiceId: finalInvoice!.id!,
        paymentId: payment.id,
        status: status,
        totalPaid: totalPaidDollars,
        totalInvoiced: invoiceRequestedAmount,
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
