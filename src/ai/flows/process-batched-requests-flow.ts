
'use server';
/**
 * @fileOverview Processes a batch of change requests for a single invoice.
 * This flow updates an existing Square invoice and Firestore record instead of recreating them.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getSquareClient } from '@/lib/square-client';
import { db } from '@/lib/services/firestore-service';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { randomUUID } from 'crypto';
import type { OrderLineItem, Money, ApiError } from 'square';

// --- Schemas ---

const BatchedRequestSchema = z.object({
  requestId: z.string(),
  type: z.enum(['Withdrawal', 'Substitution', 'Addition']),
  playerNameToRemove: z.string().optional(),
  playerToAdd: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    uscfId: z.string(),
    section: z.string(),
    uscfStatus: z.string(),
    studentType: z.string().optional(),
  }).optional(),
});

const ProcessBatchInputSchema = z.object({
  confirmationId: z.string(),
  requests: z.array(BatchedRequestSchema),
  event: z.object({
    regularFee: z.number(),
    lateFee: z.number(),
    uscfFee: z.number(),
  }),
});

const ProcessBatchOutputSchema = z.object({
  success: z.boolean(),
  invoiceId: z.string(),
  message: z.string(),
  playersRemaining: z.number(),
});

export type ProcessBatchInput = z.infer<typeof ProcessBatchInputSchema>;
export type ProcessBatchOutput = z.infer<typeof ProcessBatchOutputSchema>;

// --- Helper Functions ---

function calculateLineItems(selections: Record<string, any>, eventFees: ProcessBatchInput['event']): OrderLineItem[] {
  const lineItems: OrderLineItem[] = [];
  const playerCount = Object.keys(selections).length;

  if (playerCount > 0) {
    lineItems.push({
      name: 'Tournament Registration',
      quantity: String(playerCount),
      basePriceMoney: {
        amount: BigInt(Math.round(eventFees.regularFee * 100)),
        currency: 'USD',
      }
    });
  }
  
  // Add other line items like late fees or USCF fees as needed
  // For simplicity, this example only includes the base registration.

  return lineItems;
}


// --- Main Flow ---

export async function processBatchedRequests(input: ProcessBatchInput): Promise<ProcessBatchOutput> {
  return processBatchedRequestsFlow(input);
}

const processBatchedRequestsFlow = ai.defineFlow(
  {
    name: 'processBatchedRequestsFlow',
    inputSchema: ProcessBatchInputSchema,
    outputSchema: ProcessBatchOutputSchema,
  },
  async ({ confirmationId, requests, event: eventFees }) => {
    console.log(`Processing ${requests.length} batched requests for confirmation ID: ${confirmationId}`);
    
    const confirmationDocRef = doc(db, 'invoices', confirmationId);
    const currentConfirmation = await getDoc(confirmationDocRef);

    if (!currentConfirmation.exists()) {
      throw new Error(`Original confirmation with ID ${confirmationId} not found.`);
    }
    const currentData = currentConfirmation.data();

    // 1. Apply changes to the roster in memory
    let updatedSelections = { ...(currentData.selections || {}) };
    const changesSummary: string[] = [];

    for (const request of requests) {
      const playerToRemoveId = Object.keys(updatedSelections).find(id => {
        const player = updatedSelections[id];
        return `${player.firstName} ${player.lastName}`.toLowerCase() === request.playerNameToRemove?.toLowerCase();
      });

      if (request.type === 'Withdrawal' && playerToRemoveId) {
        delete updatedSelections[playerToRemoveId];
        changesSummary.push(`Withdrew ${request.playerNameToRemove}`);
      } else if (request.type === 'Substitution' && playerToRemoveId && request.playerToAdd) {
        delete updatedSelections[playerToRemoveId];
        updatedSelections[request.playerToAdd.id] = { ...request.playerToAdd, status: 'active' };
        changesSummary.push(`Substituted ${request.playerNameToRemove} with ${request.playerToAdd.firstName} ${request.playerToAdd.lastName}`);
      }
    }
    
    // 2. Update the Square Invoice
    const squareClient = await getSquareClient();
    const invoiceId = currentData.invoiceId;

    try {
      const { result: { invoice } } = await squareClient.invoicesApi.getInvoice(invoiceId);

      if (invoice && ['UNPAID', 'PARTIALLY_PAID', 'DRAFT'].includes(invoice.status || '')) {
        if (invoice.orderId) {
          const newLineItems = calculateLineItems(updatedSelections, eventFees);
          const { result: { order } } = await squareClient.ordersApi.retrieveOrder(invoice.orderId);
          
          await squareClient.ordersApi.updateOrder(invoice.orderId, {
            idempotencyKey: randomUUID(),
            order: {
              version: order?.version,
              lineItems: newLineItems,
            },
          });
        }
      }
      // Update description regardless of status
      const { result: { invoice: updatedInvoice } } = await squareClient.invoicesApi.updateInvoice(invoiceId, {
        invoice: {
          version: invoice.version!,
          description: `${currentData.eventName}\n\nUpdates: ${changesSummary.join(', ')}`,
        },
        idempotencyKey: randomUUID(),
      });

      // 3. Update Firestore Invoice Record
      await updateDoc(confirmationDocRef, {
        selections: updatedSelections,
        totalInvoiced: updatedInvoice?.paymentRequests?.[0]?.computedAmountMoney?.amount ? Number(updatedInvoice.paymentRequests[0].computedAmountMoney.amount) / 100 : 0,
        lastModified: new Date().toISOString(),
      });

    } catch (e: any) {
        const error = e as ApiError;
        console.error('Square API Error during batch update:', JSON.stringify(error.result, null, 2));
        const errorMessage = error.result?.errors?.[0]?.detail || 'Failed to update Square Invoice.';
        throw new Error(`Square Error: ${errorMessage}`);
    }

    // 4. Mark requests as processed
    const batch = writeBatch(db);
    requests.forEach(request => {
      const requestRef = doc(db, 'requests', request.requestId);
      batch.update(requestRef, {
        status: 'Approved',
        processedInBatch: confirmationId,
        approvedAt: new Date().toISOString(),
      });
    });
    await batch.commit();

    return {
      success: true,
      invoiceId: confirmationId,
      message: `Successfully processed ${changesSummary.length} changes.`,
      playersRemaining: Object.keys(updatedSelections).length,
    };
  }
);
