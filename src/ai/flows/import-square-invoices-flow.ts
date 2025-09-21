
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getSquareClient, getSquareLocationId } from '@/lib/square-client';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { generateTeamCode } from '@/lib/school-utils';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';
import type { Invoice, Order, Customer } from 'square';

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
    if (!db) {
      return { created: 0, updated: 0, failed: 1, errors: ['Firestore is not initialized.'] };
    }

    const squareClient = await getSquareClient();
    const locationId = await getSquareLocationId();
    
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // The Square API doesn't allow searching by invoice number range directly.
    // We search a broad range of invoices by date and then filter.
    // This is not ideal but is a limitation of the API. We'll list invoices and then filter.
    
    try {
        console.log('Fetching all invoices from Square. This might take a moment...');
        const { result: { invoices } } = await squareClient.invoicesApi.listInvoices({
            locationId: locationId,
            limit: 200, // API max limit
        });

        if (!invoices) {
            return { created: 0, updated: 0, failed: 0, errors: ['No invoices found in Square for this location.'] };
        }
        
        console.log(`Found ${invoices.length} total invoices. Filtering from ${input.startInvoiceNumber} to ${input.endInvoiceNumber}.`);

        const invoicesToProcess = invoices.filter(inv => {
            const invNumber = parseInt(inv.invoiceNumber || '0', 10);
            return invNumber >= input.startInvoiceNumber && invNumber <= input.endInvoiceNumber;
        });
        
        if (invoicesToProcess.length === 0) {
            return { created: 0, updated: 0, failed: 0, errors: ['No invoices found in the specified number range.'] };
        }

        const batch = writeBatch(db);

        for (const invoice of invoicesToProcess) {
            try {
                const invoiceData = await processSingleInvoice(squareClient, invoice);
                const q = query(collection(db, 'invoices'), where('invoiceId', '==', invoice.id));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    // Create new record
                    const docRef = doc(db, 'invoices', invoice.id!);
                    batch.set(docRef, invoiceData);
                    createdCount++;
                } else {
                    // Update existing record
                    const docRef = doc(db, 'invoices', querySnapshot.docs[0].id);
                    batch.update(docRef, invoiceData);
                    updatedCount++;
                }
            } catch (procError: any) {
                failedCount++;
                errors.push(`Invoice #${invoice.invoiceNumber}: ${procError.message}`);
            }
        }
        
        await batch.commit();

    } catch (apiError: any) {
        console.error('Square API error:', apiError);
        return { created: 0, updated: 0, failed: 1, errors: [`Square API Error: ${apiError.message}`] };
    }
    
    return { created: createdCount, updated: updatedCount, failed: failedCount, errors };
  }
);


async function processSingleInvoice(client: any, invoice: Invoice) {
    if (!invoice.orderId || !invoice.primaryRecipient?.customerId) {
        throw new Error(`Invoice #${invoice.invoiceNumber} is missing order or customer ID.`);
    }

    const { result: { order } } = await client.ordersApi.retrieveOrder(invoice.orderId);
    const { result: { customer } } = await client.customersApi.retrieveCustomer(invoice.primaryRecipient.customerId);
    
    const selections: Record<string, any> = {};

    order.lineItems?.forEach((item: any) => {
        if (item.name?.toLowerCase().includes('registration')) {
            const playerNotes = item.note?.split('\n') || [];
            playerNotes.forEach((note: string) => {
                const match = note.match(/\d+\.\s*(.+?)\s*\((\d{8}|\w+)\)/);
                if (match) {
                    const [, name, uscfId] = match;
                    selections[uscfId] = {
                        playerName: name.trim(),
                        section: 'Unknown', // This info isn't on the Square invoice
                        uscfStatus: 'current', // Assume current, can't know for sure
                    };
                }
            });
        }
    });

    const totalInvoiced = Number(invoice.paymentRequests?.[0]?.totalCompletedAmountMoney?.amount || 0) / 100;

    return {
        id: invoice.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceTitle: invoice.title,
        submissionTimestamp: invoice.createdAt,
        eventDate: invoice.createdAt, // Best guess from invoice creation
        eventName: invoice.title,
        selections,
        totalInvoiced: totalInvoiced,
        invoiceUrl: invoice.publicUrl,
        invoiceStatus: invoice.status,
        status: invoice.status,
        purchaserName: `${customer.givenName} ${customer.familyName}`,
        schoolName: customer.companyName,
        sponsorEmail: customer.emailAddress,
        district: customer.companyName?.split(' / ')[1] || 'Unknown',
        teamCode: generateTeamCode({ schoolName: customer.companyName, district: customer.companyName?.split(' / ')[1] }),
    };
}
