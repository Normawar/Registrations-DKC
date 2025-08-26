
'use server';
/**
 * @fileOverview Records a payment against a Square invoice using the Square API.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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

export const recordPayment = async ({ invoiceId, amount, paymentMethod, note, organizerInitials }: RecordPaymentParams) => {
  const response = await fetch('/api/record-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoiceId, amount, paymentMethod, note, organizerInitials })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Payment failed: ${JSON.stringify(errorData.error)}`);
  }
  
  return await response.json();
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
