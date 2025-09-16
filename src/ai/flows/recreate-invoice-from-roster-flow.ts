/**
 * @fileOverview Recreates an invoice with an updated player roster.
 * This flow cancels the original invoice and creates a new one with the updated details.
 * It now properly handles PSJA split invoices.
 */

import {ai} from '@/ai/genkit';
import { ApiError } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { createInvoice } from './create-invoice-flow';
import { cancelInvoice } from './cancel-invoice-flow';
import { createPsjaSplitInvoice } from './create-psja-split-invoice-flow';
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
      
      const isPsjaDistrict = input.district === 'PHARR-SAN JUAN-ALAMO ISD';
      
      // Step 3: Determine invoice numbering for revision
      const existingRevisionMatch = originalInvoice?.invoiceNumber?.match(/-rev\.(\d+)/);
      const nextRevisionNumber = existingRevisionMatch ? parseInt(existingRevisionMatch[1], 10) + 1 : 2;
      const baseInvoiceNumber = originalInvoice?.invoiceNumber?.split('-rev.')[0];
      const revisionMessage = `Revised based on your request. Original Invoice: #${originalInvoice?.invoiceNumber}. This invoice replaces the original.`;
      
      let newInvoiceResult;

      if (isPsjaDistrict) {
        // Step 4a: Handle PSJA Split Invoice Recreation
        console.log('Recreating as PSJA Split Invoice');
        const splitResult = await createPsjaSplitInvoice({
          ...input,
          revisionNumber: nextRevisionNumber,
          originalInvoiceNumber: baseInvoiceNumber,
          revisionMessage: revisionMessage,
        });

        // For the output, we'll return the info for one of the created invoices,
        // prioritizing the independent one as that's usually the primary sponsor's responsibility.
        newInvoiceResult = splitResult.independentInvoice || splitResult.gtInvoice;
        if (!newInvoiceResult) throw new Error('Failed to create any new invoices for PSJA split.');

      } else {
        // Step 4b: Handle Standard Invoice Recreation
        console.log('Recreating as Standard Invoice');
        const uniqueTimestamp = Date.now().toString().slice(-5);
        const newInvoiceNumber = baseInvoiceNumber 
            ? `${baseInvoiceNumber}-rev.${nextRevisionNumber}-${uniqueTimestamp}` 
            : `INV-${uniqueTimestamp}`;

        const newInvoiceInput = {
          ...input,
          invoiceNumber: newInvoiceNumber,
          revisionMessage: revisionMessage,
        };

        newInvoiceResult = await createInvoice(newInvoiceInput);
      }

      // Step 5: Fetch the final amount of the new primary invoice
      const { result: { invoice: newSquareInvoice } } = await squareClient.invoicesApi.getInvoice(newInvoiceResult.invoiceId);
      const newTotalAmount = newSquareInvoice?.paymentRequests?.[0]?.computedAmountMoney?.amount 
        ? Number(newSquareInvoice.paymentRequests[0].computedAmountMoney.amount) / 100 
        : 0;

      console.log("Successfully created new revised invoice(s).");

      return {
        oldInvoiceId: input.originalInvoiceId,
        newInvoiceId: newInvoiceResult.invoiceId,
        newInvoiceNumber: newInvoiceResult.invoiceNumber,
        newStatus: newInvoiceResult.status,
        newInvoiceUrl: newInvoiceResult.invoiceUrl,
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
