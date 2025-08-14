
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
import { useToast } from '@/hooks/use-toast';


interface PlayerSearchDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelectPlayer: (player: MasterPlayer) => void;
  onPlayerSelected?: (player: MasterPlayer) => void; // Add this new prop
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
    excludeIds: excludeIds,
    searchUnassigned: portalType === 'sponsor',
    sponsorProfile: portalType === 'sponsor' ? profile : null,
  });
  
const handleSelect = (player: MasterPlayer) => {
    console.log('🎯 PlayerSearchDialog: Player selected:', player.firstName, player.lastName);
    console.log('🎯 PlayerSearchDialog: portalType:', portalType);
    console.log('🎯 PlayerSearchDialog: profile:', profile);
    
    let playerWithSponsorInfo = { ...player };
    if (portalType === 'sponsor' && profile) {
        playerWithSponsorInfo = {
            ...player,
            district: profile.district,
            school: profile.school,
        };
        console.log('🎯 PlayerSearchDialog: Updated player with sponsor info:', playerWithSponsorInfo);
    }
    
    // Close the search dialog
    console.log('🎯 PlayerSearchDialog: Closing dialog');
    onOpenChange(false);
    
    // For sponsors, always open edit dialog to complete/verify information
    if (portalType === 'sponsor' && onPlayerSelected) {
        console.log('🎯 PlayerSearchDialog: Opening edit dialog for sponsor');
        onPlayerSelected(playerWithSponsorInfo);
    } else {
        // For non-sponsors, add immediately as before
        console.log('🎯 PlayerSearchDialog: Adding player directly (non-sponsor)');
        onSelectPlayer(playerWithSponsorInfo);
    }
};
  
  return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl h-[95vh] flex flex-col">
            <DialogHeader className="shrink-0">
                <DialogTitle>Search Master Player Database</DialogTitle>
                <DialogDescription>
                    Find existing players to add to your roster or event. For sponsors, players already on your roster are automatically excluded.
                </DialogDescription>
            </DialogHeader>

            {/* Search Form - Fixed height */}
            <div className="border rounded-md p-4 space-y-4 shrink-0">
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
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive hover:text-destructive">
                        <X className="mr-2 h-4 w-4" />Clear Filters
                    </Button>
                )}
            </div>

            {/* Results Section - Flex grow with proper overflow */}
    <div className="flex flex-col flex-1 min-h-0">
        {/* Results header */}
        {hasResults && (
            <div className="py-2 text-sm text-muted-foreground shrink-0">
                Found {searchResults.length} player{searchResults.length !== 1 ? 's' : ''}
            </div>
        )}
        
        {/* Scrollable results container */}
        <div className="flex-1 overflow-hidden border rounded-md">
            <div className="h-full overflow-y-auto">
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
                                const missingFields = portalType === 'sponsor' ? [
                                    !player.dob && 'DOB',
                                    !player.grade && 'Grade', 
                                    !player.section && 'Section',
                                    !player.email && 'Email',
                                    !player.zipCode && 'Zip'
                                ].filter(Boolean) : [];
                                
                                const isIncomplete = missingFields.length > 0;
                                
                                return (
                                    <div key={player.id} className={`flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 ${isIncomplete ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
                                        <div className="flex-1">
                                            <p className="font-semibold">{player.firstName} {player.lastName}</p>
                                            <p className="text-sm text-muted-foreground">
                                                ID: {player.uscfId} | Rating: {player.regularRating || 'UNR'} | School: {player.school || 'N/A'}
                                            </p>
                                            {isIncomplete && portalType === 'sponsor' && (
                                                <p className="text-xs text-blue-600 mt-1">
                                                    📝 Needs completion: {missingFields.join(', ')}
                                                </p>
                                            )}
                                            {!isIncomplete && portalType === 'sponsor' && (
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
                                            {isIncomplete && portalType === 'sponsor' ? 'Add & Complete' : 'Select'}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
            
            <DialogFooter className="shrink-0">
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
