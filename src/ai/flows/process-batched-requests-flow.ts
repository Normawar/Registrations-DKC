'use server';
/**
 * @fileOverview Processes a batch of change requests (approve or deny).
 * This flow is designed for organizers to handle multiple requests at once.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { doc, getDoc, writeBatch, getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { recreateInvoiceFromRoster } from './recreate-invoice-from-roster-flow';
import { type ChangeRequest } from '@/lib/data/requests-data';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';
import { type Event } from '@/hooks/use-events';


const BatchedRequestInputSchema = z.object({
  requestIds: z.array(z.string()).describe('An array of request IDs to process.'),
  decision: z.enum(['Approved', 'Denied']).describe('The decision to apply to all requests.'),
  waiveFees: z.boolean().optional().describe('Whether to waive any additional fees for approved requests.'),
  processingUser: z.object({
    uid: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
  }).describe('The organizer processing the requests.'),
});
export type ProcessBatchInput = z.infer<typeof BatchedRequestInputSchema>;

const ProcessBatchOutputSchema = z.object({
  processedCount: z.number().describe('The number of requests successfully processed.'),
  failedCount: z.number().describe('The number of requests that failed to process.'),
  errors: z.array(z.string()).optional().describe('A list of error messages for failed requests.'),
});
export type ProcessBatchOutput = z.infer<typeof ProcessBatchOutputSchema>;


export async function processBatchedRequests(input: ProcessBatchInput): Promise<ProcessBatchOutput> {
  return processBatchedRequestsFlow(input);
}

const processBatchedRequestsFlow = ai.defineFlow(
  {
    name: 'processBatchedRequestsFlow',
    inputSchema: BatchedRequestInputSchema,
    outputSchema: ProcessBatchOutputSchema,
  },
  async ({ requestIds, decision, waiveFees, processingUser }) => {
    if (!db) {
        throw new Error("Firestore database is not initialized.");
    }
    
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const batch = writeBatch(db);

    // Fetch all necessary data from Firestore at the beginning
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const allEvents = eventsSnapshot.docs.map(doc => doc.data() as Event);

    const playersSnapshot = await getDocs(collection(db, 'players'));
    const allPlayers = playersSnapshot.docs.map(doc => doc.data() as MasterPlayer);

    for (const requestId of requestIds) {
      const requestRef = doc(db, 'requests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        failedCount++;
        errors.push(`Request ID ${requestId} not found.`);
        continue;
      }
      const request = requestDoc.data() as ChangeRequest;

      if (decision === 'Denied') {
        batch.update(requestRef, {
          status: 'Denied',
          approvedBy: `${processingUser.firstName} ${processingUser.lastName}`,
          approvedAt: new Date().toISOString(),
        });
        processedCount++;
      } else { // Approved
        try {
            const originalConfirmationDoc = await getDoc(doc(db, 'invoices', request.confirmationId));
            if (!originalConfirmationDoc.exists()) {
                throw new Error(`Original invoice ${request.confirmationId} not found.`);
            }
            const originalConfirmation = originalConfirmationDoc.data();
            const eventDetails = allEvents.find(e => e.id === originalConfirmation.eventId);
            if (!eventDetails) throw new Error('Original event not found.');
    
            let newSelections = { ...(originalConfirmation.selections || {}) };
            
            if (request.type === 'Substitution') {
                const playerToRemoveId = Object.keys(newSelections).find(id => {
                    const player = allPlayers.find(p => p.id === id);
                    return player && `${player.firstName} ${player.lastName}`.trim().toLowerCase() === request.player.toLowerCase();
                });
                
                const detailsMatch = request.details?.match(/with (.*)/);
                const newPlayerName = detailsMatch ? detailsMatch[1].replace(/\..*/, '').trim() : null;
        
                if (!playerToRemoveId || !newPlayerName) throw new Error("Could not identify players for substitution.");
        
                delete newSelections[playerToRemoveId];
                
                const newPlayer = allPlayers.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === newPlayerName.toLowerCase());
                if (!newPlayer) throw new Error(`Player to add "${newPlayerName}" not found in master database.`);
        
                newSelections[newPlayer.id] = { 
                    section: newPlayer.section, 
                    uscfStatus: newPlayer.uscfId.toUpperCase() === 'NEW' ? 'new' : 'current',
                    status: 'active' 
                };
            } else if (request.type === 'Withdrawal') {
                const playerToRemoveId = Object.keys(newSelections).find(id => {
                    const player = allPlayers.find(p => p.id === id);
                    return player && `${player.firstName} ${player.lastName}`.trim().toLowerCase() === request.player.toLowerCase();
                });
                if (playerToRemoveId) {
                    delete newSelections[playerToRemoveId];
                }
            }
    
            const newPlayerRoster = Object.keys(newSelections).map(playerId => {
                const player = allPlayers.find(p => p.id === playerId)!;
                return {
                    playerName: `${player.firstName} ${player.lastName}`,
                    uscfId: player.uscfId,
                    baseRegistrationFee: eventDetails.regularFee,
                    lateFee: 0,
                    uscfAction: newSelections[playerId].uscfStatus !== 'current',
                    isGtPlayer: player.studentType === 'gt',
                    waiveLateFee: waiveFees,
                    section: newSelections[playerId].section
                };
            });
    
            await recreateInvoiceFromRoster({
                originalInvoiceId: originalConfirmation.invoiceId,
                players: newPlayerRoster,
                uscfFee: 24,
                requestingUserRole: 'organizer',
                sponsorName: originalConfirmation.sponsorName,
                sponsorEmail: originalConfirmation.sponsorEmail,
                schoolName: originalConfirmation.schoolName,
                teamCode: originalConfirmation.teamCode,
                eventName: originalConfirmation.eventName,
                eventDate: originalConfirmation.eventDate,
                revisionMessage: `Request #${request.id} processed: ${request.type} for ${request.player}`
            });
    
            batch.update(requestRef, {
                status: 'Approved',
                approvedBy: `${processingUser.firstName} ${processingUser.lastName}`,
                approvedAt: new Date().toISOString(),
            });
            processedCount++;

        } catch (error) {
            failedCount++;
            errors.push(`Request ${requestId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            batch.update(requestRef, { status: 'Failed', error: error instanceof Error ? error.message : 'Unknown processing error' });
        }
      }
    }

    await batch.commit();

    return { processedCount, failedCount, errors };
  }
);
