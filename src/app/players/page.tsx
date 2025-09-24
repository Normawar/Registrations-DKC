
'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isValid, parse } from 'date-fns';
import { useSearchParams, useRouter } from 'next/navigation';

import { AppLayout } from '@/components/app-layout';
import { PlayerDetailsDialog } from '@/components/player-details-dialog'; 
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { CSVUploadComponent } from '@/components/csv-upload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OrganizerGuard } from '@/components/auth-guard';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';


function PlayersPageContent() {
  const { database } = useMasterDb();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const { toast } = useToast();
  const { profile } = useSponsorProfile();
  const searchParams = useSearchParams();
  const router = useRouter();

  const handlePlayerSelected = (player: any) => {
    const isMasterPlayer = 'uscfId' in player;
    
    const nameParts = player.name ? player.name.split(', ') : ['Unknown', 'Player'];

    const playerToEdit: MasterPlayer = isMasterPlayer ? player : {
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
    
    setEditingPlayer(playerToEdit);
    setIsEditOpen(true);
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
  }, [searchParams, database, router, toast]);

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

        <PlayerSearchDialog
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          onSelectPlayer={handlePlayerSelected}
          portalType="organizer"
        />

        <PlayerDetailsDialog
          isOpen={isEditOpen}
          onOpenChange={setIsEditOpen}
          playerToEdit={editingPlayer}
          onPlayerCreatedOrUpdated={() => {
            // Can add refresh logic here if needed
          }}
        />
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
