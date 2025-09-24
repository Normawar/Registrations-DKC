
'use client';

import React, { Suspense, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { PlayerRosters } from '@/components/player-rosters';
import { PlayerDetailsDialog } from '@/components/player-details-dialog';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';


function RosterPage() {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
  const { updatePlayer, refreshDatabase } = useMasterDb();
  const { profile } = useSponsorProfile();

  const handleEditPlayer = (player: MasterPlayer) => {
    setPlayerToEdit(player);
    setIsEditOpen(true);
  };
  
  const handlePlayerSelectedFromSearch = (player: any) => {
    // This function is called when a player is selected from the search dialog.
    // It should close the search dialog and open the details dialog.
    setIsSearchOpen(false);
    handleEditPlayer(player);
  };

  const handleAddToRoster = async (player: MasterPlayer) => {
    if (!profile) return;
    
    // Close the search dialog first
    setIsSearchOpen(false);

    if (profile.role === 'sponsor' || profile.isDistrictCoordinator) {
      const updatedPlayer = { 
        ...player, 
        school: profile.school, 
        district: profile.district 
      };
      await updatePlayer(updatedPlayer, profile);
    }
    
    setIsEditOpen(false); // Close the details dialog
    refreshDatabase(); // Refresh data to show the new player
  };
  
  const handlePlayerCreatedOrUpdated = () => {
    refreshDatabase(); // Refresh data after any CRUD operation
  };


  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthGuard>
        <AppLayout>
          <PlayerRosters 
            onEditPlayer={handleEditPlayer} 
            onSearchPlayer={() => setIsSearchOpen(true)}
          />
          <PlayerDetailsDialog
            isOpen={isEditOpen}
            onOpenChange={setIsEditOpen}
            playerToEdit={playerToEdit}
            onPlayerCreatedOrUpdated={handlePlayerCreatedOrUpdated}
            onAddToRoster={handleAddToRoster}
          />
          <PlayerSearchDialog
            isOpen={isSearchOpen}
            onOpenChange={setIsSearchOpen}
            onPlayerSelected={handlePlayerSelectedFromSearch}
            onAddToRoster={handleAddToRoster}
            portalType={profile?.role || 'individual'}
            userProfile={profile}
          />
        </AppLayout>
      </AuthGuard>
    </Suspense>
  );
}

export default RosterPage;
