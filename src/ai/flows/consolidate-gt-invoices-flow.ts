
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { getDb } from '@/lib/firebase-admin';
import { createInvoice } from './create-invoice-flow';
import { getSquareClient } from '@/lib/square-client';

const ConsolidateGtInvoicesInputSchema = z.object({
  eventId: z.string().describe('The event ID to consolidate GT invoices for'),
  eventName: z.string().describe('The name of the event'),
  eventDate: z.string().describe('The date of the event'),
  gtCoordinatorEmail: z.string().email().describe('The GT coordinator email'),
  gtCoordinatorName: z.string().describe('The GT coordinator name'),
  gtProgramAddress: z.string().optional().describe('GT program billing address'),
  gtProgramPhone: z.string().optional().describe('GT program phone number'),
});

const ConsolidateGtInvoicesOutputSchema = z.object({
  consolidatedInvoiceId: z.string().describe('The ID of the consolidated GT invoice'),
  consolidatedInvoiceNumber: z.string().optional().describe('The invoice number of the consolidated invoice'),
  totalGtStudents: z.number().describe('Total number of GT students consolidated'),
  totalAmount: z.number().describe('Total amount of the consolidated invoice'),
  canceledInvoiceIds: z.array(z.string()).describe('Array of individual GT invoice IDs that were canceled'),
  schoolsIncluded: z.array(z.string()).describe('List of schools included in the consolidation'),
});

export type ConsolidateGtInvoicesInput = z.infer<typeof ConsolidateGtInvoicesInputSchema>;
export type ConsolidateGtInvoicesOutput = z.infer<typeof ConsolidateGtInvoicesOutputSchema>;

export async function consolidateGtInvoices(input: ConsolidateGtInvoicesInput): Promise<ConsolidateGtInvoicesOutput> {
  return consolidateGtInvoicesFlow(input);
}

