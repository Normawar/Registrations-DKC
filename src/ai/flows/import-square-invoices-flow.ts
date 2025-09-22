
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client, Environment, type Invoice, type Order, type Customer } from 'square';
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

    console.log('Initializing Square client with hard-coded values...');
    const squareClient = new Client({
      accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
      environment: Environment.Production,
    });
    const locationId = "CTED7GVSVH5H8";
    console.log('Square client initialized with hard-coded production credentials');
    
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    
    try {
        console.log('Fetching all invoices from Square. This might take a moment...');
        const { result: { invoices } } = await squareClient.invoicesApi.listInvoices(locationId, undefined, 200);

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
                const invoiceData = await processSingleInvoice(squareClient, invoice, batch);
                if (!invoiceData) {
                    failedCount++;
                    errors.push(`Invoice #${invoice.invoiceNumber}: Failed to process invoice data.`);
                    continue;
                }
                const q = query(collection(db, 'invoices'), where('invoiceId', '==', invoice.id));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    const docRef = doc(db, 'invoices', invoice.id!);
                    batch.set(docRef, invoiceData);
                    createdCount++;
                } else {
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


async function processSingleInvoice(client: Client, invoice: Invoice, batch: FirebaseFirestore.WriteBatch) {
    if (!invoice.orderId || !invoice.primaryRecipient?.customerId) {
        throw new Error(`Invoice #${invoice.invoiceNumber} is missing order or customer ID.`);
    }

    const { result: { order } } = await client.ordersApi.retrieveOrder(invoice.orderId);
    const { result: { customer } } = await client.customersApi.retrieveCustomer(invoice.primaryRecipient.customerId);
    
    // Improved school and district extraction
    const companyName = customer.companyName || 'Unknown School';
    let schoolName = 'Unknown School';
    let district = 'Unknown District';
    if (companyName.includes('/')) {
        const parts = companyName.split(' / ');
        schoolName = parts[0].trim();
        district = parts[1] ? parts[1].trim() : 'Unknown District';
    } else {
        schoolName = companyName;
        // Attempt to find district from known school data if not provided
        // This part can be enhanced with a lookup against the schools collection
    }
    
    const { selections, baseRegistrationFee } = await parseSelectionsFromOrder(order, schoolName, district, batch);

    if (Object.keys(selections).length === 0) {
        console.warn(`No players parsed for Invoice #${invoice.invoiceNumber}. Skipping player data creation.`);
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
        teamCode: generateTeamCode({ schoolName: schoolName, district: district }),
        type: 'event',
        baseRegistrationFee: baseRegistrationFee, // Store the calculated base fee
    };

    // Remove any undefined keys before saving
    Object.keys(finalData).forEach(key => finalData[key as keyof typeof finalData] === undefined && delete finalData[key as keyof typeof finalData]);

    return finalData;
}

async function parseSelectionsFromOrder(order: Order, schoolName: string, district: string, batch: FirebaseFirestore.WriteBatch) {
    const selections: Record<string, any> = {};
    let baseRegistrationFee = 0;

    if (!order.lineItems) return { selections, baseRegistrationFee };
  
    // First, find the base registration fee
    const registrationItem = order.lineItems.find(item => item.name?.toLowerCase().includes('registration'));
    if (registrationItem) {
        baseRegistrationFee = Number(registrationItem.basePriceMoney?.amount || 0) / 100;
    }

    for (const item of order.lineItems) {
        const itemNameLower = item.name?.toLowerCase() || '';
        const isRegistrationItem = itemNameLower.includes('registration');
        const isUscfItem = itemNameLower.includes('uscf');

        if (isRegistrationItem || isUscfItem) {
            const playerNotes = item.note?.split('\n') || [];
            
            for (const note of playerNotes) {
                const playerInfo = parsePlayerFromNote(note.trim());
                
                if (playerInfo) {
                    const { firstName, lastName, middleName, uscfId, isNewPlayer } = playerInfo;
                    const playerId = uscfId || `NEW_${Date.now()}_${firstName.charAt(0)}${lastName.charAt(0)}_${Math.random().toString(36).substr(2, 5)}`;
                    
                    const playerDoc: Partial<MasterPlayer> = {
                        id: playerId,
                        uscfId: uscfId || 'NEW',
                        firstName, lastName, middleName,
                        school: schoolName, district,
                        createdAt: order.createdAt,
                    };
                    
                    Object.keys(playerDoc).forEach(key => playerDoc[key as keyof typeof playerDoc] === undefined && delete playerDoc[key as keyof typeof playerDoc]);

                    const playerRef = doc(db, 'players', playerId);
                    batch.set(playerRef, playerDoc, { merge: true });

                    if (!selections[playerId]) {
                        selections[playerId] = {
                            playerName: `${firstName} ${lastName}`,
                            section: 'Unknown', // Default value
                            baseRegistrationFee: baseRegistrationFee,
                        };
                    }
                    
                    if (isRegistrationItem) {
                        selections[playerId].isRegistered = true;
                    }
                    if (isUscfItem) {
                        selections[playerId].uscfStatus = isNewPlayer ? 'new' : 'renewing';
                    } else if (isRegistrationItem && !selections[playerId].uscfStatus) {
                        selections[playerId].uscfStatus = 'current'; // Assume current if not in USCF item
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
        /^(\d{8,})\s+([A-Z\s,'-]+)(?:\s+\d{1,2}\/\d{1,2}\/\d{2,4})?/i,
        /^([A-Z][A-Za-z\s,'-]+?)\s+NEW\s*$/i,
        /^([A-Z][A-Za-z\s,'-]{2,})\s*$/i,
        /([A-Z][A-Za-z\s,'-]*[A-Za-z])\s*[^\w]*(\d{8,})/i
    ];
    
    for (const pattern of patterns) {
        const match = cleanNote.match(pattern);
        
        if (match) {
            let name: string, uscfId: string | undefined;
            
            if (pattern === patterns[3]) { uscfId = match[1]; name = match[2]; } 
            else if (pattern === patterns[4] || pattern === patterns[5]) { name = match[1]; uscfId = undefined; } 
            else { name = match[1]; uscfId = match[2]; }
            
            if (uscfId && uscfId.trim().length < 8) uscfId = undefined;
            
            name = name.trim().replace(/[,]+/g, ' ').replace(/\s+/g, ' ');
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
    
    console.log(`Could not parse player info from note: "${note}"`);
    return null;
}
