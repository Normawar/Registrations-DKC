'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client, Environment, ApiError, Invoice, Order } from 'square';
import { db } from '@/lib/firebase-admin';
import { generateTeamCode } from '@/lib/school-utils';
import { format, parseISO } from 'date-fns';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';
import { WriteBatch, Firestore } from 'firebase-admin/firestore';

const ImportSquareInvoicesInputSchema = z.object({
  startInvoiceNumber: z.number().describe('Start invoice number to import.'),
  endInvoiceNumber: z.number().describe('End invoice number to import.'),
});
export type ImportSquareInvoicesInput = z.infer<typeof ImportSquareInvoicesInputSchema>;

const ImportSquareInvoicesOutputSchema = z.object({
  created: z.number(),
  updated: z.number(),
  failed: z.number(),
  errors: z.array(z.string()),
  notifications: z.array(z.string()),
});
export type ImportSquareInvoicesOutput = z.infer<typeof ImportSquareInvoicesOutputSchema>;

export async function importSquareInvoices(input: ImportSquareInvoicesInput): Promise<ImportSquareInvoicesOutput> {
  try {
    return await importSquareInvoicesFlow(input);
  } catch (error: any) {
    return { created: 0, updated: 0, failed: 1, errors: [error?.message || 'Unknown error'], notifications: [] };
  }
}

const importSquareInvoicesFlow = ai.defineFlow(
  {
    name: 'importSquareInvoicesFlow',
    inputSchema: ImportSquareInvoicesInputSchema,
    outputSchema: ImportSquareInvoicesOutputSchema,
  },
  async (input) => {
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      throw new Error('SQUARE_ACCESS_TOKEN environment variable is not set.');
    }

    const squareClient = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: Environment.Production,
    });

    const locationId = process.env.SQUARE_LOCATION_ID || 'CTED7GVSVH5H8';

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const notifications: string[] = [];
    let invoicesToProcess: Invoice[] = [];

    try {
      // Fetch invoices
      let cursor: string | undefined = undefined;
      const allInvoices: Invoice[] = [];

      do {
        const { result } = await squareClient.invoicesApi.listInvoices(locationId, { cursor });
        if (result.invoices) allInvoices.push(...result.invoices);
        cursor = result.cursor || undefined;
      } while (cursor);

      invoicesToProcess = allInvoices.filter((inv) => {
        const invNumber = parseInt(inv.invoiceNumber || '0', 10);
        return invNumber >= input.startInvoiceNumber && invNumber <= input.endInvoiceNumber;
      });

      if (invoicesToProcess.length === 0) {
        return { created: 0, updated: 0, failed: 0, errors: ['No invoices found in the specified range.'], notifications };
      }

      const batch = db.batch();

      for (const invoice of invoicesToProcess) {
        try {
          const { invoiceData, invoiceNotifications } = await processSingleInvoice(squareClient, db, invoice, batch);

          const querySnapshot = await db.collection('invoices').where('invoiceId', '==', invoice.id).get();
          if (querySnapshot.empty) {
            batch.set(db.collection('invoices').doc(invoice.id!), invoiceData);
            createdCount++;
          } else {
            batch.update(db.collection('invoices').doc(querySnapshot.docs[0].id), invoiceData);
            updatedCount++;
          }

          notifications.push(...invoiceNotifications);
        } catch (procError: any) {
          failedCount++;
          errors.push(`Invoice #${invoice.invoiceNumber || 'unknown'}: ${procError?.message || String(procError)}`);
        }
      }

      await batch.commit();
    } catch (error: any) {
      const message = error instanceof ApiError
        ? error.result?.errors?.[0]?.detail || error.message
        : error?.message || String(error);
      return { created: 0, updated: 0, failed: 1, errors: [`Square API Error: ${message}`], notifications };
    }

    return { created: createdCount, updated: updatedCount, failed: failedCount, errors, notifications };
  }
);

async function processSingleInvoice(client: Client, db: Firestore, invoice: Invoice, batch: WriteBatch) {
  if (!invoice.orderId || !invoice.primaryRecipient?.customerId) {
    throw new Error(`Invoice #${invoice.invoiceNumber || 'unknown'} missing order or customer ID.`);
  }

  const { result: { order } } = await client.ordersApi.retrieveOrder(invoice.orderId);
  const { result: { customer } } = await client.customersApi.retrieveCustomer(invoice.primaryRecipient.customerId);

  const companyName = customer.companyName || 'Unknown School';
  let schoolName = 'Unknown School';
  let district = 'Unknown District';

  if (companyName.includes(' / ')) {
    const parts = companyName.split(' / ');
    schoolName = parts[0].trim();
    district = parts[1]?.trim() || 'Unknown District';
  } else {
    schoolName = companyName.trim();
    const districtMatch = schoolName.match(/\b([A-Z\-\s]+(?:ISD|CISD|USD|SCHOOL DISTRICT))\b/i);
    if (districtMatch) district = districtMatch[1].trim();
  }

  const { selections, baseRegistrationFee, notifications } = await parseSelectionsFromOrder(order, schoolName, district, batch, db, customer);

  const totalInvoiced = Number(invoice.paymentRequests?.[0]?.computedAmountMoney?.amount || 0) / 100;
  const eventName = invoice.title?.split('@')[1]?.trim() || invoice.title || 'Unknown Event';
  const purchaserName = customer.nickname || `${customer.givenName || ''} ${customer.familyName || ''}`.trim() || 'Unknown Purchaser';

  const invoiceData = {
    id: invoice.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceTitle: invoice.title,
    submissionTimestamp: invoice.createdAt ? format(parseISO(invoice.createdAt), 'MM/dd/yyyy') : null,
    eventDate: invoice.createdAt ? format(parseISO(invoice.createdAt), 'MM/dd/yyyy') : null,
    eventName,
    selections,
    totalInvoiced,
    totalAmount: totalInvoiced,
    invoiceUrl: invoice.publicUrl,
    invoiceStatus: invoice.status,
    status: invoice.status,
    purchaserName,
    schoolName,
    sponsorEmail: customer.emailAddress,
    district,
    teamCode: generateTeamCode({ school: schoolName, district }),
    type: 'event',
    baseRegistrationFee,
  };

  return { invoiceData, invoiceNotifications: notifications };
}