const consolidateGtInvoicesFlow = ai.defineFlow(
  {
    name: 'consolidateGtInvoicesFlow',
    inputSchema: ConsolidateGtInvoicesInputSchema,
    outputSchema: ConsolidateGtInvoicesOutputSchema,
  },
  async (input) => {
    const db = getDb();

    // Step 1: Find all GT invoices for this event
    const invoicesQuery = query(
      collection(db, 'invoices'),
      where('eventId', '==', input.eventId),
      where('district', '==', 'PHARR-SAN JUAN-ALAMO ISD'),
      where('status', '==', 'UNPAID')
    );

    const invoiceSnapshot = await getDocs(invoicesQuery);
    const allInvoices = invoiceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const gtInvoices = allInvoices.filter(invoice => 
      invoice.eventName?.includes('GT') || 
      invoice.invoiceTitle?.includes('GT') ||
      invoice.eventName?.includes('- GT')
    );

    if (gtInvoices.length === 0) {
      throw new Error('No unpaid GT invoices found for this event to consolidate.');
    }

    console.log(`Found ${gtInvoices.length} GT invoices to consolidate`);

    // Step 2: Collect all GT players from all invoices
    const allGtPlayers: any[] = [];
    const schoolsIncluded: string[] = [];
    const invoiceIdsToCancel: string[] = [];
    let totalRegistrationFees = 0;

    for (const invoice of gtInvoices) {
      invoiceIdsToCancel.push(invoice.invoiceId);
      
      if (!schoolsIncluded.includes(invoice.schoolName)) {
        schoolsIncluded.push(invoice.schoolName);
      }

      if (invoice.selections) {
        for (const [playerId, details] of Object.entries(invoice.selections as Record<string, any>)) {
          const playerData = {
            playerName: `GT Student ${playerId}`, 
            uscfId: playerId,
            baseRegistrationFee: invoice.baseRegistrationFee || invoice.totalInvoiced / Object.keys(invoice.selections).length || 0,
            lateFee: 0,
            uscfAction: false,
            isGtPlayer: true,
            section: details.section || 'High School K-12',
            school: invoice.schoolName,
          };
          
          allGtPlayers.push(playerData);
          totalRegistrationFees += playerData.baseRegistrationFee;
        }
      }
    }

    console.log(`Consolidating ${allGtPlayers.length} GT students from ${schoolsIncluded.length} schools`);

    // Step 3: Create consolidated invoice
    const consolidatedResult = await createInvoice({
      sponsorName: input.gtCoordinatorName,
      sponsorEmail: input.gtCoordinatorEmail,
      sponsorPhone: input.gtProgramPhone,
      schoolName: 'PHARR-SAN JUAN-ALAMO ISD - GT Program',
      schoolAddress: input.gtProgramAddress,
      district: 'PHARR-SAN JUAN-ALAMO ISD',
      teamCode: 'PSJA-GT-CON',
      eventName: `${input.eventName} - GT Program Consolidated`,
      eventDate: input.eventDate,
      uscfFee: 24,
      players: allGtPlayers,
      description: `Consolidated invoice for GT students from ${schoolsIncluded.length} schools: ${schoolsIncluded.join(', ')}. USCF memberships covered under district's bulk plan.`,
    });

    // Step 4: Cancel individual GT invoices
    const squareClient = await getSquareClient();
    const { invoicesApi } = squareClient;
    const batch = writeBatch(db);

    for (const invoice of gtInvoices) {
      try {
        if (invoice.invoiceId && invoice.version) {
          await invoicesApi.cancelInvoice(invoice.invoiceId, { version: invoice.version });
          const invoiceRef = doc(db, 'invoices', invoice.id);
          batch.update(invoiceRef, { status: 'CANCELED', invoiceStatus: 'CANCELED', cancelReason: 'Consolidated' });
          console.log(`Canceled invoice ${invoice.invoiceId}`);
        } else {
           console.warn(`Invoice ${invoice.id} is missing invoiceId or version, marking as canceled locally.`);
           const invoiceRef = doc(db, 'invoices', invoice.id);
           batch.update(invoiceRef, { status: 'CANCELED', invoiceStatus: 'CANCELED', cancelReason: 'Consolidated - Missing Square ID/Version' });
        }
      } catch (error: any) {
        if (error.statusCode === 404 || (error.body && error.body.includes('not found'))) {
          console.warn(`Invoice ${invoice.invoiceId} not found in Square, marking as canceled locally.`);
          const invoiceRef = doc(db, 'invoices', invoice.id);
          batch.update(invoiceRef, { status: 'CANCELED', invoiceStatus: 'CANCELED', cancelReason: 'Consolidated - Not found in Square' });
        } else {
          console.error(`Failed to cancel invoice ${invoice.invoiceId}:`, error);
        }
      }
    }
    await batch.commit();

    return {
      consolidatedInvoiceId: consolidatedResult.invoiceId,
      consolidatedInvoiceNumber: consolidatedResult.invoiceNumber,
      totalGtStudents: allGtPlayers.length,
      totalAmount: totalRegistrationFees,
      canceledInvoiceIds: invoiceIdsToCancel,
      schoolsIncluded,
    };
  }
);

// Helper function to check if GT consolidation is available for an event
export async function canConsolidateGtInvoices(eventId: string): Promise<{
  canConsolidate: boolean;
  gtInvoiceCount: number;
  totalGtStudents: number;
}> {
  const db = getDb();
  
  const invoicesQuery = query(
    collection(db, 'invoices'),
    where('eventId', '==', eventId),
    where('district', '==', 'PHARR-SAN JUAN-ALAMO ISD'),
    where('status', '==', 'UNPAID')
  );

  const invoiceSnapshot = await getDocs(invoicesQuery);
  const allInvoices = invoiceSnapshot.docs.map(doc => doc.data());

  const gtInvoices = allInvoices.filter(invoice => 
    invoice.eventName?.includes('GT') || 
    invoice.invoiceTitle?.includes('GT')
  );

  const totalGtStudents = gtInvoices.reduce((sum, invoice) => {
    return sum + (invoice.selections ? Object.keys(invoice.selections).length : 0);
  }, 0);

  return {
    canConsolidate: gtInvoices.length > 0,
    gtInvoiceCount: gtInvoices.length,
    totalGtStudents,
  };
}
