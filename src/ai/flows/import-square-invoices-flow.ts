
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client, Environment, type Invoice, type Customer } from 'square';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { generateTeamCode } from '@/lib/school-utils';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';


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

    // Hard-coded Square client initialization - same as other flows
    console.log('Initializing Square client with hard-coded values...');
    const squareClient = new Client({
      accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
      environment: Environment.Production,
    });
    const locationId = "CTED7GVSVH5H8"; // Same locationId as other flows
    console.log('Square client initialized with hard-coded production credentials');
    
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // The Square API doesn't allow searching by invoice number range directly.
    // We search a broad range of invoices by date and then filter.
    // This is not ideal but is a limitation of the API. We'll list invoices and then filter.
    
    try {
        console.log('Fetching all invoices from Square. This might take a moment...');
        const { result: { invoices } } = await squareClient.invoicesApi.listInvoices(
            locationId,
            undefined, // cursor for pagination
            200 // limit
        );

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


async function processSingleInvoice(client: Client, invoice: Invoice) {
    if (!invoice.orderId || !invoice.primaryRecipient?.customerId) {
        throw new Error(`Invoice #${invoice.invoiceNumber} is missing order or customer ID.`);
    }

    const { result: { order } } = await client.ordersApi.retrieveOrder(invoice.orderId);
    const { result: { customer } } = await client.customersApi.retrieveCustomer(invoice.primaryRecipient.customerId);
    
    const selections: Record<string, any> = {};
    const uscfFee = 24;
    let baseRegistrationFee = 0;

    order.lineItems?.forEach((item: any) => {
        if (item.name?.toLowerCase().includes('registration')) {
            baseRegistrationFee = Number(item.basePriceMoney?.amount || 0) / 100;
            const playerNotes = item.note?.split('\n') || [];
            playerNotes.forEach((note: string) => {
                const match = note.match(/\d+\.\s*(.+?)\s*\((\d{8}|\w+)\)/);
                if (match) {
                    const [, name, uscfId] = match;
                    selections[uscfId] = {
                        playerName: name.trim(),
                        section: 'Unknown', // This info isn't on the Square invoice
                        uscfStatus: 'current', // Assume current unless USCF fee is present
                        baseRegistrationFee,
                    };
                }
            });
        } else if (item.name?.toLowerCase().includes('uscf')) {
            const playerNotes = item.note?.split('\n') || [];
            playerNotes.forEach((note: string) => {
                const match = note.match(/\d+\.\s*(.+)/);
                if (match) {
                    const name = match[1].trim();
                    // Find the player in selections and update their USCF status
                    const playerEntry = Object.entries(selections).find(([_, p]) => p.playerName === name);
                    if (playerEntry) {
                        selections[playerEntry[0]].uscfStatus = 'new';
                    }
                }
            });
        }
    });

    const totalInvoiced = Number(invoice.paymentRequests?.[0]?.computedAmountMoney?.amount || 0) / 100;
    
    // Extract event name from title (e.g., "TEAMCODE @ DATE EVENT NAME")
    const titleParts = invoice.title?.split('@');
    const eventName = titleParts?.length === 2 ? titleParts[1].trim().split(' ').slice(1).join(' ') : invoice.title;

    // Use nickname if available, otherwise construct from given/family name
    const purchaserName = customer.nickname || `${customer.givenName || ''} ${customer.familyName || ''}`.trim();
    
    // Extract school and district from companyName
    const companyParts = customer.companyName?.split(' / ');
    const schoolName = companyParts?.[0] || customer.companyName || 'Unknown School';
    const district = companyParts?.[1] || 'Unknown District';

    return {
        id: invoice.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceTitle: invoice.title,
        submissionTimestamp: invoice.createdAt,
        eventDate: invoice.createdAt, // Best guess from invoice creation
        eventName: eventName,
        selections,
        totalInvoiced: totalInvoiced,
        totalAmount: totalInvoiced, // Make sure totalAmount is also set
        invoiceUrl: invoice.publicUrl,
        invoiceStatus: invoice.status,
        status: invoice.status,
        purchaserName: purchaserName,
        schoolName: schoolName,
        sponsorEmail: customer.emailAddress,
        district: district,
        teamCode: generateTeamCode({ schoolName: schoolName, district: district }),
        type: 'event', // Mark as an event type invoice
    };
}
