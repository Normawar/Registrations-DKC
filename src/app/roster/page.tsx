
'use client';

import React, { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { PlayerRosters } from '@/components/player-rosters';
import { PlayerDetailsDialog } from '@/components/player-details-dialog';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';

function RosterPage() {
  console.log('🏠 RosterPage rendering...');
  
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log('Render count:', renderCount.current);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
  const { updatePlayer, refreshDatabase } = useMasterDb();
  const { profile } = useSponsorProfile();

  useEffect(() => {
    console.log('RosterPage useEffect - refreshDatabase reference changed');
  }, [refreshDatabase]);

  const handleEditPlayer = useCallback((player: MasterPlayer) => {
    setPlayerToEdit(player);
    setIsEditOpen(true);
  }, []);
  
  const handlePlayerSelectedFromSearch = useCallback((player: any) => {
    console.log('🔍 handlePlayerSelectedFromSearch called - START');
    console.log('🔍 Current state - isSearchOpen:', isSearchOpen, 'isEditOpen:', isEditOpen);
    
    // Prevent multiple rapid calls
    if (!isSearchOpen) {
      console.log('⚠️ Search not open, ignoring call');
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
    
    console.log('🔍 Setting isSearchOpen to false');
    setIsSearchOpen(false);
    
    console.log('🔍 Setting playerToEdit');
    setPlayerToEdit(playerToProcess);
    
    console.log('🔍 Setting isEditOpen to true');
    setIsEditOpen(true);
    
    console.log('🔍 handlePlayerSelectedFromSearch - END');
  }, [isSearchOpen, profile, isEditOpen, handleEditPlayer]);

  const handleAddToRoster = async (player: MasterPlayer) => {
    console.log('📝 handleAddToRoster called');
    if (!profile) return;
    const updatedPlayer = { 
      ...player, 
      school: profile.school, 
      district: profile.district 
    };
    await updatePlayer(updatedPlayer, profile);
    console.log('📝 Player updated, closing edit dialog');
    setIsEditOpen(false);
    console.log('📝 handleAddToRoster complete');
  };
  
  const handlePlayerCreatedOrUpdated = useCallback(() => {
    console.log('🔄 handlePlayerCreatedOrUpdated called - doing nothing');
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
