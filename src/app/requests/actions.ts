'use server';

import { processBatchedRequestsFlow } from '@/ai/flows/process-batched-requests-flow';
import type { ProcessBatchInput, ProcessBatchOutput } from '@/ai/flows/schemas';

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