async function parseSelectionsFromOrder(order: Order, schoolName: string, district: string, batch: WriteBatch, db: Firestore, customer: any) {
  const selections: Record<string, any> = {};
  const notifications: string[] = [];
  const emailTracker: Record<string, string> = {};
  let baseRegistrationFee = 0;

  if (!order.lineItems) return { selections, baseRegistrationFee, notifications };

  for (const item of order.lineItems) {
    const nameLower = item.name?.toLowerCase() || '';
    const isRegistration = nameLower.includes('registration');
    const isUscf = nameLower.includes('uscf');

    if (isRegistration) {
      const totalPrice = Number(item.basePriceMoney?.amount || 0) / 100;
      const quantity = parseInt(item.quantity || '1', 10);
      if (quantity > 0) baseRegistrationFee = Math.max(baseRegistrationFee, totalPrice / quantity);
    }

    const playerSources = [item.note || '', item.variationName || '', item.name?.split('(')[1]?.replace(')', '') || ''];

    for (const source of playerSources) {
      if (!source.trim()) continue;
      for (const note of source.split('\n')) {
        const info = parsePlayerFromNote(note.trim());
        if (!info) continue;

        const playerId = info.uscfId || `NEW_${Date.now()}_${info.firstName[0]}${info.lastName[0]}`;
        const existingPlayerDoc = await db.collection('players').doc(playerId).get();
        const existingPlayer = existingPlayerDoc.exists ? existingPlayerDoc.data() as MasterPlayer : null;

        const playerDoc: Partial<MasterPlayer> = {
          id: playerId,
          firstName: info.firstName,
          lastName: info.lastName,
          middleName: info.middleName,
          school: schoolName,
          district,
          dateCreated: existingPlayer?.dateCreated || new Date().toISOString(),
          createdBy: existingPlayer?.createdBy || 'Square Import',
          uscfId: info.uscfId || existingPlayer?.uscfId,
        };

        const selectionData = selections[playerId] || { playerName: `${info.firstName} ${info.lastName}`, section: 'Unknown', baseRegistrationFee: 0 };
        if (isRegistration) selectionData.isRegistered = true;
        if (isUscf) selectionData.uscfStatus = info.isNewPlayer ? 'new' : 'renewing';
        selections[playerId] = selectionData;

        batch.set(db.collection('players').doc(playerId), playerDoc, { merge: true });

        if (!customer.emailAddress) notifications.push(`Player ${info.firstName} ${info.lastName} missing email.`);
        if (!info.uscfId) notifications.push(`Player ${info.firstName} ${info.lastName} missing USCF ID.`);

        if (customer.emailAddress) {
          const lowerEmail = customer.emailAddress.toLowerCase();
          if (emailTracker[lowerEmail] && emailTracker[lowerEmail] !== playerId) {
            notifications.push(`Duplicate email: ${customer.emailAddress} for players ${emailTracker[lowerEmail]} and ${playerId}`);
          } else {
            emailTracker[lowerEmail] = playerId;
          }
        }
      }
    }
  }

  return { selections, baseRegistrationFee, notifications };
}

function parsePlayerFromNote(note: string): { firstName: string; lastName: string; middleName?: string; uscfId?: string; isNewPlayer: boolean } | null {
  if (!note.trim()) return null;
  const clean = note.replace(/^\s*\d+\.?\s*/, '').trim();
  const isNew = clean.toLowerCase().includes('new');

  const patterns = [
    /^([A-Z][a-zA-Z'-]+)\s+([A-Z][a-zA-Z'-]+)\s+([A-Z])$/, // First Last M
    /^([A-Z][a-zA-Z'-]+)\s+([A-Z][a-zA-Z'-]+)$/            // First Last
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match) {
      return {
        firstName: match[1],
        lastName: match[2],
        middleName: match[3],
        uscfId: undefined,
        isNewPlayer: isNew,
      };
    }
  }

  // fallback: try splitting by space
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts[1],
      middleName: parts[2],
      uscfId: undefined,
      isNewPlayer: isNew,
    };
  }

  return null;
}
