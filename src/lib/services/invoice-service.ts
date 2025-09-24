
'use server';

import { 
    recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow,
    type RecreateInvoiceInput,
    type RecreateInvoiceOutput
} from '@/ai/flows/recreate-invoice-from-roster-flow';
import { analyzePlayerData as analyzePlayerDataFlow, recreateInvoiceWithRecovery } from '@/lib/services/data-recovery-service';

export async function recreateInvoiceFromRoster(input: any): Promise<RecreateInvoiceOutput> {
    const { cleanedInput, recoveryReport } = await recreateInvoiceWithRecovery(input);

    if (recoveryReport.summary.failed > 0) {
        console.error("Data recovery failed for some players. Halting invoice recreation.", recoveryReport.recoveryLog);
        throw new Error(`Could not recover names for ${recoveryReport.summary.failed} players. Please correct the source data.`);
    }

    // Now, call the actual Genkit flow with the cleaned data
    const flowInput = cleanedInput as RecreateInvoiceInput;
    return await recreateInvoiceFromRosterFlow(flowInput);
}

// Keep the analysis function for debugging if needed
export function analyzePlayerData(input: any) {
    return analyzePlayerDataFlow(input);
}
