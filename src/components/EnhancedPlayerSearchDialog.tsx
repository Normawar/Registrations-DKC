'use client';

import React, { useState, useEffect } from 'react';
import { useMasterDb, type SearchCriteria, type SearchResult, type MasterPlayer } from '@/context/master-db-context';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { ExternalLink } from 'lucide-react';

interface USCFPlayer {
  uscf_id: string;
  name: string;
  rating_regular: number | null;
  rating_quick: number | null;
  state: string | null;
  expiration_date: string | null;
}

export function EnhancedPlayerSearchDialog({ 
  isOpen, 
  onOpenChange, 
  onPlayerSelected,
  excludeIds = [],
  title = "Search Master Player Database",
  userProfile = null,
  preFilterByUserProfile = true
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPlayerSelected: (player: MasterPlayer | USCFPlayer) => void;
  excludeIds?: string[];
  title?: string;
  userProfile?: SponsorProfile | null;
  preFilterByUserProfile?: boolean;
}) {
  const { isDbLoaded, dbDistricts, dbSchools, searchPlayers } = useMasterDb();
  
  // DATABASE SEARCH STATE
  const [searchCriteria, setSearchCriteria] = useState<Partial<SearchCriteria>>({});
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const availableDistricts = React.useMemo(() => {
    if (!preFilterByUserProfile || !userProfile || userProfile.role === 'organizer' || userProfile.isDistrictCoordinator) {
      return dbDistricts;
    }
    if (userProfile.district && userProfile.district !== 'All Districts') {
      return dbDistricts.filter(district => district === userProfile.district);
    }
    return dbDistricts;
  }, [dbDistricts, userProfile, preFilterByUserProfile]);
  
  const availableSchools = React.useMemo(() => {
    const district = searchCriteria.district;
    if (!district || district === 'all') {
      return dbSchools;
    }
    // Filter schools based on the selected district.
    return dbSchools.filter(school => {
        // This is a simplified check. A better implementation would use the full school data.
        // For now, we assume school names are unique enough or we can derive district.
        // This part might need to be improved if school names are not unique across districts.
        // The master DB context would need to expose the full school objects.
        return true; // Re-evaluating this, as dbSchools is just strings.
    });
  }, [dbSchools, searchCriteria.district]);

  // Initialize search criteria based on user profile
  useEffect(() => {
    if (!preFilterByUserProfile || !userProfile || !isOpen) return;

    const initialCriteria: Partial<SearchCriteria> = {};

    if (userProfile.role !== 'organizer' && userProfile.district && userProfile.district !== 'All Districts') {
      initialCriteria.district = userProfile.district;
    }

    if (!userProfile.isDistrictCoordinator && userProfile.role === 'sponsor' && 
        userProfile.school && userProfile.school !== 'All Schools') {
      initialCriteria.school = userProfile.school;
    }

    setSearchCriteria(initialCriteria);
  }, [userProfile, preFilterByUserProfile, isOpen]);

  // API-based search function
  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const result = await searchPlayers({
        ...searchCriteria,
        pageSize: 100
      });
      setSearchResult(result);
    } catch (error: any) {
      console.error('Search failed:', error);
      alert(`Search failed: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchCriteria({});
    setSearchResult(null);
  };

  // Field updates
  const updateField = (field: keyof SearchCriteria, value: any) => {
    const newCriteria: Partial<SearchCriteria> = { ...searchCriteria, [field]: value };
    if (field === 'district') {
      newCriteria.school = 'all';
    }
    setSearchCriteria(newCriteria);
  };

  const handleSelectPlayer = (player: MasterPlayer | USCFPlayer) => {
    onPlayerSelected(player);
    onOpenChange(false);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-2">{title}</h2>
            <p className="text-sm text-gray-600">Search the master database for players to add to your roster.</p>
          </div>
           <a href="https://new.uschess.org/civicrm/player-search" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Find on USCF <ExternalLink className="h-4 w-4" />
            </a>
        </div>
        
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Database Search</h3>
            <p className="text-sm text-blue-700">Fill in your search criteria and click "Search Database" to find players.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">USCF ID</label>
              <input type="text" value={searchCriteria.uscfId || ''} onChange={(e) => updateField('uscfId', e.target.value)} placeholder="32052572" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input type="text" value={searchCriteria.firstName || ''} onChange={(e) => updateField('firstName', e.target.value)} placeholder="John" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input type="text" value={searchCriteria.lastName || ''} onChange={(e) => updateField('lastName', e.target.value)} placeholder="Smith" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">District</label>
              <select value={searchCriteria.district || 'all'} onChange={(e) => updateField('district', e.target.value)} className="w-full border rounded px-3 py-2" disabled={!isDbLoaded}>
                <option value="all">{!isDbLoaded ? 'Loading districts...' : 'All Available Districts'}</option>
                <option value="Unassigned">Unassigned Players</option>
                {availableDistricts.filter(d => d && d !== 'all').map((district) => (<option key={district} value={district}>{district}</option>))}
              </select>
              {!isDbLoaded && (<small className="text-gray-500">Loading...</small>)}
               {preFilterByUserProfile && userProfile && (
                  <small className="text-blue-600">Showing districts relevant to you</small>
               )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">School</label>
              <select value={searchCriteria.school || 'all'} onChange={(e) => updateField('school', e.target.value)} className="w-full border rounded px-3 py-2" disabled={!isDbLoaded || !searchCriteria.district}>
                <option value="all">{!isDbLoaded ? 'Loading schools...' : 'All Available Schools'}</option>
                 <option value="Unassigned">Unassigned Players</option>
                {availableSchools.filter(s => s && s !== 'all').map((school) => (<option key={school} value={school}>{school}</option>))}
              </select>
              {!isDbLoaded && (<small className="text-gray-500">Loading...</small>)}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <select value={searchCriteria.state || ''} onChange={(e) => updateField('state', e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="">All States</option><option value="TX">Texas</option><option value="CA">California</option><option value="NY">New York</option><option value="FL">Florida</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Min Rating</label>
              <input type="number" value={searchCriteria.minRating || ''} onChange={(e) => updateField('minRating', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="1000" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Rating</label>
              <input type="number" value={searchCriteria.maxRating || ''} onChange={(e) => updateField('maxRating', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="2000" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="flex space-x-4 mb-6">
            <button onClick={handleSearch} disabled={isSearching} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">{isSearching ? 'Searching...' : 'Search Database'}</button>
            <button onClick={clearSearch} className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700">Clear All</button>
          </div>
          {searchResult && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-2">Search Results ({searchResult.players?.length || 0} found)</h3>
              {searchResult.message && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"><p className="text-sm text-yellow-800">{searchResult.message}</p></div>)}
              {searchResult.players?.length === 0 ? (<p className="text-gray-500">No players found in database.</p>) : searchResult.players?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    <thead><tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">Name</th><th className="border border-gray-300 px-4 py-2 text-left">USCF ID</th><th className="border border-gray-300 px-4 py-2 text-left">State</th><th className="border border-gray-300 px-4 py-2 text-left">School</th><th className="border border-gray-300 px-4 py-2 text-left">Rating</th><th className="border border-gray-300 px-4 py-2 text-left">Action</th>
                    </tr></thead>
                    <tbody>{searchResult.players?.map((player: MasterPlayer) => (<tr key={player.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">{player.firstName} {player.middleName} {player.lastName}</td><td className="border border-gray-300 px-4 py-2">{player.uscfId}</td><td className="border border-gray-300 px-4 py-2">{player.state}</td><td className="border border-gray-300 px-4 py-2">{player.school}</td><td className="border border-gray-300 px-4 py-2">{player.regularRating}</td><td className="border border-gray-300 px-4 py-2"><button onClick={() => handleSelectPlayer(player)} className="bg-green-500 text-white px-2 py-1 rounded text-xs">Select</button></td>
                    </tr>))}</tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div className="border-t pt-4 mt-6">
          <div className="flex justify-end space-x-4"><button onClick={() => onOpenChange(false)} className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700">Close</button></div>
        </div>
      </div>
    </div>
  );
}
