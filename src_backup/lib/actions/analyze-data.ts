
'use server';

// A set of functions to analyze player data for corruption and provide insights.

export async function analyzePlayerData(input: any) {
    console.log('=== PLAYER DATA ANALYSIS ===');
    
    const players = input.players || [];
    const analysis: any = {
        total: players.length,
        valid: 0,
        corrupted: 0,
        fieldsSeen: new Set(),
        corruptedSamples: []
    };

    console.log(`Analyzing ${players.length} players...`);

    players.forEach((player: any, index: number) => {
        // Log all available fields for the first few players
        if (index < 3) {
            console.log(`Player ${index} fields:`, Object.keys(player));
        }

        // Collect all field names we see
        Object.keys(player).forEach(key => analysis.fieldsSeen.add(key));

        // Check if player name is corrupted
        if (!player.playerName || player.playerName === 'undefined undefined') {
            analysis.corrupted++;
            
            // Store sample of corrupted data (first 5)
            if (analysis.corruptedSamples.length < 5) {
                analysis.corruptedSamples.push({
                    index,
                    playerName: player.playerName,
                    allFields: Object.keys(player),
                    possibleNameFields: Object.entries(player)
                        .filter(([key, value]: [string, any]) => 
                            key.toLowerCase().includes('name') || 
                            key.toLowerCase().includes('player') ||
                            key.toLowerCase().includes('student')
                        )
                        .reduce((acc: any, [key, value]: [string, any]) => ({ ...acc, [key]: value }), {})
                });
            }
        } else {
            analysis.valid++;
        }
    });

    // Log comprehensive analysis
    console.log('\n=== ANALYSIS RESULTS ===');
    console.log(`Total players: ${analysis.total}`);
    console.log(`Valid players: ${analysis.valid}`);
    console.log(`Corrupted players: ${analysis.corrupted}`);
    console.log(`All fields seen: [${Array.from(analysis.fieldsSeen).join(', ')}]`);
    
    if (analysis.corrupted > 0) {
        console.log('\n=== CORRUPTED PLAYER SAMPLES ===');
        analysis.corruptedSamples.forEach((sample: any, i: number) => {
            console.log(`\nCorrupted Player ${i + 1} (index ${sample.index}):`);
            console.log(`  - playerName: "${sample.playerName}"`);
            console.log(`  - All fields: [${sample.allFields.join(', ')}]`);
            console.log(`  - Possible name fields:`, sample.possibleNameFields);
            
            // Check for any string values that might be names
            const stringValues = Object.entries(players[sample.index])
                .filter(([key, value]) => typeof value === 'string' && value && value !== 'undefined undefined')
                .map(([key, value]) => `${key}: "${value}"`);
            
            if (stringValues.length > 0) {
                console.log(`  - String values found: [${stringValues.join(', ')}]`);
            }
        });
    }

    // Calculate potential fees
    const validPlayers = players.filter((p: any) => p.playerName && p.playerName !== 'undefined undefined');
    const totalBaseFees = validPlayers.reduce((sum: number, p: any) => sum + (p.baseRegistrationFee || 0), 0);
    const totalUscfFees = validPlayers.filter((p: any) => p.uscfAction).length * (input.uscfFee || 24);
    const estimatedLateFees = validPlayers.length * 5; // Rough estimate
    
    console.log('\n=== FINANCIAL IMPACT ===');
    console.log(`Valid players base fees: $${totalBaseFees}`);
    console.log(`USCF fees (${validPlayers.filter((p: any) => p.uscfAction).length} players): $${totalUscfFees}`);
    console.log(`Estimated late fees: $${estimatedLateFees}`);
    console.log(`Estimated total: $${totalBaseFees + totalUscfFees + estimatedLateFees}`);
    console.log(`Lost revenue from ${analysis.corrupted} corrupted players: Unknown`);

    return {
        summary: analysis,
        validPlayers,
        corruptedSamples: analysis.corruptedSamples,
        recommendations: generateRecommendations(analysis)
    };
}

function generateRecommendations(analysis: any) {
    const recommendations = [];
    
    if (analysis.corrupted > 0) {
        recommendations.push(`🔧 ${analysis.corrupted} players have corrupted names. Check the corrupted samples above for recovery opportunities.`);
    }
    
    if (analysis.fieldsSeen.has('firstName') && analysis.fieldsSeen.has('lastName')) {
        recommendations.push(`✅ firstName/lastName fields detected. These could be used to reconstruct names.`);
    }
    
    if (analysis.fieldsSeen.has('fullName')) {
        recommendations.push(`✅ fullName field detected. This could be an alternative to playerName.`);
    }
    
    if (analysis.corrupted > analysis.valid) {
        recommendations.push(`⚠️ More players are corrupted than valid. Check your data input source.`);
    }
    
    return recommendations;
}
