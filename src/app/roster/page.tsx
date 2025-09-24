
'use client';

import React, { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { PlayerRosters } from '@/components/player-rosters';
import { PlayerDetailsDialog } from '@/components/player-details-dialog';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';
import { useToast } from '@/hooks/use-toast';

function RosterPage() {
  console.log('🏠 RosterPage rendering...');
  
  // Add this to track what's causing renders
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log('Render count:', renderCount.current);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
  const { updatePlayer, refreshDatabase } = useMasterDb();
  const { profile } = useSponsorProfile();
  const { toast } = useToast();

  // Track if refreshDatabase is being called accidentally
  useEffect(() => {
    console.log('RosterPage useEffect - refreshDatabase reference changed');
  }, [refreshDatabase]);

  const handleEditPlayer = useCallback((player: MasterPlayer) => {
    setPlayerToEdit(player);
    setIsEditOpen(true);
  }, []);
  
  const handlePlayerSelectedFromSearch = useCallback((player: any) => {
    console.log('🔍 handlePlayerSelectedFromSearch called - START');
    
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
  }, [profile]);
  
  const handleAddToRoster = async (player: MasterPlayer) => {
    console.log('📝 handleAddToRoster called');
    if (!profile) return;
    
    try {
      const updatedPlayer = { 
        ...player, 
        school: profile.school, 
        district: profile.district 
      };
      
      // Update the player in Firebase
      await updatePlayer(updatedPlayer, profile);
      console.log('📝 Player updated successfully');
      
      // Close the dialog
      setIsEditOpen(false);
      setPlayerToEdit(null);
      
      // Show success message without triggering database refresh
      toast({
        title: "Player Added to Roster",
        description: `${player.firstName} ${player.lastName} has been added to your roster.`
      });
      
      console.log('📝 handleAddToRoster complete');
    } catch (error) {
      console.error('Error in handleAddToRoster:', error);
      toast({
        title: "Error",
        description: "Failed to add player to roster. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handlePlayerCreatedOrUpdated = useCallback(() => {
    console.log('🔄 handlePlayerCreatedOrUpdated called - SKIPPING refresh to prevent loop');
    // DO NOT call refreshDatabase here
  }, []);

  const handleSearchPlayerClick = useCallback(() => {
    console.log('🔍 Search button clicked - opening search dialog');
    setIsSearchOpen(true);
  }, []);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthGuard>
        <AppLayout>
          <PlayerRosters 
            onEditPlayer={handleEditPlayer} 
            onSearchPlayer={handleSearchPlayerClick}
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
