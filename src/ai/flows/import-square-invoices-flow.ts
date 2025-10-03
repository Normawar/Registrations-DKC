'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { type Invoice, type Order, Client, Environment, ApiError } from 'square';
import { getDb } from '@/lib/firebase-admin';
import { generateTeamCode } from '@/lib/school-utils';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';
import { Firestore, WriteBatch } from 'firebase-admin/firestore';

const ImportSquareInvoicesInputSchema = z.object({
  startInvoiceNumber: z.number().describe('The invoice number to start importing from.'),
  endInvoiceNumber: z.number().describe('The invoice number to end importing at (inclusive).'),
});
export type ImportSquareInvoicesInput = z.infer<typeof ImportSquareInvoicesInputSchema>;

const ImportSquareInvoicesOutputSchema = z.object({
  created: z.number().describe('Number of new invoice records created.'),
  updated: z.number().describe('Number of existing invoice records updated.'),
  failed: z.number().describe('Number of invoices that failed to process.'),
  errors: z.array(z.string()).describe('List of error messages for failed invoices.'),
});
export type ImportSquareInvoicesOutput = z.infer<typeof ImportSquareInvoicesOutputSchema>;

export async function importSquareInvoices(input: ImportSquareInvoicesInput): Promise<ImportSquareInvoicesOutput> {
  return importSquareInvoicesFlow(input);
}

const importSquareInvoicesFlow = ai.defineFlow(
  {
    name: 'importSquareInvoicesFlow',
    inputSchema: ImportSquareInvoicesInputSchema,
    outputSchema: ImportSquareInvoicesOutputSchema,
  },
  async (input) => {
    const db = getDb();

    if (!process.env.SQUARE_ACCESS_TOKEN) {
      throw new Error('SQUARE_ACCESS_TOKEN environment variable is not set.');
    }

    const squareClient = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: Environment.Production,
    });

    // Replace with your real Square Location ID
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) throw new Error('SQUARE_LOCATION_ID environment variable is not set.');

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    let invoicesToProcess: Invoice[] = [];

    try {
      console.log('Fetching all invoices from Square...');

      let cursor: string | undefined = undefined;
      do {
        const { result } = await squareClient.invoicesApi.listInvoices(locationId, {
          limit: 200,
          cursor,
        });
        const invoices = result.invoices || [];

        invoicesToProcess.push(...invoices.filter(inv => {
          const invNumber = parseInt(inv.invoiceNumber || '0', 10);
          return invNumber >= input.startInvoiceNumber && invNumber <= input.endInvoiceNumber;
        }));

        cursor = result.cursor;
      } while (cursor);

      if (invoicesToProcess.length === 0) {
        return { created: 0, updated: 0, failed: 0, errors: ['No invoices found in the specified number range.'] };
      }

      const batch = db.batch();

      for (const invoice of invoicesToProcess) {
        try {
          const invoiceData = await processSingleInvoice(squareClient, db, invoice, batch);

          const q = db.collection('invoices').where('invoiceId', '==', invoice.id);
          const querySnapshot = await q.get();

          if (querySnapshot.empty) {
            const docRef = db.collection('invoices').doc(invoice.id!);
            batch.set(docRef, invoiceData);
            createdCount++;
          } else {
            const docRef = db.collection('invoices').doc(querySnapshot.docs[0].id);
            batch.update(docRef, invoiceData);
            updatedCount++;
          }
        } catch (procError: any) {
          failedCount++;
          const errorMessage = procError?.message || String(procError);
          errors.push(`Invoice #${invoice.invoiceNumber}: ${errorMessage}`);
        }
      }

      await batch.commit();

    } catch (error: any) {
      console.error('Square API error:', error);
      if (error instanceof ApiError) {
        const errorDetail = error.result?.errors?.[0]?.detail || error.message;
        return { created: 0, updated: 0, failed: invoicesToProcess.length || 1, errors: [`Square API Error: ${errorDetail}`] };
      }
      const errorMessage = error?.message || String(error);
      return { created: 0, updated: 0, failed: invoicesToProcess.length || 1, errors: [`API Error: ${errorMessage}`] };
    }

    return { created: createdCount, updated: updatedCount, failed: failedCount, errors };
  }
);

async function processSingleInvoice(client: Client, db: Firestore, invoice: Invoice, batch: WriteBatch) {
  if (!invoice.orderId || !invoice.primaryRecipient?.customerId) {
    throw new Error(`Invoice #${invoice.invoiceNumber} is missing order or customer ID.`);
  }

  const { result: { order } } = await client.ordersApi.retrieveOrder(invoice.orderId);
  const { result: { customer } } = await client.customersApi.retrieveCustomer(invoice.primaryRecipient.customerId);

  const companyName = customer.companyName || 'Unknown School';
  let schoolName = 'Unknown School';
  let district = 'Unknown District';

  if (companyName.includes(' / ')) {
    const parts = companyName.split(' / ');
    schoolName = parts[0].trim();
    district = parts.length > 1 ? parts[1].trim() : 'Unknown District';
  } else {
    schoolName = companyName.trim();
    const districtMatch = schoolName.match(/\b([A-Z\-\s]+(?:ISD|CISD|USD|SCHOOL DISTRICT))\b/i);
    if (districtMatch) district = districtMatch[1].trim();
  }

  const { selections, baseRegistrationFee } = await parseSelectionsFromOrder(order, schoolName, district, batch, db);

  const totalInvoiced = Number(invoice.paymentRequests?.[0]?.computedAmountMoney?.amount || 0) / 100;

  const titleParts = invoice.title?.split('@');
  const eventName = titleParts?.length === 2 ? titleParts[1].trim().split(' ').slice(1).join(' ') : invoice.title;

  const purchaserName = customer.nickname || `${customer.givenName || ''} ${customer.familyName || ''}`.trim();

  const finalData = {
    id: invoice.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceTitle: invoice.title,
    submissionTimestamp: invoice.createdAt,
    eventDate: invoice.createdAt,
    eventName: eventName,
    selections: selections,
    totalInvoiced: totalInvoiced,
    totalAmount: totalInvoiced,
    invoiceUrl: invoice.publicUrl,
    invoiceStatus: invoice.status,
    status: invoice.status,
    purchaserName: purchaserName,
    schoolName: schoolName,
    sponsorEmail: customer.emailAddress,
    district: district,
    teamCode: generateTeamCode({ school: schoolName, district: district } as any),
    type: 'event',
    baseRegistrationFee: baseRegistrationFee,
  };

  Object.keys(finalData).forEach(key => (finalData as any)[key] === undefined && delete (finalData as any)[key]);

  return finalData;
}

