
'use server';
/**
 * @fileOverview Creates a new general-purpose Square invoice to replace an old one.
 * This flow cancels the original invoice and creates a new one with a revision number.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { createOrganizerInvoice } from './create-organizer-invoice-flow';
import { cancelInvoice } from './cancel-invoice-flow';

const LineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  amount: z.number().describe('The cost of the line item in dollars.'),
  note: z.string().optional().describe('Any additional notes for the line item.'),
});

const RecreateOrganizerInvoiceInputSchema = z.object({
    originalInvoiceId: z.string().describe('The ID of the invoice to cancel and replace.'),
    sponsorName: z.string().describe('The name of the person or entity to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the invoice recipient.'),
    schoolName: z.string().describe('The school associated with this invoice.'),
    invoiceTitle: z.string().describe('The main title for the invoice.'),
    lineItems: z.array(LineItemSchema).min(1).describe('An array of items to be included in the invoice.'),
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
      // Step 1: Get original invoice to fetch its number
      console.log(`Fetching original invoice: ${input.originalInvoiceId}`);
      const { result: { invoice: originalInvoice } } = await squareClient.invoicesApi.getInvoice(input.originalInvoiceId);
      
      if (!originalInvoice) {
        throw new Error(`Could not find original invoice with ID: ${input.originalInvoiceId}`);
      }

      // Step 2: Cancel the original invoice.
      console.log(`Canceling original invoice: ${input.originalInvoiceId}`);
      await cancelInvoice({ invoiceId: input.originalInvoiceId });
      console.log(`Successfully canceled original invoice: ${input.originalInvoiceId}`);

      // Step 3: Determine the new title with revision number.
      const baseTitle = input.invoiceTitle.split('-rev.')[0].trim();
      const currentRevisionMatch = originalInvoice.title?.match(/-rev\.(\d+)$/);
      const currentRevision = currentRevisionMatch ? parseInt(currentRevisionMatch[1], 10) : 1;
      const newRevisedTitle = `${baseTitle}-rev.${currentRevision + 1}`;
      console.log(`Generated new revised title: ${newRevisedTitle}`);
      
      // Step 4: Create a new invoice with the updated details and revised title.
      console.log(`Creating new organizer invoice.`);
      
      const newInvoiceResult = await createOrganizerInvoice({
          sponsorName: input.sponsorName,
          sponsorEmail: input.sponsorEmail,
          schoolName: input.schoolName,
          invoiceTitle: newRevisedTitle,
          lineItems: input.lineItems,
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
        console.error('Square API Error in recreateOrganizerInvoiceFlow:', JSON.stringify(error.result, null, 2));
        const errorMessage = error.result.errors?.[0]?.detail || JSON.stringify(error.result);
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
