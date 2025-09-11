
// src/lib/services/invoice-service.ts
'use server';

import { 
    recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow,
    type RecreateInvoiceInput,
    type RecreateInvoiceOutput
} from '@/ai/flows/recreate-invoice-from-roster-flow';

export async function recreateInvoiceFromRoster(input: any): Promise<RecreateInvoiceOutput> {
    // Clean and transform the data before sending to the flow
    const cleanedInput: RecreateInvoiceInput = {
        ...input,
        players: input.players
            .filter((p: any) => p.playerName && p.playerName !== 'undefined undefined')
            .map((player: any) => ({
                playerName: player.playerName,
                uscfId: player.uscfId || "NEW",
                baseRegistrationFee: player.baseRegistrationFee,
                lateFee: player.lateFee, // Keep as null, schema now supports it
                uscfAction: player.uscfAction,
                isGtPlayer: player.isGtPlayer || false,
                isNew: player.isNew || false,
                isSubstitution: player.isSubstitution || false,
                waiveLateFee: player.waiveLateFee || false,
                lateFeeOverride: player.lateFeeOverride,
                registrationDate: player.registrationDate
            }))
    };
    
    return recreateInvoiceFromRosterFlow(cleanedInput);
}
