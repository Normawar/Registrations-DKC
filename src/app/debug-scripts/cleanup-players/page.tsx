
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';
import { OrganizerGuard } from '@/components/auth-guard';

// This is the set of essential test players to always keep.
const playersToKeep = new Set([
  "90000001", "90000002", "90000003", "90000004", "90000005",
  "90000006", "90000007", "90000008", "90000009", "90000010"
]);

function CleanupPlayersPage() {
  const { toast } = useToast();
  const [playersToDelete, setPlayersToDelete] = useState<MasterPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const findPlayersToDelete = useCallback(async () => {
    if (!db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore is not initialized.' });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // 1. Get all player IDs from existing invoices
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      const playersOnInvoices = new Set<string>();
      invoicesSnapshot.forEach(invoiceDoc => {
        const selections = invoiceDoc.data().selections;
        if (selections && typeof selections === 'object') {
          Object.keys(selections).forEach(playerId => playersOnInvoices.add(playerId));
        }
      });
      console.log(`Found ${playersOnInvoices.size} unique players on invoices.`);

      // 2. Fetch all players
      const playersSnapshot = await getDocs(collection(db, 'players'));
      const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterPlayer));
      console.log(`Total players in database: ${allPlayers.length}`);

      // 3. Determine which players to delete based on the new, more specific rules
      const toDelete = allPlayers.filter(player => {
        // Rule 1: Always keep the essential test players
        if (playersToKeep.has(player.id)) {
          return false;
        }

        // Rule 2: Keep all players from the PSJA district
        if (player.district === 'PHARR-SAN JUAN-ALAMO ISD') {
          return false;
        }
        
        // Rule 3: Keep players who are on an invoice
        if (playersOnInvoices.has(player.id)) {
          return false;
        }

        // Rule 4: Keep players who are on a roster (have a school and district assigned)
        if (player.school && player.district && player.school.trim() !== '' && player.district.trim() !== '') {
          return false;
        }

        // If none of the above conditions are met, the player should be deleted.
        return true;
      });

      console.log(`Identified ${toDelete.length} players to delete.`);
      setPlayersToDelete(toDelete);

    } catch (error) {
      console.error("Error fetching players for cleanup:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch data from the database to determine cleanup targets.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    findPlayersToDelete();
  }, [findPlayersToDelete]);

  const handleCleanup = async () => {
    if (!db || playersToDelete.length === 0) {
      toast({ title: 'No players to delete.' });
      return;
    }
  
    setIsDeleting(true);
    try {
      const BATCH_SIZE = 450; // Stay safely under Firebase's 500 operation limit
      const totalPlayers = playersToDelete.length;
      let deletedCount = 0;
  
      // Process players in batches
      for (let i = 0; i < totalPlayers; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const currentBatch = playersToDelete.slice(i, i + BATCH_SIZE);
        
        currentBatch.forEach(player => {
          const playerRef = doc(db, 'players', player.id);
          batch.delete(playerRef);
        });
  
        await batch.commit();
        deletedCount += currentBatch.length;
        
        // Update progress
        toast({
          title: `Progress: ${deletedCount}/${totalPlayers} deleted`,
          description: `Batch ${Math.ceil(deletedCount / BATCH_SIZE)} of ${Math.ceil(totalPlayers / BATCH_SIZE)} complete`,
        });
  
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < totalPlayers) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
  
      toast({
        title: 'Cleanup Complete!',
        description: `${deletedCount} player records have been deleted from Firestore.`,
        variant: 'default'
      });
      
      // Refresh the list after deletion
      await findPlayersToDelete();
      
    } catch (error: any) {
      console.error('Error deleting players:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Cleanup Failed', 
        description: `Error: ${error.message}` 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Database Cleanup Tool</CardTitle>
            <CardDescription>
              This tool will permanently delete players who are **not** on any roster, **not** on any invoice, and **not** from the PSJA district. It will always preserve the 10 core test accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Warning: Destructive Action</AlertTitle>
              <AlertDescription>
                This action cannot be undone. Please review the list of players to be deleted carefully. It is recommended to back up your data before proceeding.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Players Targeted for Deletion ({isLoading ? '...' : playersToDelete.length})</CardTitle>
            <CardDescription>The following players will be permanently removed from the database when you click the button below.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Analyzing database...</span>
              </div>
            ) : playersToDelete.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>No unrostered or un-invoiced players found to delete. Your database is clean according to the rules!</p>
              </div>
            ) : (
              <ul className="text-sm space-y-1 list-disc list-inside max-h-60 overflow-y-auto">
                {playersToDelete.slice(0, 100).map(p => (
                  <li key={p.id}>
                    {p.firstName} {p.lastName} (ID: {p.id}) - School: {p.school || 'N/A'}, District: {p.district || 'N/A'}
                  </li>
                ))}
                {playersToDelete.length > 100 && (
                  <li className="font-bold">... and {playersToDelete.length - 100} more.</li>
                )}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleCleanup}
              disabled={isLoading || isDeleting || playersToDelete.length === 0}
              variant="destructive"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Permanently Delete {playersToDelete.length} Player(s)
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function GuardedCleanupPage() {
    return (
        <OrganizerGuard>
            <CleanupPlayersPage />
        </OrganizerGuard>
    )
}
