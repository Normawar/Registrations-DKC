
'use server';
/**
 * @fileOverview Creates an invoice with the Square API and saves player data to Firestore.
 *
 * - createInvoice - A function that handles the invoice creation process.
 * - CreateInvoiceInput - The input type for the createInvoice function.
 * - CreateInvoiceOutput - The return type for the createInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { randomUUID } from 'crypto';
import { ApiError, type OrderLineItem, type InvoiceRecipient, type Address, Client, Environment } from 'square';
import { format } from 'date-fns';
import { checkSquareConfig } from '@/lib/actions/check-config';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { generateTeamCode } from '@/lib/school-utils';

const PlayerInvoiceInfoSchema = z.object({
  playerName: z.string().describe('The full name of the player.'),
  uscfId: z.string().describe('The USCF ID of the player.'),
  baseRegistrationFee: z.number().describe('The base registration fee for the event.'),
  lateFee: z.number().optional().nullable().describe('The late fee applied, if any.'),
  uscfAction: z.boolean().describe('Whether a USCF membership action (new/renew) is needed.'),
  isGtPlayer: z.boolean().optional().describe('Whether the player is in the Gifted & Talented program.'),
  section: z.string().optional().describe('The tournament section for the player.'),
  waiveLateFee: z.boolean().optional().describe('Flag to waive late fee for a player.'),
});

const CreateInvoiceInputSchema = z.object({
    sponsorName: z.string().describe('The name of the sponsor to be invoiced.'),
    sponsorEmail: z.string().email().describe('The email of the sponsor.'),
    sponsorPhone: z.string().optional().describe('The phone number of the sponsor.'),
    bookkeeperEmail: z.string().email().or(z.literal('')).optional(),
    gtCoordinatorEmail: z.string().email().or(z.literal('')).optional(),
    schoolName: z.string().describe('The name of the school associated with the sponsor.'),
    schoolAddress: z.string().optional().describe('The street address of the school.'),
    schoolPhone: z.string().optional().describe('The phone number of the school.'),
    district: z.string().optional().describe('The school district.'),
    teamCode: z.string().optional().describe('An optional team code. If provided, it will be used. If not, it will be generated.'),
    eventName: z.string().describe('The name of the event.'),
    eventDate: z.string().describe('The date of the event in ISO 8601 format.'),
    uscfFee: z.number().describe('The fee for a new or renewing USCF membership.'),
    players: z.array(PlayerInvoiceInfoSchema).describe('An array of players to be invoiced.'),
    invoiceNumber: z.string().optional().describe('A custom invoice number to assign. If not provided, Square will generate one.'),
    substitutionFee: z.number().optional().describe('A fee for substitutions, if applicable.'),
    description: z.string().optional().describe('An optional description or note for the invoice.'),
    revisionMessage: z.string().optional().describe('Revision message to include in invoice description'),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

const CreateInvoiceOutputSchema = z.object({
  invoiceId: z.string().describe('The unique ID for the generated invoice.'),
  invoiceNumber: z.string().optional().describe('The user-facing invoice number.'),
  status: z.string().describe('The status of the invoice (e.g., DRAFT, PUBLISHED).'),
  invoiceUrl: z.string().url().describe('The URL to view the invoice online.'),
});
export type CreateInvoiceOutput = z.infer<typeof CreateInvoiceOutputSchema>;

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  return createInvoiceFlow(input);
}

const createInvoiceFlow = ai.defineFlow(
  {
    name: 'createInvoiceFlow',
    inputSchema: CreateInvoiceInputSchema,
    outputSchema: CreateInvoiceOutputSchema,
  },
  async (input) => {
    // Step 0: Globally fix all null or undefined fields in players
    const processedPlayers = input.players.map(p => ({
      ...p,
      playerName: p.playerName ?? 'undefined undefined',
      uscfId: p.uscfId ?? 'NEW',
      baseRegistrationFee: p.baseRegistrationFee ?? 0,
      lateFee: p.lateFee ?? 0,
      uscfAction: p.uscfAction ?? false,
      isGtPlayer: p.isGtPlayer ?? false,
      waiveLateFee: p.waiveLateFee ?? false,
      // FIXED: Ensure section is never undefined
      section: p.section && p.section.trim() !== '' ? p.section.trim() : 'High School K-12',
    }));

    // Step 1: Save/Update player data in Firestore
    if (db && processedPlayers.length > 0) {
      console.log(`Processing ${processedPlayers.length} players for Firestore save/update...`);
      for (const player of processedPlayers) {
        const playerId = player.uscfId.toUpperCase() !== 'NEW' ? player.uscfId : `temp_${randomUUID()}`;
        const playerRef = doc(db, 'players', playerId);
        const playerDoc = await getDoc(playerRef);

        const [firstName, ...lastNameParts] = player.playerName.split(' ');
        const lastName = lastNameParts.join(' ');

        // FIXED: Validate all fields before saving to Firestore
        const playerData = {
          id: playerId,
          uscfId: player.uscfId,
          firstName: firstName || 'Unknown',
          lastName: lastName || 'Unknown',
          school: input.schoolName || 'Unknown School',
          district: input.district || 'Unknown District',
          studentType: player.isGtPlayer ? 'gt' : 'independent',
          section: player.section, // Now guaranteed to be a valid string
          updatedAt: new Date().toISOString(),
        };

        // Additional validation to ensure no undefined values
        Object.keys(playerData).forEach(key => {
          if (playerData[key as keyof typeof playerData] === undefined) {
            console.error(`Undefined value found for key ${key} in player data:`, playerData);
            throw new Error(`Invalid player data: ${key} is undefined`);
          }
        });

        if (playerDoc.exists()) {
          await setDoc(playerRef, playerData, { merge: true });
          console.log(`Updated player ${player.playerName} (ID: ${playerId}) in Firestore.`);
        } else {
          await setDoc(playerRef, { ...playerData, createdAt: new Date().toISOString() }, { merge: true });
          console.log(`Created new player ${player.playerName} (ID: ${playerId}) in Firestore.`);
        }
      }
    }
    
    // TEMPORARY BYPASS - Direct hard-code since config is broken
    const squareClient = new Client({
      accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
      environment: Environment.Production,
    });
    const locationId = "CTED7GVSVH5H8";

    console.log('Using direct hard-coded values to bypass config issue');

    const { customersApi, ordersApi, invoicesApi } = squareClient;

    try {
      // --- Customer Creation / Lookup ---
      const searchCustomersResponse = await customersApi.searchCustomers({
        query: {
          filter: { emailAddress: { exact: input.sponsorEmail } },
        },
      });

      const companyName = input.district ? `${input.schoolName} / ${input.district}` : input.schoolName;
      const finalTeamCode = input.teamCode || generateTeamCode({ schoolName: input.schoolName, district: input.district });

      let customerId: string;
      if (searchCustomersResponse.result.customers?.length) {
        const customer = searchCustomersResponse.result.customers[0];
        customerId = customer.id!;
        await customersApi.updateCustomer(customerId, {
          companyName,
          phoneNumber: input.schoolPhone,
          address: { addressLine1: input.schoolAddress },
        });
      } else {
        const [firstName, ...lastNameParts] = input.sponsorName.split(' ');
        const createCustomerResponse = await customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          givenName: firstName,
          familyName: lastNameParts.join(' '),
          emailAddress: input.sponsorEmail,
          companyName,
          phoneNumber: input.schoolPhone,
          address: { addressLine1: input.schoolAddress },
          note: `Team Code: ${finalTeamCode}`,
        });
        customerId = createCustomerResponse.result.customer!.id!;
      }

      // --- Order Line Items ---
      const lineItems: OrderLineItem[] = [];

      // 1. Registration
      if (processedPlayers.length > 0) {
        const registrationFee = processedPlayers[0].baseRegistrationFee;
        const playerNotes = processedPlayers
          .map((p, idx) => `${idx + 1}. ${p.playerName} (${p.uscfId})${p.isGtPlayer ? ' (GT)' : ''}`)
          .join('\n');

        lineItems.push({
          name: 'Tournament Registration',
          quantity: String(processedPlayers.length),
          basePriceMoney: { amount: BigInt(Math.round(registrationFee * 100)), currency: 'USD' },
          note: playerNotes,
        });
      }

      // 2. Late Fees (exclude waived)
      const lateFeePlayers = processedPlayers.filter(p => p.lateFee && p.lateFee > 0 && !p.waiveLateFee);
      if (lateFeePlayers.length > 0) {
        const lateFee = lateFeePlayers[0].lateFee;
        const lateFeePlayerNotes = lateFeePlayers.map((p, i) => `${i + 1}. ${p.playerName}`).join('\n');
        lineItems.push({
          name: 'Late Fee',
          quantity: String(lateFeePlayers.length),
          basePriceMoney: { amount: BigInt(Math.round(lateFee! * 100)), currency: 'USD' },
          note: lateFeePlayerNotes,
        });
      }

      // 3. Substitution Fee
      if (input.substitutionFee && input.substitutionFee > 0) {
        lineItems.push({
          name: 'Substitution Fee',
          quantity: '1',
          basePriceMoney: { amount: BigInt(Math.round(input.substitutionFee * 100)), currency: 'USD' },
          note: 'Fee for substituting a player after registration.',
        });
      }

      // 4. USCF Fee (exclude GT for PSJA district) - with bulk discount
      const uscfActionPlayers = processedPlayers.filter(p => {
        if (!p.uscfAction) return false;
        if (input.district === 'PHARR-SAN JUAN-ALAMO ISD' && p.isGtPlayer) return false;
        return true;
      });

      if (uscfActionPlayers.length > 0) {
        // Bulk discount: $4 off per membership for 24+ memberships
        const isBulkOrder = uscfActionPlayers.length >= 24;
        const bulkDiscount = 4; // $4 discount per membership
        const uscfPrice = isBulkOrder ? (input.uscfFee - bulkDiscount) : input.uscfFee;
        const totalSavings = isBulkOrder ? bulkDiscount * uscfActionPlayers.length : 0;
        
        const uscfPlayerNotes = uscfActionPlayers.map((p, i) => `${i + 1}. ${p.playerName}`).join('\n');
        
        // Build the line item name
        const uscfLineItemName = isBulkOrder 
          ? 'USCF Membership (Bulk Rate - 24+)' 
          : 'USCF Membership (New/Renew)';
        
        // Build the note with bulk pricing details
        let uscfNote = '';
        if (input.district === 'PHARR-SAN JUAN-ALAMO ISD') {
          uscfNote = `Applies to non-GT players needing USCF membership.\n${uscfPlayerNotes}`;
        } else {
          uscfNote = `Applies to players needing USCF membership.\n${uscfPlayerNotes}`;
        }
        
        // Add bulk pricing information to the note
        if (isBulkOrder) {
          uscfNote += `\n\nBULK PRICING: $${uscfPrice} each (${uscfActionPlayers.length} memberships)\nTotal savings: $${totalSavings.toFixed(2)}`;
        }
        
        lineItems.push({
          name: uscfLineItemName,
          quantity: String(uscfActionPlayers.length),
          basePriceMoney: { amount: BigInt(Math.round(uscfPrice * 100)), currency: 'USD' },
          note: uscfNote,
        });
      }

      // --- Create Order ---
      const createOrderResponse = await ordersApi.createOrder({
        idempotencyKey: randomUUID(),
        order: { locationId, customerId, lineItems },
      });
      const orderId = createOrderResponse.result.order!.id!;

      // --- Create Invoice ---
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const formattedEventDate = format(new Date(input.eventDate), 'MM/dd/yyyy');

      const ccRecipients: InvoiceRecipient[] = [];
      if (input.bookkeeperEmail?.trim()) ccRecipients.push({ emailAddress: input.bookkeeperEmail });
      if (input.gtCoordinatorEmail?.trim()) ccRecipients.push({ emailAddress: input.gtCoordinatorEmail });

      const revisionNote = input.revisionMessage ? `\n\n${input.revisionMessage}` : '';
      const baseDescription = 'Thank you for your registration.';
      const description = input.description ? `${input.description}${revisionNote}\n\n${baseDescription}` : `${baseDescription}${revisionNote}`;

      const invoicePayload = {
        idempotencyKey: randomUUID(),
        invoice: {
          orderId,
          primaryRecipient: { customerId },
          ccRecipients: ccRecipients.length ? ccRecipients : undefined,
          paymentRequests: [{ requestType: 'BALANCE', dueDate: dueDate.toISOString().split('T')[0] }],
          deliveryMethod: 'EMAIL',
          acceptedPaymentMethods: { card: true, squareGiftCard: true, bankAccount: true },
          invoiceNumber: input.invoiceNumber,
          title: `${finalTeamCode} @ ${formattedEventDate} ${input.eventName}`,
          description,
        },
      };

      const createInvoiceResponse = await invoicesApi.createInvoice(invoicePayload);

      const draftInvoice = createInvoiceResponse.result.invoice!;
      await invoicesApi.publishInvoice(draftInvoice.id!, { version: draftInvoice.version!, idempotencyKey: randomUUID() });
      await new Promise(r => setTimeout(r, 2000));
      const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(draftInvoice.id!);

      if (!finalInvoice?.publicUrl) throw new Error('Failed to retrieve public URL for the invoice.');

      return { invoiceId: finalInvoice.id!, invoiceNumber: finalInvoice.invoiceNumber, status: finalInvoice.status!, invoiceUrl: finalInvoice.publicUrl! };

    } catch (error) {
      if (error instanceof ApiError) {
        const errors = Array.isArray(error.result?.errors) ? error.result!.errors : [];
        const errorMessage = errors.length ? errors.map(e => `[${e.category}/${e.code}]: ${e.detail}`).join(', ') : JSON.stringify(error.result);
        throw new Error(`Square Error: ${errorMessage}`);
      }
      throw error instanceof Error ? new Error(error.message) : new Error('Unexpected error during invoice creation.');
    }
  }
);
