'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { AppLayout } from '@/components/app-layout';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Search } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { CSVUploadComponent } from '@/components/csv-upload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OrganizerGuard } from '@/app/auth-guard';
import { PlayerManagementDialog, PlayerFormValues } from '@/components/player-management-dialog';

function PlayersPageContent() {
  const { addPlayer, updatePlayer, database } = useMasterDb();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Partial<MasterPlayer> | null>(null);
  const [isAddingToRoster, setIsAddingToRoster] = useState(false);
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const searchParams = useSearchParams();
  const router = useRouter();

  const handlePlayerSelected = (player: any) => {
    if (!profile) return;

    // A player from our database will have a school property, 
    // a raw USCF search result will not.
    const isPlayerInMasterDb = 'school' in player;

    if (isPlayerInMasterDb) {
      setEditingPlayer(player);
      setIsAddingToRoster(false);
      setIsEditOpen(true);
    } else {
      const nameParts = player.name ? player.name.split(', ') : ['', ''];
      const playerToAdd: Partial<MasterPlayer> = {
        id: player.uscf_id,
        uscfId: player.uscf_id,
        firstName: nameParts[1] || '',
        lastName: nameParts[0] || '',
        regularRating: player.rating_regular || undefined,
        uscfExpiration: player.expiration_date ? new Date(player.expiration_date).toISOString() : undefined,
        state: player.state || 'TX',
        // Pre-fill with user's profile data
        district: profile.district,
        school: profile.school,
      };
      setEditingPlayer(playerToAdd);
      setIsAddingToRoster(true);
      setIsEditOpen(true);
    }
    setIsSearchOpen(false);
  };

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && database.length > 0) {
      const playerToEdit = database.find(p => p.id === editId);
      if (playerToEdit) {
        handlePlayerSelected(playerToEdit);
        router.replace('/players', { scroll: false });
      } else {
        toast({
          variant: 'destructive',
          title: 'Player Not Found',
          description: `Could not find a player with ID: ${editId}`,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, database]);

  const handlePlayerFormSubmit = async (values: PlayerFormValues) => {
    if (!profile) return;

    const playerToSave: MasterPlayer = {
      ...editingPlayer,
      ...values,
      id: editingPlayer?.id || values.uscfId || `temp_${Date.now()}`,
    } as MasterPlayer;

    const isExistingInDb = database.some(p => p.id === playerToSave.id);

    if (isAddingToRoster || !isExistingInDb) {
      await addPlayer(playerToSave, profile);
      toast({ 
        title: "Player Added", 
        description: `${playerToSave.firstName} ${playerToSave.lastName} has been added to the master database.`
      });
    } else {
      await updatePlayer(playerToSave, profile);
      toast({ 
        title: "Player Updated", 
        description: `${playerToSave.firstName} ${playerToSave.lastName}'s information has been updated.`
      });
    }
    
    setIsEditOpen(false);
    setEditingPlayer(null);
    setIsAddingToRoster(false);
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Master Player Database</h1>
            <p className="text-sm text-gray-600 mt-1">
              Search, manage, and register every player in the system.
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button
              className="flex items-center"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="w-4 h-4 mr-2" />
              Search Players
            </Button>
          </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Bulk Upload</CardTitle>
                <CardDescription>Upload a CSV file to add or update multiple players in the master database at once.</CardDescription>
            </CardHeader>
            <CardContent>
                <CSVUploadComponent />
            </CardContent>
        </Card>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-800">Search to Begin</h2>
            <p className="mt-1 text-sm">
                Use the "Search Players" button to find, edit, or add players to the master database. 
                Displaying all {database.length.toLocaleString()} players at once is not supported for performance reasons.
            </p>
        </div>

        <EnhancedPlayerSearchDialog
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          onPlayerSelected={handlePlayerSelected}
          title="Search and Add Players"
          userProfile={profile}
          preFilterByUserProfile={true}
        />

        {isEditOpen && (
            <PlayerManagementDialog 
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
                player={editingPlayer}
                onSubmit={handlePlayerFormSubmit}
                isAddingToRoster={isAddingToRoster}
            />
        )}
      </div>
    </AppLayout>
  );
}

function PlayersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrganizerGuard>
        <PlayersPageContent />
      </OrganizerGuard>
    </Suspense>
  )
}

export default PlayersPage;
