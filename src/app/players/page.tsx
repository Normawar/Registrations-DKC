
'use client';

import { useState, useMemo, useCallback, Suspense, useEffect, useRef, type ChangeEvent } from 'react';
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { PlusCircle, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Search, Download, Trash2, Edit, Upload, ClipboardPaste, Delete } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { PlayerSearchDialog } from '@/components/PlayerSearchDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isValid } from 'date-fns';
import Papa from 'papaparse';
import { useEvents, type Event } from '@/hooks/use-events';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';


type SortableColumnKey = 'lastName' | 'school' | 'uscfId' | 'regularRating' | 'grade' | 'state' | 'uscfExpiration' | 'events';

function PlayersPageContent() {
  const { toast } = useToast();
  const { database, deletePlayer, isDbLoaded, addBulkPlayers, dbPlayerCount, clearDatabase, dbDistricts } = useMasterDb();
  const { events } = useEvents();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<MasterPlayer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 50;
  
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false);
  
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [dbPlayerCount]);


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
  
  const handleExport = (district?: string) => {
    let playersToExport = database;
    let fileName = 'master_player_database.csv';

    if (district) {
      playersToExport = database.filter(p => p.district === district);
      fileName = `${district.replace(/\s+/g, '_')}_players.csv`;
    }

    if (playersToExport.length === 0) {
      toast({ variant: 'destructive', title: 'No Data to Export', description: district ? `No players found for ${district}.` : 'The player database is empty.' });
      return;
    }

    const csv = Papa.unparse(playersToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: 'Export Complete', description: `${playersToExport.length} players exported.` });
  };
  
  const processImportData = (data: any[]) => {
    const newPlayers: MasterPlayer[] = [];
    let errors = 0;
    let skippedIncomplete = 0;

    const findColumn = (row: any, searchTerms: string[]) => {
      const keys = Object.keys(row);
      for (const term of searchTerms) {
        const found = keys.find(key => 
          key.toLowerCase().includes(term.toLowerCase()) && 
          row[key] !== null && 
          row[key] !== undefined && 
          String(row[key]).trim() !== ''
        );
        if (found) return row[found];
      }
      return null;
    };

    data.forEach((row: any) => {
      try {
        if (!row || Object.keys(row).length === 0) {
          skippedIncomplete++;
          return;
        }

        const uscfId = findColumn(row, ['uscf id', 'id']);
        const lastName = findColumn(row, ['last name']);

        if (!uscfId || !lastName) {
          skippedIncomplete++;
          return;
        }
        
        const firstName = findColumn(row, ['first name']) || 'Unknown';
        const ratingStr = findColumn(row, ['rating']);
        const expiresStr = findColumn(row, ['expires', 'expiration']);

        const playerData: MasterPlayer = {
          id: uscfId,
          uscfId: uscfId,
          firstName: firstName,
          lastName: lastName,
          state: findColumn(row, ['state', 'st']) || 'TX',
          regularRating: ratingStr && !isNaN(parseInt(ratingStr)) ? parseInt(ratingStr) : undefined,
          uscfExpiration: expiresStr && isValid(new Date(expiresStr)) ? new Date(expiresStr).toISOString() : undefined,
          middleName: findColumn(row, ['middle name']) || '',
          grade: findColumn(row, ['grade']) || '',
          section: findColumn(row, ['section']) || '',
          email: findColumn(row, ['email']) || '',
          phone: findColumn(row, ['phone']) || '',
          dob: undefined, // DOB parsing can be added if needed
          zipCode: findColumn(row, ['zip']) || '',
          studentType: undefined,
          school: findColumn(row, ['school']) || '',
          district: findColumn(row, ['district']) || '',
          events: 0,
          eventIds: [],
        };
        newPlayers.push(playerData);
      } catch(e) {
        errors++;
        console.error("Error processing player row:", row, e);
      }
    });

    if (newPlayers.length === 0) {
      toast({ 
        variant: 'destructive', 
        title: 'Import Failed', 
        description: `No valid players found. Skipped ${skippedIncomplete} incomplete rows. Check headers like 'USCF ID' and 'Last Name'.` 
      });
      return;
    }

    addBulkPlayers(newPlayers);
    toast({ 
      title: "Player Import Complete", 
      description: `Successfully imported ${newPlayers.length} players. Skipped ${skippedIncomplete} rows.` 
    });
  };

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => processImportData(results.data),
      error: (error) => { toast({ variant: 'destructive', title: 'Import Failed', description: error.message }); },
    });
    if (e.target) e.target.value = '';
  };

  const handlePasteImport = () => {
    if (!pasteData) { toast({ variant: 'destructive', title: 'No data', description: 'Please paste data.' }); return; }
    Papa.parse(pasteData, {
        header: true,
        skipEmptyLines: true,
        complete: (resultsWithHeader) => {
            if (resultsWithHeader.data.length > 0 && resultsWithHeader.meta.fields) {
                processImportData(resultsWithHeader.data);
            } else {
                 toast({ variant: 'destructive', title: 'Import Failed', description: 'No data parsed.' });
            }
            setIsPasteDialogOpen(false);
            setPasteData('');
        },
        error: (error) => { toast({ variant: 'destructive', title: 'Parse Failed', description: error.message }); }
    });
  };
  
  const handleClearDatabase = () => {
    clearDatabase();
    toast({ title: 'Database Cleared', description: 'All players have been removed from the database.'});
    setIsClearAlertOpen(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Master Player Database</h1>
          <p className="text-muted-foreground">
            Search, manage, and register every player in the system. Total Players: {clientReady ? dbPlayerCount.toLocaleString() : '...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileImport} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Import Players</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                    Import Players from CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsPasteDialogOpen(true)}>
                    Paste from Sheet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setIsSearchOpen(true)}><Search className="mr-2 h-4 w-4" />Search Players</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary"><Download className="mr-2 h-4 w-4" />Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => handleExport()}>
                    Export All Players
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Export by District</DropdownMenuLabel>
                {dbDistricts.map(district => (
                    <DropdownMenuItem key={district} onSelect={() => handleExport(district)}>
                        {district}
                    </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="destructive" onClick={() => setIsClearAlertOpen(true)}><Delete className="mr-2 h-4 w-4" />Clear Database</Button>
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
                        {!clientReady || !isDbLoaded ? Array.from({ length: 10 }).map((_, i) => (
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
                                    <DropdownMenuItem disabled><Edit className="mr-2 h-4 w-4"/>Edit Player</DropdownMenuItem>
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
            {clientReady && isDbLoaded ? (
                <>
                    <div className="text-sm text-muted-foreground">Showing <strong>{`${(currentPage - 1) * ROWS_PER_PAGE + 1}`}</strong> to <strong>{`${Math.min(currentPage * ROWS_PER_PAGE, sortedPlayers.length)}`}</strong> of <strong>{`${sortedPlayers.length.toLocaleString()}`}</strong> players</div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
                        <span className="text-sm font-medium">Page {`${currentPage.toLocaleString()}`} of {`${totalPages.toLocaleString()}`}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
                    </div>
                </>
            ) : (
                <div className="text-sm text-muted-foreground">Loading pagination...</div>
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
      
      <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Entire Player Database?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently remove all players from the database. Are you sure you want to continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearDatabase} className="bg-destructive hover:bg-destructive/90">Yes, Clear Database</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPasteDialogOpen} onOpenChange={setIsPasteDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Paste from Spreadsheet</DialogTitle><DialogDescription>Copy player data from your spreadsheet and paste it into the text area below.</DialogDescription></DialogHeader>
          <div className="py-4 space-y-4">
              <Textarea placeholder="Paste player data here..." className="h-64" value={pasteData} onChange={(e) => setPasteData(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button onClick={handlePasteImport}><ClipboardPaste className="mr-2 h-4 w-4" />Import Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
