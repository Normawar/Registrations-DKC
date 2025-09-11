
'use server';
/**
 * @fileOverview Creates a new Square invoice to replace an old one.
 * This flow correctly handles updating an event registration invoice by first canceling
 * the original invoice, then creating a brand new one with the updated roster.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError } from 'square';
import { getSquareClient } from '@/lib/square-client';
import { checkSquareConfig } from '@/lib/actions/check-config';
import { createInvoice } from './create-invoice-flow';
import { cancelInvoice } from './cancel-invoice-flow';
import { format } from 'date-fns';

const PlayerToInvoiceSchema = z.object({
  playerName: z.string().describe('The full name of the player.'),
  uscfId: z.string().describe('The USCF ID of the player.'),
  baseRegistrationFee: z.number().describe('The base registration fee for the event.'),
  lateFee: z.number().describe('The late fee applied, if any.'),
  uscfAction: z.boolean().describe('Whether a USCF membership action (new/renew) is needed.'),
  isGtPlayer: z.boolean().optional().describe('Whether the player is in the Gifted & Talented program.'),
  isNew: z.boolean().optional().describe('Whether this is a new player added to the invoice.'),
  isSubstitution: z.boolean().optional().describe('Whether this player is a substitution for another.'),
});

const RecreateInvoiceInputSchema = z.object({
    originalInvoiceId: z.string().describe('The ID of the invoice to cancel and replace.'),
    players: z.array(PlayerToInvoiceSchema).describe('The complete list of players who should be on the new invoice.'),
    uscfFee: z.number().describe('The fee for a new or renewing USCF membership.'),
    sponsorName: z.string().describe('The name of the sponsor to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the sponsor.'),
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string().describe('The name of the school associated with the sponsor.'),
    schoolAddress: z.string().optional().describe('The address of the school.'),
    schoolPhone: z.string().optional().describe('The phone number of the school.'),
    district: z.string().optional().describe('The school district.'),
    teamCode: z.string().describe('The team code of the sponsor.'),
    eventName: z.string().describe('The name of the event.'),
    eventDate: z.string().describe('The date of the event in ISO 8601 format.'),
    requestingUserRole: z.string().describe('Role of user requesting the recreation'),
    revisionMessage: z.string().optional().describe('Message explaining why invoice was recreated'),
});
export type RecreateInvoiceInput = z.infer<typeof RecreateInvoiceInputSchema>;

const RecreateInvoiceOutputSchema = z.object({
  oldInvoiceId: z.string(),
  newInvoiceId: z.string(),
  newInvoiceNumber: z.string().optional(),
  newTotalAmount: z.number(),
  newStatus: z.string(),
  newInvoiceUrl: z.string().url(),
});
export type RecreateInvoiceOutput = z.infer<typeof RecreateInvoiceOutputSchema>;

export async function recreateInvoiceFromRoster(input: RecreateInvoiceInput): Promise<RecreateInvoiceOutput> {
  return recreateInvoiceFlow(input);
}

const recreateInvoiceFlow = ai.defineFlow(
  {
    name: 'recreateInvoiceFlow',
    inputSchema: RecreateInvoiceInputSchema,
    outputSchema: RecreateInvoiceOutputSchema,
  },
  async (input) => {
    if (input.requestingUserRole !== 'organizer') {
        throw new Error('Only organizers can recreate invoices.');
    }
    
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
      console.log(`Square not configured. Mock-recreating invoice based on ${input.originalInvoiceId}.`);
      return {
        oldInvoiceId: input.originalInvoiceId,
        newInvoiceId: `MOCK_RECREATED_${randomUUID()}`,
        newInvoiceNumber: 'MOCK-rev.2',
        newTotalAmount: 0,
        newStatus: 'DRAFT',
        newInvoiceUrl: `/#mock-invoice/new`,
      };
    }
    const squareClient = await getSquareClient();

    try {
      // Step 1: Get original invoice to fetch its number
      console.log(`Fetching original invoice: ${input.originalInvoiceId}`);
      const { result: { invoice: originalInvoice } } = await squareClient.invoicesApi.getInvoice(input.originalInvoiceId);
      
      if (!originalInvoice) {
        throw new Error(`Could not find original invoice with ID: ${input.originalInvoiceId}`);
      }

      // Step 2: Cancel the original invoice.
      console.log(`Canceling original invoice: ${input.originalInvoiceId}`);
      await cancelInvoice({ invoiceId: input.originalInvoiceId, requestingUserRole: 'organizer' });
      console.log(`Successfully canceled original invoice: ${input.originalInvoiceId}`);

      // Step 3: Use the original invoice number for the new invoice.
      const newInvoiceNumber = originalInvoice.invoiceNumber || undefined;
      console.log(`Using original invoice number for new invoice: ${newInvoiceNumber}`);
      
      // Step 4: Intelligent Fee Calculation
      const SUBSTITUTION_FEE = 2.00;
      let totalSubstitutionFee = 0;

      const playersWithAdjustedFees = input.players.map(player => {
        if (player.isSubstitution) {
          totalSubstitutionFee += SUBSTITUTION_FEE;
          return { ...player, lateFee: 0 }; // Substitutions don't get late fees
        }
        // For existing players (not new, not substitutions), keep their original late fee.
        // For new players, keep the late fee calculated on the client side.
        // Ensure lateFee is a number, defaulting to 0 if null/undefined.
        return { ...player, lateFee: player.lateFee ?? 0 };
      });
      
      // Step 5: Create a new invoice with the updated roster and new invoice number.
      console.log(`Creating new invoice with ${input.players.length} players.`);
      
      const newInvoiceResult = await createInvoice({
          ...input,
          players: playersWithAdjustedFees,
          substitutionFee: totalSubstitutionFee > 0 ? totalSubstitutionFee : undefined,
          invoiceNumber: newInvoiceNumber,
          description: input.revisionMessage || `Revised on ${format(new Date(), 'PPP')}. This invoice replaces #${originalInvoice.invoiceNumber}.`
      });

      console.log("Successfully created new invoice:", newInvoiceResult);

      let newTotal = 0;
      if (newInvoiceResult.invoiceId) {
          const { result: { invoice } } = await squareClient.invoicesApi.getInvoice(newInvoiceResult.invoiceId);
          const computedAmount = invoice?.paymentRequests?.[0]?.computedAmountMoney?.amount;
          newTotal = computedAmount ? Number(computedAmount) / 100 : 0;
      }
      
      return {
        oldInvoiceId: input.originalInvoiceId,
        newInvoiceId: newInvoiceResult.invoiceId,
        newInvoiceNumber: newInvoiceResult.invoiceNumber,
        newStatus: newInvoiceResult.status,
        newInvoiceUrl: newInvoiceResult.invoiceUrl,
        newTotalAmount: newTotal,
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
