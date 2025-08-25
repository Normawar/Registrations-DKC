
'use server';
/**
 * @fileOverview Records a payment against a Square invoice using the Square API.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';

const RecordPaymentInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to record a payment for.'),
  amount: z.number().describe('The payment amount in dollars.'),
  note: z.string().optional().describe('A note for the payment, e.g., check number or transaction ID.'),
  paymentDate: z.string().optional().describe('The date of the payment in YYYY-MM-DD format.'),
  paymentMethod: z.string().optional().describe('The method of payment (e.g., Check, Cash App).'),
  externalPaymentId: z.string().optional().describe('A unique ID for the payment from the local system.'),
  organizerInitials: z.string().optional().describe('Initials of the organizer recording the payment.'),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentInputSchema>;

const RecordPaymentOutputSchema = z.object({
  paymentId: z.string(),
  status: z.string(),
  totalPaid: z.number(),
  totalInvoiced: z.number(),
});
export type RecordPaymentOutput = z.infer<typeof RecordPaymentOutputSchema>;

// This function now makes a direct API call to Square to create a payment.
export interface RecordPaymentParams {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  note: string;
  organizerInitials: string;
}

export const recordPayment = async ({
  invoiceId,
  amount,
  paymentMethod,
  note,
  organizerInitials
}: RecordPaymentParams) => {
  const { isConfigured } = await checkSquareConfig();
  if (!isConfigured) {
    console.log(`Square not configured. Mock-recording payment for invoice ${invoiceId}.`);
    return {
        id: `MOCK_PAY_${randomUUID()}`,
        status: 'COMPLETED',
        amount_money: { amount: amount * 100, currency: 'USD' }
    };
  }

  const squareClient = await getSquareClient();
  const locationId = process.env.SQUARE_LOCATION_ID;

  // Use the Square SDK to create a payment
  const { result } = await squareClient.paymentsApi.createPayment({
    sourceId: 'EXTERNAL', // For manually recorded payments
    idempotencyKey: `payment_${invoiceId}_${Date.now()}_${organizerInitials}`,
    amountMoney: {
      amount: BigInt(Math.round(amount * 100)), // Convert to cents
      currency: 'USD',
    },
    invoiceIds: [invoiceId],
    locationId: locationId,
    note: note,
    externalDetails: {
      type: 'OTHER',
      source: paymentMethod || 'Manual',
      sourceId: `local-${Date.now()}`
    }
  });

  if (!result.payment) {
    throw new Error('Square payment creation failed.');
  }

  console.log('✅ Square API success:', result);

  // Now, get the updated invoice status
  const { result: invoiceResult } = await squareClient.invoicesApi.getInvoice(invoiceId);

  return {
    paymentId: result.payment.id!,
    status: invoiceResult.invoice?.status || 'UNKNOWN',
    totalPaid: Number(invoiceResult.invoice?.paymentRequests?.[0]?.totalCompletedAmountMoney?.amount || 0) / 100,
    totalInvoiced: Number(invoiceResult.invoice?.paymentRequests?.[0]?.computedAmountMoney?.amount || 0) / 100,
  };
};

// The Genkit flow remains as the primary public interface.
export const recordPaymentFlow = ai.defineFlow(
  {
    name: 'recordPaymentFlow',
    inputSchema: RecordPaymentInputSchema,
    outputSchema: RecordPaymentOutputSchema,
  },
  async (input) => {
    return recordPayment({
        invoiceId: input.invoiceId,
        amount: input.amount,
        paymentMethod: input.paymentMethod || 'manual',
        note: input.note || 'No note provided',
        organizerInitials: input.organizerInitials || 'N/A',
    });
  }
);
