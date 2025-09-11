'use server';

import { 
    recreateInvoiceFromRoster as recreateInvoiceFromRosterFlow,
    type RecreateInvoiceInput,
    type RecreateInvoiceOutput
} from '@/ai/flows/recreate-invoice-from-roster-flow';

export async function recreateInvoiceFromRoster(input: any): Promise<RecreateInvoiceOutput> {
    // CRITICAL: Transform ALL null lateFee values to 0 before processing
    const fixedData = JSON.parse(JSON.stringify(input)); // Deep clone
    
    fixedData.players = fixedData.players.map((player: any, index: number) => {
        // Fix the lateFee issue
        if (player.lateFee === null) {
            player.lateFee = 0;
        }
        
        // Fix missing uscfId
        if (!player.uscfId) {
            player.uscfId = "NEW";
        }
        
        // Create descriptive name for undefined players
        if (!player.playerName || player.playerName === 'undefined undefined') {
            const gtStatus = player.isGtPlayer ? 'GT' : 'Regular';
            const uscfStatus = player.uscfAction ? 'NewUSCF' : 'HasUSCF';
            player.playerName = `Student${index + 1}_${gtStatus}_${uscfStatus}`;
        }
        
        return player;
    });
    
    console.log(`Processing ${fixedData.players.length} players with fixed data`);
    
    return await recreateInvoiceFromRosterFlow(fixedData);
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