
'use client';

import { Suspense, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { PlayerRosters } from '@/components/player-rosters';
import { PlayerDetailsDialog } from '@/components/player-details-dialog';
import { type MasterPlayer } from '@/lib/data/full-master-player-data';

function RosterPage() {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<MasterPlayer | null>(null);

  const handleEditPlayer = (player: MasterPlayer) => {
    setPlayerToEdit(player);
    setIsEditOpen(true);
  };
  
  const handlePlayerCreatedOrUpdated = () => {
    // This could trigger a refresh if needed
  };

  const handlePlayerSelected = (player: any) => {
      const isMasterPlayer = 'uscfId' in player;
      const nameParts = player.name ? player.name.split(', ') : ['Unknown', 'Player'];
      const playerToEditObj: MasterPlayer = isMasterPlayer ? player : {
        id: player.uscf_id,
        uscfId: player.uscf_id,
        firstName: nameParts[1] || '',
        lastName: nameParts[0] || '',
        middleName: nameParts.length > 2 ? nameParts[2] : '',
        regularRating: player.rating_regular || undefined,
        uscfExpiration: player.expiration_date ? new Date(player.expiration_date).toISOString() : undefined,
        state: player.state || 'TX',
        school: '',
        district: '',
        grade: '',
        section: '',
        email: '',
        zipCode: '',
        events: 0,
        eventIds: [],
      };
      setPlayerToEdit(playerToEditObj);
      setIsEditOpen(true);
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthGuard>
        <AppLayout>
          <PlayerRosters 
            onEditPlayer={handleEditPlayer} 
            onPlayerSelected={handlePlayerSelected}
          />
          <PlayerDetailsDialog
            isOpen={isEditOpen}
            onOpenChange={setIsEditOpen}
            playerToEdit={playerToEdit}
            onPlayerCreatedOrUpdated={handlePlayerCreatedOrUpdated}
          />
        </AppLayout>
      </AuthGuard>
    </Suspense>
  );
}

export default RosterPage;
