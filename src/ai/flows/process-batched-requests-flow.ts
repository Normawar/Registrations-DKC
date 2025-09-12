'use server';
/**
 * @fileOverview DEPRECATED. This flow attempts to modify a live Square invoice, which is unreliable.
 * Use `recreate-invoice-from-roster-flow.ts` instead, which follows the best practice of
 * canceling the old invoice and creating a new, revised one.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DeprecatedInputSchema = z.object({
  confirmationId: z.string(),
});

const DeprecatedOutputSchema = z.object({
  error: z.string(),
});

export type ProcessBatchInput = z.infer<typeof DeprecatedInputSchema>;
export type ProcessBatchOutput = z.infer<typeof DeprecatedOutputSchema>;


export async function processBatchedRequests(input: ProcessBatchInput): Promise<ProcessBatchOutput> {
  return flow(input);
}

const flow = ai.defineFlow(
  {
    name: 'processBatchedRequestsFlow_DEPRECATED',
    inputSchema: DeprecatedInputSchema,
    outputSchema: DeprecatedOutputSchema,
  },
  async () => {
    const errorMsg = "This flow is deprecated. Use `recreate-invoice-from-roster-flow.ts` instead.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
);
