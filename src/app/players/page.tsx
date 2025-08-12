
'use client';

import { useState, useMemo, useCallback, Suspense, useEffect } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { PlusCircle, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Search, Download, Trash2, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import Papa from 'papaparse';
import { useEvents, type Event } from '@/hooks/use-events';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SortableColumnKey = 'lastName' | 'school' | 'uscfId' | 'regularRating' | 'grade' | 'state' | 'uscfExpiration' | 'events';

function PlayersPageContent() {
  const { toast } = useToast();
  const { database, deletePlayer, isDbLoaded } = useMasterDb();
  const { events } = useEvents();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 50;

  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (isDbLoaded) {
      setTotalPlayers(database.length);
    }
  }, [isDbLoaded, database.length]);


  const sortedPlayers = useMemo(() => {
    const sortablePlayers = [...database];
    if (sortConfig) {
        sortablePlayers.sort((a, b) => {
            let aValue: any = a[sortConfig.key as keyof MasterPlayer];
            let bValue: any = b[sortConfig.key as keyof MasterPlayer];

            if (sortConfig.key === 'uscfExpiration') {
                aValue = a.uscfExpiration ? new Date(a.uscfExpiration).getTime() : 0;
                bValue = b.uscfExpiration ? new Date(b.uscfExpiration).getTime() : 0;
            } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                aValue = aValue ?? 0;
                bValue = bValue ?? 0;
            }

            const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            return sortConfig.direction === 'ascending' ? result : -result;
        });
    }
    return sortablePlayers;
  }, [database, sortConfig]);

  const totalPages = Math.ceil(sortedPlayers.length / ROWS_PER_PAGE);
  const paginatedPlayers = sortedPlayers.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

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
    if (!selectedEventId) {
      toast({ variant: 'destructive', title: 'No Event Selected', description: 'Please select an event from the dropdown to add this player.' });
      return;
    }
    toast({ title: 'Player Added to Event', description: `${player.firstName} ${player.lastName} has been staged for registration in the selected event.` });
    console.log(`Staging player ${player.id} for event ${selectedEventId}`);
  };

  const handleDeletePlayer = (player: MasterPlayer) => {
    setPlayerToDelete(player);
    setIsAlertOpen(true);
  };
  
  const confirmDelete = () => {
    if (playerToDelete) {
      deletePlayer(playerToDelete.id);
      toast({ title: "Player removed", description: `${playerToDelete.firstName} ${playerToDelete.lastName} has been removed.` });
    }
    setIsAlertOpen(false);
    setPlayerToDelete(null);
  };
  
  const handleExport = () => {
    if (database.length === 0) {
      toast({ variant: 'destructive', title: 'No Data to Export', description: 'The player database is empty.' });
      return;
    }
    const csv = Papa.unparse(database);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'master_player_database.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: 'Export Complete', description: 'The master player database has been downloaded.' });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Master Player Database</h1>
          <p className="text-muted-foreground">
            Search, manage, and register every player in the system. Total Players: {isClient ? totalPlayers.toLocaleString() : '...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsSearchOpen(true)}><Search className="mr-2 h-4 w-4" />Search Players</Button>
            <Button variant="secondary" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export All</Button>
        </div>
      </div>
      
      <Card>
          <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>All Players</CardTitle>
                  <CardDescription>The complete list of players. Use the search button for advanced filtering.</CardDescription>
                </div>
                <div className="w-64">
                  <Select onValueChange={setSelectedEventId}>
                    <SelectTrigger><SelectValue placeholder="Select event to add players..." /></SelectTrigger>
                    <SelectContent>
                      {events.filter(e => new Date(e.date) >= new Date()).map(event => (
                        <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
          </CardHeader>
          <CardContent>
              <div className="h-[60vh] overflow-auto">
                  <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                              <TableHead><Button variant="ghost" onClick={() => requestSort('lastName')}>Player {getSortIcon('lastName')}</Button></TableHead>
                              <TableHead><Button variant="ghost" onClick={() => requestSort('school')}>School / District {getSortIcon('school')}</Button></TableHead>
                              <TableHead><Button variant="ghost" onClick={() => requestSort('uscfId')}>USCF ID {getSortIcon('uscfId')}</Button></TableHead>
                              <TableHead><Button variant="ghost" onClick={() => requestSort('uscfExpiration')}>Expiration {getSortIcon('uscfExpiration')}</Button></TableHead>
                              <TableHead><Button variant="ghost" onClick={() => requestSort('regularRating')}>Rating {getSortIcon('regularRating')}</Button></TableHead>
                              <TableHead><Button variant="ghost" onClick={() => requestSort('events')}>Events {getSortIcon('events')}</Button></TableHead>
                              <TableHead><span className="sr-only">Actions</span></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!isClient || !isDbLoaded ? Array.from({ length: 10 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                        )) : paginatedPlayers.map((player) => (
                          <TableRow key={player.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9"><AvatarFallback>{player.firstName?.charAt(0)}{player.lastName?.charAt(0)}</AvatarFallback></Avatar>
                                  <div>
                                    {`${player.lastName}, ${player.firstName} ${player.middleName || ''}`.trim()}
                                    <div className="text-sm text-muted-foreground">{player.email}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                  <div>{player.school}<div className="text-sm text-muted-foreground">{player.district}</div></div>
                              </TableCell>
                              <TableCell>{player.uscfId}</TableCell>
                              <TableCell>{player.uscfExpiration ? format(new Date(player.uscfExpiration), 'PPP') : 'N/A'}</TableCell>
                              <TableCell>{player.regularRating === undefined ? 'UNR' : player.regularRating}</TableCell>
                              <TableCell>{player.events}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => alert('Edit page not implemented yet.')}><Edit className="mr-2 h-4 w-4"/>Edit Player</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeletePlayer(player)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete Player</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                  </Table>
              </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between pt-6">
            {isClient && totalPages > 0 && (
                <>
                    <div className="text-sm text-muted-foreground">Showing <strong>{(currentPage - 1) * ROWS_PER_PAGE + 1}</strong> to <strong>{Math.min(currentPage * ROWS_PER_PAGE, sortedPlayers.length)}</strong> of <strong>{sortedPlayers.length.toLocaleString()}</strong> players</div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
                        <span className="text-sm font-medium">Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
                    </div>
                </>
            )}
             {isClient && totalPages === 0 && (
                <div className="text-sm text-muted-foreground">Showing <strong>0</strong> to <strong>0</strong> of <strong>0</strong> players</div>
             )}
          </CardFooter>
      </Card>
      
      <PlayerSearchDialog 
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectPlayer={handleSelectPlayer}
        portalType="organizer"
      />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove {playerToDelete?.firstName} {playerToDelete?.lastName} from the master database.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function PlayersPage() {
    return (
        <AppLayout>
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <PlayersPageContent />
            </Suspense>
        </AppLayout>
    );
}
