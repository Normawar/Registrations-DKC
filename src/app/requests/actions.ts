'use server';

import { processBatchedRequestsFlow } from '@/ai/flows/process-batched-requests-flow';
import { recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow } from '@/ai/flows/recreate-invoice-from-roster-flow';
import type { ProcessBatchInput, ProcessBatchOutput, RecreateInvoiceInput, RecreateInvoiceOutput } from '@/ai/flows/schemas';

/**
 * Server action to process a batch of change requests.
 * This acts as a safe wrapper around the Genkit flow.
 */
export async function processBatchedRequests(input: ProcessBatchInput): Promise<ProcessBatchOutput> {
  try {
    const result = await processBatchedRequestsFlow(input);
    return result;
  } catch (error) {
    console.error('Error in processBatchedRequests server action:', error);
    // Ensure we always return a valid ProcessBatchOutput structure
    return {
      processedCount: 0,
      failedCount: input.requestIds.length,
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
