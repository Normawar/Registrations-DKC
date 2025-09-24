
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
    const isMasterPlayer = 'uscfId' in player;
    let playerToProcess: MasterPlayer;

    if (isMasterPlayer) {
      playerToProcess = player as MasterPlayer;
    } else {
      // This is a USCFPlayer object, map it to a MasterPlayer
      const nameParts = player.name ? player.name.split(', ') : ['Unknown', 'Player'];
      playerToProcess = {
        id: player.uscf_id,
        uscfId: player.uscf_id,
        firstName: nameParts[1] || '',
        lastName: nameParts[0] || '',
        middleName: nameParts.length > 2 ? nameParts[2] : '',
        regularRating: player.rating_regular || undefined,
        uscfExpiration: player.expiration_date ? new Date(player.expiration_date).toISOString() : undefined,
        state: player.state || 'TX',
        school: profile?.school || '', 
        district: profile?.district || '', 
        grade: '', 
        section: '', 
        email: '', 
        zipCode: '',
        events: 0,
        eventIds: [],
      };
    }
    setIsSearchOpen(false); // Close search dialog
    handleEditPlayer(playerToProcess); // Open details dialog
  };

  const handleAddToRoster = async (player: MasterPlayer) => {
    if (!profile) return;
    const updatedPlayer = { 
      ...player, 
      school: profile.school, 
      district: profile.district 
    };
    await updatePlayer(updatedPlayer, profile);
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
            portalType={profile?.role || 'individual'}
            userProfile={profile}
          />
        </AppLayout>
      </AuthGuard>
    </Suspense>
  );
}

export default RosterPage;
