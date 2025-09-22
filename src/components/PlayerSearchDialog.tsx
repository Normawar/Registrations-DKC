
'use client';

import React, { useState } from 'react';
import { useMasterDb, type SearchCriteria, type SearchResult, type MasterPlayer } from '@/context/master-db-context';

export function PlayerSearchDialog({ isOpen, onOpenChange, onSelectPlayer, excludeIds, portalType }: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSelectPlayer: (player: MasterPlayer) => void;
    excludeIds?: string[];
    portalType: 'sponsor' | 'organizer' | 'individual';
}) {
  const { searchPlayers, isDbLoaded, dbDistricts, dbSchools } = useMasterDb();
  const [searchCriteria, setSearchCriteria] = useState<Partial<SearchCriteria>>({});
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const handleSearch = async () => {
    setIsSearching(true);
    try {
      console.log('Starting search with criteria:', searchCriteria);
      const result = await searchPlayers({
        ...searchCriteria,
        pageSize: 100 // Load 100 results at a time
      });
      console.log('Search completed:', result);
      setSearchResult(result);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!searchResult?.hasMore || !searchResult?.lastDoc) return;
    
    setIsSearching(true);
    try {
      const moreResults = await searchPlayers({
        ...searchCriteria,
        lastDoc: searchResult.lastDoc,
        pageSize: 100
      });
      
      setSearchResult({
        players: [...searchResult.players, ...moreResults.players],
        hasMore: moreResults.hasMore,
        lastDoc: moreResults.lastDoc,
        totalFound: searchResult.totalFound + moreResults.totalFound
      });
    } catch (error) {
      console.error('Load more failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchCriteria({});
    setSearchResult(null);
  };
  
  const handleSelect = (player: MasterPlayer) => {
    onSelectPlayer(player);
    onOpenChange(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Search Form */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Search Master Player Database</h2>
          <p className="text-sm text-gray-600 mb-4">
            Use specific filters for faster results. Avoid broad searches with large datasets.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* USCF ID - Most efficient search */}
            <div>
              <label className="block text-sm font-medium mb-1">USCF ID (Exact)</label>
              <input
                type="text"
                value={searchCriteria.uscfId || ''}
                onChange={(e) => setSearchCriteria(prev => ({ ...prev, uscfId: e.target.value }))}
                placeholder="12345678"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                type="text"
                value={searchCriteria.firstName || ''}
                onChange={(e) => setSearchCriteria(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="John"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                type="text"
                value={searchCriteria.lastName || ''}
                onChange={(e) => setSearchCriteria(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Doe"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            {/* District */}
             <div>
                <label className="block text-sm font-medium mb-1">District</label>
                <select
                  value={searchCriteria.district || 'all'}
                  onChange={(e) => setSearchCriteria(prev => ({...prev, district: e.target.value, school: 'all'}))}
                  className="w-full border rounded px-3 py-2"
                  disabled={!isDbLoaded}
                >
                  <option value="all">
                    {!isDbLoaded ? 'Loading...' : 'All Districts'}
                  </option>
                  {dbDistricts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
            </div>
            
            {/* School */}
            <div>
                <label className="block text-sm font-medium mb-1">School</label>
                <select
                  value={searchCriteria.school || 'all'}
                  onChange={(e) => setSearchCriteria(prev => ({ ...prev, school: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  disabled={!isDbLoaded}
                >
                  <option value="all">
                    {!isDbLoaded ? 'Loading...' : 'All Schools'}
                  </option>
                  {dbSchools.map((school) => (
                    <option key={school} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search Players'}
            </button>
            
            <button
              onClick={handleClearSearch}
              className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
            >
              Clear
            </button>
            
            <button
              onClick={() => onOpenChange(false)}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
            >
              Close
            </button>
          </div>
        </div>
        
        {/* Search Results */}
        {searchResult && (
          <div>
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-2">
                Search Results ({searchResult.players.length} shown)
              </h3>
              
              {searchResult.players.length === 0 ? (
                <p className="text-gray-500">No players found matching your criteria.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">USCF ID</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">State</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">School</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Rating</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResult.players.map((player) => (
                          <tr key={player.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              {player.firstName} {player.lastName}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">{player.uscfId}</td>
                            <td className="border border-gray-300 px-4 py-2">{player.state}</td>
                            <td className="border border-gray-300 px-4 py-2">{player.school}</td>
                            <td className="border border-gray-300 px-4 py-2">{player.regularRating}</td>
                            <td className="border border-gray-300 px-4 py-2">
                                <button onClick={() => handleSelect(player)} className="bg-green-500 text-white px-2 py-1 rounded text-xs">Select</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Load More Button */}
                  {searchResult.hasMore && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={handleLoadMore}
                        disabled={isSearching}
                        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {isSearching ? 'Loading...' : 'Load More Results'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
