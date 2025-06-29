'use server';
/**
 * @fileOverview Simulates creating an invoice with an external payment provider like Square.
 *
 * - createInvoice - A function that handles the invoice creation process.
 * - CreateInvoiceInput - The input type for the createInvoice function.
 * - CreateInvoiceOutput - The return type for the createInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { randomUUID } from 'crypto';

const CreateInvoiceInputSchema = z.object({
    sponsorName: z.string().describe('The name of the sponsor to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the sponsor.'),
    eventName: z.string().describe('The name of the event.'),
    registrationFee: z.number().describe('The per-player registration fee.'),
    registrationCount: z.number().int().describe('The number of players being registered.'),
    uscfFee: z.number().describe('The fee for a new or renewing USCF membership.'),
    uscfCount: z.number().int().describe('The number of new or renewing USCF memberships.'),
    totalAmount: z.number().describe('The total amount to be invoiced.'),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

const CreateInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});
export type CreateInvoiceOutput = z.infer<typeof CreateInvoiceOutputSchema>;

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  return createInvoiceFlow(input);
}

const createInvoiceFlow = ai.defineFlow(
  {
    name: 'createInvoiceFlow',
    inputSchema: CreateInvoiceInputSchema,
    outputSchema: CreateInvoiceOutputSchema,
  },
  async (input) => {
    // In a real application, this is where you would use the Square SDK
    // to create an invoice using the provided input.
    //
    // Example (conceptual):
    // const squareClient = new SquareClient({ accessToken: process.env.SQUARE_ACCESS_TOKEN });
    // const response = await squareClient.invoicesApi.createInvoice({ ... });
    //
    // For this simulation, we'll generate a fake invoice ID and URL.
    
    console.log("Simulating invoice creation with input:", input);

    const invoiceId = `inv_fake_${randomUUID()}`;
    // This URL format is for demonstration purposes only.
    const invoiceUrl = `https://squareup.com/invoice/${invoiceId}/1/`; 

    return {
      invoiceId,
      status: 'DRAFT',
      invoiceUrl,
    };
  }
);
