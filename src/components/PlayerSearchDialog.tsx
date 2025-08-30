
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
import { Loader2, Search, X, School } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';


interface PlayerSearchDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelectPlayer: (player: MasterPlayer) => void;
  onPlayerSelected?: (player: MasterPlayer) => void; 
  excludeIds?: string[];
  portalType: 'sponsor' | 'organizer' | 'individual';
}

export function PlayerSearchDialog({ isOpen, onOpenChange, onSelectPlayer, onPlayerSelected, excludeIds, portalType }: PlayerSearchDialogProps) {
  const { profile } = useSponsorProfile();
  const { dbStates, dbSchools, dbDistricts, isDbLoaded } = useMasterDb();
  const { toast } = useToast();

  const {
    filters,
    updateFilter,
    clearFilters,
    searchResults,
    isLoading,
    hasResults,
    hasActiveFilters,
  } = usePlayerSearch({
    initialFilters: { state: 'TX' },
    excludeIds: portalType === 'sponsor' ? excludeIds : [], // Only exclude for sponsors
    searchUnassigned: portalType === 'sponsor',
    sponsorProfile: portalType === 'sponsor' ? profile : null,
    portalType: portalType,
  });
  
const handleSelect = (player: MasterPlayer) => {
    let playerWithSponsorInfo = { ...player };
    
    // For individual portal, the logic from onPlayerSelected is now used directly
    if (portalType === 'individual' && onPlayerSelected) {
      onOpenChange(false);
      onPlayerSelected(player);
      return;
    }
    
    if (portalType === 'individual') {
        onOpenChange(false);
        onSelectPlayer(player);
        return;
    }

    // Existing logic for sponsor/organizer
    if (portalType === 'sponsor' && profile) {
        playerWithSponsorInfo = {
            ...player,
            district: profile.district,
            school: profile.school,
        };
    }
    
    if (onPlayerSelected) {
        onPlayerSelected(playerWithSponsorInfo);
    } else {
        onSelectPlayer(playerWithSponsorInfo);
    }
    onOpenChange(false);
};
  
  return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl h-[95vh] flex flex-col">
            <DialogHeader className="shrink-0 flex-row items-start justify-between">
                <div>
                    <DialogTitle>Search Master Player Database</DialogTitle>
                    <DialogDescription>
                        Find existing players to add. For sponsors, players already on your roster are automatically excluded.
                    </DialogDescription>
                </div>
                 {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive hover:text-destructive">
                        <X className="mr-2 h-4 w-4" />Clear Filters
                    </Button>
                )}
            </DialogHeader>

            <div className="border rounded-md p-4 space-y-4 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="search-first-name">First Name</Label>
                        <Input id="search-first-name" placeholder="John" value={filters.firstName || ''} onChange={(e) => updateFilter('firstName', e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor="search-middle-name">Middle Name</Label>
                        <Input id="search-middle-name" placeholder="M" value={filters.middleName || ''} onChange={(e) => updateFilter('middleName', e.target.value)} />
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
                        <Select value={filters.state || 'ALL'} onValueChange={(value) => updateFilter('state', value)} disabled={!isDbLoaded}>
                            <SelectTrigger id="search-state">
                                <SelectValue placeholder={isDbLoaded ? "All States" : "Loading..."} />
                            </SelectTrigger>
                            <SelectContent>{dbStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                {portalType === 'organizer' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="search-school">School</Label>
                            <Select value={filters.school || ''} onValueChange={(value) => updateFilter('school', value)} disabled={!isDbLoaded}>
                                <SelectTrigger id="search-school">
                                    <SelectValue placeholder={isDbLoaded ? "All Schools" : "Loading..."} />
                                </SelectTrigger>
                                <SelectContent>{dbSchools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="search-district">District</Label>
                            <Select value={filters.district || ''} onValueChange={(value) => updateFilter('district', value)} disabled={!isDbLoaded}>
                                <SelectTrigger id="search-district">
                                    <SelectValue placeholder={isDbLoaded ? "All Districts" : "Loading..."} />
                                </SelectTrigger>
                                <SelectContent>{dbDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

            {hasResults && (
                <div className="py-2 text-sm text-muted-foreground shrink-0">
                    Found {searchResults.length} player{searchResults.length !== 1 ? 's' : ''}
                </div>
            )}
            
            <ScrollArea className="flex-1 border rounded-md">
                <div className="p-4">
                    {isLoading && (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin"/>Searching...
                        </div>
                    )}
                    {!isLoading && !hasResults && hasActiveFilters && (
                        <div className="text-center p-8 text-muted-foreground">
                            No players found matching your criteria.
                        </div>
                    )}
                    {!isLoading && !hasActiveFilters && (
                        <div className="text-center p-8 text-muted-foreground">
                            Enter search criteria above to find players.
                        </div>
                    )}
                    {hasResults && (
                        <div className="space-y-2">
                            {searchResults.map((player, index) => {
                                const missingFields = (portalType === 'sponsor' || portalType === 'individual') ? [
                                    !player.dob && 'DOB',
                                    !player.grade && 'Grade', 
                                    !player.section && 'Section',
                                    !player.email && 'Email',
                                    !player.zipCode && 'Zip'
                                ].filter(Boolean) : [];
                                
                                const isIncomplete = missingFields.length > 0;
                                const fullName = [player.firstName, player.middleName, player.lastName].filter(Boolean).join(' ');

                                
                                return (
                                    <div key={player.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
                                        <div className="flex-1">
                                            <p className="font-semibold">{fullName}</p>
                                            <p className="text-sm text-muted-foreground">
                                                ID: {player.uscfId} | Rating: {player.regularRating || 'UNR'} | School: {player.school || 'N/A'}
                                            </p>
                                            {isIncomplete && (portalType === 'sponsor' || portalType === 'individual') && (
                                                <p className="text-xs text-blue-600 mt-1">
                                                    📝 Needs completion: {missingFields.join(', ')}
                                                </p>
                                            )}
                                            {!isIncomplete && (portalType === 'sponsor' || portalType === 'individual') && (
                                                <p className="text-xs text-green-600 mt-1">
                                                    ✅ Complete profile
                                                </p>
                                            )}
                                        </div>
                                        <Button 
                                            variant="secondary"
                                            size="sm" 
                                            onClick={() => handleSelect(player)}
                                        >
                                            {(isIncomplete && (portalType === 'sponsor' || portalType === 'individual')) ? 'Add & Complete' : 'Select'}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </ScrollArea>
            
            <DialogFooter className="shrink-0">
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
