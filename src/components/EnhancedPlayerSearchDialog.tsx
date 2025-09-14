
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMasterDb, type SearchCriteria, type SearchResult, type MasterPlayer } from '@/context/master-db-context';

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
  title = "Search Master Player Database"
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPlayerSelected: (player: MasterPlayer | USCFPlayer) => void;
  excludeIds?: string[];
  title?: string;
}) {
  const { searchPlayers } = useMasterDb();
  const [activeTab, setActiveTab] = useState<'database' | 'uscf'>('database');
  
  // Database search state
  const [searchCriteria, setSearchCriteria] = useState<Partial<SearchCriteria>>({});
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [dynamicSearchDisabled, setDynamicSearchDisabled] = useState(false);
  
  // USCF lookup state
  const [uscfLookup, setUSCFLookup] = useState({
    uscfId: '',
    firstName: '',
    lastName: ''
  });
  const [uscfResults, setUSCFResults] = useState<USCFPlayer[]>([]);
  const [isUSCFSearching, setIsUSCFSearching] = useState(false);
  const [uscfError, setUSCFError] = useState<string>('');

  // Debounced search function
  const performDynamicSearch = useCallback(async (criteria: Partial<SearchCriteria>) => {
    // Only search if there's at least one meaningful criteria
    const hasSearchCriteria = Object.values(criteria).some(value => 
      value !== undefined && value !== null && value !== ''
    );

    if (!hasSearchCriteria) {
      setSearchResult(null);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchPlayers({
        ...criteria,
        pageSize: 100
      });
      setSearchResult(result);
    } catch (error) {
      console.error('Dynamic search failed:', error);
      // Don't show alert for dynamic searches, just log the error
    } finally {
      setIsSearching(false);
    }
  }, [searchPlayers]);

  // Effect to handle dynamic searching with debouncing
  useEffect(() => {
    if (activeTab !== 'database' || dynamicSearchDisabled) return;

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      performDynamicSearch(searchCriteria);
    }, 300); // 300ms delay

    setSearchTimeout(timeout);

    // Cleanup
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchCriteria, activeTab, performDynamicSearch, dynamicSearchDisabled]);

  // Update search criteria with dynamic search
  const updateSearchCriteria = (field: keyof SearchCriteria, value: any) => {
    setSearchCriteria(prev => ({ ...prev, [field]: value }));
  };

  // Database search functions
  const handleDatabaseSearch = async () => {
    // Manual search - same as before but without debouncing
    setIsSearching(true);
    try {
      const result = await searchPlayers({
        ...searchCriteria,
        pageSize: 100
      });
      setSearchResult(result);
      setDynamicSearchDisabled(false); // Re-enable dynamic search on success
    } catch (error) {
      console.error('Database search failed:', error);
      alert('Search failed. Please try again.');
      setDynamicSearchDisabled(true); // Disable on error
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearDatabaseSearch = () => {
    setSearchCriteria({});
    setSearchResult(null);
    setDynamicSearchDisabled(false);
  };

  // USCF lookup functions
  const handleUSCFLookupById = async () => {
    if (!uscfLookup.uscfId.trim()) {
      setUSCFError('Please enter a USCF ID');
      return;
    }

    setIsUSCFSearching(true);
    setUSCFError('');
    setUSCFResults([]);

    try {
      const response = await fetch('/api/uscf-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uscfId: uscfLookup.uscfId.trim() }),
      });

      if (response.ok) {
        const player = await response.json();
        setUSCFResults([player]);
      } else {
        const errorData = await response.json();
        setUSCFError(errorData.error || `No player found with USCF ID: ${uscfLookup.uscfId}`);
      }
    } catch (error) {
      setUSCFError('Failed to lookup player. Please try again.');
    } finally {
      setIsUSCFSearching(false);
    }
  };

  const handleUSCFLookupByName = async () => {
    const firstName = uscfLookup.firstName.trim();
    const lastName = uscfLookup.lastName.trim();

    if (!firstName && !lastName) {
      setUSCFError('Please enter at least a first or last name');
      return;
    }

    setIsUSCFSearching(true);
    setUSCFError('');
    setUSCFResults([]);

    try {
      const response = await fetch('/api/uscf-lookup-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          firstName, 
          lastName
        }),
      });

      if (response.ok) {
        const players = await response.json();
        if (players.length > 0) {
          setUSCFResults(players);
        } else {
          setUSCFError(`No players found matching your search.`);
        }
      } else {
        const errorData = await response.json();
        setUSCFError(errorData.error || 'Failed to lookup players. Please try again.');
      }
    } catch (error) {
      setUSCFError('Failed to lookup players. Please try again.');
    } finally {
      setIsUSCFSearching(false);
    }
  };

  const handleClearUSCFSearch = () => {
    setUSCFLookup({ uscfId: '', firstName: '', lastName: '' });
    setUSCFResults([]);
    setUSCFError('');
  };

  const handleSelectPlayer = (player: MasterPlayer | USCFPlayer) => {
    onPlayerSelected(player);
    onOpenChange(false);
  };

  const formatUSCFPlayerName = (name: string) => {
    // Parse the formatted name "lastName, firstName, middleName" and display all parts
    const parts = name.split(', ');
    if (parts.length >= 2) {
      const lastName = parts[0];
      const firstName = parts[1];
      const middleName = parts.length > 2 ? parts[2] : '';
      
      // Show all parts: "firstName middleName lastName"
      if (middleName) {
        return `${firstName} ${middleName} ${lastName}`;
      } else {
        return `${firstName} ${lastName}`;
      }
    }
    return name;
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          <p className="text-sm text-gray-600">
            Search your master database or lookup players directly from USCF.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('database')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'database'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Search Master Database
              </button>
              <button
                onClick={() => setActiveTab('uscf')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'uscf'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                USCF Lookup
              </button>
            </nav>
          </div>
        </div>

        {/* Database Search Tab */}
        {activeTab === 'database' && (
          <div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-green-800 mb-2">
                {dynamicSearchDisabled ? 'Dynamic Search Disabled' : 'Dynamic Search'}
              </h3>
              <p className="text-sm text-green-700">
                {dynamicSearchDisabled 
                  ? 'Dynamic search was disabled due to missing database index. Use "Manual Search" or "Clear All" to re-enable.'
                  : 'Search updates automatically as you type in any field. For example: typing "9" in USCF ID shows all IDs starting with 9, typing "John" in First Name shows all first names starting with John, etc.'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  USCF ID
                  {isSearching && searchCriteria.uscfId && (
                    <span className="ml-2 text-xs text-blue-600">Searching...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={searchCriteria.uscfId || ''}
                  onChange={(e) => updateSearchCriteria('uscfId', e.target.value)}
                  placeholder="e.g., 9 (shows all IDs starting with 9)"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  First Name
                  {isSearching && searchCriteria.firstName && (
                    <span className="ml-2 text-xs text-blue-600">Searching...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={searchCriteria.firstName || ''}
                  onChange={(e) => updateSearchCriteria('firstName', e.target.value)}
                  placeholder="John"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Middle Name
                  {isSearching && searchCriteria.middleName && (
                    <span className="ml-2 text-xs text-blue-600">Searching...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={searchCriteria.middleName || ''}
                  onChange={(e) => updateSearchCriteria('middleName', e.target.value)}
                  placeholder="Michael"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name
                  {isSearching && searchCriteria.lastName && (
                    <span className="ml-2 text-xs text-blue-600">Searching...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={searchCriteria.lastName || ''}
                  onChange={(e) => updateSearchCriteria('lastName', e.target.value)}
                  placeholder="Doe"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <select
                  value={searchCriteria.state || ''}
                  onChange={(e) => updateSearchCriteria('state', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">All States</option>
                  <option value="TX">Texas</option>
                  <option value="CA">California</option>
                  <option value="NY">New York</option>
                  <option value="FL">Florida</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  School (Exact)
                  {isSearching && searchCriteria.school && (
                    <span className="ml-2 text-xs text-blue-600">Searching...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={searchCriteria.school || ''}
                  onChange={(e) => updateSearchCriteria('school', e.target.value)}
                  placeholder="Lincoln Elementary"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  District (Exact)
                  {isSearching && searchCriteria.district && (
                    <span className="ml-2 text-xs text-blue-600">Searching...</span>
                  )}
                </label>
                <input
                  type="text"
                  value={searchCriteria.district || ''}
                  onChange={(e) => updateSearchCriteria('district', e.target.value)}
                  placeholder="Austin ISD"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Min Rating</label>
                <input
                  type="number"
                  value={searchCriteria.minRating || ''}
                  onChange={(e) => updateSearchCriteria('minRating', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="1000"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Rating</label>
                <input
                  type="number"
                  value={searchCriteria.maxRating || ''}
                  onChange={(e) => updateSearchCriteria('maxRating', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="2000"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            
            <div className="flex space-x-4 mb-6">
              <button
                onClick={handleDatabaseSearch}
                disabled={isSearching}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSearching ? 'Searching...' : 'Manual Search'}
              </button>
              
              <button
                onClick={handleClearDatabaseSearch}
                className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
              >
                Clear All
              </button>
            </div>

            {searchResult && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-2">
                  Database Results ({searchResult.players?.length || 0} found)
                  {isSearching && <span className="ml-2 text-sm text-blue-600">Updating...</span>}
                </h3>
                
                {searchResult.players?.length === 0 ? (
                  <p className="text-gray-500">No players found in database.</p>
                ) : (
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
                        {searchResult.players?.map((player: MasterPlayer) => (
                          <tr key={player.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              {player.firstName} {player.middleName} {player.lastName}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">{player.uscfId}</td>
                            <td className="border border-gray-300 px-4 py-2">{player.state}</td>
                            <td className="border border-gray-300 px-4 py-2">{player.school}</td>
                            <td className="border border-gray-300 px-4 py-2">{player.regularRating}</td>
                            <td className="border border-gray-300 px-4 py-2">
                              <button 
                                onClick={() => handleSelectPlayer(player)}
                                disabled={excludeIds.includes(player.uscfId)}
                                className={`px-2 py-1 rounded text-xs ${
                                  excludeIds.includes(player.uscfId)
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                              >
                                {excludeIds.includes(player.uscfId) ? 'Already Added' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* USCF Lookup Tab */}
        {activeTab === 'uscf' && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-800 mb-2">USCF Direct Lookup</h3>
              <p className="text-sm text-blue-700">
                Look up players directly from the USCF database. Players found here can be added to both your roster and master database.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Lookup by USCF ID</h3>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">USCF ID</label>
                  <input
                    type="text"
                    value={uscfLookup.uscfId}
                    onChange={(e) => setUSCFLookup(prev => ({ ...prev, uscfId: e.target.value }))}
                    placeholder="32052572"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <button
                  onClick={handleUSCFLookupById}
                  disabled={isUSCFSearching}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUSCFSearching ? 'Looking up...' : 'Lookup'}
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Lookup by Name</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name</label>
                  <input
                    type="text"
                    value={uscfLookup.firstName}
                    onChange={(e) => setUSCFLookup(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Ryan"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    value={uscfLookup.lastName}
                    onChange={(e) => setUSCFLookup(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Moreno"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              <button
                onClick={handleUSCFLookupByName}
                disabled={isUSCFSearching}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isUSCFSearching ? 'Looking up...' : 'Lookup by Name'}
              </button>
            </div>

            <div className="flex space-x-4 mb-6">
              <button
                onClick={handleClearUSCFSearch}
                className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
              >
                Clear
              </button>
            </div>

            {uscfError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">{uscfError}</p>
              </div>
            )}

            {uscfResults.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-2">
                  USCF Results ({uscfResults.length} found)
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">USCF ID</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Regular Rating</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Quick Rating</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">State</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Expires</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uscfResults.map((player) => (
                        <tr key={player.uscf_id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">
                            {formatUSCFPlayerName(player.name)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">{player.uscf_id}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            {player.rating_regular || 'Unrated'}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {player.rating_quick || 'Unrated'}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">{player.state || '-'}</td>
                          <td className="border border-gray-300 px-4 py-2">{player.expiration_date || '-'}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            <button 
                              onClick={() => handleSelectPlayer(player)}
                              disabled={excludeIds.includes(player.uscf_id)}
                              className={`px-2 py-1 rounded text-xs ${
                                excludeIds.includes(player.uscf_id)
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-green-500 text-white hover:bg-green-600'
                              }`}
                            >
                              {excludeIds.includes(player.uscf_id) ? 'Already Added' : 'Add & Complete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-4 mt-6">
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => onOpenChange(false)}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}