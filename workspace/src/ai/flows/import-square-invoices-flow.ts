
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Client, Environment, type Invoice, type Order, type Customer } from 'square';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase-admin';
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
    
    // Enhanced school and district extraction
    const companyName = customer.companyName || 'Unknown School';
    let schoolName = 'Unknown School';
    let district = 'Unknown District';
    
    console.log(`Processing invoice ${invoice.invoiceNumber}, companyName: "${companyName}"`);
    
    if (companyName.includes(' / ')) {
        const parts = companyName.split(' / ');
        schoolName = parts[0].trim();
        district = parts.length > 1 ? parts[1].trim() : 'Unknown District';
    } else {
        schoolName = companyName.trim();
        // Try to extract district from school name if it contains "ISD", "CISD", etc.
        const districtMatch = schoolName.match(/\b([A-Z\-\s]+(?:ISD|CISD|USD|SCHOOL DISTRICT))\b/i);
        if (districtMatch) {
            district = districtMatch[1].trim();
        }
    }
    
    console.log(`Extracted school: "${schoolName}", district: "${district}"`);
    
    const { selections, baseRegistrationFee } = await parseSelectionsFromOrder(order, schoolName, district, batch);

    if (Object.keys(selections).length === 0) {
        console.warn(`No players parsed for Invoice #${invoice.invoiceNumber}. Skipping player data creation.`);
        // Add debugging info
        console.log('Order line items for debugging:');
        order.lineItems?.forEach((item, index) => {
            console.log(`Item ${index}:`, {
                name: item.name,
                note: item.note,
                quantity: item.quantity,
                basePriceMoney: item.basePriceMoney
            });
        });
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
        baseRegistrationFee: baseRegistrationFee,
    };

    Object.keys(finalData).forEach(key => finalData[key as keyof typeof finalData] === undefined && delete finalData[key as keyof typeof finalData]);

    return finalData;
}

async function parseSelectionsFromOrder(order: Order, schoolName: string, district: string, batch: FirebaseFirestore.WriteBatch) {
    const selections: Record<string, any> = {};
    let baseRegistrationFee = 0;

    if (!order.lineItems) return { selections, baseRegistrationFee };

    console.log(`Parsing ${order.lineItems.length} line items for players...`);
    
    for (const item of order.lineItems) {
        const itemNameLower = item.name?.toLowerCase() || '';
        const isRegistrationItem = itemNameLower.includes('registration');
        const isUscfItem = itemNameLower.includes('uscf');
        
        console.log(`Processing item: "${item.name}", isReg: ${isRegistrationItem}, isUSCF: ${isUscfItem}`);
        console.log(`Item note: "${item.note}"`);
        console.log(`Item quantity: ${item.quantity}`);
        console.log(`Item price: ${item.basePriceMoney?.amount}`);

        if (isRegistrationItem) {
            // Calculate base registration fee per person
            const totalPrice = Number(item.basePriceMoney?.amount || 0) / 100;
            const quantity = parseInt(item.quantity || '1', 10);
            baseRegistrationFee = Math.max(baseRegistrationFee, totalPrice / quantity);
        }

        if (isRegistrationItem || isUscfItem) {
            // Look for player names in multiple places
            const playerSources = [
                item.note || '',
                item.variationName || '',
                // Sometimes names are in the item name after parentheses
                item.name?.split('(')[1]?.replace(')', '') || ''
            ];
            
            let playersFound = false;
            
            for (const source of playerSources) {
                if (source.trim()) {
                    console.log(`Checking source: "${source}"`);
                    const playerNotes = source.split('\n');
                    
                    for (const note of playerNotes) {
                        const playerInfo = parsePlayerFromNote(note.trim());
                        
                        if (playerInfo) {
                            playersFound = true;
                            console.log(`Found player: ${JSON.stringify(playerInfo)}`);
                            
                            const { firstName, lastName, middleName, uscfId, isNewPlayer } = playerInfo;
                            const playerId = uscfId || `NEW_${Date.now()}_${firstName.charAt(0)}${lastName.charAt(0)}_${Math.random().toString(36).substr(2, 9)}`;
                            
                            const playerDoc: Partial<MasterPlayer> = {
                                id: playerId,
                                uscfId: uscfId || 'NEW',
                                firstName, 
                                lastName, 
                                middleName,
                                school: schoolName, 
                                district,
                                createdAt: order.createdAt,
                            };
                            
                            Object.keys(playerDoc).forEach(key => playerDoc[key as keyof typeof playerDoc] === undefined && delete playerDoc[key as keyof typeof playerDoc]);

                            const playerRef = doc(db, 'players', playerId);
                            batch.set(playerRef, playerDoc, { merge: true });

                            if (!selections[playerId]) {
                                selections[playerId] = {
                                    playerName: `${firstName} ${lastName}`,
                                    section: 'Unknown',
                                    baseRegistrationFee: baseRegistrationFee,
                                };
                            }
                            
                            if (isRegistrationItem) {
                                selections[playerId].isRegistered = true;
                            }
                            if (isUscfItem) {
                                selections[playerId].uscfStatus = isNewPlayer ? 'new' : 'renewing';
                                // USCF fee calculation
                                const uscfTotalPrice = Number(item.basePriceMoney?.amount || 0) / 100;
                                const uscfQuantity = parseInt(item.quantity || '1', 10);
                                selections[playerId].uscfFee = uscfTotalPrice / uscfQuantity;
                            } else if (isRegistrationItem && !selections[playerId].uscfStatus) {
                                selections[playerId].uscfStatus = 'current';
                            }
                        }
                    }
                    
                    if (playersFound) break; // Found players in this source, no need to check others
                }
            }
            
            // If no players found in notes/sources, try to infer from quantity
            if (!playersFound && item.quantity) {
                const quantity = parseInt(item.quantity, 10);
                console.log(`No player names found, but quantity is ${quantity}. Creating ${quantity} unknown players.`);
                
                for (let i = 1; i <= quantity; i++) {
                    const playerId = `UNKNOWN_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`;
                    
                    const playerDoc: Partial<MasterPlayer> = {
                        id: playerId,
                        uscfId: 'UNKNOWN',
                        firstName: 'Unknown',
                        lastName: `Player ${i}`,
                        school: schoolName,
                        district,
                        createdAt: order.createdAt,
                    };

                    const playerRef = doc(db, 'players', playerId);
                    batch.set(playerRef, playerDoc, { merge: true });

                    selections[playerId] = {
                        playerName: `Unknown Player ${i}`,
                        section: 'Unknown',
                        baseRegistrationFee: baseRegistrationFee,
                        uscfStatus: isUscfItem ? 'unknown' : 'current',
                        isRegistered: isRegistrationItem,
                    };
                    
                    if (isUscfItem) {
                        const uscfTotalPrice = Number(item.basePriceMoney?.amount || 0) / 100;
                        selections[playerId].uscfFee = uscfTotalPrice / quantity;
                    }
                }
            }
        }
    }
    
    console.log(`Found ${Object.keys(selections).length} total players`);
    return { selections, baseRegistrationFee };
}

