
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
import { ApiError, type LineItem } from 'square';
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

      // If withdrawal is within 48 hours, do not modify the invoice.
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

      const updatedLineItems: LineItem[] = JSON.parse(JSON.stringify(invoice.lineItems || [])); // Deep copy

      let playerFound = false;

      // Iterate through the line items to find and update the withdrawn player's items
      for (const item of updatedLineItems) {
        // Simplified logic: If the player's name is in the note, we assume it's an item to modify.
        if (item.note?.toLowerCase().includes(playerName.toLowerCase())) {
            playerFound = true;
            const currentQuantity = parseInt(item.quantity!, 10);
            if (currentQuantity > 0) {
                item.quantity = String(currentQuantity - 1);
            }

            // Update the note for the line item to reflect withdrawal
            if (item.note) {
                const playerLines = item.note.split('\n');
                const updatedLines = playerLines.map(line => {
                    if (line.toLowerCase().includes(playerName.toLowerCase()) && !line.toLowerCase().includes('(withdrawn)')) {
                        return `${line} (Withdrawn)`;
                    }
                    return line;
                });
                item.note = updatedLines.join('\n');
            }
        }
      }

      if (!playerFound) {
        throw new Error(`Could not find a line item for player "${playerName}" to withdraw.`);
      }
      
      const finalLineItems = updatedLineItems.filter(item => parseInt(item.quantity || '0', 10) > 0);

      const { result: { invoice: updatedInvoice } } = await invoicesApi.updateInvoice(invoiceId, {
        invoice: {
          ...invoice,
          lineItems: finalLineItems,
          version: invoice.version!,
        },
        idempotencyKey: randomUUID(),
      });
      
      console.log("Successfully updated invoice:", updatedInvoice);

      return {
        invoiceId: updatedInvoice!.id!,
        orderId: updatedInvoice!.orderId,
        totalAmount: Number(updatedInvoice!.paymentRequests?.[0].computedAmountMoney?.amount || 0) / 100,
        status: updatedInvoice!.status!,
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
