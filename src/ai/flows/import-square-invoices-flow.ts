
'use server';
/**
 * @fileOverview A flow to import and process invoices directly from the Square API.
 * This is a more reliable alternative to parsing PDFs for bulk data migration.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';
import { type Invoice, ApiError } from 'square';
import { generateTeamCode } from '@/lib/school-utils';
import { checkSquareConfig } from '@/lib/actions/check-config';

const ImportSquareInvoicesInputSchema = z.object({
  startInvoiceNumber: z.number().describe('The invoice number to start importing from.'),
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
  async ({ startInvoiceNumber }) => {
    
    console.log('Environment check:', {
      hasAccessToken: !!process.env.SQUARE_ACCESS_TOKEN,
      hasAppId: !!process.env.SQUARE_APPLICATION_ID,
      hasLocationId: !!process.env.SQUARE_LOCATION_ID,
      environment: process.env.SQUARE_ENVIRONMENT,
      tokenStart: process.env.SQUARE_ACCESS_TOKEN?.substring(0, 6) + '...'
    });
    
    const { isConfigured } = await checkSquareConfig();
    if (!isConfigured) {
      throw new Error('Square API is not configured. Please set credentials in your .env file.');
    }

    if (!db) {
      throw new Error('Firestore database is not initialized.');
    }

    const squareClient = await getSquareClient();
    const locationId = await getSquareLocationId();
    let cursor: string | undefined;
    const allInvoices: Invoice[] = [];

    console.log(`Starting import from Square for invoices >= #${startInvoiceNumber}...`);

    try {
        console.log('Testing basic Square API connectivity...');
        const locationsTest = await squareClient.locationsApi.listLocations();
        console.log('✅ Locations API test passed', locationsTest.result.locations?.[0]?.name);

        do {
            const { result } = await squareClient.invoicesApi.listInvoices({
                locationId: locationId,
                limit: 200,
                cursor,
            });
            
            const invoices = result.invoices || [];
            allInvoices.push(...invoices);
            cursor = result.cursor;
            console.log(`Fetched ${invoices.length} invoices, total so far: ${allInvoices.length}. More available: ${!!cursor}`);
        } while (cursor);
    } catch (error: any) {
        if (error instanceof ApiError) {
             console.error('Full Square API Error:', {
                name: error.name,
                message: error.message,
                statusCode: error.statusCode,
                errors: error.errors,
                body: error.body
            });
            throw new Error(`Square API Error: ${error.message} (Status: ${error.statusCode || 'unknown'})`);
        }
        console.error('Failed to fetch invoices from Square API:', error);
        throw new Error('Could not fetch data from Square. Check API credentials and permissions.');
    }

    const relevantInvoices = allInvoices.filter(invoice => {
        const numPart = invoice.invoiceNumber?.replace(/\D/g, '');
        if (!numPart) return false;
        return parseInt(numPart, 10) >= startInvoiceNumber;
    });

    console.log(`Found ${relevantInvoices.length} invoices to process with number >= ${startInvoiceNumber}.`);
    
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    const existingInvoiceDocs = await getDocs(query(collection(db, 'invoices'), where('invoiceNumber', '>=', String(startInvoiceNumber))));
    const existingInvoicesMap = new Map(existingInvoiceDocs.docs.map(doc => [doc.data().invoiceNumber, { id: doc.id, ...doc.data() }]));

    for (const invoice of relevantInvoices) {
        if (!invoice.id || !invoice.invoiceNumber) {
            failed++;
            errors.push(`Skipped Square invoice with missing ID or Number.`);
            continue;
        }

        try {
            const customer = invoice.primaryRecipient;
            const orderId = invoice.orderId;
            if (!orderId) {
                failed++;
                errors.push(`Invoice #${invoice.invoiceNumber} has no Order ID.`);
                continue;
            }

            const { result: { order } } = await squareClient.ordersApi.retrieveOrder(orderId);
            
            const totalAmount = Number(invoice.paymentRequests?.[0]?.computedAmountMoney?.amount || 0) / 100;
            const totalPaid = Number(invoice.paymentRequests?.[0]?.totalCompletedAmountMoney?.amount || 0) / 100;
            
            const schoolName = customer?.companyName?.split(' / ')[0] || customer?.companyName || 'Unknown School';
            const district = customer?.companyName?.split(' / ')[1] || 'Unknown District';
            const teamCode = generateTeamCode({ schoolName, district });
            
            const firestoreRecord = {
                id: invoice.id,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceUrl: invoice.publicUrl,
                status: invoice.status,
                invoiceStatus: invoice.status,
                submissionTimestamp: invoice.createdAt,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt,
                totalInvoiced: totalAmount,
                totalAmount,
                totalPaid: totalPaid,
                purchaserName: `${customer?.givenName || ''} ${customer?.familyName || ''}`.trim(),
                sponsorEmail: customer?.emailAddress,
                schoolName,
                district,
                teamCode,
                eventName: invoice.title,
                selections: {}, // Simplified for now, can be enriched if player data is in notes
                type: 'organizer' // Assume general organizer invoice from Square
            };
            
            const existing = existingInvoicesMap.get(invoice.invoiceNumber);

            if (existing) {
                await setDoc(doc(db, 'invoices', existing.id), firestoreRecord, { merge: true });
                updated++;
            } else {
                await setDoc(doc(db, 'invoices', invoice.id), firestoreRecord);
                created++;
            }

        } catch (error) {
            failed++;
            const msg = error instanceof Error ? error.message : 'Unknown processing error.';
            errors.push(`Invoice #${invoice.invoiceNumber}: ${msg}`);
        }
    }

    return { created, updated, failed, errors };
  }
);
