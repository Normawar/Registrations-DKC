
'use server';
/**
 * @fileOverview Orchestrates the creation of two separate invoices for PSJA district registrations.
 * One invoice is for GT (Gifted & Talented) players, sent to the GT Coordinator.
 * The other is for Independent/Regular players, sent to the Bookkeeper.
 */

import { z } from 'genkit';
import { createInvoice, type CreateInvoiceInput, type CreateInvoiceOutput } from './create-invoice-flow';

const PlayerToInvoiceSchema = z.object({
  playerName: z.string(),
  uscfId: z.string(),
  baseRegistrationFee: z.number(),
  lateFee: z.number().nullable(),
  uscfAction: z.boolean(),
  isGtPlayer: z.boolean().optional(),
  section: z.string().optional(),
  waiveLateFee: z.boolean().optional(), // Added field
});

export const CreatePsjaSplitInvoiceInputSchema = z.object({
  sponsorName: z.string(),
  sponsorEmail: z.string().email(),
  bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
  gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
  schoolName: z.string(),
  schoolAddress: z.string().optional(),
  schoolPhone: z.string().optional(),
  district: z.literal('PHARR-SAN JUAN-ALAMO ISD'),
  teamCode: z.string().optional(),
  eventName: z.string(),
  eventDate: z.string(),
  uscfFee: z.number(),
  players: z.array(PlayerToInvoiceSchema),
  originalInvoiceNumber: z.string().optional(),
  revisionNumber: z.number().optional().describe('Revision number for this invoice'),
  revisionMessage: z.string().optional().describe('Message explaining the revision'),
});
export type CreatePsjaSplitInvoiceInput = z.infer<typeof CreatePsjaSplitInvoiceInputSchema>;


export const CreatePsjaSplitInvoiceOutputSchema = z.object({
  gtInvoice: CreateInvoiceOutputSchema.optional(),
  independentInvoice: CreateInvoiceOutputSchema.optional(),
});
export type CreatePsjaSplitInvoiceOutput = z.infer<typeof CreatePsjaSplitInvoiceOutputSchema>;


export async function createPsjaSplitInvoice(
  input: CreatePsjaSplitInvoiceInput
): Promise<CreatePsjaSplitInvoiceOutput> {
    const gtPlayers = input.players.filter((p) => p.isGtPlayer);
    const independentPlayers = input.players.filter((p) => !p.isGtPlayer);

    // Filter for GT players who have a late fee that is NOT waived
    const gtLateFeePlayers = gtPlayers.filter(p => (p.lateFee || 0) > 0 && !p.waiveLateFee);
    
    let gtInvoice: CreatePsjaSplitInvoiceOutput['gtInvoice'] = undefined;
    let independentInvoice:
      | CreatePsjaSplitInvoiceOutput['independentInvoice'] = undefined;

    // Create GT Invoice (Registration fees only - NO late fees, NO USCF fees)
    if (gtPlayers.length > 0) {
      const gtPlayersForInvoice = gtPlayers.map((p) => ({
        ...p,
        lateFee: 0, // GT students never pay late fees on their invoice
        uscfAction: false, // GT students covered under district bulk USCF plan
        waiveLateFee: true, // Always waive late fee on the GT invoice itself
      }));

      gtInvoice = await createInvoice({
        sponsorName: input.sponsorName,
        sponsorEmail: input.gtCoordinatorEmail || input.sponsorEmail,
        sponsorPhone: input.sponsorPhone,
        bookkeeperEmail: input.gtCoordinatorEmail,
        schoolName: input.schoolName,
        schoolAddress: input.schoolAddress,
        schoolPhone: input.schoolPhone,
        district: input.district,
        teamCode: `${input.teamCode}-GT`,
        eventName: `${input.eventName} - GT`,
        eventDate: input.eventDate,
        uscfFee: input.uscfFee,
        players: gtPlayersForInvoice,
        description: `GT students only. USCF memberships covered under district bulk plan. Late fees billed separately to school.`,
      });
    }

    // Create Independent Invoice (includes its own late fees + ALL applicable GT late fees)
    if (independentPlayers.length > 0 || gtLateFeePlayers.length > 0) {
      const independentPlayersForInvoice: CreateInvoiceInput['players'] = [
        ...independentPlayers.map(p => ({...p, lateFee: p.lateFee ?? 0}))
      ];
      
      // Add GT late fees to Independent invoice as if they were for independent players
      gtLateFeePlayers.forEach(p => {
        independentPlayersForInvoice.push({
          playerName: `${p.playerName} (GT Late Fee)`,
          uscfId: p.uscfId,
          baseRegistrationFee: 0, // No registration fee, just the late fee
          lateFee: p.lateFee || 0, // Apply the late fee
          uscfAction: false,
          isGtPlayer: false, // Important: Treat as non-GT for billing purposes
          section: p.section,
          waiveLateFee: false, // Ensure late fee is applied on this invoice
        });
      });


      independentInvoice = await createInvoice({
        sponsorName: input.sponsorName,
        sponsorEmail: input.sponsorEmail,
        sponsorPhone: input.sponsorPhone,
        bookkeeperEmail: input.bookkeeperEmail,
        schoolName: input.schoolName,
        schoolAddress: input.schoolAddress,
        schoolPhone: input.schoolPhone,
        district: input.district,
        teamCode: `${input.teamCode}-IND`,
        eventName: `${input.eventName} - Independent & All Late Fees`,
        eventDate: input.eventDate,
        uscfFee: input.uscfFee,
        players: independentPlayersForInvoice,
        description: gtLateFeePlayers.length > 0 
          ? `Invoice for independent students and all applicable late fees (including for ${gtLateFeePlayers.length} GT program students).`
          : `Invoice for independent students only.`,
      });
    }

    return {
      gtInvoice,
      independentInvoice,
    };
}
