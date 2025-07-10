
'use server';
/**
 * @fileOverview Rebuilds a Square invoice from a given player roster.
 * This flow is designed to be the single source of truth for updating an event registration invoice,
 * ensuring that the invoice always reflects the current state of the application's roster.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError, type OrderLineItem, type Invoice } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';

const PlayerToInvoiceSchema = z.object({
  playerName: z.string().describe('The full name of the player.'),
  uscfId: z.string().describe('The USCF ID of the player.'),
  baseRegistrationFee: z.number().describe('The base registration fee for the event.'),
  lateFee: z.number().describe('The late fee applied, if any.'),
  uscfAction: z.boolean().describe('Whether a USCF membership action (new/renew) is needed.'),
});

const RebuildInvoiceInputSchema = z.object({
    invoiceId: z.string().describe('The ID of the invoice to rebuild.'),
    sponsorName: z.string().describe('The name of the sponsor to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the sponsor.'),
    schoolName: z.string().describe('The name of the school associated with the sponsor.'),
    teamCode: z.string().describe('The team code of the sponsor.'),
    eventName: z.string().describe('The name of the event.'),
    eventDate: z.string().describe('The date of the event in ISO 8601 format.'),
    uscfFee: z.number().describe('The fee for a new or renewing USCF membership.'),
    players: z.array(PlayerToInvoiceSchema).describe('The complete list of players who should be on the invoice.'),
});
export type RebuildInvoiceInput = z.infer<typeof RebuildInvoiceInputSchema>;

const RebuildInvoiceOutputSchema = z.object({
  invoiceId: z.string(),
  orderId: z.string().optional(),
  totalAmount: z.number(),
  status: z.string(),
  invoiceUrl: z.string().url(),
});
export type RebuildInvoiceOutput = z.infer<typeof RebuildInvoiceOutputSchema>;

export async function rebuildInvoiceFromRoster(input: RebuildInvoiceInput): Promise<RebuildInvoiceOutput> {
  return rebuildInvoiceFlow(input);
}

const rebuildInvoiceFlow = ai.defineFlow(
  {
    name: 'rebuildInvoiceFlow',
    inputSchema: RebuildInvoiceInputSchema,
    outputSchema: RebuildInvoiceOutputSchema,
  },
  async (input) => {
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
      console.log(`Square not configured. Mock-rebuilding invoice ${input.invoiceId}.`);
      return {
        invoiceId: input.invoiceId,
        totalAmount: 0,
        status: 'DRAFT',
        invoiceUrl: `/#mock-invoice/${input.invoiceId}`,
      };
    }

    const squareClient = await getSquareClient();
    const { invoicesApi } = squareClient;
      
    try {
      console.log(`Fetching invoice ${input.invoiceId} to get its details...`);
      const { result: { invoice: originalInvoice } } = await invoicesApi.getInvoice(input.invoiceId);
      
      if (!originalInvoice?.id) {
        throw new Error(`Invoice ${input.invoiceId} not found.`);
      }

      const updatableStatuses = ['DRAFT', 'PUBLISHED', 'UNPAID', 'PARTIALLY_PAID'];
      if (!updatableStatuses.includes(originalInvoice.status!)) {
        throw new Error(`Invoice is in status ${originalInvoice.status} and cannot be modified.`);
      }

      // --- Reconstruct Line Items based on the provided player list ---
      const newLineItems: OrderLineItem[] = [];

      // 1. Registration Line Item
      if (input.players.length > 0) {
          const registrationFee = input.players[0].baseRegistrationFee;
          const playerNotes = input.players.map((p, index) => `${index + 1}. ${p.playerName} (${p.uscfId})`).join('\n');
          newLineItems.push({
              name: `Tournament Registration`,
              quantity: String(input.players.length),
              basePriceMoney: {
                  amount: BigInt(Math.round(registrationFee * 100)),
                  currency: 'USD',
              },
              note: playerNotes,
          });
      }

      // 2. Late Fee Line Item
      const lateFeePlayers = input.players.filter(p => p.lateFee > 0);
      if (lateFeePlayers.length > 0) {
          const lateFee = lateFeePlayers[0].lateFee;
          const lateFeePlayerNotes = lateFeePlayers.map((p, index) => `${index + 1}. ${p.playerName}`).join('\n');
          newLineItems.push({
              name: 'Late Fee',
              quantity: String(lateFeePlayers.length),
              basePriceMoney: {
                  amount: BigInt(Math.round(lateFee * 100)),
                  currency: 'USD',
              },
              note: lateFeePlayerNotes,
          });
      }

      // 3. USCF Membership Line Item
      const uscfActionPlayers = input.players.filter(p => p.uscfAction);
      if (uscfActionPlayers.length > 0) {
          const uscfPlayerNotes = uscfActionPlayers.map((p, index) => `${index + 1}. ${p.playerName}`).join('\n');
          newLineItems.push({
              name: 'USCF Membership (New/Renew)',
              quantity: String(uscfActionPlayers.length),
              basePriceMoney: {
                  amount: BigInt(Math.round(input.uscfFee * 100)),
                  currency: 'USD',
              },
              note: uscfPlayerNotes,
          });
      }

      // --- Prepare the invoice object for update ---
      const invoiceToUpdate: any = { ...originalInvoice };
      
      // Replace old line items with the newly constructed ones
      invoiceToUpdate.lineItems = newLineItems;

      // Delete read-only fields to prevent API errors
      delete invoiceToUpdate.createdAt;
      delete invoiceToUpdate.updatedAt;
      delete invoiceToUpdate.publicUrl;
      delete invoiceToUpdate.scheduledAt;
      delete invoiceToUpdate.location;
      if (invoiceToUpdate.paymentRequests) {
          invoiceToUpdate.paymentRequests.forEach((pr: any) => {
              delete pr.computedAmountMoney;
              delete pr.totalCompletedAmountMoney;
          });
      }

      // Update the invoice
      const { result: { invoice: finalInvoice } } = await invoicesApi.updateInvoice(input.invoiceId, {
        invoice: invoiceToUpdate,
        idempotencyKey: randomUUID(),
      });
      
      console.log("Successfully rebuilt invoice:", finalInvoice);

      return {
        invoiceId: finalInvoice!.id!,
        orderId: finalInvoice!.orderId,
        totalAmount: Number(finalInvoice!.paymentRequests?.[0].computedAmountMoney?.amount || 0) / 100,
        status: finalInvoice!.status!,
        invoiceUrl: finalInvoice!.publicUrl!,
      };

    } catch (error) {
      if (error instanceof ApiError) {
        console.error('Square API Error in rebuildInvoiceFlow:', JSON.stringify(error.result, null, 2));
        const errorMessage = error.result.errors?.[0]?.detail || JSON.stringify(error.result);
        throw new Error(`Square Error: ${errorMessage}`);
      } else {
        console.error('An unexpected error occurred during invoice rebuild:', error);
        if (error instanceof Error) {
            throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice rebuild.');
      }
    }
  }
);
