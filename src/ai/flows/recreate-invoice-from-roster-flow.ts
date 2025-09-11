
'use server';
/**
 * @fileOverview Creates a new Square invoice to replace an old one.
 * This flow correctly handles updating an event registration invoice by first canceling
 * the original invoice, then creating a brand new one with the updated roster.
 * It includes dynamic late fee calculation and data sanitization.
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

// --- New, more robust types and logic for late fee calculation ---

const PlayerToInvoiceSchema = z.object({
  playerName: z.string().describe('The full name of the player.'),
  uscfId: z.string().describe('The USCF ID of the player.'),
  baseRegistrationFee: z.number().describe('The base registration fee for the event.'),
  lateFee: z.number().describe('The late fee applied, if any.'),
  uscfAction: z.boolean().describe('Whether a USCF membership action (new/renew) is needed.'),
  isGtPlayer: z.boolean().optional().describe('Whether the player is in the Gifted & Talented program.'),
  isNew: z.boolean().optional().describe('Whether this is a new player added to the invoice.'),
  isSubstitution: z.boolean().optional().describe('Whether this player is a substitution for another.'),
  waiveLateFee: z.boolean().optional().describe('Organizer-only flag to waive the late fee.'),
  registrationDate: z.string().optional().describe('ISO string of when the player was registered.'),
});

const EventConfigSchema = z.object({
  eventDate: z.string(),
  earlyDeadlineDays: z.number().optional(),
  standardLateFee: z.number().optional(),
  gtLateFee: z.number().optional(),
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
    eventConfig: EventConfigSchema.optional(),
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

function calculateLateFee(player: z.infer<typeof PlayerToInvoiceSchema>, config: z.infer<typeof EventConfigSchema>): number {
  const today = player.registrationDate ? new Date(player.registrationDate) : new Date();
  const event = new Date(config.eventDate);

  const earlyDeadline = new Date(event);
  const earlyDays = config.earlyDeadlineDays ?? 14;
  earlyDeadline.setDate(event.getDate() - earlyDays);

  if (today <= earlyDeadline) return 0;

  const standardLateFee = config.standardLateFee ?? 5;
  const gtLateFee = config.gtLateFee ?? 3;

  return player.isGtPlayer ? gtLateFee : standardLateFee;
}

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
    
    // --- Data Sanitization and Fee Calculation ---
    const SUBSTITUTION_FEE = 2.0;
    let totalSubstitutionFee = 0;
    
    const eventConfig = input.eventConfig ?? { eventDate: input.eventDate };

    const sanitizedPlayers = input.players
      .filter(p => p.playerName && p.playerName !== "undefined undefined")
      .map(p => {
        let lateFee = typeof p.lateFee === "number" ? p.lateFee : calculateLateFee(p, eventConfig);
        
        if (input.requestingUserRole === "organizer" && p.waiveLateFee) {
          lateFee = 0;
        }

        if (p.isSubstitution) {
          totalSubstitutionFee += SUBSTITUTION_FEE;
          return { ...p, lateFee: 0 };
        }
        
        return { ...p, lateFee };
      });

    const sanitizedInput = {
      ...input,
      players: sanitizedPlayers,
    };

    // --- Mocking for Unconfigured Environments ---
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
      console.log(`Square not configured. Mock-recreating invoice based on ${sanitizedInput.originalInvoiceId}.`);
      return {
        oldInvoiceId: sanitizedInput.originalInvoiceId,
        newInvoiceId: `MOCK_RECREATED_${randomUUID()}`,
        newInvoiceNumber: 'MOCK-rev.2',
        newTotalAmount: 0,
        newStatus: 'DRAFT',
        newInvoiceUrl: `/#mock-invoice/new`,
      };
    }

    const squareClient = await getSquareClient();

    try {
      // Step 1: Get original invoice
      console.log(`Fetching original invoice: ${sanitizedInput.originalInvoiceId}`);
      const { result: { invoice: originalInvoice } } = await squareClient.invoicesApi.getInvoice(sanitizedInput.originalInvoiceId);

      if (!originalInvoice) {
        throw new Error(`Could not find original invoice with ID: ${sanitizedInput.originalInvoiceId}`);
      }

      // Step 2: Cancel the original invoice
      console.log(`Canceling original invoice: ${sanitizedInput.originalInvoiceId}`);
      await cancelInvoice({ invoiceId: sanitizedInput.originalInvoiceId, requestingUserRole: 'organizer' });
      console.log(`Successfully canceled original invoice: ${sanitizedInput.originalInvoiceId}`);

      // Step 3: Use original invoice number
      const newInvoiceNumber = originalInvoice.invoiceNumber || undefined;
      console.log(`Using original invoice number for new invoice: ${newInvoiceNumber}`);

      // Step 4: Create new invoice
      console.log(`Creating new invoice with ${sanitizedPlayers.length} players.`);
      const newInvoiceResult = await createInvoice({
        ...sanitizedInput,
        players: sanitizedPlayers,
        substitutionFee: totalSubstitutionFee > 0 ? totalSubstitutionFee : undefined,
        invoiceNumber: newInvoiceNumber,
        description:
          sanitizedInput.revisionMessage || `Revised on ${format(new Date(), 'PPP')}. This invoice replaces #${originalInvoice.invoiceNumber}.`,
      });

      console.log('Successfully created new invoice:', newInvoiceResult);

      // Step 5: Compute total amount
      let newTotal = 0;
      if (newInvoiceResult.invoiceId) {
        const { result: { invoice } } = await squareClient.invoicesApi.getInvoice(newInvoiceResult.invoiceId);
        const computedAmount = invoice?.paymentRequests?.[0]?.computedAmountMoney?.amount;
        newTotal = computedAmount ? Number(computedAmount) / 100 : 0;
      }

      return {
        oldInvoiceId: sanitizedInput.originalInvoiceId,
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
        console.error('Unexpected error during invoice recreation:', error);
        if (error instanceof Error) {
          throw new Error(`${error.message}`);
        }
        throw new Error('An unexpected error occurred during invoice recreation.');
      }
    }
  }
);
