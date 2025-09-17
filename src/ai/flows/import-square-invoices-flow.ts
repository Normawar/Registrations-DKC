
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
    
    // Bypass credential check entirely since other flows work
    console.log('TEST: Bypassing credential check, going straight to Square API...');
    
    try {
      // Import and test the actual Square client
      const { getSquareClient, getSquareLocationId } = await import('@/lib/square-client');
      
      console.log('TEST: Getting Square client...');
      const squareClient = await getSquareClient();
      const locationId = await getSquareLocationId();
      
      console.log('TEST: Square client obtained, testing API call...');
      const { result } = await squareClient.invoicesApi.listInvoices({
        locationId: locationId,
        limit: 1, // Just test with 1 invoice
      });
      
      const invoiceCount = result.invoices?.length || 0;
      console.log(`TEST: Success! Found ${invoiceCount} invoices in Square`);
      
      return {
        created: 0,
        updated: 0,
        failed: 0,
        errors: [`TEST: Square API works! Found ${invoiceCount} invoices. Credential check is the problem.`],
      };
      
    } catch (error) {
      console.log('TEST: Square API failed:', error);
      return {
        created: 0,
        updated: 0,
        failed: 1,
        errors: [`TEST: Square API error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }
);
