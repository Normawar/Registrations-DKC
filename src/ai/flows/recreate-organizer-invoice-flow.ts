
'use server';
/**
 * @fileOverview Creates a new general-purpose Square invoice to replace an old one.
 * This flow cancels the original invoice and creates a new one with a revision number.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError, type Client } from 'square';
import { createOrganizerInvoice } from './create-organizer-invoice-flow';
import { cancelInvoice } from './cancel-invoice-flow';
import { getSquareClient } from '@/lib/square-client';

const LineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  amount: z.number().describe('The cost of the line item in dollars.'),
  note: z.string().optional().describe('Any additional notes for the line item.'),
});

const RecreateOrganizerInvoiceInputSchema = z.object({
    originalInvoiceId: z.string().describe('The ID of the invoice to cancel and replace.'),
    sponsorName: z.string().describe('The name of the person or entity to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the invoice recipient.'),
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string().describe('The school associated with this invoice.'),
    schoolAddress: z.string().optional().describe('The address of the school.'),
    schoolPhone: z.string().optional().describe('The phone number of the school.'),
    district: z.string().optional().describe('The school district.'),
    invoiceTitle: z.string().describe('The main title for the invoice.'),
    lineItems: z.array(LineItemSchema).min(1).describe('An array of items to be included in the invoice.'),
    revisionNumber: z.number().optional().describe('The revision number for this invoice'),
});
export type RecreateOrganizerInvoiceInput = z.infer<typeof RecreateOrganizerInvoiceInputSchema>;

const RecreateOrganizerInvoiceOutputSchema = z.object({
  oldInvoiceId: z.string(),
  newInvoiceId: z.string(),
  invoiceNumber: z.string().optional(),
  status: z.string(),
  invoiceUrl: z.string().url(),
});
export type RecreateOrganizerInvoiceOutput = z.infer<typeof RecreateOrganizerInvoiceOutputSchema>;

export async function recreateOrganizerInvoice(input: RecreateOrganizerInvoiceInput): Promise<RecreateOrganizerInvoiceOutput> {
  return recreateOrganizerInvoiceFlow(input);
}

const recreateOrganizerInvoiceFlow = ai.defineFlow(
  {
    name: 'recreateOrganizerInvoiceFlow',
    inputSchema: RecreateOrganizerInvoiceInputSchema,
    outputSchema: RecreateOrganizerInvoiceOutputSchema,
  },
  async (input) => {
    const squareClient = await getSquareClient();

    try {
      const { result: { invoice: originalInvoice } } = await squareClient.invoicesApi.getInvoice(input.originalInvoiceId);

      // Step 1: Cancel the original invoice.
      console.log(`Canceling original invoice: ${input.originalInvoiceId}`);
      await cancelInvoice({ invoiceId: input.originalInvoiceId, requestingUserRole: 'organizer' });
      console.log(`Successfully canceled original invoice: ${input.originalInvoiceId}`);

      // Step 2: Create a new invoice with the updated details and revised title/number.
      console.log(`Creating new organizer invoice.`);
      
      const revisionSuffix = `-rev.${input.revisionNumber || 2}`;
      const baseInvoiceNumber = originalInvoice?.invoiceNumber?.split('-rev.')[0];
      const newInvoiceNumber = baseInvoiceNumber ? `${baseInvoiceNumber}${revisionSuffix}` : undefined;

      const newInvoiceResult = await createOrganizerInvoice({
          ...input,
          invoiceNumber: newInvoiceNumber,
      });

      console.log("Successfully created new revised invoice:", newInvoiceResult);

      return {
        oldInvoiceId: input.originalInvoiceId,
        newInvoiceId: newInvoiceResult.invoiceId,
        invoiceNumber: newInvoiceResult.invoiceNumber,
        status: newInvoiceResult.status,
        invoiceUrl: newInvoiceResult.invoiceUrl,
      };

    } catch (error) {
      if (error instanceof ApiError) {
        const errorResult = error.result || {};
        const errors = Array.isArray(errorResult.errors) ? errorResult.errors : [];
        console.error('Square API Error in recreateOrganizerInvoiceFlow:', JSON.stringify(errorResult, null, 2));
        const errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during organizer invoice recreation:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during organizer invoice recreation.');
      }
    }
  }
);
