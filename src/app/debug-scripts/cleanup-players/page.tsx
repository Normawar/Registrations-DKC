'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';
import { OrganizerGuard } from '@/components/auth-guard';

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
      return;
    }
    setIsLoading(true);
    try {
      const playersSnapshot = await getDocs(collection(db, 'players'));
      const allPlayers = playersSnapshot.docs.map(doc => doc.data() as MasterPlayer);
      const toDelete = allPlayers.filter(player => !playersToKeep.has(player.id));
      setPlayersToDelete(toDelete);
    } catch (error) {
      console.error("Error fetching players:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch players from the database.' });
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
      const batch = writeBatch(db);
      playersToDelete.forEach(player => {
        const playerRef = doc(db, 'players', player.id);
        batch.delete(playerRef);
      });
      await batch.commit();

      toast({
        title: 'Cleanup Complete!',
        description: `${playersToDelete.length} player records have been deleted from Firestore.`,
      });
      // Refresh the list after deletion
      await findPlayersToDelete();
    } catch (error) {
      console.error('Error deleting players:', error);
      toast({ variant: 'destructive', title: 'Cleanup Failed', description: 'Could not delete players.' });
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
              This tool will permanently delete all player records from your Firestore database except for the 10 essential test records (IDs 90000001-90000010).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Warning: Destructive Action</AlertTitle>
              <AlertDescription>
                This action cannot be undone. Please ensure you have backed up any important data before proceeding.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Players Targeted for Deletion ({playersToDelete.length})</CardTitle>
            <CardDescription>The following players will be removed from the database.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : playersToDelete.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>No players to delete. Your database is already clean!</p>
              </div>
            ) : (
              <ul className="text-sm space-y-1 list-disc list-inside max-h-60 overflow-y-auto">
                {playersToDelete.map(p => (
                  <li key={p.id}>
                    {p.firstName} {p.lastName} (ID: {p.id})
                  </li>
                ))}
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
              Delete {playersToDelete.length} Player(s)
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
