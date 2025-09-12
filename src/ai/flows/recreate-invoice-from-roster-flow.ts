
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
  uscfId: z.string().optional().describe('The USCF ID of the player.'),
  baseRegistrationFee: z.number().describe('The base registration fee for the event.'),
  lateFee: z.union([z.number(), z.null()]).describe('The late fee applied, if any.'),
  uscfAction: z.boolean().describe('Whether a USCF membership action (new/renew) is needed.'),
  isGtPlayer: z.boolean().optional().describe('Whether the player is in the Gifted & Talented program.'),
  isNew: z.boolean().optional().describe('Whether this is a new player added to the invoice.'),
  isSubstitution: z.boolean().optional().describe('Whether this player is a substitution for another.'),
  waiveLateFee: z.boolean().optional().describe('Organizer-only flag to waive the late fee.'),
  lateFeeOverride: z.number().optional().describe('Organizer override for late fee amount.'),
  registrationDate: z.string().optional().describe('ISO string of when the player was registered.'),
  section: z.string().optional(),
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
    revisionNumber: z.number().optional().describe('The revision number for this invoice'),
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
  async (input: any) => { 
    console.log('🔧 Starting recreation flow with manual validation...');

    if (input.requestingUserRole !== 'organizer') {
      throw new Error('Only organizers can recreate invoices.');
    }

    if (!input.players || !Array.isArray(input.players)) {
      throw new Error('No players array found');
    }

    const transformedInput = {
      ...input,
      players: input.players.map((player: any, index: number) => ({
        playerName: (!player.playerName || player.playerName === 'undefined undefined') 
          ? `Student_${index + 1}`
          : String(player.playerName),
        uscfId: String(player.uscfId || "NEW"),
        baseRegistrationFee: Number(player.baseRegistrationFee || 20),
        lateFee: 0, 
        uscfAction: Boolean(player.uscfAction),
        isGtPlayer: Boolean(player.isGtPlayer),
        isNew: Boolean(player.isNew),
        isSubstitution: Boolean(player.isSubstitution),
        waiveLateFee: Boolean(player.waiveLateFee),
        lateFeeOverride: player.lateFeeOverride ? Number(player.lateFeeOverride) : undefined,
        registrationDate: String(player.registrationDate || new Date().toISOString()),
        section: player.section || 'High School K-12', // Ensure section has a default
      })),
    };

    const SUBSTITUTION_FEE = 2.0;
    let totalSubstitutionFee = 0;
    const eventConfig = transformedInput.eventConfig || { eventDate: transformedInput.eventDate };

    const sanitizedPlayers = transformedInput.players.map((p: any) => {
      let lateFee = 0;
      if (!p.waiveLateFee) {
        if (typeof p.lateFeeOverride === 'number') {
          lateFee = p.lateFeeOverride;
        } else {
          lateFee = calculateLateFee(p, eventConfig);
        }
      }
      if (p.isSubstitution) {
        totalSubstitutionFee += SUBSTITUTION_FEE;
        return { ...p, lateFee: 0 };
      }
      return { ...p, lateFee };
    });

    const sanitizedInput = {
      ...transformedInput,
      players: sanitizedPlayers,
      eventName: transformedInput.eventName.replace(/\(PSJA students only\)/i, '').trim(),
    };

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
      const { result: { invoice: originalInvoice } } = await squareClient.invoicesApi.getInvoice(sanitizedInput.originalInvoiceId);
      if (!originalInvoice) throw new Error(`Could not find original invoice with ID: ${sanitizedInput.originalInvoiceId}`);

      await cancelInvoice({ invoiceId: sanitizedInput.originalInvoiceId, requestingUserRole: 'organizer' });
      
      const revisionSuffix = `-rev.${input.revisionNumber || 2}`;
      const baseInvoiceNumber = originalInvoice.invoiceNumber?.split('-rev.')[0];
      const newInvoiceNumber = baseInvoiceNumber ? `${baseInvoiceNumber}${revisionSuffix}` : undefined;

      const newInvoiceResult = await createInvoice({
        ...sanitizedInput,
        players: sanitizedPlayers,
        substitutionFee: totalSubstitutionFee > 0 ? totalSubstitutionFee : undefined,
        invoiceNumber: newInvoiceNumber,
        description: sanitizedInput.revisionMessage || `Revised on ${format(new Date(), 'PPP')}. This invoice replaces #${originalInvoice.invoiceNumber}.`,
      });

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
        const errors = Array.isArray(error.result?.errors) ? error.result.errors : [];
        const errorMessage = errors.map((e: any) => `[${e.category}/${e.code}]: ${e.detail}`).join(', ');
        throw new Error(`Square Error: ${errorMessage}`);
      } else if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during invoice recreation.');
    }
  }
);
