
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { usePlayerSearch } from '@/hooks/use-player-search';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Loader2, Search, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


interface PlayerSearchDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelectPlayer: (player: MasterPlayer) => void;
  excludeIds?: string[];
  portalType: 'sponsor' | 'organizer' | 'individual';
}

export function PlayerSearchDialog({ isOpen, onOpenChange, onSelectPlayer, excludeIds, portalType }: PlayerSearchDialogProps) {
  const { profile } = useSponsorProfile();
  const { dbStates, dbSchools, dbDistricts } = useMasterDb();

  const [initialSearchFilters, setInitialSearchFilters] = useState<Partial<MasterPlayer>>({ state: 'TX' });

  useEffect(() => {
    // Set initial district/school for sponsors, but let the hook handle the actual filtering logic
    if (portalType === 'sponsor' && profile) {
      setInitialSearchFilters({ state: 'TX', district: profile.district, school: profile.school });
    }
  }, [portalType, profile]);

  const {
    filters,
    updateFilter,
    clearFilters,
    searchResults,
    isLoading,
    hasResults,
    hasActiveFilters,
  } = usePlayerSearch({
    initialFilters: initialSearchFilters,
    excludeIds: excludeIds,
    searchUnassigned: portalType === 'sponsor',
    sponsorProfile: portalType === 'sponsor' ? profile : null,
  });
  
  const handleSelect = (player: MasterPlayer) => {
    let playerWithSponsorInfo = { ...player };
    if (portalType === 'sponsor' && profile) {
      playerWithSponsorInfo = {
        ...player,
        district: profile.district,
        school: profile.school,
      };
    }
    onSelectPlayer(playerWithSponsorInfo);
    onOpenChange(false);
  };
  
  return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
            <DialogTitle>Search Master Player Database</DialogTitle>
            <DialogDescription>
                Find existing players to add to your roster or event. For sponsors, players already on your roster are automatically excluded.
            </DialogDescription>
            </DialogHeader>

            <div className="border rounded-md p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                      <Label htmlFor="search-first-name">First Name</Label>
                      <Input id="search-first-name" placeholder="John" value={filters.firstName || ''} onChange={(e) => updateFilter('firstName', e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="search-last-name">Last Name</Label>
                      <Input id="search-last-name" placeholder="Doe" value={filters.lastName || ''} onChange={(e) => updateFilter('lastName', e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="search-uscf-id">USCF ID</Label>
                      <Input id="search-uscf-id" placeholder="12345678" value={filters.uscfId || ''} onChange={(e) => updateFilter('uscfId', e.target.value)} />
                  </div>
                  <div>
                      <Label htmlFor="search-state">State</Label>
                      <Select value={filters.state || 'ALL'} onValueChange={(value) => updateFilter('state', value)}>
                        <SelectTrigger id="search-state"><SelectValue/></SelectTrigger>
                        <SelectContent>{dbStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                </div>
                {portalType === 'organizer' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="search-school">School</Label>
                            <Select value={filters.school || ''} onValueChange={(value) => updateFilter('school', value)}>
                                <SelectTrigger id="search-school"><SelectValue placeholder="All Schools"/></SelectTrigger>
                                <SelectContent>{dbSchools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="search-district">District</Label>
                             <Select value={filters.district || ''} onValueChange={(value) => updateFilter('district', value)}>
                                <SelectTrigger id="search-district"><SelectValue placeholder="All Districts"/></SelectTrigger>
                                <SelectContent>{dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
                {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive hover:text-destructive"><X className="mr-2 h-4 w-4" />Clear Filters</Button>}
            </div>

            <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
                <div className="pr-4">
                {isLoading && (
                    <div className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Searching...</div>
                )}
                {!isLoading && !hasResults && hasActiveFilters && (
                    <div className="text-center p-8 text-muted-foreground">No players found matching your criteria.</div>
                )}
                {!isLoading && !hasActiveFilters && (
                    <div className="text-center p-8 text-muted-foreground">Enter search criteria above to find players.</div>
                )}
                {hasResults && (
                    <div className="space-y-2">
                    {searchResults.map(player => (
                        <div key={player.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
                        <div>
                            <p className="font-semibold">{player.firstName} {player.lastName}</p>
                            <p className="text-sm text-muted-foreground">ID: {player.uscfId} | Rating: {player.regularRating || 'UNR'} | School: {player.school || 'N/A'}</p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => handleSelect(player)}>Select</Button>
                        </div>
                    ))}
                    </div>
                )}
                </div>
            </ScrollArea>
            </div>
            
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
