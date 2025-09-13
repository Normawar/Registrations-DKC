/**
 * @fileOverview Recreates an invoice with an updated player roster.
 * This flow cancels the original invoice and creates a new one with the updated details.
 * It's the standard, reliable way to handle changes to existing registrations.
 */

import {ai} from '@/ai/genkit';
import { ApiError } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { createInvoice } from './create-invoice-flow';
import { cancelInvoice } from './cancel-invoice-flow';
import {
  RecreateInvoiceInputSchema,
  type RecreateInvoiceInput,
  RecreateInvoiceOutputSchema,
  type RecreateInvoiceOutput,
} from './schemas';


export async function recreateInvoiceFromRoster(input: RecreateInvoiceInput): Promise<RecreateInvoiceOutput> {
  return recreateInvoiceFromRosterFlow(input);
}

const recreateInvoiceFromRosterFlow = ai.defineFlow(
  {
    name: 'recreateInvoiceFromRosterFlow',
    inputSchema: RecreateInvoiceInputSchema,
    outputSchema: RecreateInvoiceOutputSchema,
  },
  async (input) => {
    if (input.requestingUserRole !== 'organizer') {
        throw new Error('Only organizers can modify existing invoices.');
    }
    
    const squareClient = await getSquareClient();

    try {
      // Step 1: Get original invoice details to construct the revised invoice number
      const { result: { invoice: originalInvoice } } = await squareClient.invoicesApi.getInvoice(input.originalInvoiceId);

      if (originalInvoice?.status === 'CANCELED') {
        console.log(`Original invoice ${input.originalInvoiceId} is already canceled. Proceeding to create new invoice without canceling again.`);
      } else {
        // Step 2: Cancel the original invoice.
        console.log(`Canceling original invoice: ${input.originalInvoiceId}`);
        await cancelInvoice({ invoiceId: input.originalInvoiceId, requestingUserRole: 'organizer' });
        console.log(`Successfully canceled original invoice: ${input.originalInvoiceId}`);
      }

      // Step 3: Create a new invoice with the updated details and a unique revision number.
      const existingRevision = originalInvoice?.invoiceNumber?.match(/-rev\.(\d+)/);
      const nextRevisionNumber = existingRevision ? parseInt(existingRevision[1], 10) + 1 : 2;
      const baseInvoiceNumber = originalInvoice?.invoiceNumber?.split('-rev.')[0];
      // Append a timestamp to ensure uniqueness, even if run in quick succession.
      const uniqueTimestamp = Date.now().toString().slice(-5);
      const newInvoiceNumber = baseInvoiceNumber 
          ? `${baseInvoiceNumber}-rev.${nextRevisionNumber}-${uniqueTimestamp}` 
          : `INV-${uniqueTimestamp}`; // Fallback if no base number

      console.log('Generated invoice number:', {
        baseInvoiceNumber,
        existingRevision,
        nextRevisionNumber,
        uniqueTimestamp,
        newInvoiceNumber
      });

      const revisionMessage = `Revised based on your request. Original Invoice: #${originalInvoice?.invoiceNumber}. This invoice replaces the original.`;
      
      const newInvoiceInput = {
        ...input,
        invoiceNumber: newInvoiceNumber,
        revisionMessage: revisionMessage,
      };

      console.log('Passing to createInvoice:', { invoiceNumber: newInvoiceInput.invoiceNumber });
      
      const { invoiceId, invoiceNumber, status, invoiceUrl } = await createInvoice(newInvoiceInput);

      // We need to fetch the final amount of the new invoice
      const { result: { invoice: newSquareInvoice } } = await squareClient.invoicesApi.getInvoice(invoiceId);
      const newTotalAmount = newSquareInvoice?.paymentRequests?.[0]?.computedAmountMoney?.amount 
        ? Number(newSquareInvoice.paymentRequests[0].computedAmountMoney.amount) / 100 
        : 0;

      console.log("Successfully created new revised invoice:", newInvoiceInput);

      return {
        oldInvoiceId: input.originalInvoiceId,
        newInvoiceId: invoiceId,
        newInvoiceNumber: invoiceNumber,
        newStatus: status,
        newInvoiceUrl: invoiceUrl,
        newTotalAmount: newTotalAmount,
      };

    } catch (error) {
      if (error instanceof ApiError) {
        const errorResult = error.result || {};
        const errors = Array.isArray(errorResult.errors) ? errorResult.errors : [];
        console.error('Square API Error in recreateInvoiceFlow:', JSON.stringify(errorResult, null, 2));
        const errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice recreation:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice recreation.');
      }
    }
  }
);
