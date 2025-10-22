'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/app-layout';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { PlayerManagementDialog, PlayerFormValues } from '@/components/player-management-dialog';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


export default function RostersPageClient() {
  const { database: players, addPlayer, updatePlayer, refreshDatabase } = useMasterDb();
  const { profile } = useSponsorProfile();
  const { toast } = useToast();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<Partial<MasterPlayer> | null>(null);
  const [isAddingToRoster, setIsAddingToRoster] = useState(false);
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<MasterPlayer | null>(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  const filteredPlayers = useMemo(() => {
    if (!profile || !players) return [];
    if (profile.role === 'organizer') return players;

    const lowerCaseDistrict = profile.district?.toLowerCase();
    const lowerCaseSchool = profile.school?.toLowerCase();

    return players.filter(p => {
      const playerDistrict = p.district?.toLowerCase();
      const playerSchool = p.school?.toLowerCase();
      
      if (profile.role === 'district_coordinator') {
        return playerDistrict === lowerCaseDistrict;
      }
      if (profile.role === 'sponsor') {
        return playerSchool === lowerCaseSchool && playerDistrict === lowerCaseDistrict;
      }
      if (profile.role === 'individual') {
        return profile.studentIds?.includes(p.id);
      }
      return false;
    });
  }, [players, profile]);

  const safePlayers = useMemo(() => {
    return filteredPlayers.map(player => {
      const safeDate = (dateValue: any): string => {
        if (!dateValue) return '';
        try {
          const date = dateValue.seconds ? new Date(dateValue.seconds * 1000) : parseISO(dateValue);
          return isValid(date) ? date.toISOString() : '';
        } catch {
          return '';
        }
      };

      return {
        ...player,
        id: String(player.id || ''),
        name: `${player.lastName || ''}, ${player.firstName || ''}`.trim(),
        grade: String(player.grade || ''),
        dob: safeDate(player.dob),
        uscfExpiration: safeDate(player.uscfExpiration),
      };
    });
  }, [filteredPlayers]);

  const sortedPlayers = useMemo(() => {
    const sortable = [...safePlayers];
    if (sortConfig) {
      sortable.sort((a, b) => {
        const aVal = (a[sortConfig.key as keyof typeof a] || '').toString().toLowerCase();
        const bVal = (b[sortConfig.key as keyof typeof b] || '').toString().toLowerCase();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [safePlayers, sortConfig]);

  const requestSort = (key: string) => {
    setSortConfig(prev => (
      prev?.key === key && prev.direction === 'asc' 
        ? { key, direction: 'desc' } 
        : { key, direction: 'asc' }
    ));
  };

  const handleEditPlayer = (player: Partial<MasterPlayer>) => {
    setPlayerToEdit(player);
    setIsAddingToRoster(false);
    setIsCreatingPlayer(false);
    setIsEditOpen(true);
  };

  const handleCreateNewPlayer = () => {
    if (!profile) return;
    setPlayerToEdit({
      district: profile.district,
      school: profile.school,
    });
    setIsAddingToRoster(false);
    setIsCreatingPlayer(true);
    setIsEditOpen(true);
  };

  const handlePlayerSelectedFromSearch = (player: MasterPlayer) => {
    if (!profile) return;
    const playerWithProfileData = {
      ...player,
      district: profile.district,
      school: profile.school,
    };
    setPlayerToEdit(playerWithProfileData);
    setIsAddingToRoster(true);
    setIsCreatingPlayer(false);
    setIsEditOpen(true);
    setIsSearchOpen(false);
  };

  const onEditSubmit = async (values: PlayerFormValues) => {
    if (!profile) return;

    const playerToSave: MasterPlayer = {
      ...playerToEdit,
      ...values,
      id: playerToEdit?.id || values.uscfId || `temp_${Date.now()}`,
    } as MasterPlayer;

    try {
        if (isAddingToRoster || !playerToEdit?.id) {
            await addPlayer(playerToSave, profile);
            toast({ title: "Player Added", description: "The player has been added to your roster." });
        } else {
            await updatePlayer(playerToSave, profile);
            toast({ title: "Player Updated", description: "The player\'s information has been updated." });
        }
        
        await refreshDatabase(); // Use await here
        setIsEditOpen(false);
        setPlayerToEdit(null);
        setIsAddingToRoster(false);
        setIsCreatingPlayer(false);

    } catch (error) {
        console.error("Error saving player:", error);
        toast({ variant: "destructive", title: "Save Failed", description: "Could not save player data." });
    }
  };
  
  const handleRemoveFromRoster = (player: MasterPlayer) => {
    setPlayerToRemove(player);
    setIsRemoveConfirmOpen(true);
  };

  const confirmRemovePlayer = async () => {
    if (!playerToRemove || !profile) return;

    const unassignedPlayer: MasterPlayer = {
        ...playerToRemove,
        district: '' as (string | undefined),
        school: '' as (string | undefined),
      };

    try {
        await updatePlayer(unassignedPlayer, profile);
        toast({ title: "Player Removed", description: `${playerToRemove.firstName} has been unassigned from your roster.` });
        await refreshDatabase();
    } catch (error) {
        console.error("Error removing player:", error);
        toast({ variant: "destructive", title: "Removal Failed", description: "Could not remove player from roster." });
    }

    setIsRemoveConfirmOpen(false);
    setPlayerToRemove(null);
  };

  const getDisplayDate = (isoDate: string) => {
    if (!isoDate) return '';
    try {
      return format(parseISO(isoDate), 'MM/dd/yyyy');
    } catch {
      return 'Invalid Date';
    }
  };
  
  const getMissingFields = (player: MasterPlayer) => {
    const missing = [];
    if (!player.firstName) missing.push('First Name');
    if (!player.lastName) missing.push('Last Name');
    if (!player.grade) missing.push('Grade');
    if (!player.dob) missing.push('Date of Birth');
    if (!player.gender) missing.push('Gender');
    return missing;
  };

  const headerCols = ['Name', 'USCF ID', 'Grade', 'Gender', 'DOB', 'Email', 'Zip', 'USCF Exp', 'Actions'];

  return (
    <AppLayout>
      <h1 className="text-3xl font-bold mb-6">Roster</h1>
      
      <div className="flex justify-end gap-2 mb-2">
        <Button onClick={() => setIsSearchOpen(true)}>Add Player From Database</Button>
        <Button onClick={handleCreateNewPlayer}>Create New Player</Button>
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            {headerCols.map(col => (
              <th key={col} className="p-2 border-b cursor-pointer hover:bg-gray-200" onClick={() => col !== 'Actions' && requestSort(col.toLowerCase().replace(/ /g, ''))}>
                {col}
                {sortConfig?.key === col.toLowerCase().replace(/ /g, '') && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p) => {
            const missingFields = getMissingFields(p as MasterPlayer);
            return (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  {p.name}
                  {missingFields.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-2 text-red-500 font-bold">!</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Missing: {missingFields.join(', ')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </td>
                <td className="p-2">{p.uscfId}</td>
                <td className="p-2">{p.grade === 'K' ? 'K' : p.grade.replace(/Grade /i, '')}</td>
                <td className="p-2">{p.gender}</td>
                <td className="p-2">{getDisplayDate(p.dob)}</td>
                <td className="p-2">{p.email}</td>
                <td className="p-2">{p.zip}</td>
                <td className={`p-2 ${p.uscfExpiration && new Date(p.uscfExpiration) < new Date() ? 'text-red-600 font-bold' : ''}`}>
                  {p.uscfExpiration ? (new Date(p.uscfExpiration) < new Date() ? 'Expired' : getDisplayDate(p.uscfExpiration)) : ''}
                </td>
                <td className="p-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditPlayer(p)}>Edit</Button>
                  <Button variant="destructive" size="sm" className="ml-2" onClick={() => handleRemoveFromRoster(p as MasterPlayer)}>Remove</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <EnhancedPlayerSearchDialog 
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onPlayerSelected={handlePlayerSelectedFromSearch}
        userProfile={profile}
      />

      {isEditOpen && (
        <PlayerManagementDialog
          isOpen={isEditOpen}
          onOpenChange={setIsEditOpen}
          player={playerToEdit}
          onSubmit={onEditSubmit}
          isAddingToRoster={isAddingToRoster}
          isCreatingPlayer={isCreatingPlayer}
        />
      )}
      
      <AlertDialog open={isRemoveConfirmOpen} onOpenChange={setIsRemoveConfirmOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will remove {playerToRemove?.firstName} {playerToRemove?.lastName} from your roster by unassigning them from their current school and district. This action does not delete the player from the master database.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmRemovePlayer}>Confirm</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
