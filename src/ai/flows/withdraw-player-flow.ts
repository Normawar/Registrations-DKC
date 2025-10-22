'use server';
/**
 * @fileOverview This flow has been deprecated.
 * All invoice modifications should now use rebuild-invoice-from-roster-flow.ts
 * to ensure data integrity by rebuilding the invoice from the source of truth (the app's roster state)
 * rather than attempting to parse and modify existing invoice data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DeprecatedInputSchema = z.object({
  invoiceId: z.string(),
});
export type DeprecatedInput = z.infer<typeof DeprecatedInputSchema>;

const DeprecatedOutputSchema = z.object({
  error: z.string(),
});
export type DeprecatedOutput = z.infer<typeof DeprecatedOutputSchema>;


export async function withdrawPlayerFromInvoice(input: DeprecatedInput): Promise<DeprecatedOutput> {
  return flow(input);
}

const flow = ai.defineFlow(
  {
    name: 'withdrawPlayerFlow_DEPRECATED',
    inputSchema: DeprecatedInputSchema,
    outputSchema: DeprecatedOutputSchema,
  },
  async () => {
    const errorMsg = "This flow is deprecated. Use rebuild-invoice-from-roster-flow instead.";
    console.error(errorMsg);
    return { error: errorMsg };
  }
);
