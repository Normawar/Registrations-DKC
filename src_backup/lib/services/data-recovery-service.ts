
'use server';

// A service to automatically recover corrupted player data before invoice creation.

export async function recreateInvoiceWithRecovery(input: any) {
  console.log('--- Starting Data Recovery Process ---');
  
  const originalPlayers = input.players || [];
  const recoveryReport = {
    summary: {
      total: originalPlayers.length,
      recovered: 0,
      valid: 0,
      failed: 0,
      needsReview: 0,
    },
    recoveryLog: [] as string[],
    recoveredPlayers: [] as any[],
  };

  const cleanedPlayers = originalPlayers.map((player: any, index: number) => {
    let recoveredPlayer = { ...player };
    let needsManualReview = false;

    // Check for corrupted playerName
    if (!player.playerName || player.playerName.trim().toLowerCase() === 'undefined undefined') {
      let recoveredName = '';
      
      // Attempt recovery from firstName and lastName
      if (player.firstName && player.lastName) {
        recoveredName = `${player.firstName} ${player.lastName}`.trim();
        recoveryReport.recoveryLog.push(`[Index ${index}] Recovered name from firstName/lastName: "${recoveredName}"`);
      } 
      // Add other potential recovery methods here if needed
      // else if (player.fullName) { ... }

      if (recoveredName) {
        recoveredPlayer.playerName = recoveredName;
        recoveryReport.summary.recovered++;
      } else {
        recoveryReport.summary.failed++;
        needsManualReview = true;
        recoveryReport.recoveryLog.push(`[Index ${index}] FAILED to recover name. Data: ${JSON.stringify(player)}`);
      }
    } else {
      recoveryReport.summary.valid++;
    }

    // Sanitize other fields to prevent schema errors
    recoveredPlayer.uscfId = player.uscfId || 'NEW';
    recoveredPlayer.baseRegistrationFee = typeof player.baseRegistrationFee === 'number' ? player.baseRegistrationFee : 0;
    recoveredPlayer.lateFee = typeof player.lateFee === 'number' ? player.lateFee : null;
    recoveredPlayer.uscfAction = typeof player.uscfAction === 'boolean' ? player.uscfAction : false;
    recoveredPlayer.isGtPlayer = typeof player.isGtPlayer === 'boolean' ? player.isGtPlayer : false;
    
    if (needsManualReview) {
      recoveryReport.summary.needsReview++;
    }

    recoveryReport.recoveredPlayers.push({
      ...recoveredPlayer,
      originalIndex: index,
      needsManualReview,
    });

    return recoveredPlayer;
  });

  const cleanedInput = {
    ...input,
    players: cleanedPlayers,
  };

  console.log('--- Data Recovery Finished ---');
  console.log('Summary:', recoveryReport.summary);

  return { cleanedInput, recoveryReport };
}
