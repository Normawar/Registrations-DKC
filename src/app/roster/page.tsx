
'use client';

import React, { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { PlayerRosters } from '@/components/player-rosters';
import { PlayerDetailsDialog } from '@/components/player-details-dialog';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';
import { useToast } from '@/hooks/use-toast';

function RosterPage() {
  console.log('🏠 RosterPage rendering...');
  
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log('Render count:', renderCount.current);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);
  const { updatePlayer, refreshDatabase } = useMasterDb();
  const { profile, updateProfile } = useSponsorProfile();
  const { toast } = useToast();

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
    if (!profile || !player) return;
    
    try {
      switch (profile.role) {
        case 'individual':
          const currentStudentIds = profile.studentIds || [];
          if (!currentStudentIds.includes(player.id)) {
            await updateProfile({ 
              studentIds: [...currentStudentIds, player.id] 
            });
          }
          break;
          
        case 'sponsor':
          const updatedPlayer = { 
            ...player, 
            school: profile.school, 
            district: profile.district 
          };
          await updatePlayer(updatedPlayer, profile);
          break;
          
        case 'district-coordinator':
          const dcUpdatedPlayer = { 
            ...player, 
            district: profile.district,
            school: player.school || profile.school
          };
          await updatePlayer(dcUpdatedPlayer, profile);
          break;
          
        case 'organizer':
          await updatePlayer(player, profile);
          break;
      }
      
      setIsEditOpen(false);
      setPlayerToEdit(null);
      
      toast({
        title: "Player Updated",
        description: `${player.firstName} ${player.lastName} has been updated successfully.`
      });
      
    } catch (error) {
      console.error('Error updating player:', error);
      toast({
        title: "Error",
        description: "Failed to update player. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handlePlayerCreatedOrUpdated = useCallback(() => {
    console.log('🔄 handlePlayerCreatedOrUpdated called - doing nothing');
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
            portalType={profile?.role || 'individual'}
            userProfile={profile}
            mode={playerToEdit?.id && !playerToEdit.id.startsWith('temp_') ? 'edit' : 'create'}
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
