
// src/lib/services/invoice-service.ts
'use server';

import { 
    recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow,
    type RecreateInvoiceInput,
    type RecreateInvoiceOutput
} from '@/ai/flows/recreate-invoice-from-roster-flow';

export async function recreateInvoiceFromRoster(input: any): Promise<RecreateInvoiceOutput> {
    console.log('🔍 Input validation debug:', {
        firstPlayerLateFee: input.players[0]?.lateFee,
        firstPlayerLateFeeType: typeof input.players[0]?.lateFee,
        isNull: input.players[0]?.lateFee === null,
        isUndefined: input.players[0]?.lateFee === undefined
    });

    // Workaround: Convert data to ensure clean validation
    const transformedInput = {
        ...input,
        players: input.players
            .filter((p: any) => p.playerName && p.playerName !== 'undefined undefined')
            .map((player: any) => {
                // Create a clean player object with explicit type conversion
                const cleanPlayer: any = {
                    playerName: player.playerName,
                    baseRegistrationFee: Number(player.baseRegistrationFee),
                    uscfAction: Boolean(player.uscfAction),
                };

                // Handle optional fields explicitly
                if (player.uscfId) {
                    cleanPlayer.uscfId = String(player.uscfId);
                }

                if (player.isGtPlayer !== undefined) {
                    cleanPlayer.isGtPlayer = Boolean(player.isGtPlayer);
                }

                // Handle lateFee explicitly - try multiple approaches
                if (player.lateFee === null) {
                    cleanPlayer.lateFee = null;
                } else if (typeof player.lateFee === 'number') {
                    cleanPlayer.lateFee = Number(player.lateFee);
                } else {
                    // Default to null if undefined or invalid
                    cleanPlayer.lateFee = null;
                }

                // Add other optional fields if present
                if (player.waiveLateFee !== undefined) {
                    cleanPlayer.waiveLateFee = Boolean(player.waiveLateFee);
                }
                if (player.lateFeeOverride !== undefined) {
                    cleanPlayer.lateFeeOverride = Number(player.lateFeeOverride);
                }
                if (player.registrationDate) {
                    cleanPlayer.registrationDate = String(player.registrationDate);
                }

                return cleanPlayer;
            })
    };

    console.log('🔍 Transformed first player:', transformedInput.players[0]);

    try {
        return await recreateInvoiceFromRosterFlow(transformedInput);
    } catch (error) {
        console.error('❌ Flow validation error:', error);
        
        // If null still fails, try with 0 as fallback
        console.log('🔄 Trying fallback with lateFee = 0...');
        const fallbackInput = {
            ...transformedInput,
            players: transformedInput.players.map((p: any) => ({
                ...p,
                lateFee: p.lateFee === null ? 0 : p.lateFee
            }))
        };
        
        return await recreateInvoiceFromRosterFlow(fallbackInput);
    }
}
