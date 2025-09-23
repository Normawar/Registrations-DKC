
'use server';
/**
 * @fileOverview Updates an invoice title with the Square API.
 *
 * - updateInvoiceTitle - A function that handles updating the invoice title.
 * - UpdateInvoiceTitleInput - The input type for the updateInvoiceTitle function.
 * - UpdateInvoiceTitleOutput - The return type for the updateInvoiceTitle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ApiError, type Client } from 'square';
import { randomUUID } from 'crypto';
import { getSquareClient } from '@/lib/square-client';

const UpdateInvoiceTitleInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to update.'),
  title: z.string().describe('The new title for the invoice.'),
});
export type UpdateInvoiceTitleInput = z.infer<typeof UpdateInvoiceTitleInputSchema>;

const UpdateInvoiceTitleOutputSchema = z.object({
  invoiceId: z.string(),
  title: z.string(),
  status: z.string(),
});
export type UpdateInvoiceTitleOutput = z.infer<typeof UpdateInvoiceTitleOutputSchema>;

export async function updateInvoiceTitle(input: UpdateInvoiceTitleInput): Promise<UpdateInvoiceTitleOutput> {
  return updateInvoiceTitleFlow(input);
}

const updateInvoiceTitleFlow = ai.defineFlow(
  {
    name: 'updateInvoiceTitleFlow',
    inputSchema: UpdateInvoiceTitleInputSchema,
    outputSchema: UpdateInvoiceTitleOutputSchema,
  },
  async (input) => {
    const squareClient = await getSquareClient();
    const { invoicesApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${input.invoiceId} to get current version...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!invoice || !invoice.version) {
        throw new Error(`Could not find invoice or invoice version for ID: ${input.invoiceId}`);
      }

      // Check if the invoice is in a state that allows updates.
      if (invoice.status && invoice.status !== 'DRAFT' && invoice.status !== 'UNPAID' && invoice.status !== 'PARTIALLY_PAID') {
        console.warn(`Invoice ${input.invoiceId} is in status ${invoice.status} and cannot be updated. Returning current state.`);
        return {
          invoiceId: invoice.id!,
          title: invoice.title!,
          status: invoice.status!,
        };
      }
      
      console.log(`Updating invoice ${input.invoiceId} with new title: "${input.title}"`);
      
      const { result: { invoice: updatedInvoice } } = await invoicesApi.updateInvoice(input.invoiceId, {
        invoice: {
          title: input.title,
          version: invoice.version,
        },
        idempotencyKey: randomUUID(),
      });
      
      console.log("Successfully updated invoice:", updatedInvoice);

      return {
        invoiceId: updatedInvoice!.id!,
        title: updatedInvoice!.title!,
        status: updatedInvoice!.status!,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        const errorResult = error.result || {};
        const errors = Array.isArray(errorResult.errors) ? errorResult.errors : [];
        
        const isNotUpdatable = errors.some(e => e.detail?.toLowerCase().includes('can only update an unpaid invoice'));

        if (isNotUpdatable) {
            console.warn(`Invoice ${input.invoiceId} cannot be updated via the API, likely because it's already paid or in a final state.`);
            const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
            return {
                invoiceId: invoice!.id!,
                title: invoice!.title!,
                status: invoice!.status!,
            };
        }
        
        console.error('Square API Error in updateInvoiceTitleFlow:', JSON.stringify(errorResult, null, 2));
        let errorMessage: string;
        if (errors.length > 0) {
            errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
        } else {
            errorMessage = JSON.stringify(errorResult);
        }
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice update:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice update.');
      }
    }
  }
);