async function parseSelectionsFromOrder(order: Order, schoolName: string, district: string, batch: WriteBatch, db: Firestore) {
  const selections: Record<string, any> = {};
  let baseRegistrationFee = 0;

  if (!order.lineItems) return { selections, baseRegistrationFee };

  for (const item of order.lineItems) {
    const itemNameLower = item.name?.toLowerCase() || '';
    const isRegistrationItem = itemNameLower.includes('registration');
    const isUscfItem = itemNameLower.includes('uscf');

    if (!isRegistrationItem && !isUscfItem) continue;

    const totalPrice = Number(item.basePriceMoney?.amount || 0) / 100;
    const quantity = parseInt(item.quantity || '1', 10);

    if (isRegistrationItem && quantity > 0) baseRegistrationFee = Math.max(baseRegistrationFee, totalPrice / quantity);

    const playerSources = [
      item.note || '',
      item.variationName || '',
      item.name?.split('(')[1]?.replace(')', '') || ''
    ];

    let playersFound = false;

    for (const source of playerSources) {
      if (!source.trim()) continue;
      const playerNotes = source.split('\n');
      for (const note of playerNotes) {
        const playerInfo = parsePlayerFromNote(note.trim());
        if (!playerInfo) continue;

        playersFound = true;
        const { firstName, lastName, middleName, uscfId, isNewPlayer } = playerInfo;
        const playerId = uscfId || `NEW_${Date.now()}_${firstName.charAt(0)}${lastName.charAt(0)}`;

        const playerDoc: Partial<MasterPlayer> = {
          id: playerId,
          uscfId: uscfId || 'NEW',
          firstName,
          lastName,
          middleName,
          school: schoolName,
          district,
          dateCreated: new Date().toISOString(),
          createdBy: 'Square Import',
        };

        Object.keys(playerDoc).forEach(key => (playerDoc as any)[key] === undefined && delete (playerDoc as any)[key]);

        batch.set(db.collection('players').doc(playerId), playerDoc, { merge: true });

        if (!selections[playerId]) {
          selections[playerId] = {
            playerName: `${firstName} ${lastName}`.trim(),
            section: 'Unknown',
            baseRegistrationFee: 0,
          };
        }

        if (isRegistrationItem) {
          selections[playerId].isRegistered = true;
          selections[playerId].baseRegistrationFee = baseRegistrationFee;
        }

        if (isUscfItem) {
          selections[playerId].uscfStatus = isNewPlayer ? 'new' : 'renewing';
          if (quantity > 0) selections[playerId].uscfFee = totalPrice / quantity;
        } else if (isRegistrationItem && !selections[playerId].uscfStatus) {
          selections[playerId].uscfStatus = 'current';
        }
      }
      if (playersFound) break;
    }

    if (!playersFound && quantity) {
      for (let i = 1; i <= quantity; i++) {
        const playerId = `UNKNOWN_${order.id}_${i}`;
        const playerDoc: Partial<MasterPlayer> = {
          id: playerId,
          uscfId: 'UNKNOWN',
          firstName: 'Unknown',
          lastName: `Player ${i}`,
          school: schoolName,
          district,
          dateCreated: new Date().toISOString(),
          createdBy: 'Square Import',
        };
        batch.set(db.collection('players').doc(playerId), playerDoc, { merge: true });

        selections[playerId] = {
          playerName: `Unknown Player ${i}`,
          section: 'Unknown',
          baseRegistrationFee,
          uscfStatus: isUscfItem ? 'unknown' : 'current',
          isRegistered: isRegistrationItem,
        };

        if (isUscfItem && quantity > 0) selections[playerId].uscfFee = totalPrice / quantity;
      }
    }
  }

  return { selections, baseRegistrationFee };
}

function parsePlayerFromNote(note: string): { firstName: string; lastName: string; middleName?: string; uscfId?: string; isNewPlayer: boolean } | null {
  if (!note || note.trim() === '') return null;
  const cleanNote = note.replace(/^\s*\d+\.?\s*/, '').trim();
  const isNewPlayer = cleanNote.toLowerCase().includes('new');

  const patterns = [
    /^([A-Z\s,'-]+\s[A-Z\s\.'-]+)\s*\(\s*(\d{8,})\s*\)/i,
    /^([A-Z\s,'-]+)\s+(\d{8,})\s+\d{1,2}\/\d{1,2}\/\d{2,4}/i,
    /^([A-Z\s,'-]+)\s+(\d{8,})(?:\s|$)/i,
    /^(\d{8,})\s+([A-Z\s,'-]+)/i,
    /^([
