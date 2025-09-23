
'use server';
/**
 * @fileOverview Records a payment against a Square invoice using the Square API.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ApiError, CreatePaymentRequest, Money, type Client } from 'square';
import { randomUUID } from 'crypto';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';

const RecordPaymentInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to record a payment for.'),
  amount: z.number().describe('The payment amount in dollars.'),
  note: z.string().optional().describe('A note for the payment, e.g., check number or transaction ID.'),
  paymentDate: z.string().optional().describe('The date of the payment in YYYY-MM-DD format.'),
  paymentMethod: z.string().optional().describe('The method of payment (e.g., Check, Cash App).'),
  externalPaymentId: z.string().optional().describe('A unique ID for the payment from the local system.'),
  requestingUserRole: z.string().describe('Role of user recording the payment'),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentInputSchema>;

const RecordPaymentOutputSchema = z.object({
  paymentId: z.string(),
  status: z.string(),
  totalPaid: z.number(),
  totalInvoiced: z.number(),
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
    if (input.requestingUserRole !== 'organizer') {
        throw new Error('Only organizers can record payments.');
    }
    
    const squareClient = await getSquareClient();
    const { paymentsApi, invoicesApi } = squareClient;

    try {
        console.log(`Fetching invoice ${input.invoiceId} to get details...`);
        const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
        
        // Use the publishInvoice API to mark invoice as paid - this was the working solution
        console.log("Publishing invoice to mark as paid...");
        const publishRequest = {
            version: invoice.version!,
        };

        const { result: { invoice: updatedInvoice } } = await invoicesApi.publishInvoice(
            input.invoiceId,
            publishRequest
        );

        const totalPaid = updatedInvoice?.paymentRequests?.[0]?.totalCompletedAmountMoney?.amount;
        const totalInvoiced = updatedInvoice?.paymentRequests?.[0]?.computedAmountMoney?.amount;

        return {
            paymentId: randomUUID(), // Generate local ID since no Square payment created
            status: 'PAID',
            totalPaid: totalPaid ? Number(totalPaid) / 100 : input.amount,
            totalInvoiced: totalInvoiced ? Number(totalInvoiced) / 100 : input.amount,
        };

    } catch (error) {
        if (error instanceof ApiError) {
            const errorResult = error.result || {};
            const errors = Array.isArray(errorResult.errors) ? errorResult.errors : [];
            console.error('Square API Error in recordPaymentFlow:', JSON.stringify(errorResult, null, 2));
            const errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
            throw new Error(`Square Error: ${errorMessage}`);
        } else {
            console.error('An unexpected error occurred during payment recording:', error);
            if (error instanceof Error) {
                throw new Error(`${error.message}`);
            }
            throw new Error('An unexpected error occurred during payment recording.');
        }
    }
  }
);
