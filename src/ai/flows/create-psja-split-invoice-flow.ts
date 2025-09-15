
'use server';
/**
 * @fileOverview Orchestrates the creation of two separate invoices for PSJA district registrations.
 * One invoice is for GT (Gifted & Talented) players, sent to the GT Coordinator.
 * The other is for Independent/Regular players, sent to the Bookkeeper.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { createInvoice, type CreateInvoiceInput } from './create-invoice-flow';

const PlayerToInvoiceSchema = z.object({
  playerName: z.string(),
  uscfId: z.string(),
  baseRegistrationFee: z.number(),
  lateFee: z.number().nullable(),
  uscfAction: z.boolean(),
  isGtPlayer: z.boolean().optional(),
});

export type CreatePsjaSplitInvoiceInput = z.infer<typeof CreatePsjaSplitInvoiceInputSchema>;
const CreatePsjaSplitInvoiceInputSchema = z.object({
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

const CreateInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  invoiceNumber: z.string().optional().describe('The user-facing invoice number.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});

export type CreatePsjaSplitInvoiceOutput = z.infer<typeof CreatePsjaSplitInvoiceOutputSchema>;
const CreatePsjaSplitInvoiceOutputSchema = z.object({
  gtInvoice: CreateInvoiceOutputSchema.optional(),
  independentInvoice: CreateInvoiceOutputSchema.optional(),
});

export async function createPsjaSplitInvoice(input: CreatePsjaSplitInvoiceInput): Promise<CreatePsjaSplitInvoiceOutput> {
  return createPsjaSplitInvoiceFlow(input);
}

const createPsjaSplitInvoiceFlow = ai.defineFlow(
  {
    name: 'createPsjaSplitInvoiceFlow',
    inputSchema: CreatePsjaSplitInvoiceInputSchema,
    outputSchema: CreatePsjaSplitInvoiceOutputSchema,
  },
  async (input) => {
    const gtPlayers = input.players.filter(p => p.isGtPlayer);
    const independentPlayers = input.players.filter(p => !p.isGtPlayer);

    const output: CreatePsjaSplitInvoiceOutput = {};

    const revisionSuffix = input.revisionNumber ? `-rev.${input.revisionNumber}` : '';
    const baseInvoiceNumber = input.originalInvoiceNumber?.split('-rev.')[0];
    
    const gtInvoiceNumber = baseInvoiceNumber
        ? `${baseInvoiceNumber}-GT${revisionSuffix}`
        : undefined;
    const indInvoiceNumber = baseInvoiceNumber
        ? `${baseInvoiceNumber}-IND${revisionSuffix}`
        : undefined;
    
    // 1. Create invoice for GT players if any exist
    if (gtPlayers.length > 0) {
      console.log(`Creating GT invoice for ${gtPlayers.length} players.`);
      
      const gtInvoiceInput: CreateInvoiceInput = {
        ...input,
        players: gtPlayers.map(p => ({ ...p, lateFee: p.lateFee ?? 0 })), // Ensure lateFee is not null
        // Send to GT coordinator, not bookkeeper
        gtCoordinatorEmail: input.gtCoordinatorEmail,
        bookkeeperEmail: '', // Ensure bookkeeper is not CC'd on the GT invoice
        invoiceNumber: gtInvoiceNumber,
        revisionMessage: input.revisionMessage,
        teamCode: input.teamCode, // Ensure teamCode is passed
      };
      output.gtInvoice = await createInvoice(gtInvoiceInput);
      console.log(`GT Invoice created:`, output.gtInvoice);
    }

    // 2. Create invoice for Independent players if any exist
    if (independentPlayers.length > 0) {
      console.log(`Creating Independent invoice for ${independentPlayers.length} players.`);
      
      const independentInvoiceInput: CreateInvoiceInput = {
        ...input,
        players: independentPlayers.map(p => ({ ...p, lateFee: p.lateFee ?? 0 })), // Ensure lateFee is not null
        // Send to bookkeeper, not GT coordinator
        bookkeeperEmail: input.bookkeeperEmail,
        gtCoordinatorEmail: '', // Ensure GT coordinator is not CC'd on the independent invoice
        invoiceNumber: indInvoiceNumber,
        revisionMessage: input.revisionMessage,
        teamCode: input.teamCode, // Ensure teamCode is passed
      };
      output.independentInvoice = await createInvoice(independentInvoiceInput);
      console.log(`Independent Invoice created:`, output.independentInvoice);
    }

    return output;
  }
);

    