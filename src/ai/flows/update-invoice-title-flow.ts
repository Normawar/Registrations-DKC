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
import { Client, Environment, ApiError } from 'square';
import { randomUUID } from 'crypto';

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox, // Use Sandbox for testing
});

const { invoicesApi } = squareClient;

// Add some diagnostic logging to verify configuration
console.log(`Square client configured for: Sandbox Environment`);
if (process.env.SQUARE_ACCESS_TOKEN) {
    const token = process.env.SQUARE_ACCESS_TOKEN;
    if (token.startsWith('YOUR_')) {
      console.log('Square Access Token: Using placeholder value. Please update your .env file.');
    } else {
      console.log(`Using Square Access Token: Provided (starts with ${token.substring(0, 8)}..., ends with ${token.substring(token.length - 4)})`);
    }
} else {
    console.log('Square Access Token: Not Provided. Please check your .env file.');
}

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
    try {
      console.log(`Fetching invoice ${input.invoiceId} to get current version...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!invoice || !invoice.version) {
        throw new Error(`Could not find invoice or invoice version for ID: ${input.invoiceId}`);
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
        console.error('Square API Error:', JSON.stringify(error.result, null, 2));
        const firstError = error.result.errors?.[0];
        const errorMessage = firstError?.detail ?? JSON.stringify(error.result.errors);
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice update:', error);
        if (error instanceof Error) {
            throw new Error(`An unexpected error occurred: ${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice update.');
      }
    }
  }
);
