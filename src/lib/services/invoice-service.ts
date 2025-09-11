// src/lib/services/invoice-service.ts
'use server';

import { 
    recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow,
    type RecreateInvoiceInput,
    type RecreateInvoiceOutput
} from '@/ai/flows/recreate-invoice-from-roster-flow';

export async function recreateInvoiceFromRoster(input: any): Promise<RecreateInvoiceOutput> {
    console.log('Processing invoice with null-to-zero conversion...');
    
    // Convert null lateFee to 0 and preserve all players including "undefined undefined"
    const processedInput = {
        ...input,
        players: input.players.map((player: any, index: number) => {
            // Generate a meaningful name for undefined players based on their data
            let playerName = player.playerName;
            
            if (!playerName || playerName === 'undefined undefined') {
                // Create a descriptive placeholder that includes their characteristics
                const gtStatus = player.isGtPlayer ? 'GT' : 'Regular';
                const uscfStatus = player.uscfAction ? 'New USCF' : 'Has USCF';
                const uscfId = player.uscfId || 'No ID';
                
                playerName = `Student ${index + 1} (${gtStatus}, ${uscfStatus}, ${uscfId})`;
                
                console.log(`Created placeholder name: "${playerName}" for player at index ${index}`);
            }
            
            return {
                ...player,
                playerName,
                lateFee: 0, // Convert null to 0 to bypass Genkit bug - flow will recalculate
                uscfId: player.uscfId || "NEW"
            };
        })
    };

    // Log the processing results
    const originalCount = input.players.length;
    const processedCount = processedInput.players.length;
    const placeholderCount = processedInput.players.filter((p: any) => 
        p.playerName.startsWith('Student ')
    ).length;
    
    console.log(`Invoice processing summary:
    - Original players: ${originalCount}
    - Processed players: ${processedCount}
    - Placeholder names created: ${placeholderCount}
    - Valid existing names: ${processedCount - placeholderCount}`);
    
    // List all players for verification
    console.log('All players in invoice:');
    processedInput.players.forEach((p: any, i: number) => {
        console.log(`  ${i + 1}. ${p.playerName} - ${p.isGtPlayer ? 'GT' : 'Regular'} - ${p.uscfAction ? 'USCF Action' : 'No USCF Action'}`);
    });

    try {
        const result = await recreateInvoiceFromRosterFlow(processedInput);
        
        console.log(`Invoice created successfully with ${processedCount} players`);
        
        if (placeholderCount > 0) {
            console.log(`⚠️ IMPORTANT: ${placeholderCount} players have placeholder names and need manual review/correction in the final invoice.`);
        }
        
        return result;
    } catch (error: any) {
        console.error('Invoice creation failed:', error);
        throw new Error(`Invoice creation failed: ${error.message}`);
    }
}

// Helper function to analyze what we're working with
export function analyzePlayerData(input: any) {
    const players = input.players || [];
    
    console.log('=== PLAYER DATA ANALYSIS ===');
    console.log(`Total players: ${players.length}`);
    
    const analysis = {
        total: players.length,
        validNames: 0,
        needsPlaceholder: 0,
        gtPlayers: 0,
        uscfActions: 0,
        hasUscfIds: 0
    };
    
    players.forEach((player: any, index: number) => {
        if (player.playerName && player.playerName !== 'undefined undefined') {
            analysis.validNames++;
            console.log(`✓ Valid: ${player.playerName}`);
        } else {
            analysis.needsPlaceholder++;
            console.log(`⚠ Needs placeholder: Index ${index} - GT:${player.isGtPlayer}, USCF:${player.uscfAction}, ID:${player.uscfId || 'none'}`);
        }
        
        if (player.isGtPlayer) analysis.gtPlayers++;
        if (player.uscfAction) analysis.uscfActions++;
        if (player.uscfId && player.uscfId !== 'NEW') analysis.hasUscfIds++;
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Valid names: ${analysis.validNames}`);
    console.log(`Need placeholders: ${analysis.needsPlaceholder}`);
    console.log(`GT players: ${analysis.gtPlayers}`);
    console.log(`USCF actions needed: ${analysis.uscfActions}`);
    console.log(`Have USCF IDs: ${analysis.hasUscfIds}`);
    
    // Calculate estimated fees
    const baseFees = players.length * 20; // All players have $20 base fee
    const uscfFees = analysis.uscfActions * 24; // USCF actions cost $24 each
    const lateFees = analysis.gtPlayers * 3 + (players.length - analysis.gtPlayers) * 5; // GT = $3, Regular = $5
    
    console.log('\n=== ESTIMATED COSTS ===');
    console.log(`Base registration: ${players.length} × $20 = $${baseFees}`);
    console.log(`USCF fees: ${analysis.uscfActions} × $24 = $${uscfFees}`);
    console.log(`Late fees: GT ${analysis.gtPlayers} × $3 + Regular ${players.length - analysis.gtPlayers} × $5 = $${lateFees}`);
    console.log(`TOTAL ESTIMATED: $${baseFees + uscfFees + lateFees}`);
    
    return analysis;
}