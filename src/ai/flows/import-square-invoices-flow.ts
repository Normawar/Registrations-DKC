'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { checkSquareConfig } from '@/lib/actions/check-config';

const ImportSquareInvoicesInputSchema = z.object({
  startInvoiceNumber: z.number().describe('The invoice number to start importing from.'),
});
export type ImportSquareInvoicesInput = z.infer<typeof ImportSquareInvoicesInputSchema>;

const ImportSquareInvoicesOutputSchema = z.object({
  created: z.number().describe('Number of new invoice records created.'),
  updated: z.number().describe('Number of existing invoice records updated.'),
  failed: z.number().describe('Number of invoices that failed to process.'),
  errors: z.array(z.string()).describe('List of error messages for failed invoices.'),
});
export type ImportSquareInvoicesOutput = z.infer<typeof ImportSquareInvoicesOutputSchema>;

export async function importSquareInvoices(input: ImportSquareInvoicesInput): Promise<ImportSquareInvoicesOutput> {
  return importSquareInvoicesFlow(input);
}

const importSquareInvoicesFlow = ai.defineFlow(
  {
    name: 'importSquareInvoicesFlow',
    inputSchema: ImportSquareInvoicesInputSchema,
    outputSchema: ImportSquareInvoicesOutputSchema,
  },
  async (input) => {
    console.log('TEST: Flow is running! Input:', input);
    
    // Step 1: Test credential check
    console.log('TEST: Checking Square config...');
    const { isConfigured } = await checkSquareConfig();
    console.log('TEST: checkSquareConfig result:', isConfigured);
    
    if (!isConfigured) {
      console.log('TEST: Square not configured');
      return {
        created: 0,
        updated: 0,
        failed: 1,
        errors: ['Square is not configured. Please provide credentials in your environment variables.'],
      };
    }
    
    console.log('TEST: Square is configured, proceeding...');
    
    // Just return a test response for now
    return {
      created: 0,
      updated: 0,
      failed: 0,
      errors: ['TEST: This is just a test run - credentials OK'],
    };
  }
);