function parsePlayerFromNote(note: string): { firstName: string; lastName: string; middleName?: string; uscfId?: string; isNewPlayer: boolean } | null {
    if (!note || note.trim() === '') return null;
    
    const cleanNote = note.replace(/^\s*\d+\.?\s*/, '').trim();
    const isNewPlayer = cleanNote.toLowerCase().includes('new');
    
    console.log(`Parsing note: "${cleanNote}", isNew: ${isNewPlayer}`);
    
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
        
        // Pattern 6: Just Name (for any remaining name-only cases) - more permissive
        /^([A-Z][A-Za-z\s,'-]{2,}?)(?:\s+NEW)?\s*$/i,
        
        // Pattern 7: More flexible - any 8+ digit number with surrounding text
        /([A-Z][A-Za-z\s,'-]*[A-Za-z])\s*[^\w]*(\d{8,})/i
    ];
    
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = cleanNote.match(pattern);
        
        if (match) {
            console.log(`Matched pattern ${i + 1}: ${pattern}`);
            let name: string, uscfId: string | undefined;
            
            if (i === 3) { // USCF_ID Name pattern
                uscfId = match[1];
                name = match[2];
            } else if (i === 4 || i === 5) { // Name NEW or Just Name patterns
                name = match[1];
                uscfId = undefined;
            } else {
                name = match[1];
                uscfId = match[2];
            }
            
            if (uscfId && uscfId.trim().length < 8) uscfId = undefined;
            
            // Clean name and remove "NEW" if present
            name = name.trim().replace(/\s+NEW\s*$/i, '').replace(/[,]+/g, ' ').replace(/\s+/g, ' ');
            const nameParts = name.split(/\s+/);
            
            if (nameParts.length < 2) continue;
            
            let firstName = nameParts[0];
            let lastName = nameParts[nameParts.length - 1];
            let middleName: string | undefined;
            
            // Handle suffixes
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
            
            const result = { firstName, lastName, middleName, uscfId, isNewPlayer };
            console.log(`Successfully parsed: ${JSON.stringify(result)}`);
            return result;
        }
    }
    
    console.log(`Could not parse player info from note: "${note}"`);
    return null;
}

    
