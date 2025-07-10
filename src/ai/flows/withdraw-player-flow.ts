
'use server';
/**
 * @fileOverview Withdraws a player from an invoice with the Square API by updating the underlying order.
 *
 * - withdrawPlayerFromInvoice - A function that handles the player withdrawal process.
 * - WithdrawPlayerInput - The input type for the withdrawPlayerFromInvoice function.
 * - WithdrawPlayerOutput - The return type for the withdrawPlayerFromInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ApiError, type Order, type OrderLineItem } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';

const WithdrawPlayerInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to update.'),
  playerName: z.string().describe('The full name of the player to withdraw.'),
});
export type WithdrawPlayerInput = z.infer<typeof WithdrawPlayerInputSchema>;

const WithdrawPlayerOutputSchema = z.object({
  invoiceId: z.string(),
  orderId: z.string(),
  totalAmount: z.number(),
  status: z.string(),
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
  async ({ invoiceId, playerName }) => {
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
      console.log(`Square not configured. Mock-withdrawing ${playerName} from invoice ${invoiceId}.`);
      return {
        invoiceId: invoiceId,
        orderId: 'MOCK_ORDER_ID',
        totalAmount: 0,
        status: 'DRAFT',
      };
    }

    const squareClient = await getSquareClient();
    const { invoicesApi, ordersApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${invoiceId} to get its order ID...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(invoiceId);
      
      if (!invoice?.orderId) {
        throw new Error(`Invoice ${invoiceId} does not have an associated order ID.`);
      }

      if (invoice.status !== 'DRAFT' && invoice.status !== 'PUBLISHED' && invoice.status !== 'UNPAID' && invoice.status !== 'PARTIALLY_PAID') {
        throw new Error(`Invoice is in status ${invoice.status} and cannot be modified. Player must be withdrawn manually and a credit/refund issued if applicable.`);
      }
      
      const orderId = invoice.orderId;
      console.log(`Fetching order ${orderId} to update line items...`);
      const { result: { order } } = await ordersApi.retrieveOrder(orderId);

      if (!order || !order.lineItems) {
        throw new Error(`Could not retrieve order or order has no line items for ID: ${orderId}`);
      }

      // Identify and filter out line items associated with the player.
      const updatedLineItems = order.lineItems.filter(item => {
        const isRegistrationItem = item.name === 'Tournament Registration';
        const isLateFeeItem = item.name === 'Late Fee';
        const isUscfItem = item.name === 'USCF Membership (New/Renew)';
        
        if (isRegistrationItem || isLateFeeItem || isUscfItem) {
          const notes = item.note || '';
          return !notes.toLowerCase().includes(playerName.toLowerCase());
        }
        return true;
      });
      
      if (updatedLineItems.length === order.lineItems.length) {
          throw new Error(`Could not find a line item for player "${playerName}" to remove.`);
      }
      
      // Update quantities for items that list multiple players
      const itemsToUpdate = ['Tournament Registration', 'Late Fee', 'USCF Membership (New/Renew)'];
      const finalLineItems = updatedLineItems.map(item => {
          if (itemsToUpdate.includes(item.name!)) {
              // The new quantity is the number of players left in the notes
              const newQuantity = (item.note?.split('\n').filter(name => name.trim() !== '').length || 0).toString();
              return { ...item, quantity: newQuantity };
          }
          return item;
      }).filter(item => parseInt(item.quantity) > 0); // Remove items if quantity becomes 0
      

      console.log(`Updating order ${orderId} for invoice ${invoiceId}...`);
      const { result: { order: updatedOrder } } = await ordersApi.updateOrder(orderId, {
        order: {
          locationId: order.locationId!,
          lineItems: finalLineItems,
          version: order.version,
        },
      });

      console.log("Successfully updated order:", updatedOrder);
      
      // Fetch the invoice again to get the final updated state
      const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(invoiceId);

      return {
        invoiceId: finalInvoice!.id!,
        orderId: updatedOrder!.id!,
        totalAmount: Number(finalInvoice!.total?.amount || 0) / 100,
        status: finalInvoice!.status!,
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
