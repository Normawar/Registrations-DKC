
'use server';
/**
 * @fileOverview DEPRECATED. Use `process-batched-requests-flow.ts` instead.
 * This flow incorrectly handles invoice updates by recreating them, which can lead
 * to invoice number collisions and other data integrity issues. The new batch
 * update flow correctly modifies the existing invoice.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DeprecatedInputSchema = z.object({
  originalInvoiceId: z.string(),
});
export type DeprecatedInput = z.infer<typeof DeprecatedInputSchema>;

const DeprecatedOutputSchema = z.object({
  error: z.string(),
});
export type DeprecatedOutput = z.infer<typeof DeprecatedOutputSchema>;

export async function recreateInvoiceFromRoster(input: DeprecatedInput): Promise<DeprecatedOutput> {
  return flow(input);
}

const flow = ai.defineFlow(
  {
    name: 'recreateInvoiceFlow_DEPRECATED',
    inputSchema: DeprecatedInputSchema,
    outputSchema: DeprecatedOutputSchema,
  },
  async () => {
    const errorMsg = "This flow is deprecated. Use `process-batched-requests-flow` instead. The Square API should be used to update existing invoices, not recreate them.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
);
