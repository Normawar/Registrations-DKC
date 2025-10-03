'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { type Invoice, type Order, Client, Environment, ApiError } from 'square';
import { getDb } from '@/lib/firebase-admin'; // Correctly import the getter
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

    const locationId = 'Production';

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    let invoicesToProcess: Invoice[] = [];

    try {
      console.log('Fetching all invoices from Square...');
      const { result } = await squareClient.invoicesApi.listInvoices(locationId, 200);
      const invoices = result.invoices;

      if (!invoices) {
        return { created: 0, updated: 0, failed: 0, errors: ['No invoices found in Square for this location.'] };
      }

      console.log(`Found ${invoices.length} total invoices. Filtering from ${input.startInvoiceNumber} to ${input.endInvoiceNumber}.`);

      invoicesToProcess = invoices.filter(inv => {
        const invNumber = parseInt(inv.invoiceNumber || '0', 10);
        return invNumber >= input.startInvoiceNumber && invNumber <= input.endInvoiceNumber;
      });

      if (invoicesToProcess.length === 0) {
        return { created: 0, updated: 0, failed: 0, errors: ['No invoices found in the specified number range.'] };
      }

      const batch = db.batch();

      for (const invoice of invoicesToProcess) {
        try {
          // Process the invoice and get plain data
          const invoiceData = await processSingleInvoice(squareClient, db, invoice, batch);
          
          // Query for existing invoice
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
          // Ensure error message is a plain string
          const errorMessage = procError?.message || String(procError);
          errors.push(`Invoice #${invoice.invoiceNumber}: ${errorMessage}`);
        }
      }

      // Commit all batched writes
      await batch.commit();

    } catch (error: any) {
      console.error('Square API error:', error);
      if (error instanceof ApiError) {
        const errorDetail = error.result?.errors?.[0]?.detail || error.message;
        return { created: 0, updated: 0, failed: invoicesToProcess.length || 1, errors: [`Square API Error: ${errorDetail}`] };
      }
      // Ensure error is converted to plain string
      const errorMessage = error?.message || String(error);
      return { created: 0, updated: 0, failed: invoicesToProcess.length || 1, errors: [`API Error: ${errorMessage}`] };
    }

    // Return only plain data
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
    if (districtMatch) {
      district = districtMatch[1].trim();
    }
  }

  const { selections, baseRegistrationFee } = await parseSelectionsFromOrder(order, schoolName, district, batch, db);

  if (Object.keys(selections).length === 0) {
    console.warn(`No players parsed for Invoice #${invoice.invoiceNumber}.`);
  }

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

    if (isRegistrationItem) {
      const totalPrice = Number(item.basePriceMoney?.amount || 0) / 100;
      const quantity = parseInt(item.quantity || '1', 10);
      if (quantity > 0) {
        baseRegistrationFee = Math.max(baseRegistrationFee, totalPrice / quantity);
      }
    }

    if (isRegistrationItem || isUscfItem) {
      const playerSources = [
        item.note || '',
        item.variationName || '',
        item.name?.split('(')[1]?.replace(')', '') || ''
      ];

      let playersFound = false;

      for (const source of playerSources) {
        if (source.trim()) {
          const playerNotes = source.split('\n');

          for (const note of playerNotes) {
            const playerInfo = parsePlayerFromNote(note.trim());

            if (playerInfo) {
              playersFound = true;
              const { firstName, lastName, middleName, uscfId } = playerInfo;
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

              const playerRef = db.collection('players').doc(playerId);
              batch.set(playerRef, playerDoc, { merge: true });

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
                selections[playerId].uscfStatus = playerInfo.isNewPlayer ? 'new' : 'renewing';
                const uscfTotalPrice = Number(item.basePriceMoney?.amount || 0) / 100;
                const uscfQuantity = parseInt(item.quantity || '1', 10);
                if (uscfQuantity > 0) {
                  selections[playerId].uscfFee = uscfTotalPrice / uscfQuantity;
                }
              } else if (isRegistrationItem && !selections[playerId].uscfStatus) {
                selections[playerId].uscfStatus = 'current';
              }
            }
          }
          if (playersFound) break;
        }
      }

      if (!playersFound && item.quantity) {
        const quantity = parseInt(item.quantity, 10);
        for (let i = 1; i <= quantity; i++) {
          const playerId = `UNKNOWN_${order.id}_${i}`;

          const playerDoc: Partial<MasterPlayer> = {
            id: playerId, uscfId: 'UNKNOWN', firstName: 'Unknown',
            lastName: `Player ${i}`, school: schoolName, district,
            dateCreated: new Date().toISOString(), createdBy: 'Square Import',
          };

          const playerRef = db.collection('players').doc(playerId);
          batch.set(playerRef, playerDoc, { merge: true });

          selections[playerId] = {
            playerName: `Unknown Player ${i}`, section: 'Unknown',
            baseRegistrationFee: baseRegistrationFee,
            uscfStatus: isUscfItem ? 'unknown' : 'current',
            isRegistered: isRegistrationItem,
          };

          if (isUscfItem) {
            const uscfTotalPrice = Number(item.basePriceMoney?.amount || 0) / 100;
            if (quantity > 0) {
              selections[playerId].uscfFee = uscfTotalPrice / quantity;
            }
          }
        }
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
    /^([A-Z][A-Za-z\s,'-]+?)\s+NEW\s*$/i,
    /^([A-Z][A-Za-z\s,'-]{2,}?)(?:\s+NEW)?\s*$/i,
    /([A-Z][A-Za-z\s,'-]*[A-Za-z])\s*[^\w]*(\d{8,})/i
  ];

  for (const pattern of patterns) {
    const match = cleanNote.match(pattern);
    if (match) {
      let name: string, uscfId: string | undefined;

      if (pattern.source.startsWith('(\d{8,})')) { // USCF ID first
        uscfId = match[1];
        name = match[2];
      } else {
        name = match[1];
        uscfId = match[2];
      }

      if (uscfId && uscfId.trim().length < 8) uscfId = undefined;

      name = name.trim().replace(/\s+NEW\s*$/i, '').replace(/[,]+/g, ' ').replace(/\s+/g, ' ');
      const nameParts = name.split(/\s+/);

      if (nameParts.length < 2) continue;

      let firstName = nameParts[0];
      let lastName = nameParts[nameParts.length - 1];
      let middleName: string | undefined;

      const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v'];
      const lastPartLower = lastName.toLowerCase().replace(/[^a-z]/g, '');

      if (suffixes.includes(lastPartLower) && nameParts.length > 2) {
        const suffix = lastName;
        lastName = nameParts[nameParts.length - 2];
        middleName = nameParts.length > 3 ? nameParts.slice(1, -2).join(' ') + ' ' + suffix : suffix;
      } else if (nameParts.length > 2) {
        middleName = nameParts.slice(1, -1).join(' ');
      }

      if (firstName.length < 1 || lastName.length < 1) continue;

      return { firstName, lastName, middleName, uscfId, isNewPlayer };
    }
  }

  return null;
}
