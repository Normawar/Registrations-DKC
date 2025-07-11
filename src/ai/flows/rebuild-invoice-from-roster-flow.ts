
'use server';
/**
 * @fileOverview This flow is DEPRECATED. Use `recreate-invoice-from-roster-flow.ts` instead.
 * The Square API does not allow direct modification of line items on an invoiced order.
 * The correct approach is to cancel the old invoice and create a new one.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DeprecatedInputSchema = z.object({
  invoiceId: z.string(),
  players: z.array(z.any()),
  uscfFee: z.number(),
});
export type DeprecatedInput = z.infer<typeof DeprecatedInputSchema>;

const DeprecatedOutputSchema = z.object({
  error: z.string(),
});
export type DeprecatedOutput = z.infer<typeof DeprecatedOutputSchema>;

export async function rebuildInvoiceFromRoster(input: DeprecatedInput): Promise<DeprecatedOutput> {
  return flow(input);
}

const flow = ai.defineFlow(
  {
    name: 'rebuildInvoiceFlow_DEPRECATED',
    inputSchema: DeprecatedInputSchema,
    outputSchema: DeprecatedOutputSchema,
  },
  async () => {
    const errorMsg = "This flow is deprecated. Use recreate-invoice-from-roster-flow instead.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
);
