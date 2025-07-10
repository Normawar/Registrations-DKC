
'use server';
/**
 * @fileOverview Withdraws a player from an invoice with the Square API by updating the invoice line items directly.
 *
 * - withdrawPlayerFromInvoice - A function that handles the player withdrawal process.
 * - WithdrawPlayerInput - The input type for the withdrawPlayerFromInvoice function.
 * - WithdrawPlayerOutput - The return type for the withdrawPlayerFromInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ApiError, type Invoice, type LineItem } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';
import { differenceInHours } from 'date-fns';
import { randomUUID } from 'crypto';

const WithdrawPlayerInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to update.'),
  playerName: z.string().describe('The full name of the player to withdraw.'),
  eventDate: z.string().describe('The date of the event in ISO 8601 format.'),
});
export type WithdrawPlayerInput = z.infer<typeof WithdrawPlayerInputSchema>;

const WithdrawPlayerOutputSchema = z.object({
  invoiceId: z.string(),
  orderId: z.string().optional(),
  totalAmount: z.number(),
  status: z.string(),
  wasInvoiceModified: z.boolean(),
});
export type WithdrawPlayerOutput = z.infer<typeof WithdrawPlayerOutputSchema>;

export async function withdrawPlayerFromInvoice(input: WithdrawPlayerInput): Promise<WithdrawPlayerOutput> {
  return withdrawPlayerFlow(input);
}

const withdrawPlayerFlow = ai.defineFlow(
  {
    name: 'withdrawPlayerFlow',
    inputSchema: WithdrawPlayerInputSchema,
    outputSchema: WithdrawPlayerOutputSchema,
  },
  async ({ invoiceId, playerName, eventDate }) => {
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
      console.log(`Square not configured. Mock-withdrawing ${playerName} from invoice ${invoiceId}.`);
      return {
        invoiceId: invoiceId,
        orderId: 'MOCK_ORDER_ID',
        totalAmount: 0,
        status: 'DRAFT',
        wasInvoiceModified: true,
      };
    }

    const squareClient = await getSquareClient();
    const { invoicesApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${invoiceId} to get its details...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(invoiceId);
      
      if (!invoice?.id) {
        throw new Error(`Invoice ${invoiceId} not found.`);
      }

      const hoursUntilEvent = differenceInHours(new Date(eventDate), new Date());

      if (hoursUntilEvent <= 48) {
        console.log(`Withdrawal for ${playerName} is within 48 hours of the event. Invoice ${invoiceId} will not be modified.`);
        return {
          invoiceId: invoice.id!,
          orderId: invoice.orderId,
          totalAmount: Number(invoice.paymentRequests?.[0].computedAmountMoney?.amount ?? 0) / 100,
          status: invoice.status!,
          wasInvoiceModified: false,
        };
      }
      
      const updatableStatuses = ['DRAFT', 'PUBLISHED', 'UNPAID', 'PARTIALLY_PAID'];
      if (!updatableStatuses.includes(invoice.status!)) {
        throw new Error(`Invoice is in status ${invoice.status} and cannot be modified. Player must be withdrawn manually and a credit/refund issued if applicable.`);
      }
      
      let playerFound = false;
      const lowerPlayerName = playerName.toLowerCase();

      if (!invoice.lineItems) {
        invoice.lineItems = [];
      }
      
      // Directly modify the line items from the fetched invoice
      for (const item of invoice.lineItems) {
        if (!item.note) continue;

        const noteLines = item.note.split('\n');
        let noteWasModified = false;
        
        for (let i = 0; i < noteLines.length; i++) {
            const line = noteLines[i];
            // Use a flexible search that doesn't rely on strict formatting
            if (line.toLowerCase().includes(lowerPlayerName)) {
                playerFound = true;
                
                // Decrease quantity
                const currentQuantity = parseInt(item.quantity || '1', 10);
                if (currentQuantity > 0) {
                    item.quantity = String(currentQuantity - 1);
                }

                // Mark player as withdrawn in the note
                if (!noteLines[i].toLowerCase().includes('(withdrawn)')) {
                    noteLines[i] += ' (Withdrawn)';
                    noteWasModified = true;
                }
                // A player can only appear once in the notes, so we can break
                break;
            }
        }
        
        if (noteWasModified) {
          item.note = noteLines.join('\n');
        }
      }


      if (!playerFound) {
        throw new Error(`Could not find a line item for player "${playerName}" to withdraw.`);
      }
      
      // Filter out any line items that now have a quantity of 0.
      invoice.lineItems = invoice.lineItems.filter(item => parseInt(item.quantity || '0', 10) > 0);
      
      // We must delete these fields as they are read-only and will cause an error if sent back.
      // This is a critical step for updating invoices.
      const invoiceToUpdate: any = invoice;
      delete invoiceToUpdate.createdAt;
      delete invoiceToUpdate.updatedAt;
      if (invoiceToUpdate.paymentRequests) {
          invoiceToUpdate.paymentRequests.forEach((pr: any) => {
              delete pr.computedAmountMoney;
              delete pr.totalCompletedAmountMoney;
          });
      }

      const { result: { invoice: finalInvoice } } = await invoicesApi.updateInvoice(invoiceId, {
        invoice: invoiceToUpdate,
        idempotencyKey: randomUUID(),
      });
      
      console.log("Successfully updated invoice:", finalInvoice);

      return {
        invoiceId: finalInvoice!.id!,
        orderId: finalInvoice!.orderId,
        totalAmount: Number(finalInvoice!.paymentRequests?.[0].computedAmountMoney?.amount || 0) / 100,
        status: finalInvoice!.status!,
        wasInvoiceModified: true,
      };

    } catch (error) {
      if (error instanceof ApiError) {
        console.error('Square API Error in withdrawPlayerFlow:', JSON.stringify(error.result, null, 2));
        const errorMessage = error.result.errors?.[0]?.detail || JSON.stringify(error.result);
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during player withdrawal:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during player withdrawal.');
      }
    }
  }
);
