
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
        // Fixed: Pass locationId and limit as separate parameters
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
    
    // Extract school and district from companyName
    const companyParts = customer.companyName?.split(' / ');
    const schoolName = companyParts?.[0] || customer.companyName || 'Unknown School';
    const district = companyParts?.[1] || 'Unknown District';
    
    const { selections } = await parseSelectionsFromOrder(order, schoolName, district, batch);

    const totalInvoiced = Number(invoice.paymentRequests?.[0]?.computedAmountMoney?.amount || 0) / 100;
    
    // Extract event name from title (e.g., "TEAMCODE @ DATE EVENT NAME")
    const titleParts = invoice.title?.split('@');
    const eventName = titleParts?.length === 2 ? titleParts[1].trim().split(' ').slice(1).join(' ') : invoice.title;

    // Use nickname if available, otherwise construct from given/family name
    const purchaserName = customer.nickname || `${customer.givenName || ''} ${customer.familyName || ''}`.trim();
    

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

async function parseSelectionsFromOrder(order: Order, schoolName: string, district: string, batch: FirebaseFirestore.WriteBatch) {
    const selections: Record<string, any> = {};
    let baseRegistrationFee = 0;

    if (!order.lineItems) return { selections, baseRegistrationFee };
  
    for (const item of order.lineItems) {
        const itemNameLower = item.name?.toLowerCase() || '';
        if (itemNameLower.includes('registration') || itemNameLower.includes('uscf')) {
            
            baseRegistrationFee = Math.max(baseRegistrationFee, Number(item.basePriceMoney?.amount || 0) / 100);
            
            const playerNotes = item.note?.split('\n') || [];
            
            for (const note of playerNotes) {
                const playerInfo = parsePlayerFromNote(note.trim());
                
                if (playerInfo) {
                    const { firstName, lastName, middleName, uscfId, isNewPlayer } = playerInfo;
                    
                    // Generate a temporary ID for new players (you might want to adjust this logic)
                    const playerId = uscfId || `NEW_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    const playerDoc: Partial<MasterPlayer> = {
                        id: playerId,
                        uscfId: uscfId || undefined, // Don't set uscfId for new players
                        firstName: firstName,
                        lastName: lastName,
                        middleName: middleName || undefined,
                        school: schoolName,
                        district: district,
                        createdAt: order.createdAt,
                    };
                    
                    // Remove any undefined keys before setting to Firestore
                    Object.keys(playerDoc).forEach(key => playerDoc[key as keyof typeof playerDoc] === undefined && delete playerDoc[key as keyof typeof playerDoc]);

                    const playerRef = doc(db, 'players', playerId);
                    batch.set(playerRef, playerDoc, { merge: true });

                    selections[playerId] = {
                        playerName: `${firstName} ${lastName}`,
                        section: 'Unknown',
                        uscfStatus: isNewPlayer ? 'new' : 'renewing',
                        baseRegistrationFee,
                        isNewPlayer: isNewPlayer,
                    };
                }
            }
        }
    }
    
    return { selections, baseRegistrationFee };
}

function parsePlayerFromNote(note: string): { firstName: string; lastName: string; middleName?: string; uscfId?: string; isNewPlayer: boolean } | null {
    // Skip empty notes
    if (!note || note.trim() === '') return null;
    
    // Remove any leading numbers/bullets (like "1. ", "2.", etc.)
    const cleanNote = note.replace(/^\s*\d+\.?\s*/, '').trim();
    
    // Check if this is a new player
    const isNewPlayer = cleanNote.toLowerCase().includes('new');
    
    // Try multiple parsing patterns in order of specificity
    const patterns = [
        // Pattern 1: Name (USCF_ID) - original format
        /^([A-Z\s,'-]+\s[A-Z\s\.'-]+)\s*\(\s*(\d{8,})\s*\)/i,
        
        // Pattern 2: Name USCF_ID Date - format like "Ricardo Vela Jr 30298695 12/31/24"
        /^([A-Z\s,'-]+)\s+(\d{8,})\s+\d{1,2}\/\d{1,2}\/\d{2,4}/i,
        
        // Pattern 3: Name USCF_ID (without date)
        /^([A-Z\s,'-]+)\s+(\d{8,})(?:\s|$)/i,
        
        // Pattern 4: USCF_ID Name (reverse order)
        /^(\d{8,})\s+([A-Z\s,'-]+)(?:\s+\d{1,2}\/\d{1,2}\/\d{2,4})?/i,
        
        // Pattern 5: Name NEW - for new players like "Emily Requenez NEW"
        /^([A-Z][A-Za-z\s,'-]+?)\s+NEW\s*$/i,
        
        // Pattern 6: Just Name (for any remaining name-only cases)
        /^([A-Z][A-Za-z\s,'-]{2,})\s*$/i,
        
        // Pattern 7: More flexible - any 8+ digit number with surrounding text
        /([A-Z][A-Za-z\s,'-]*[A-Za-z])\s*[^\w]*(\d{8,})/i
    ];
    
    for (const pattern of patterns) {
        const match = cleanNote.match(pattern);
        
        if (match) {
            let name: string;
            let uscfId: string | undefined;
            
            // Handle different capture group arrangements
            if (pattern === patterns[3]) { // USCF_ID Name pattern
                uscfId = match[1];
                name = match[2];
            } else if (pattern === patterns[4] || pattern === patterns[5]) { // Name NEW or Just Name patterns
                name = match[1];
                uscfId = undefined; // No USCF ID for these patterns
            } else {
                name = match[1];
                uscfId = match[2];
            }
            
            // Clean and validate USCF ID if present
            if (uscfId) {
                uscfId = uscfId.trim();
                if (uscfId.length < 8) {
                    uscfId = undefined; // Invalid USCF ID
                }
            }
            
            // Parse name parts
            name = name.trim().replace(/[,]+/g, ' ').replace(/\s+/g, ' ');
            const nameParts = name.split(/\s+/);
            
            if (nameParts.length < 2) continue; // Need at least first and last name
            
            // Handle names with suffixes (Jr, Sr, III, etc.)
            let firstName = nameParts[0];
            let lastName = nameParts[nameParts.length - 1];
            let middleName: string | undefined;
            
            // Check if last part is a suffix
            const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v'];
            const lastPartLower = lastName.toLowerCase().replace(/[^a-z]/g, '');
            
            if (suffixes.includes(lastPartLower) && nameParts.length > 2) {
                // Last part is a suffix, so actual last name is second to last
                const suffix = lastName;
                lastName = nameParts[nameParts.length - 2];
                middleName = nameParts.length > 3 ? nameParts.slice(1, -2).join(' ') + ' ' + suffix : suffix;
            } else if (nameParts.length > 2) {
                // Regular middle name case
                middleName = nameParts.slice(1, -1).join(' ');
            }
            
            // Validate that we have reasonable name parts
            if (firstName.length < 1 || lastName.length < 1) continue;
            
            return {
                firstName,
                lastName,
                middleName,
                uscfId,
                isNewPlayer
            };
        }
    }
    
    // If no patterns matched, log for debugging
    console.log(`Could not parse player info from note: "${note}"`);
    return null;
}

// Helper function to test the enhanced parser
function testEnhancedPlayerParser() {
    const testCases = [
        "Ricardo Vela Jr 30298695 12/31/24",
        "John Smith (12345678)",
        "Emily Requenez NEW",
        "Francisco Morales NEW",
        "Mikayla Anzaldu NEW",
        "1. Ricardo Vela Jr 30298695 12/31/24",
        "2. John Smith 12345678",
        "87654321 Jane Doe 03/20/25",
        "Alice Johnson-Smith 11223344 12/31/24",
        "Bob O'Connor Jr. NEW"
    ];
    
    console.log("Testing enhanced player parser:");
    testCases.forEach(testCase => {
        const result = parsePlayerFromNote(testCase);
        console.log(`"${testCase}" -> `, result);
    });
}
