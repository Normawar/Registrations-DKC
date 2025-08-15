
'use server';
/**
 * @fileOverview Retrieves an invoice status from the Square API.
 *
 * - getInvoiceStatus - A function that handles retrieving the invoice status.
 * - GetInvoiceStatusInput - The input type for the getInvoiceStatus function.
 * - GetInvoiceStatusOutput - The return type for the getInvoiceStatus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ApiError } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';

const GetInvoiceStatusInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to get the status for.'),
});
export type GetInvoiceStatusInput = z.infer<typeof GetInvoiceStatusInputSchema>;

const GetInvoiceStatusOutputSchema = z.object({
  status: z.string(),
  invoiceNumber: z.string().optional(),
});
export type GetInvoiceStatusOutput = z.infer<typeof GetInvoiceStatusOutputSchema>;

export async function getInvoiceStatus(input: GetInvoiceStatusInput): Promise<GetInvoiceStatusOutput> {
  return getInvoiceStatusFlow(input);
}

const getInvoiceStatusFlow = ai.defineFlow(
  {
    name: 'getInvoiceStatusFlow',
    inputSchema: GetInvoiceStatusInputSchema,
    outputSchema: GetInvoiceStatusOutputSchema,
  },
  async (input) => {
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
      // In mock mode, we just return a "PAID" status as an example.
      return {
        status: 'PAID',
        invoiceNumber: `MOCK-${input.invoiceId.substring(0, 4)}`,
      };
    }
    
    const squareClient = await getSquareClient();
    const { invoicesApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${input.invoiceId} to get current status...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!invoice || !invoice.status) {
        throw new Error(`Could not find invoice or invoice status for ID: ${input.invoiceId}`);
      }
      
      return {
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        const errorResult = error.result || {};
        const errors = Array.isArray(errorResult.errors) ? errorResult.errors : [];
        console.error('Square API Error in getInvoiceStatusFlow:', JSON.stringify(errorResult, null, 2));
        let errorMessage: string;
        if (errors.length > 0) {
            const firstError = errors[0];
            errorMessage = firstError.detail || `Category: ${firstError.category}, Code: ${firstError.code}`;
        } else {
            errorMessage = JSON.stringify(errorResult);
        }
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice status retrieval:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice status retrieval.');
      }
    }
  }
);
