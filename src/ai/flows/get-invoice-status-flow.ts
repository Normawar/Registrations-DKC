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
import { Client, Environment, ApiError } from 'square';

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox, // Use Sandbox for testing
});

const { invoicesApi } = squareClient;

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
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken || accessToken.startsWith('YOUR_')) {
        throw new Error(
            `Square configuration is incomplete. Please set SQUARE_ACCESS_TOKEN in your .env file. You can find this in your Square Developer Dashboard.`
        );
    }
      
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
        console.error('Square API Error during status fetch:', JSON.stringify(error.result, null, 2));
        const firstError = error.result.errors?.[0];
        const errorMessage = firstError?.detail ?? JSON.stringify(error.result.errors);
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice status retrieval:', error);
        if (error instanceof Error) {
            throw new Error(`An unexpected error occurred: ${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice status retrieval.');
      }
    }
  }
);
