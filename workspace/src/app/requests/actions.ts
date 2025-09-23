
'use server';

import { doc, getDoc, writeBatch, getDocs, collection, updateDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase-admin';
import type { ProcessBatchInput, ProcessBatchOutput, RecreateInvoiceInput, RecreateInvoiceOutput } from '@/ai/flows/schemas';
import { recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow } from '@/ai/flows/recreate-invoice-from-roster-flow';
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


/**
 * Server action to process a batch of change requests.
 * This function now contains the full logic and replaces the separate Genkit flow.
 */
export async function processBatchedRequests(input: ProcessBatchInput): Promise<ProcessBatchOutput> {
  const { requestIds, decision, waiveFees, processingUser } = input;
  console.log('Starting batch processing with:', { requestIds, decision, waiveFees });

  try {
    const db = getDb();
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const batch = writeBatch(db);

    const eventsSnapshot = await getDocs(collection(db, 'events'));
    const allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Event);

    const playersSnapshot = await getDocs(collection(db, 'players'));
    const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as MasterPlayer);

    for (const requestId of requestIds) {
      try {
        const requestRef = doc(db, 'requests', requestId);
        const requestDoc = await getDoc(requestRef);

        if (!requestDoc.exists()) {
          throw new Error(`Request ID ${requestId} not found.`);
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
          if (!request.confirmationId) throw new Error('Request missing confirmationId');
          
          const originalConfirmationDoc = await getDoc(doc(db, 'invoices', request.confirmationId));
          if (!originalConfirmationDoc.exists()) throw new Error(`Original invoice ${request.confirmationId} not found.`);
          
          const originalConfirmation = originalConfirmationDoc.data();
          if (!originalConfirmation.eventId) throw new Error('Original confirmation missing eventId');
          
          let newSelections = { ...(originalConfirmation.selections || {}) };
          
          if (request.type === 'Substitution') {
            const playerToRemoveId = Object.keys(newSelections).find(id => {
              const player = allPlayers.find(p => p.id === id);
              return player && `${player.firstName} ${player.lastName}`.trim().toLowerCase() === (request.player || '').trim().toLowerCase();
            });
            
            const newPlayerName = request.details?.match(/with\s+(.+?)(?:\s*\.|$)/i)?.[1]?.trim();
            if (!playerToRemoveId) throw new Error(`Could not find player "${request.player}" to substitute.`);
            if (!newPlayerName) throw new Error('Could not extract replacement player name from details.');
            
            delete newSelections[playerToRemoveId];
            
            const newPlayer = allPlayers.find(p => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === newPlayerName.toLowerCase());
            if (!newPlayer) throw new Error(`Player to add "${newPlayerName}" not found.`);

            newSelections[newPlayer.id] = { 
              section: newPlayer.section, 
              uscfStatus: newPlayer.uscfId?.toUpperCase() === 'NEW' ? 'new' : 'current',
              status: 'active' 
            };
          } else if (request.type === 'Withdrawal') {
            const playerToRemoveId = Object.keys(newSelections).find(id => {
              const player = allPlayers.find(p => p.id === id);
              return player && `${player.firstName} ${player.lastName}`.trim().toLowerCase() === (request.player || '').trim().toLowerCase();
            });
            if (playerToRemoveId) {
              delete newSelections[playerToRemoveId];
            } else {
              console.warn(`Could not find player "${request.player}" to withdraw.`);
            }
          }

          const invoiceRef = doc(db, 'invoices', request.confirmationId);
          await updateDoc(invoiceRef, {
            selections: newSelections,
            lastModified: new Date().toISOString(),
            modifiedBy: `${processingUser.firstName} ${processingUser.lastName}`,
            changeLog: `Request #${request.id} processed: ${request.type} for ${request.player}`,
            updatedAt: new Date().toISOString(),
          });

          batch.update(requestRef, {
            status: 'Approved',
            approvedBy: `${processingUser.firstName} ${processingUser.lastName}`,
            approvedAt: new Date().toISOString(),
          });
          processedCount++;
        }
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Request ${requestId}: ${errorMessage}`);
        const requestRef = doc(db, 'requests', requestId);
        batch.update(requestRef, { status: 'Failed', error: errorMessage, failedAt: new Date().toISOString() });
      }
    }

    await batch.commit();
    return { processedCount, failedCount, errors };
  } catch (error) {
    console.error('Fatal error in batch processing:', error);
    return {
      processedCount: 0,
      failedCount: requestIds.length,
      errors: [error instanceof Error ? error.message : 'An unknown server action error occurred.'],
    };
  }
}


/**
 * Server action to recreate an invoice from a roster.
 * This acts as a safe wrapper around the Genkit flow.
 */
export async function recreateInvoiceAction(input: RecreateInvoiceInput): Promise<{ success: true, data: RecreateInvoiceOutput } | { success: false, error: string }> {
  try {
    const result = await recreateInvoiceFromRosterFlow(input);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error in recreateInvoiceAction server action:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown server action error occurred.'
    };
  }
}
