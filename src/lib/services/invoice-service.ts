// src/lib/services/invoice-service.ts
'use server';

import { 
    recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow,
    type RecreateInvoiceOutput
} from '@/ai/flows/recreate-invoice-from-roster-flow';

import { recreateInvoiceWithRecovery } from './data-recovery-service';

export async function recreateInvoiceFromRoster(input: any): Promise<RecreateInvoiceOutput & { recoveryReport?: any }> {
    console.log('Starting comprehensive player data recovery...');
    
    try {
        // Attempt comprehensive data recovery
        const { cleanedInput, recoveryReport } = await recreateInvoiceWithRecovery(input);
        
        console.log(`Recovery complete: ${recoveryReport.summary.recovered}/${recoveryReport.summary.total} players recovered`);
        
        // Process the invoice with recovered data
        const result = await recreateInvoiceFromRosterFlow(cleanedInput);
        
        return {
            ...result,
            recoveryReport: {
                originalPlayerCount: recoveryReport.summary.total,
                recoveredPlayers: recoveryReport.summary.recovered,
                playersNeedingReview: recoveryReport.summary.needsReview,
                recoveryMethods: recoveryReport.recoveryLog
            }
        };
        
    } catch (error) {
        console.error('Recovery and invoice creation failed:', error);
        throw new Error(`Invoice creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Diagnostic function to analyze recovery potential before processing
export async function analyzeRecoveryPotential(input: any) {
    console.log('Analyzing player data recovery potential...');
    
    const { recoveryReport } = await recreateInvoiceWithRecovery(input);
    
    return {
        summary: recoveryReport.summary,
        detailedLog: recoveryReport.recoveryLog,
        playersNeedingAttention: recoveryReport.recoveredPlayers
            .filter((p: any) => p.needsManualReview)
            .map((p: any) => ({
                placeholder: p.playerName,
                originalIndex: p.originalIndex,
                availableData: Object.keys(input.players[p.originalIndex])
            }))
    };
}
