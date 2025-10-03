'use server';
/**
 * @fileOverview Creates an invoice with the Square API and saves player data to Firestore.
 * This flow is now unified to handle both individual and sponsor registrations.
 * It has been refactored to use the client 'firebase' SDK due to persistent admin SDK initialization failures.
 */

import { randomUUID } from 'crypto';
import { ApiError, type OrderLineItem, type InvoiceRecipient, Client, Environment } from 'square';
import { format } from 'date-fns';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service'; // USING CLIENT SDK
import { generateTeamCode } from '@/lib/school-utils';
import { type CreateInvoiceInput, type CreateInvoiceOutput } from './schemas';

// This function now acts as a standalone Server Action.
export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  
  if (!db) {
    throw new Error('FATAL: Client Firestore DB is not available.');
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

      if (playerDoc.exists()) {
        await setDoc(playerRef, playerData, { merge: true });
      } else {
        await setDoc(playerRef, { ...playerData, createdAt: new Date().toISOString() }, { merge: true });
      }
    }
  }

  // Using hard-coded Square client
  const squareClient = new Client({
    accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
    environment: Environment.Production,
  });
  const locationId = "CTED7GVSVH5H8";
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

    // 2. Late Fees
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

    // 4. USCF Fee
    const uscfActionPlayers = processedPlayers.filter(p => p.uscfAction && !(input.district === 'PHARR-SAN JUAN-ALAMO ISD' && p.isGtPlayer));
    if (uscfActionPlayers.length > 0) {
        const isBulkOrder = uscfActionPlayers.length >= 24;
        const uscfPrice = isBulkOrder ? (input.uscfFee - 4) : input.uscfFee;
        const uscfPlayerNotes = uscfActionPlayers.map((p, i) => `${i + 1}. ${p.playerName}`).join('\n');
        let uscfNote = `Applies to players needing USCF membership.\n${uscfPlayerNotes}`;
        if (isBulkOrder) {
            uscfNote += `\n\nBULK PRICING: $${uscfPrice} each. Total savings: $${(4 * uscfActionPlayers.length).toFixed(2)}`;
        }
        lineItems.push({
            name: isBulkOrder ? 'USCF Membership (Bulk Rate - 24+)' : 'USCF Membership (New/Renew)',
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
    const ccRecipients: InvoiceRecipient[] = [
      ...(input.bookkeeperEmail ? [{ emailAddress: input.bookkeeperEmail }] : []),
      ...(input.gtCoordinatorEmail ? [{ emailAddress: input.gtCoordinatorEmail }] : []),
    ];
    
    const description = `${input.description || 'Thank you for your registration.'}${input.revisionMessage ? `\n\n${input.revisionMessage}` : ''}`;
    
    const invoicePayload = {
      idempotencyKey: randomUUID(),
      invoice: {
        orderId,
        primaryRecipient: { customerId },
        ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
        paymentRequests: [{ requestType: 'BALANCE' as const, dueDate: dueDate.toISOString().split('T')[0] }],
        deliveryMethod: 'EMAIL' as const,
        acceptedPaymentMethods: { card: true, squareGiftCard: true, bankAccount: true },
        invoiceNumber: input.invoiceNumber,
        title: `${finalTeamCode} @ ${formattedEventDate} ${input.eventName}`,
        description,
      },
    };

    const createInvoiceResponse = await invoicesApi.createInvoice(invoicePayload);
    const draftInvoice = createInvoiceResponse.result.invoice!;

    await invoicesApi.publishInvoice(draftInvoice.id!, { version: draftInvoice.version!, idempotencyKey: randomUUID() });
    
    // Wait for propagation before final fetch
    await new Promise(r => setTimeout(r, 2000));
    
    const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(draftInvoice.id!);

    if (!finalInvoice?.publicUrl) throw new Error('Failed to retrieve public URL for the invoice.');

    return {
      invoiceId: finalInvoice.id!,
      invoiceNumber: finalInvoice.invoiceNumber,
      status: finalInvoice.status!,
      invoiceUrl: finalInvoice.publicUrl!,
    };

  } catch (error) {
    if (error instanceof ApiError) {
      const errorDetail = error.result?.errors?.[0]?.detail || error.message;
      throw new Error(`Square API Error: ${errorDetail}`);
    }
    throw error;
  }
}
