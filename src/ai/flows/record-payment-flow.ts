
'use server';
/**
 * @fileOverview Records a payment against a Square invoice using the Square API.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ApiError, CreatePaymentRequest, Money, Client, Environment } from 'square';
import { randomUUID } from 'crypto';

const RecordPaymentInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to record a payment for.'),
  amount: z.number().describe('The payment amount in dollars.'),
  note: z.string().optional().describe('A note for the payment, e.g., check number or transaction ID.'),
  paymentDate: z.string().optional().describe('The date of the payment in YYYY-MM-DD format.'),
  paymentMethod: z.string().optional().describe('The method of payment (e.g., Check, Cash App).'),
  externalPaymentId: z.string().optional().describe('A unique ID for the payment from the local system.'),
  organizerInitials: z.string().optional().describe('Initials of the organizer recording the payment.'),
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
    
    // Hard-coded Square client initialization
    const squareClient = new Client({
      accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
      environment: Environment.Production,
    });
    const { paymentsApi, invoicesApi } = squareClient;

    try {
        console.log(`Fetching invoice ${input.invoiceId} to get details...`);
        const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
        
        if (!invoice?.orderId) {
            throw new Error('Cannot record payment for an invoice without an associated order.');
        }

        const amountMoney: Money = {
            amount: BigInt(Math.round(input.amount * 100)),
            currency: 'USD',
        };

        const payment: CreatePaymentRequest = {
            sourceId: 'EXTERNAL',
            idempotencyKey: input.externalPaymentId || randomUUID(),
            amountMoney: amountMoney,
            orderId: invoice.orderId,
            note: input.note,
            externalDetails: {
                type: 'OTHER',
                source: input.paymentMethod || 'Manual',
                sourceFeeMoney: { amount: BigInt(0), currency: 'USD' }
            },
        };

        console.log("Creating payment object for Square:", JSON.stringify(payment, (k,v) => typeof v === 'bigint' ? v.toString() : v));
        const { result: { payment: createdPayment } } = await paymentsApi.createPayment(payment);
        
        // After creating a payment, we need to fetch the invoice again to get the updated status
        const { result: { invoice: updatedInvoice } } = await invoicesApi.getInvoice(input.invoiceId);

        const totalPaid = updatedInvoice?.paymentRequests?.[0]?.totalCompletedAmountMoney?.amount;
        const totalInvoiced = updatedInvoice?.paymentRequests?.[0]?.computedAmountMoney?.amount;

        return {
            paymentId: createdPayment.id!,
            status: updatedInvoice!.status!,
            totalPaid: totalPaid ? Number(totalPaid) / 100 : 0,
            totalInvoiced: totalInvoiced ? Number(totalInvoiced) / 100 : 0,
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
