
'use server';
/**
 * @fileOverview Creates an invoice with the Square API and saves player data to Firestore.
 * This flow is now unified to handle both individual and sponsor registrations.
 */

import { ai } from '@/ai/genkit';
import { randomUUID } from 'crypto';
import { ApiError, type OrderLineItem, type InvoiceRecipient, type Address } from 'square';
import { format } from 'date-fns';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase-admin';
import { generateTeamCode } from '@/lib/school-utils';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';
import { type CreateInvoiceInput, CreateInvoiceInputSchema, type CreateInvoiceOutput, CreateInvoiceOutputSchema } from './schemas';


export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  console.log('[[DEBUG]] createInvoice: Entered wrapper function.');
  try {
    const db = getDb();
    console.log('[[DEBUG]] createInvoice wrapper: DB check passed.');
  } catch (error) {
     console.error('[[DEBUG]] createInvoice wrapper: DB check failed!', error);
     throw new Error('Server configuration error: Database not available.');
  }
  
  return createInvoiceFlow(input);
}


const createInvoiceFlow = ai.defineFlow(
  {
    name: 'createInvoiceFlow',
    inputSchema: CreateInvoiceInputSchema,
    outputSchema: CreateInvoiceOutputSchema,
  },
  async (input) => {
    console.log('[[DEBUG]] createInvoiceFlow: Genkit flow started.');
    let db;
    try {
      db = getDb();
      console.log('[[DEBUG]] createInvoiceFlow: DB check passed inside flow.');
    } catch (error) {
       console.error('[[DEBUG]] CRITICAL: DB check failed inside flow!', error);
       throw new Error('Server configuration error: Database not available.');
    }


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
      section: p.section && p.section.trim() !== '' ? p.section.trim() : 'High School K-12',
    }));

    // Step 1: Save/Update player data in Firestore
    if (processedPlayers.length > 0) {
      console.log(`[[DEBUG]] Processing ${processedPlayers.length} players for Firestore save/update...`);
      for (const player of processedPlayers) {
        const playerId = player.uscfId.toUpperCase() !== 'NEW' ? player.uscfId : `temp_${randomUUID()}`;
        const playerRef = doc(db, 'players', playerId);
        const playerDoc = await getDoc(playerRef);

        const [firstName, ...lastNameParts] = player.playerName.split(' ');
        const lastName = lastNameParts.join(' ');

        const playerData = {
          id: playerId,
          uscfId: player.uscfId,
          firstName: firstName || 'Unknown',
          lastName: lastName || 'Unknown',
          school: input.schoolName || 'Unknown School',
          district: input.district || 'Unknown District',
          studentType: player.isGtPlayer ? 'gt' : 'independent',
          section: player.section,
          updatedAt: new Date().toISOString(),
        };

        Object.keys(playerData).forEach(key => {
          if (playerData[key as keyof typeof playerData] === undefined) {
            console.error(`[[DEBUG]] Undefined value found for key ${key} in player data:`, playerData);
            throw new Error(`Invalid player data: ${key} is undefined`);
          }
        });

        if (playerDoc.exists()) {
          await setDoc(playerRef, playerData, { merge: true });
          console.log(`[[DEBUG]] Updated player ${player.playerName} (ID: ${playerId}) in Firestore.`);
        } else {
          await setDoc(playerRef, { ...playerData, createdAt: new Date().toISOString() }, { merge: true });
          console.log(`[[DEBUG]] Created new player ${player.playerName} (ID: ${playerId}) in Firestore.`);
        }
      }
    }
    
    const squareClient = await getSquareClient();
    const locationId = await getSquareLocationId();
    const { customersApi, ordersApi, invoicesApi } = squareClient;
    console.log('[[DEBUG]] createInvoiceFlow: Square client and location obtained.');

    try {
      // --- Customer Creation / Lookup ---
      const searchCustomersResponse = await customersApi.searchCustomers({
        query: {
          filter: { emailAddress: { exact: input.sponsorEmail } },
        },
      });

      const companyName = input.district ? `${input.schoolName} / ${input.district}` : input.schoolName;
      const finalTeamCode = input.teamCode || generateTeamCode({ schoolName: input.schoolName, district: input.district });
      const customerName = input.sponsorName || input.parentName || 'Customer';

      let customerId: string;
      if (searchCustomersResponse.result.customers?.length) {
        const customer = searchCustomersResponse.result.customers[0];
        customerId = customer.id!;
        await customersApi.updateCustomer(customerId, {
          companyName,
          phoneNumber: input.sponsorPhone || input.schoolPhone,
          address: { addressLine1: input.schoolAddress },
        });
      } else {
        const [firstName, ...lastNameParts] = customerName.split(' ');
        const createCustomerResponse = await customersApi.createCustomer({
          idempotencyKey: randomUUID(),
          givenName: firstName,
          familyName: lastNameParts.join(' '),
          emailAddress: input.sponsorEmail,
          companyName,
          phoneNumber: input.sponsorPhone || input.schoolPhone,
          address: { addressLine1: input.schoolAddress },
          note: `Team Code: ${finalTeamCode}`,
        });
        customerId = createCustomerResponse.result.customer!.id!;
      }
      console.log(`[[DEBUG]] createInvoiceFlow: Customer processed. ID: ${customerId}`);


      // --- Order Line Items ---
      const lineItems: OrderLineItem[] = [];

      // 1. Registration
      if (processedPlayers.length > 0) {
        const registrationFee = processedPlayers[0].baseRegistrationFee;
        const playerNotes = processedPlayers
          .map((p, idx) => `${idx + 1}. ${p.playerName} (${p.uscfId})${p.isGtPlayer ? ' (GT)' : ''} - Section: ${p.section}`)
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
        const isBulkOrder = uscfActionPlayers.length >= 24;
        const bulkDiscount = 4; // $4 discount per membership
        const uscfPrice = isBulkOrder ? (input.uscfFee - bulkDiscount) : input.uscfFee;
        const totalSavings = isBulkOrder ? bulkDiscount * uscfActionPlayers.length : 0;
        
        const uscfPlayerNotes = uscfActionPlayers.map((p, i) => `${i + 1}. ${p.playerName}`).join('\n');
        const uscfLineItemName = isBulkOrder ? 'USCF Membership (Bulk Rate - 24+)' : 'USCF Membership (New/Renew)';
        
        let uscfNote = input.district === 'PHARR-SAN JUAN-ALAMO ISD'
          ? `Applies to non-GT players needing USCF membership.\n${uscfPlayerNotes}`
          : `Applies to players needing USCF membership.\n${uscfPlayerNotes}`;
        
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
      console.log(`[[DEBUG]] createInvoiceFlow: ${lineItems.length} line items created.`);


      // --- Create Order ---
      const createOrderResponse = await ordersApi.createOrder({
        idempotencyKey: randomUUID(),
        order: { locationId, customerId, lineItems },
      });
      const orderId = createOrderResponse.result.order!.id!;
      console.log(`[[DEBUG]] createInvoiceFlow: Order created. ID: ${orderId}`);


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
      console.log('[[DEBUG]] createInvoiceFlow: Draft invoice created.');


      const draftInvoice = createInvoiceResponse.result.invoice!;
      await invoicesApi.publishInvoice(draftInvoice.id!, { version: draftInvoice.version!, idempotencyKey: randomUUID() });
      await new Promise(r => setTimeout(r, 2000));
      const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(draftInvoice.id!);
      console.log('[[DEBUG]] createInvoiceFlow: Invoice published.');


      if (!finalInvoice?.publicUrl) throw new Error('Failed to retrieve public URL for the invoice.');

      return { invoiceId: finalInvoice.id!, invoiceNumber: finalInvoice.invoiceNumber, status: finalInvoice.status!, invoiceUrl: finalInvoice.publicUrl! };

    } catch (error) {
      if (error instanceof ApiError) {
        const errors = Array.isArray(error.result?.errors) ? error.result!.errors : [];
        const errorMessage = errors.length ? errors.map(e => `[${e.category}/${e.code}]: ${e.detail}`).join(', ') : JSON.stringify(error.result);
        console.error('[[DEBUG]] Square Error in createInvoiceFlow:', errorMessage);
        throw new Error(`Square Error: ${errorMessage}`);
      }
      console.error('[[DEBUG]] Unexpected error in createInvoiceFlow:', error);
      throw error instanceof Error ? new Error(error.message) : new Error('Unexpected error during invoice creation.');
    }
  }
);
