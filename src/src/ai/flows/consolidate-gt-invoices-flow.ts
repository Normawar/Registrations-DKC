'use server';

/**
 * @fileOverview Consolidated GT Invoice Flow
 * Dynamically creates an invoice via Square and syncs player data with Firestore.
 * Refactored for Next.js 15+ (ESM-safe dynamic imports) and hardened error handling.
 */

import { randomUUID } from 'crypto';
import { format } from 'date-fns';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { generateTeamCode } from '@/lib/school-utils';
import { type CreateInvoiceInput, type CreateInvoiceOutput } from './schemas';

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  // --- 🔒 Validation ---
  if (!db) throw new Error('FATAL: Client Firestore DB is not available.');
  if (!process.env.SQUARE_ACCESS_TOKEN) throw new Error('Missing Square Access Token');
  if (!process.env.SQUARE_LOCATION_ID) throw new Error('Missing Square Location ID');

  // --- 📦 Dynamic Square Import (ESM-safe for Next.js 15+) ---
  const squareModule = await import('square');
  const { Client, Environment, ApiError } = squareModule as any;

  // --- 🧩 Normalize Player Data ---
  const players = input.players.map((p) => ({
    ...p,
    playerName: p.playerName?.trim() || 'undefined undefined',
    uscfId: p.uscfId?.trim() || 'NEW',
    baseRegistrationFee: p.baseRegistrationFee ?? 0,
    lateFee: p.lateFee ?? 0,
    uscfAction: p.uscfAction ?? false,
    isGtPlayer: p.isGtPlayer ?? false,
    waiveLateFee: p.waiveLateFee ?? false,
    section: p.section?.trim() || 'High School K-12',
  }));

  // --- 🔥 Firestore Sync (Players) ---
  for (const player of players) {
    const playerId = player.uscfId.toUpperCase() !== 'NEW' ? player.uscfId : `temp_${randomUUID()}`;
    const playerRef = doc(db, 'players', playerId);
    const existing = await getDoc(playerRef);

    const [firstName, ...lastNameParts] = player.playerName.split(' ');
    const playerData = {
      id: playerId,
      uscfId: player.uscfId,
      firstName: firstName || 'Unknown',
      lastName: lastNameParts.join(' ') || 'Unknown',
      school: input.schoolName || 'Unknown School',
      district: input.district || 'Unknown District',
      studentType: player.isGtPlayer ? 'gt' : 'independent',
      section: player.section,
      updatedAt: new Date().toISOString(),
      createdAt: existing.exists()
        ? existing.data()?.createdAt ?? new Date().toISOString()
        : new Date().toISOString(),
    };

    await setDoc(playerRef, playerData, { merge: true });
  }

  // --- 🧾 Square Client Initialization ---
  const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN!,
    environment: Environment.Production,
  });

  const locationId = process.env.SQUARE_LOCATION_ID!;
  const { customersApi, ordersApi, invoicesApi } = squareClient;

  try {
    // --- 👤 Customer Lookup or Creation ---
    const { result: searchRes } = await customersApi.searchCustomers({
      query: { filter: { emailAddress: { exact: input.sponsorEmail } } },
    });

    const companyName = input.district
      ? `${input.schoolName} / ${input.district}`
      : input.schoolName;
    const teamCode =
      input.teamCode || generateTeamCode({ schoolName: input.schoolName, district: input.district });
    const customerName = input.sponsorName || input.parentName || 'Customer';

    let customerId: string;
    if (searchRes?.customers?.length) {
      customerId = searchRes.customers[0].id!;
      await customersApi.updateCustomer(customerId, {
        companyName,
        phoneNumber: input.sponsorPhone || input.schoolPhone,
        address: { addressLine1: input.schoolAddress },
      });
    } else {
      const [firstName, ...lastNameParts] = customerName.split(' ');
      const { result: createRes } = await customersApi.createCustomer({
        idempotencyKey: randomUUID(),
        givenName: firstName,
        familyName: lastNameParts.join(' '),
        emailAddress: input.sponsorEmail,
        companyName,
        phoneNumber: input.sponsorPhone || input.schoolPhone,
        address: { addressLine1: input.schoolAddress },
        note: `Team Code: ${teamCode}`,
      });
      customerId = createRes.customer!.id!;
    }

    // --- 🧾 Build Line Items ---
    const lineItems: any[] = [];

    // Registration
    if (players.length > 0) {
      const registrationFee = players[0].baseRegistrationFee;
      const playerNotes = players
        .map(
          (p, i) =>
            `${i + 1}. ${p.playerName} (${p.uscfId})${p.isGtPlayer ? ' (GT)' : ''} - Section: ${p.section}`,
        )
        .join('\n');
      lineItems.push({
        name: 'Tournament Registration',
        quantity: String(players.length),
        basePriceMoney: { amount: BigInt(Math.round(registrationFee * 100)), currency: 'USD' },
        note: playerNotes,
      });
    }

    // Late Fees
    const latePlayers = players.filter((p) => p.lateFee > 0 && !p.waiveLateFee);
    if (latePlayers.length > 0) {
      lineItems.push({
        name: 'Late Fee',
        quantity: String(latePlayers.length),
        basePriceMoney: {
          amount: BigInt(Math.round(latePlayers[0].lateFee * 100)),
          currency: 'USD',
        },
        note: latePlayers.map((p, i) => `${i + 1}. ${p.playerName}`).join('\n'),
      });
    }

    // Substitution Fee
    if (input.substitutionFee && input.substitutionFee > 0) {
      lineItems.push({
        name: 'Substitution Fee',
        quantity: '1',
        basePriceMoney: {
          amount: BigInt(Math.round(input.substitutionFee * 100)),
          currency: 'USD',
        },
        note: 'Fee for substituting a player after registration.',
      });
    }

    // USCF Membership
    const uscfPlayers = players.filter(
      (p) => p.uscfAction && !(input.district === 'PHARR-SAN JUAN-ALAMO ISD' && p.isGtPlayer),
    );
    if (uscfPlayers.length > 0) {
      const isBulk = uscfPlayers.length >= 24;
      const uscfPrice = isBulk ? input.uscfFee - 4 : input.uscfFee;
      const notes = uscfPlayers.map((p, i) => `${i + 1}. ${p.playerName}`).join('\n');
      lineItems.push({
        name: isBulk ? 'USCF Membership (Bulk 24+)' : 'USCF Membership (New/Renew)',
        quantity: String(uscfPlayers.length),
        basePriceMoney: { amount: BigInt(Math.round(uscfPrice * 100)), currency: 'USD' },
        note: `Applies to players needing USCF membership.\n${notes}${
          isBulk ? `\n\nBULK DISCOUNT: $${uscfPrice} each (save $4/player)` : ''
        }`,
      });
    }

    // --- 🧾 Create Order ---
    const { result: orderRes } = await ordersApi.createOrder({
      idempotencyKey: randomUUID(),
      order: { locationId, customerId, lineItems },
    });
    const orderId = orderRes.order!.id!;

    // --- 📧 Create Invoice ---
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const formattedEventDate = format(new Date(input.eventDate), 'MM/dd/yyyy');

    const ccRecipients = [
      ...(input.bookkeeperEmail ? [{ emailAddress: input.bookkeeperEmail }] : []),
      ...(input.gtCoordinatorEmail ? [{ emailAddress: input.gtCoordinatorEmail }] : []),
    ];

    const description =
      (input.description || 'Thank you for your registration.') +
      (input.revisionMessage ? `\n\n${input.revisionMessage}` : '');

    const invoicePayload = {
      idempotencyKey: randomUUID(),
      invoice: {
        orderId,
        primaryRecipient: { customerId },
        ccRecipients: ccRecipients.length ? ccRecipients : undefined,
        paymentRequests: [
          { requestType: 'BALANCE' as const, dueDate: dueDate.toISOString().split('T')[0] },
        ],
        deliveryMethod: 'EMAIL' as const,
        acceptedPaymentMethods: { card: true, squareGiftCard: true, bankAccount: true },
        invoiceNumber: input.invoiceNumber,
        title: `${teamCode} @ ${formattedEventDate} ${input.eventName}`,
        description,
      },
    };

    const { result: createInvRes } = await invoicesApi.createInvoice(invoicePayload);
    const draft = createInvRes.invoice!;
    await invoicesApi.publishInvoice(draft.id!, {
      version: draft.version!,
      idempotencyKey: randomUUID(),
    });

    // --- Wait for Propagation ---
    await new Promise((r) => setTimeout(r, 2000));

    const { result: getRes } = await invoicesApi.getInvoice(draft.id!);
    const finalInvoice = getRes.invoice;

    if (!finalInvoice?.publicUrl)
      throw new Error('Failed to retrieve Square public invoice URL.');

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
    console.error('Unhandled Error in consolidateGTInvoice:', error);
    throw new Error(error.message || 'Unknown error in consolidateGTInvoice');
  }
}
