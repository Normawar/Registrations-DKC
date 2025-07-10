
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
import { differenceInHours } from 'date-fns';

const WithdrawPlayerInputSchema = z.object({
  invoiceId: z.string().describe('The ID of the invoice to update.'),
  playerName: z.string().describe('The full name of the player to withdraw.'),
  eventDate: z.string().describe('The date of the event in ISO 8601 format.'),
});
export type WithdrawPlayerInput = z.infer<typeof WithdrawPlayerInputSchema>;

const WithdrawPlayerOutputSchema = z.object({
  invoiceId: z.string(),
  orderId: z.string(),
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
    const { invoicesApi, ordersApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${invoiceId} to get its order ID...`);
      const { result: { invoice } } = await invoicesApi.getInvoice(invoiceId);
      
      if (!invoice?.orderId) {
        throw new Error(`Invoice ${invoiceId} does not have an associated order ID.`);
      }
      
      const orderId = invoice.orderId;
      
      const hoursUntilEvent = differenceInHours(new Date(eventDate), new Date());

      // If withdrawal is within 48 hours, do not modify the invoice.
      if (hoursUntilEvent <= 48) {
        console.log(`Withdrawal for ${playerName} is within 48 hours of the event. Invoice ${invoiceId} will not be modified.`);
        return {
          invoiceId: invoice.id!,
          orderId: orderId,
          totalAmount: Number(invoice.paymentRequests?.[0].computedAmountMoney?.amount || invoice.total?.amount || 0) / 100,
          status: invoice.status!,
          wasInvoiceModified: false,
        };
      }

      if (invoice.status !== 'DRAFT' && invoice.status !== 'PUBLISHED' && invoice.status !== 'UNPAID' && invoice.status !== 'PARTIALLY_PAID') {
        throw new Error(`Invoice is in status ${invoice.status} and cannot be modified. Player must be withdrawn manually and a credit/refund issued if applicable.`);
      }
      
      console.log(`Fetching order ${orderId} to update line items...`);
      const { result: { order } } = await ordersApi.retrieveOrder(orderId);

      if (!order || !order.lineItems) {
        throw new Error(`Could not retrieve order or order has no line items for ID: ${orderId}`);
      }

      let playerFound = false;
      const sparseLineItemUpdates: OrderLineItem[] = [];

      // Find all line items that might be associated with this player
      const registrationItem = order.lineItems.find(item => item.name?.toLowerCase().includes('tournament registration'));
      const lateFeeItem = order.lineItems.find(item => item.name?.toLowerCase().includes('late fee'));
      const uscfItem = order.lineItems.find(item => item.name?.toLowerCase().includes('uscf membership'));
      
      // Check if the player is mentioned in any of the notes, which indicates they are part of that line item
      const isPlayerInRegistrationNotes = registrationItem?.note?.toLowerCase().includes(playerName.toLowerCase());
      const isPlayerInLateFeeNotes = lateFeeItem?.note?.toLowerCase().includes(playerName.toLowerCase());
      const isPlayerInUscfNotes = uscfItem?.note?.toLowerCase().includes(playerName.toLowerCase());

      if (registrationItem && (isPlayerInRegistrationNotes || registrationItem.quantity > '0')) {
          playerFound = true;
          const newQuantity = parseInt(registrationItem.quantity, 10) - 1;
          if (newQuantity >= 0) {
              sparseLineItemUpdates.push({ uid: registrationItem.uid!, quantity: String(newQuantity) });
          }
      }

      if (lateFeeItem && isPlayerInLateFeeNotes) {
          const newQuantity = parseInt(lateFeeItem.quantity, 10) - 1;
          if (newQuantity >= 0) {
              sparseLineItemUpdates.push({ uid: lateFeeItem.uid!, quantity: String(newQuantity) });
          }
      }

      if (uscfItem && isPlayerInUscfNotes) {
          const newQuantity = parseInt(uscfItem.quantity, 10) - 1;
          if (newQuantity >= 0) {
              sparseLineItemUpdates.push({ uid: uscfItem.uid!, quantity: String(newQuantity) });
          }
      }

      if (!playerFound) {
        throw new Error(`Could not find a line item for player "${playerName}" to withdraw.`);
      }

      if (sparseLineItemUpdates.length === 0) {
          console.warn(`No line item quantities needed to be changed for player ${playerName}.`);
          return {
            invoiceId: invoice.id!,
            orderId: orderId,
            totalAmount: Number(invoice.paymentRequests?.[0].computedAmountMoney?.amount || invoice.total?.amount || 0) / 100,
            status: invoice.status!,
            wasInvoiceModified: false,
          };
      }
      
      console.log(`Updating order ${orderId} for invoice ${invoiceId} with sparse line item changes...`, JSON.stringify(sparseLineItemUpdates));
      
      const { result: { order: updatedOrder } } = await ordersApi.updateOrder(orderId, {
        order: {
          locationId: order.locationId!,
          lineItems: sparseLineItemUpdates, // Send only the sparse update
          version: order.version,
        },
      });

      console.log("Successfully updated order:", updatedOrder);
      
      // Fetch the invoice again to get the final updated state
      await new Promise(resolve => setTimeout(resolve, 2000));
      const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(invoiceId);

      return {
        invoiceId: finalInvoice!.id!,
        orderId: updatedOrder!.id!,
        totalAmount: Number(finalInvoice!.paymentRequests?.[0].computedAmountMoney?.amount || finalInvoice!.total?.amount || 0) / 100,
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
