'use server';
/**
 * @fileOverview Creates an invoice with the Square API and saves player data to Firestore.
 * Refactored for Next.js 15+ and ESM-safe Square imports.
 */

import { randomUUID } from 'crypto';
import { format } from 'date-fns';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service'; // ✅ Client Firestore SDK
import { generateTeamCode } from '@/lib/school-utils';
import { type CreateInvoiceInput, type CreateInvoiceOutput } from './schemas';

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  if (!db) throw new Error('FATAL: Client Firestore DB is not available.');
  if (!process.env.SQUARE_ACCESS_TOKEN) throw new Error('SQUARE_ACCESS_TOKEN not set');
  if (!process.env.SQUARE_LOCATION_ID) throw new Error('SQUARE_LOCATION_ID not set');

  // ✅ Dynamic import for ESM compatibility (Next.js 15+)
  const Square = await import('square');
  const { Client, Environment, ApiError } = Square as any;

  // --- Normalize player fields ---
  const processedPlayers = input.players.map(p => ({
    ...p,
    playerName: p.playerName ?? 'undefined undefined',
    uscfId: p.uscfId ?? 'NEW',
    baseRegistrationFee: p.baseRegistrationFee ?? 0,
    lateFee: p.lateFee ?? 0,
    uscfAction: p.uscfAction ?? false,
    isGtPlayer: p.isGtPlayer ?? false,
    waiveLateFee: p.waiveLateFee ?? false,
    section: p.section?.trim() || 'High School K-12',
  }));

  // --- Save/Update player data in Firestore ---
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
      createdAt: playerDoc.exists() ? playerDoc.data()?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
    };

    await setDoc(playerRef, playerData, { merge: true });
  }

  // --- Initialize Square client ---
  const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
    environment: Environment.Production,
  });

  const locationId = process.env.SQUARE_LOCATION_ID!;
  const { customersApi, ordersApi, invoicesApi } = squareClient;

  try {
    // --- Lookup or create customer ---
    const searchCustomersResponse = await customersApi.searchCustomers({
      query: { filter: { emailAddress: { exact: input.sponsorEmail } } },
    });

    const companyName = input.district ? `${input.schoolName} / ${input.district}` : input.schoolName;
    const finalTeamCode = input.teamCode || generateTeamCode({ schoolName: input.schoolName, district: input.district });
    const customerName = input.sponsorName || input.parentName || 'Customer';

    let customerId: string;
    if (searchCustomersResponse.result.customers?.length) {
      const existing = searchCustomersResponse.result.customers[0];
      customerId = existing.id!;
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

    // --- Build order line items ---
    const lineItems: any[] = [];

    // Registration
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

    // Late fees
    const lateFeePlayers = processedPlayers.filter(p => p.lateFee && !p.waiveLateFee);
    if (lateFeePlayers.length > 0) {
      const lateFee = lateFeePlayers[0].lateFee;
      lineItems.push({
        name: 'Late Fee',
        quantity: String(lateFeePlayers.length),
        basePriceMoney: { amount: BigInt(Math.round(lateFee * 100)), currency: 'USD' },
        note: lateFeePlayers.map((p, i) => `${i + 1}. ${p.playerName}`).join('\n'),
      });
    }

    // Substitution Fee
    if (input.substitutionFee && input.substitutionFee > 0) {
      lineItems.push({
        name: 'Substitution Fee',
        quantity: '1',
        basePriceMoney: { amount: BigInt(Math.round(input.substitutionFee * 100)), currency: 'USD' },
        note: 'Fee for substituting a player after registration.',
      });
    }

    // USCF Fee
    const uscfActionPlayers = processedPlayers.filter(p => p.uscfAction && !(input.district === 'PHARR-SAN JUAN-ALAMO ISD' && p.isGtPlayer));
    if (uscfActionPlayers.length > 0) {
      const isBulkOrder = uscfActionPlayers.length >= 24;
      const uscfPrice = isBulkOrder ? (input.uscfFee - 4) : input.uscfFee;
      let uscfNote = `Applies to players needing USCF membership.\n${uscfActionPlayers.map((p, i) => `${i + 1}. ${p.playerName}`).join('\n')}`;
      if (isBulkOrder) uscfNote += `\n\nBULK PRICING: $${uscfPrice} each (save $4 per player).`;

      lineItems.push({
        name: isBulkOrder ? 'USCF Membership (Bulk 24+)' : 'USCF Membership (New/Renew)',
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

    // --- Create & Publish Invoice ---
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const formattedEventDate = format(new Date(input.eventDate), 'MM/dd/yyyy');

    const ccRecipients = [
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

    const { result: { invoice: draftInvoice } } = await invoicesApi.createInvoice(invoicePayload);
    await invoicesApi.publishInvoice(draftInvoice.id!, { version: draftInvoice.version!, idempotencyKey: randomUUID() });

    await new Promise(r => setTimeout(r, 2000)); // allow propagation
    const { result: { invoice: finalInvoice } } = await invoicesApi.getInvoice(draftInvoice.id!);

    if (!finalInvoice?.publicUrl) throw new Error('Failed to retrieve invoice public URL.');

    return {
      invoiceId: finalInvoice.id!,
      invoiceNumber: finalInvoice.invoiceNumber,
      status: finalInvoice.status!,
      invoiceUrl: finalInvoice.publicUrl!,
    };

  } catch (error: any) {
    if (error instanceof ApiError) {
      const detail = error.result?.errors?.[0]?.detail || error.message;
      throw new Error(`Square API Error: ${detail}`);
    }
    console.error('Unexpected error in createInvoice:', error);
    throw new Error(error.message || 'Unknown error');
  }
}
