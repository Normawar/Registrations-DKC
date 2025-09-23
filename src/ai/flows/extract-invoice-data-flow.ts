
'use server';
/**
 * @fileOverview An AI flow to extract structured data from an invoice image/PDF
 * and create or update the corresponding player and invoice records in Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { doc, setDoc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getDb } from '@/lib/firebase-admin';
import { createInvoice } from './create-invoice-flow';
import { createPsjaSplitInvoice } from './create-psja-split-invoice-flow';
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
  isGtPlayer: z.boolean().optional().describe('Whether the player is part of the Gifted & Talented (GT) program. This is often indicated next to their name.'),
});

const ExtractedInvoiceSchema = z.object({
  invoiceNumber: z.string().optional().describe('The invoice number, if present on the document.'),
  sponsorName: z.string().describe('The name of the sponsor or person to be invoiced.'),
  sponsorEmail: z.string().email().describe("The sponsor's email address."),
  schoolName: z.string().describe('The name of the school or organization.'),
  district: z.string().describe('The school district.'),
  eventName: z.string().describe('The name of the tournament or event.'),
  eventDate: z.string().describe('The date of the event in YYYY-MM-DD format.'),
  players: z.array(PlayerSchema).describe('A list of all players and their fees from the invoice.'),
});

const MultiInvoiceSchema = z.object({
    invoices: z.array(ExtractedInvoiceSchema).describe("An array of all invoices found in the document. If there's only one invoice, return it as a single-element array."),
});


const ExtractInvoiceDataOutputSchema = z.object({
  success: z.boolean(),
  processedInvoices: z.array(z.object({
    invoiceId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    action: z.enum(['created', 'updated', 'error']),
    playersAdded: z.number().optional(),
    error: z.string().optional(),
  })),
});
export type ExtractInvoiceDataOutput = z.infer<
  typeof ExtractInvoiceDataOutputSchema
>;

const extractPrompt = ai.definePrompt({
  name: 'extractInvoicePrompt',
  input: { schema: ExtractInvoiceDataInputSchema },
  output: { schema: MultiInvoiceSchema },
  prompt: `
    You are an expert data entry assistant for a chess tournament organization.
    Your task is to analyze the provided invoice document (image or PDF) and extract the key information for ALL invoices present in the document.
    Return all extracted invoices in a structured JSON array.

    Document: {{media url=fileDataUri}}

    For each invoice found, pay close attention to the following fields:
    - The invoice number (if present).
    - The name of the person or sponsor who should be invoiced.
    - Their email address.
    - The school and district they represent.
    - The name and date of the event.
    - A list of all players, including their full name, USCF ID (if present), and the fee associated with them.
    - **Crucially, identify if a player is part of the "GT" (Gifted & Talented) program and set the isGtPlayer flag to true.** This is often noted next to the player's name. If not specified as GT, they are considered "Independent".

    Return ONLY the structured JSON object containing an array of invoices. Do not include any explanatory text.
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
    const db = getDb();

    try {
      const { output } = await extractPrompt(input);
      if (!output || !output.invoices || output.invoices.length === 0) {
        throw new Error('AI failed to extract any invoice data from the document.');
      }
      
      const processedInvoices: z.infer<typeof ExtractInvoiceDataOutputSchema>['processedInvoices'] = [];
      const uscfFee = 24;

      for (const extracted of output.invoices) {
          try {
              let existingInvoice: any = null;
              if (extracted.invoiceNumber) {
                const q = query(collection(db, 'invoices'), where('invoiceNumber', '==', extracted.invoiceNumber), limit(1));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                  existingInvoice = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
                }
              }
              
              const playersToInvoice = [];
              const selections: Record<string, any> = {};

              for (const player of extracted.players) {
                const [firstName, ...lastNameParts] = player.playerName.split(' ');
                const lastName = lastNameParts.join(' ') || 'Unknown';
                
                const baseRegistrationFee = player.fee > uscfFee ? player.fee - uscfFee : player.fee;
                const uscfAction = player.fee > baseRegistrationFee;

                const newPlayerId = player.uscfId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                
                const newPlayerData: MasterPlayer = {
                    id: newPlayerId,
                    uscfId: player.uscfId || 'NEW',
                    firstName: firstName,
                    lastName: lastName,
                    school: extracted.schoolName,
                    district: extracted.district,
                    studentType: player.isGtPlayer ? 'gt' : 'independent',
                    email: '', grade: '', section: '', events: 1,
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
                    isGtPlayer: player.isGtPlayer,
                });

                selections[newPlayerId] = {
                    section: '',
                    status: 'active',
                    uscfStatus: uscfAction ? 'new' : 'current'
                };
              }

              const teamCode = generateTeamCode({ schoolName: extracted.schoolName, district: extracted.district });
              
              let invoiceResult;
              let action: 'created' | 'updated' = 'created';

              if (existingInvoice) {
                action = 'updated';
                // Note: Logic for updating complex invoices (like PSJA split) would be more involved.
                // This simplified update assumes a standard invoice structure.
                const totalInvoiced = playersToInvoice.reduce((acc, p) => acc + p.baseRegistrationFee + (p.lateFee || 0) + (p.uscfAction ? uscfFee : 0), 0);
                const updatedInvoiceData = {
                  ...existingInvoice, sponsorName: extracted.sponsorName, sponsorEmail: extracted.sponsorEmail,
                  schoolName: extracted.schoolName, district: extracted.district, teamCode: teamCode,
                  eventName: extracted.eventName, eventDate: extracted.eventDate, selections: selections,
                  totalInvoiced: totalInvoiced, updatedAt: new Date().toISOString(),
                };
                const invoiceRef = doc(db, 'invoices', existingInvoice.id);
                await setDoc(invoiceRef, updatedInvoiceData, { merge: true });

                invoiceResult = {
                  invoiceId: existingInvoice.id,
                  invoiceNumber: existingInvoice.invoiceNumber,
                  status: existingInvoice.status || 'DRAFT',
                };

              } else {
                  action = 'created';
                  const isPsjaSplit = extracted.district === 'PHARR-SAN JUAN-ALAMO ISD' && playersToInvoice.some(p => p.isGtPlayer) && playersToInvoice.some(p => !p.isGtPlayer);
                  
                  if (isPsjaSplit) {
                      const splitResult = await createPsjaSplitInvoice({
                          ...extracted,
                          sponsorEmail: extracted.sponsorEmail || '',
                          teamCode,
                          uscfFee,
                          players: playersToInvoice
                      });
                      // For simplicity, we'll just report the first invoice created
                      invoiceResult = splitResult.gtInvoice || splitResult.independentInvoice;
                  } else {
                      invoiceResult = await createInvoice({
                          invoiceNumber: extracted.invoiceNumber,
                          ...extracted,
                          sponsorEmail: extracted.sponsorEmail || '',
                          teamCode,
                          uscfFee,
                          players: playersToInvoice
                      });
                  }
              }

              processedInvoices.push({
                invoiceId: invoiceResult?.invoiceId,
                invoiceNumber: invoiceResult?.invoiceNumber,
                playersAdded: playersToInvoice.length,
                action: action,
              });

          } catch(innerError) {
              const errorMessage = innerError instanceof Error ? innerError.message : 'An unknown error occurred during invoice processing.';
              processedInvoices.push({
                invoiceNumber: extracted.invoiceNumber || 'Unknown',
                action: 'error',
                error: errorMessage,
              });
          }
      }

      return { success: true, processedInvoices };

    } catch (error) {
      console.error('Error in extractInvoiceDataFlow:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during processing.';
      return { success: false, processedInvoices: [{ action: 'error', error: errorMessage }]};
    }
  }
);
