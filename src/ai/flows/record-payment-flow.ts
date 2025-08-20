
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
import { ApiError, type Money } from 'square';
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
      return {
        invoiceId: input.invoiceId,
        paymentId: `MOCK_PAY_${randomUUID()}`,
        status: 'PAID',
        totalPaid: input.amount,
      };
    }

    const squareClient = await getSquareClient();
    const { invoicesApi, paymentsApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${input.invoiceId} to get order ID...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!invoice || !invoice.orderId) {
        throw new Error(`Could not find invoice or order ID for invoice: ${input.invoiceId}`);
      }

      console.log(`Recording payment for order ID: ${invoice.orderId}`);

      const paymentAmount: Money = {
          amount: BigInt(Math.round(input.amount * 100)),
          currency: 'USD',
      };

      const { result: { payment } } = await paymentsApi.createPayment({
          idempotencyKey: randomUUID(),
          sourceId: 'EXTERNAL',
          amountMoney: paymentAmount,
          orderId: invoice.orderId,
          note: input.note,
          externalDetails: {
            type: 'OTHER',
            source: 'Manual entry by organizer',
            sourceFeeMoney: { amount: BigInt(0), currency: 'USD' }
          }
      });
      
      if (!payment || !payment.id) {
        throw new Error("Failed to create payment record in Square.");
      }

      // After payment, get the latest invoice status
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for propagation
      const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(input.invoiceId);

      const totalPaidAmount = finalInvoice?.paymentRequests
        ?.flatMap(pr => pr.totalCompletedAmountMoney?.amount ? [pr.totalCompletedAmountMoney.amount] : [])
        .reduce((sum, current) => sum + current, BigInt(0)) || BigInt(0);

      return {
        invoiceId: finalInvoice!.id!,
        paymentId: payment.id,
        status: finalInvoice!.status!,
        totalPaid: Number(totalPaidAmount) / 100,
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
