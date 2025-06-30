'use client';

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { PlusCircle, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const allPlayers = [
  { id: "p1", firstName: "Liam", middleName: "J", lastName: "Johnson", uscfId: "12345678", rating: 1850, team: "Solo", events: 2, eventIds: ['e2'] },
  { id: "p2", firstName: "Olivia", middleName: "K", lastName: "Smith", uscfId: "87654321", rating: 2100, team: "City Chess Club", events: 3, eventIds: ['e1', 'e3'] },
  { id: "p3", firstName: "Noah", middleName: "L", lastName: "Williams", uscfId: "11223344", rating: 1600, team: "Scholastic Stars", events: 1, eventIds: ['e1'] },
  { id: "p4", firstName: "Emma", middleName: "M", lastName: "Brown", uscfId: "44332211", rating: 1950, team: "Solo", events: 1, eventIds: ['e2'] },
  { id: "p5", firstName: "James", middleName: "N", lastName: "Jones", uscfId: "55667788", rating: 2200, team: "Grandmasters Inc.", events: 4, eventIds: ['e1', 'e2', 'e3'] },
  { id: "p6", firstName: "Alex", middleName: "S", lastName: "Ray", uscfId: "98765432", rating: 1750, team: "Sharyland Pioneer HS", events: 2, eventIds: ['e1'] },
  { id: "p7", firstName: "Jordan", middleName: "T", lastName: "Lee", uscfId: "23456789", rating: 2050, team: "Sharyland Pioneer HS", events: 3, eventIds: ['e1', 'e2'] },
];

const allEvents = [
  { id: 'e1', name: 'Spring Open 2024' },
  { id: 'e2', name: 'Summer Championship' },
  { id: 'e3', name: 'Autumn Classic' },
];

type Player = typeof allPlayers[0];
type SortableColumnKey = keyof Omit<Player, 'id' | 'eventIds' | 'middleName' | 'firstName'> | 'name';

export default function PlayersPage() {
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey; direction: 'ascending' | 'descending' } | null>({ key: 'lastName', direction: 'ascending' });
  const [selectedEvent, setSelectedEvent] = useState<string>('all');

  const filteredAndSortedPlayers = useMemo(() => {
    let sortablePlayers = [...allPlayers];
    
    if (selectedEvent !== 'all') {
      sortablePlayers = sortablePlayers.filter(p => p.eventIds.includes(selectedEvent));
    }

    if (sortConfig) {
        sortablePlayers.sort((a, b) => {
            const key = sortConfig.key;
            let aVal: any;
            let bVal: any;
            
            if (key === 'name') {
                aVal = a.lastName;
                bVal = b.lastName;
            } else {
                aVal = a[key as keyof Player];
                bVal = b[key as keyof Player];
            }
            
            let result = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                result = aVal.localeCompare(bVal);
            } else {
                if (aVal < bVal) result = -1;
                if (aVal > bVal) result = 1;
            }
            
            if (key === 'name' && result === 0) {
                result = a.firstName.localeCompare(b.firstName);
            }

            return sortConfig.direction === 'ascending' ? result : -result;
        });
    }
    return sortablePlayers;
  }, [sortConfig, selectedEvent]);
  
  const requestSort = (key: SortableColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    } else {
      return <ArrowDown className="ml-2 h-4 w-4" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">All Players</h1>
            <p className="text-muted-foreground">
              Manage player rosters for all events. (Organizer View)
            </p>
          </div>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Player
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter and Sort Players</CardTitle>
            <CardDescription>
                Use the filter to view players by event. Click column headers to sort.
            </CardDescription>
            <div className="pt-2">
                 <Select onValueChange={setSelectedEvent} defaultValue="all">
                    <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Filter by event..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Players</SelectItem>
                        {allEvents.map(event => (
                            <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('name')}>
                          Player {getSortIcon('name')}
                      </Button>
                  </TableHead>
                  <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('uscfId')}>
                          USCF ID {getSortIcon('uscfId')}
                      </Button>
                  </TableHead>
                  <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('rating')}>
                          Rating {getSortIcon('rating')}
                      </Button>
                  </TableHead>
                  <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('team')}>
                          Team / Sponsor {getSortIcon('team')}
                      </Button>
                  </TableHead>
                   <TableHead className="p-0">
                      <Button variant="ghost" className="w-full justify-start font-medium px-4" onClick={() => requestSort('events')}>
                          # Events {getSortIcon('events')}
                      </Button>
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={`https://placehold.co/40x40.png`} alt={player.firstName} data-ai-hint="person face" />
                          <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {`${player.lastName}, ${player.firstName} ${player.middleName || ''}`.trim()}
                      </div>
                    </TableCell>
                    <TableCell>{player.uscfId}</TableCell>
                    <TableCell>{player.rating}</TableCell>
                    <TableCell>{player.team}</TableCell>
                    <TableCell>{player.events}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>Edit Player</DropdownMenuItem>
                          <DropdownMenuItem>View Registrations</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Remove Player
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
