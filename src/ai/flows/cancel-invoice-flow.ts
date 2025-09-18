
'use server';
/**
 * @fileOverview Cancels an invoice with the Square API.
 *
 * - cancelInvoice - A function that handles the invoice cancellation process.
 * - CancelInvoiceInput - The input type for the cancelInvoice function.
 * - CancelInvoiceOutput - The return type for the cancelInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ApiError } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';

const CancelInvoiceInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to cancel.'),
  requestingUserRole: z.string().describe('Role of user requesting the cancellation'),
});
export type CancelInvoiceInput = z.infer<typeof CancelInvoiceInputSchema>;

const CancelInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  status: z.string(),
});
export type CancelInvoiceOutput = z.infer<typeof CancelInvoiceOutputSchema>;

export async function cancelInvoice(input: CancelInvoiceInput): Promise<CancelInvoiceOutput> {
  return cancelInvoiceFlow(input);
}

const cancelInvoiceFlow = ai.defineFlow(
  {
    name: 'cancelInvoiceFlow',
    inputSchema: CancelInvoiceInputSchema,
    outputSchema: CancelInvoiceOutputSchema,
  },
  async (input) => {
    if (input.requestingUserRole !== 'organizer') {
        throw new Error('Only organizers can cancel invoices.');
    }
    
    let squareClient;
    try {
        squareClient = await getSquareClient();
        console.log('Debug: Square client obtained successfully for cancelInvoiceFlow');
    } catch (error) {
        console.error('Debug: Failed to get Square client in cancelInvoiceFlow:', error);
        throw new Error(`Square configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const { invoicesApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${input.invoiceId} to get current version...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!invoice || !invoice.version) {
        throw new Error(`Could not find invoice or invoice version for ID: ${input.invoiceId}`);
      }

      // Invoices can only be canceled if they are in a state that allows it.
      // If already paid or otherwise non-cancelable, we can just return the current status.
      // The UI will handle this by simply marking it as comped locally.
      const cancelableStatuses = ['DRAFT', 'PUBLISHED', 'UNPAID', 'PARTIALLY_PAID'];
      if (!invoice.status || !cancelableStatuses.includes(invoice.status)) {
        console.log(`Invoice ${input.invoiceId} is in status ${invoice.status} and cannot be canceled via API. It will be marked as comped locally.`);
        // Return the definitive current status from Square
        return {
          invoiceId: invoice.id!,
          status: invoice.status || 'UNKNOWN',
        };
      }
      
      console.log(`Canceling invoice ${input.invoiceId}`);
      
      const { result: { invoice: canceledInvoice } } = await invoicesApi.cancelInvoice(input.invoiceId, {
        version: invoice.version,
      });
      
      console.log("Successfully canceled invoice:", canceledInvoice);

      // Return the definitive final status from the cancellation response
      return {
        invoiceId: canceledInvoice!.id!,
        status: canceledInvoice!.status!,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        const errorResult = error.result || {};
        const errors = Array.isArray(errorResult.errors) ? errorResult.errors : [];
        
        // Check for specific error where invoice cannot be canceled because of its state
        const isNotCancelable = errors.some(e => 
            e.code === 'BAD_REQUEST' && e.detail?.toLowerCase().includes('cannot be canceled')
        );

        if (isNotCancelable) {
             console.warn(`Invoice ${input.invoiceId} cannot be canceled through the API (likely already paid or in a final state). Fetching and returning its current state.`);
             const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
             if (!invoice) {
                throw new Error(`Could not find invoice or invoice version for ID: ${input.invoiceId}`);
             }
             return { invoiceId: input.invoiceId, status: invoice?.status || 'UNKNOWN' };
        }

        console.error('Square API Error in cancelInvoiceFlow:', JSON.stringify(error.result, null, 2));
        let errorMessage: string;
        if (errors.length > 0) {
            errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
        } else {
            errorMessage = JSON.stringify(error.result);
        }
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice cancellation:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice cancellation.');
      }
    }
  }
);
