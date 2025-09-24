
'use client';

import React, { Suspense, useState, useCallback } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { PlayerRosters } from '@/components/player-rosters';
import { PlayerDetailsDialog } from '@/components/player-details-dialog';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';


function RosterPage() {
  console.log('🏠 RosterPage rendering...');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
  const { updatePlayer, refreshDatabase } = useMasterDb();
  const { profile } = useSponsorProfile();

  const handleEditPlayer = useCallback((player: MasterPlayer) => {
    setPlayerToEdit(player);
    setIsEditOpen(true);
  }, []);
  
  const handlePlayerSelectedFromSearch = useCallback((player: any) => {
    console.log('🔍 handlePlayerSelectedFromSearch called with:', player.firstName, player.lastName);
    
    // Prevent multiple rapid calls
    if (isSearchOpen === false) {
      console.log('⚠️ Search already closed, ignoring duplicate call');
      return;
    }
    
    const isMasterPlayer = 'uscfId' in player;
    let playerToProcess: MasterPlayer;
  
    if (isMasterPlayer) {
      playerToProcess = player as MasterPlayer;
    } else {
      const nameParts = player.name ? player.name.split(', ') : ['Unknown', 'Player'];
      playerToProcess = {
        id: player.uscf_id,
        uscfId: player.uscf_id,
        firstName: nameParts[1] || '',
        lastName: nameParts[0] || '',
        middleName: '',
        regularRating: player.rating_regular || undefined,
        uscfExpiration: player.expiration_date ? new Date(player.expiration_date).toISOString() : undefined,
        state: player.state || 'TX',
        school: profile?.school || '', 
        district: profile?.district || '', 
        grade: '', 
        section: '', 
        email: '', 
        zipCode: '',
        dob: undefined,
        events: 0,
        eventIds: [],
      };
    }
    
    console.log('🔍 Setting search closed...');
    setIsSearchOpen(false);
    
    // Use setTimeout to ensure state update happens first
    setTimeout(() => {
      console.log('🔍 Opening player edit dialog...');
      handleEditPlayer(playerToProcess);
    }, 100);
    
  }, [isSearchOpen, profile, handleEditPlayer]);

  const handleAddToRoster = async (player: MasterPlayer) => {
    if (!profile) return;
    
    // Close the details dialog
    setIsEditOpen(false);

    if (profile.role === 'sponsor' || profile.isDistrictCoordinator) {
      const updatedPlayer = { 
        ...player, 
        school: profile.school, 
        district: profile.district 
      };
      await updatePlayer(updatedPlayer, profile);
    }
    
    refreshDatabase(); // Refresh data to show the new player
  };
  
  const handlePlayerCreatedOrUpdated = useCallback(() => {
    console.log('🔄 handlePlayerCreatedOrUpdated called - SKIPPING refresh to prevent loop');
    // DO NOT call refreshDatabase here
  }, []);


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
