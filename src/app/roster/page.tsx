
'use client';

import { useState, useMemo, Suspense } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { PlusCircle, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { generateTeamCode } from '@/lib/school-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog'; // New search dialog

type SortableColumnKey = 'lastName' | 'teamCode' | 'uscfId' | 'regularRating' | 'grade' | 'section';

function RosterPageContent() {
  const { toast } = useToast();
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<MasterPlayer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>(null);

  const { profile, isProfileLoaded } = useSponsorProfile();
  const { database, addPlayer, updatePlayer, deletePlayer, isDbLoaded } = useMasterDb();
  
  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;

  const rosterPlayers = useMemo(() => {
    if (!isProfileLoaded || !isDbLoaded || !profile) return [];
    return database.filter(player => player.district === profile.district && player.school === profile.school);
  }, [database, profile, isProfileLoaded, isDbLoaded]);

  const rosterPlayerIds = useMemo(() => rosterPlayers.map(p => p.id), [rosterPlayers]);

  const sortedPlayers = useMemo(() => {
    let sortablePlayers = [...rosterPlayers];
    if (sortConfig) {
      sortablePlayers.sort((a, b) => {
        const key = sortConfig.key;
        let aVal: any = a[key as keyof MasterPlayer] ?? '';
        let bVal: any = b[key as keyof MasterPlayer] ?? '';
        
        if (key === 'teamCode' && profile) {
          aVal = generateTeamCode({ schoolName: a.school, district: a.district, studentType: a.studentType });
          bVal = generateTeamCode({ schoolName: b.school, district: b.district, studentType: b.studentType });
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'ascending' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortConfig.direction === 'ascending' ? result : -result;
      });
    }
    return sortablePlayers;
  }, [rosterPlayers, sortConfig, profile]);

  const requestSort = (key: SortableColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const handleSelectPlayer = (player: MasterPlayer) => {
    // Player is already assigned to the sponsor's school/district by the dialog
    addPlayer(player);
    toast({ title: "Player Added", description: `${player.firstName} ${player.lastName} has been added to your roster.` });
  };
  
  const handleDeletePlayer = (player: MasterPlayer) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };
  
  const confirmDelete = () => {
    if (playerToDelete) {
      deletePlayer(playerToDelete.id);
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed from your roster.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };

  if (!isProfileLoaded || !isDbLoaded) {
    return <AppLayout><Skeleton className="h-[60vh] w-full" /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Team Roster</h1>
            <p className="text-muted-foreground">
              Manage your team players and their information. ({rosterPlayers.length} players)
            </p>
          </div>
          <Button onClick={() => setIsPlayerDialogOpen(true)} className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Add Player from Database
          </Button>
        </div>

        {profile && teamCode && (
          <Alert>
            <AlertTitle>Team Information</AlertTitle>
            <AlertDescription>
              <strong>School:</strong> {profile.school}<br/>
              <strong>District:</strong> {profile.district}<br/>
              <strong>Team Code:</strong> {teamCode}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader><CardTitle>Current Roster</CardTitle><CardDescription>Players registered under your school and district</CardDescription></CardHeader>
          <CardContent>
            {rosterPlayers.length === 0 ? (
              <div className="text-center py-8"><p className="text-muted-foreground">No players in your roster yet.</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('lastName')}>Player Name {getSortIcon('lastName')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('teamCode')}>Team Code {getSortIcon('teamCode')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('uscfId')}>USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('regularRating')}>Rating {getSortIcon('regularRating')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('grade')}>Grade {getSortIcon('grade')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => requestSort('section')}>Section {getSortIcon('section')}</Button></TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlayers.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8"><AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback></Avatar>
                            <div>
                              <div className="font-medium">{player.firstName} {player.lastName}</div>
                              <div className="text-sm text-muted-foreground">{player.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{generateTeamCode({ schoolName: player.school, district: player.district, studentType: player.studentType })}</TableCell>
                        <TableCell>{player.uscfId}</TableCell>
                        <TableCell>{player.regularRating || 'UNR'}</TableCell>
                        <TableCell>{player.grade}</TableCell>
                        <TableCell>{player.section}</TableCell>
                         <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem disabled>Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeletePlayer(player)} className="text-destructive">Remove from Roster</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <PlayerSearchDialog 
            isOpen={isPlayerDialogOpen}
            onOpenChange={setIsPlayerDialogOpen}
            onSelectPlayer={handleSelectPlayer}
            excludeIds={rosterPlayerIds}
            portalType="sponsor"
        />

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Player from Roster</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to remove {playerToDelete?.firstName} {playerToDelete?.lastName} from your roster?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Remove Player</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={<AppLayout><Skeleton className="h-96 w-full" /></AppLayout>}>
      <RosterPageContent />
    </Suspense>
  );
}
