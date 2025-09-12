
'use server';
/**
 * @fileOverview An AI flow to extract structured data from an invoice image/PDF
 * and create the corresponding player and invoice records in Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { createInvoice } from './create-invoice-flow';
import { generateTeamCode } from '@/lib/school-utils';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';

const ExtractInvoiceDataInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "An image or PDF file of an invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceDataInput = z.infer<
  typeof ExtractInvoiceDataInputSchema
>;

const PlayerSchema = z.object({
  playerName: z.string().describe('The full name of the player.'),
  uscfId: z.string().optional().describe('The USCF ID of the player, if available.'),
  fee: z.number().describe('The total fee listed for this player on the invoice.'),
});

const ExtractedInvoiceSchema = z.object({
  sponsorName: z.string().describe('The name of the sponsor or person to be invoiced.'),
  sponsorEmail: z.string().email().describe("The sponsor's email address."),
  schoolName: z.string().describe('The name of the school or organization.'),
  district: z.string().describe('The school district.'),
  eventName: z.string().describe('The name of the tournament or event.'),
  eventDate: z.string().describe('The date of the event in YYYY-MM-DD format.'),
  players: z.array(PlayerSchema).describe('A list of players and their fees from the invoice.'),
});

const ExtractInvoiceDataOutputSchema = z.object({
  success: z.boolean(),
  invoiceId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  playersAdded: z.number().optional(),
  error: z.string().optional(),
});
export type ExtractInvoiceDataOutput = z.infer<
  typeof ExtractInvoiceDataOutputSchema
>;

const extractPrompt = ai.definePrompt({
  name: 'extractInvoicePrompt',
  input: { schema: ExtractInvoiceDataInputSchema },
  output: { schema: ExtractedInvoiceSchema },
  prompt: `
    You are an expert data entry assistant for a chess tournament organization.
    Your task is to analyze the provided invoice document (image or PDF) and extract the key information in a structured JSON format.

    Document: {{media url=fileDataUri}}

    Pay close attention to the following fields:
    - The name of the person or sponsor who should be invoiced.
    - Their email address.
    - The school and district they represent.
    - The name and date of the event.
    - A list of all players, including their full name, USCF ID (if present), and the fee associated with them.

    Return ONLY the structured JSON object. Do not include any explanatory text.
  `,
});


export async function extractInvoiceData(
  input: ExtractInvoiceDataInput
): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const extractInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async (input) => {
    if (!db) {
      throw new Error('Firestore database is not initialized.');
    }

    try {
      // Step 1: Use AI to extract data from the document
      const { output } = await extractPrompt(input);
      if (!output) {
        throw new Error('AI failed to extract any data from the document.');
      }
      
      const extracted = output;

      // Step 2: Create new player records in Firestore for players who don't exist
      const playersToInvoice = [];
      const uscfFee = 24;

      for (const player of extracted.players) {
        const [firstName, ...lastNameParts] = player.playerName.split(' ');
        const lastName = lastNameParts.join(' ') || 'Unknown';
        
        // Assume a base registration fee and calculate if USCF fee was included
        const baseRegistrationFee = player.fee > uscfFee ? player.fee - uscfFee : player.fee;
        const uscfAction = player.fee > baseRegistrationFee;

        // A real implementation would search for existing players first
        // For this tool, we will create new players to ensure data integrity from the invoice
        const newPlayerId = player.uscfId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        const newPlayerData: MasterPlayer = {
            id: newPlayerId,
            uscfId: player.uscfId || 'NEW',
            firstName: firstName,
            lastName: lastName,
            school: extracted.schoolName,
            district: extracted.district,
            email: '', 
            grade: '', 
            section: '', 
            events: 1,
            eventIds: [extracted.eventName],
            createdAt: new Date().toISOString(),
        };

        const playerRef = doc(db, 'players', newPlayerId);
        await setDoc(playerRef, newPlayerData, { merge: true });

        playersToInvoice.push({
            playerName: player.playerName,
            uscfId: newPlayerData.uscfId,
            baseRegistrationFee: baseRegistrationFee,
            lateFee: 0,
            uscfAction: uscfAction,
        });
      }

      // Step 3: Create the invoice using the existing createInvoice flow
      const teamCode = generateTeamCode({ schoolName: extracted.schoolName, district: extracted.district });
      
      const invoiceResult = await createInvoice({
          sponsorName: extracted.sponsorName,
          sponsorEmail: extracted.sponsorEmail,
          schoolName: extracted.schoolName,
          district: extracted.district,
          teamCode: teamCode,
          eventName: extracted.eventName,
          eventDate: extracted.eventDate,
          uscfFee: uscfFee,
          players: playersToInvoice,
      });

      // Step 4: Return a success response
      return {
        success: true,
        invoiceId: invoiceResult.invoiceId,
        invoiceNumber: invoiceResult.invoiceNumber,
        playersAdded: playersToInvoice.length,
      };

    } catch (error) {
      console.error('Error in extractInvoiceDataFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during processing.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
);
