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

// Define the Event type directly in the server-side flow to avoid client-side imports.
type Event = {
  id: string;
  name: string;
  date: string;
  location: string;
  rounds: number;
  regularFee: number;
  lateFee: number;
  veryLateFee: number;
  dayOfFee: number;
  imageUrl?: string;
  imageName?: string;
  pdfUrl?: string;
  pdfName?: string;
  isClosed?: boolean;
  isPsjaOnly?: boolean;
};

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
    console.log('Starting batch processing with:', { requestIds, decision, waiveFees });

    if (!db) {
      console.error('Firestore database is not initialized');
      throw new Error("Firestore database is not initialized.");
    }

    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const batch = writeBatch(db);

    try {
      console.log('Fetching events and players from Firestore...');
      
      // Fetch all necessary data from Firestore at the beginning
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      const allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Event);
      console.log(`Loaded ${allEvents.length} events`);

      const playersSnapshot = await getDocs(collection(db, 'players'));
      const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MasterPlayer);
      console.log(`Loaded ${allPlayers.length} players`);

      for (const requestId of requestIds) {
        console.log(`Processing request: ${requestId}`);
        
        try {
          const requestRef = doc(db, 'requests', requestId);
          const requestDoc = await getDoc(requestRef);

          if (!requestDoc.exists()) {
            console.error(`Request ${requestId} not found`);
            failedCount++;
            errors.push(`Request ID ${requestId} not found.`);
            continue;
          }
          
          const request = requestDoc.data() as ChangeRequest;
          console.log(`Request data:`, { type: request.type, player: request.player, details: request.details });

          if (decision === 'Denied') {
            batch.update(requestRef, {
              status: 'Denied',
              approvedBy: `${processingUser.firstName} ${processingUser.lastName}`,
              approvedAt: new Date().toISOString(),
            });
            processedCount++;
            console.log(`Request ${requestId} marked as denied`);
          } else { // Approved
            console.log(`Processing approval for request ${requestId}`);
            
            // Validate required fields
            if (!request.confirmationId) {
              throw new Error('Request missing confirmationId');
            }

            const originalConfirmationDoc = await getDoc(doc(db, 'invoices', request.confirmationId));
            if (!originalConfirmationDoc.exists()) {
                throw new Error(`Original invoice ${request.confirmationId} not found.`);
            }
            
            const originalConfirmation = originalConfirmationDoc.data();
            console.log('Original confirmation:', originalConfirmation);
            
            if (!originalConfirmation.eventId) {
              throw new Error('Original confirmation missing eventId');
            }
            
            const eventDetails = allEvents.find(e => e.id === originalConfirmation.eventId);
            if (!eventDetails) {
              throw new Error(`Event ${originalConfirmation.eventId} not found in loaded events`);
            }
            console.log('Found event:', eventDetails.name);

            let newSelections = { ...(originalConfirmation.selections || {}) };
            console.log('Original selections:', Object.keys(newSelections));
            
            if (request.type === 'Substitution') {
              console.log('Processing substitution request');
              
              // Find player to remove with better error handling
              const playerToRemoveId = Object.keys(newSelections).find(id => {
                  const player = allPlayers.find(p => p.id === id);
                  if (!player) {
                    console.warn(`Player with id ${id} not found in master database`);
                    return false;
                  }
                  const playerFullName = `${player.firstName || ''} ${player.lastName || ''}`.trim().toLowerCase();
                  const requestPlayerName = (request.player || '').trim().toLowerCase();
                  return playerFullName === requestPlayerName;
              });
              
              // Extract new player name from details with better parsing
              const detailsMatch = request.details?.match(/with\s+(.+?)(?:\s*\.|$)/i);
              const newPlayerName = detailsMatch ? detailsMatch[1].trim() : null;
      
              if (!playerToRemoveId) {
                throw new Error(`Could not find player "${request.player}" in current selections`);
              }
              
              if (!newPlayerName) {
                throw new Error(`Could not extract replacement player name from details: "${request.details}"`);
              }
              
              console.log(`Substituting ${request.player} with ${newPlayerName}`);

              delete newSelections[playerToRemoveId];
              
              const newPlayer = allPlayers.find(p => {
                const playerFullName = `${p.firstName || ''} ${p.lastName || ''}`.trim().toLowerCase();
                return playerFullName === newPlayerName.toLowerCase();
              });
              
              if (!newPlayer) {
                throw new Error(`Player to add "${newPlayerName}" not found in master database.`);
              }

              newSelections[newPlayer.id] = { 
                  section: newPlayer.section, 
                  uscfStatus: newPlayer.uscfId?.toUpperCase() === 'NEW' ? 'new' : 'current',
                  status: 'active' 
              };
              
            } else if (request.type === 'Withdrawal') {
              console.log('Processing withdrawal request');
              
              const playerToRemoveId = Object.keys(newSelections).find(id => {
                  const player = allPlayers.find(p => p.id === id);
                  if (!player) {
                    console.warn(`Player with id ${id} not found in master database`);
                    return false;
                  }
                  const playerFullName = `${player.firstName || ''} ${player.lastName || ''}`.trim().toLowerCase();
                  const requestPlayerName = (request.player || '').trim().toLowerCase();
                  return playerFullName === requestPlayerName;
              });
              
              if (playerToRemoveId) {
                  delete newSelections[playerToRemoveId];
                  console.log(`Removed player ${request.player} from selections`);
              } else {
                  console.warn(`Could not find player "${request.player}" to remove`);
              }
            }

            console.log('New selections:', Object.keys(newSelections));

            const newPlayerRoster = Object.keys(newSelections).map(playerId => {
                const player = allPlayers.find(p => p.id === playerId);
                if (!player) {
                  throw new Error(`Player ${playerId} not found in master database`);
                }
                return {
                    playerName: `${player.firstName || ''} ${player.lastName || ''}`.trim(),
                    uscfId: player.uscfId || '',
                    baseRegistrationFee: eventDetails.regularFee || 0,
                    lateFee: 0,
                    uscfAction: newSelections[playerId].uscfStatus !== 'current',
                    isGtPlayer: player.studentType === 'gt',
                    waiveLateFee: waiveFees || false,
                    section: newSelections[playerId].section || player.section || ''
                };
            });
            
            console.log(`Creating roster with ${newPlayerRoster.length} players`);

            await recreateInvoiceFromRoster({
                originalInvoiceId: originalConfirmation.invoiceId,
                players: newPlayerRoster,
                uscfFee: 24,
                requestingUserRole: 'organizer',
                sponsorName: originalConfirmation.sponsorName || '',
                sponsorEmail: originalConfirmation.sponsorEmail || '',
                schoolName: originalConfirmation.schoolName || '',
                teamCode: originalConfirmation.teamCode || '',
                eventName: originalConfirmation.eventName || eventDetails.name,
                eventDate: originalConfirmation.eventDate || eventDetails.date,
                revisionMessage: `Request #${request.id} processed: ${request.type} for ${request.player}`
            });

            batch.update(requestRef, {
                status: 'Approved',
                approvedBy: `${processingUser.firstName} ${processingUser.lastName}`,
                approvedAt: new Date().toISOString(),
            });
            processedCount++;
            console.log(`Request ${requestId} approved successfully`);

          }
        } catch (error) {
            console.error(`Error processing request ${requestId}:`, error);
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Request ${requestId}: ${errorMessage}`);
            
            // Update the request with error status
            try {
              const requestRef = doc(db, 'requests', requestId);
              batch.update(requestRef, { 
                status: 'Failed', 
                error: errorMessage,
                failedAt: new Date().toISOString()
              });
            } catch (batchError) {
              console.error(`Failed to update request ${requestId} with error status:`, batchError);
            }
        }
      }

      console.log('Committing batch operations...');
      await batch.commit();
      console.log('Batch processing completed');

    } catch (error) {
      console.error('Fatal error in batch processing:', error);
      throw error;
    }

    const result = { processedCount, failedCount, errors };
    console.log('Batch processing result:', result);
    return result;
  }
);
