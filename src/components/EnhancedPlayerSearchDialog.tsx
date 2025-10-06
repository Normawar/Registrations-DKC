'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMasterDb, type SearchCriteria, type SearchResult, type MasterPlayer } from '@/context/master-db-context';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { ExternalLink } from 'lucide-react';

// ---------------------
// Helper
// ---------------------
function safeToLower(value?: string): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

// ---------------------
// Component
// ---------------------
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
  onPlayerSelected: (player: MasterPlayer) => void;
  excludeIds?: string[];
  title?: string;
  userProfile?: SponsorProfile | null;
  preFilterByUserProfile?: boolean;
}) {
  const { searchPlayers } = useMasterDb();
  
  const [dbDistricts, setDbDistricts] = useState<string[]>([]);
  const [dbSchools, setDbSchools] = useState<string[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const [searchCriteria, setSearchCriteria] = useState<Partial<SearchCriteria>>({});
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<string[]>([]);

  // ---------------------
  // Load districts & schools
  // ---------------------
  useEffect(() => {
    async function fetchData() {
      try {
        const [districtsRes, schoolsRes] = await Promise.all([
          fetch('/api/districts'),
          fetch('/api/schools')
        ]);

        const districts = await districtsRes.json();
        const schools = await schoolsRes.json();

        setDbDistricts(Array.isArray(districts) ? districts.filter(d => d?.trim()) : []);
        setDbSchools(Array.isArray(schools) ? schools.filter(s => s?.trim()) : []);
        setIsDbLoaded(true);
      } catch (error) {
        console.error("Failed to load initial search data:", error);
        setDbDistricts([]);
        setDbSchools([]);
        setIsDbLoaded(true);
      }
    }
    fetchData();
  }, []);

  // ---------------------
  // Update available schools
  // ---------------------
  const getSchoolsForDistrict = useCallback(async (district: string) => {
    if (!district || district === 'all') {
      setAvailableSchools(dbSchools);
      return;
    }
    try {
      const res = await fetch(`/api/schools?district=${encodeURIComponent(district)}`);
      const schools = await res.json();
      setAvailableSchools(Array.isArray(schools) ? schools.filter(s => s?.trim()) : []);
    } catch (error) {
      console.error(`Failed to fetch schools for district ${district}:`, error);
      setAvailableSchools([]);
    }
  }, [dbSchools]);

  // ---------------------
  // Filter districts for user
  // ---------------------
  const availableDistricts = React.useMemo(() => {
    if (!Array.isArray(dbDistricts)) return [];
    if (!preFilterByUserProfile || !userProfile || userProfile.role === 'organizer' || userProfile.isDistrictCoordinator) {
      return dbDistricts;
    }
    if (userProfile.district && userProfile.district !== 'All Districts') {
      return dbDistricts.filter(d => safeToLower(d) === safeToLower(userProfile.district));
    }
    return dbDistricts;
  }, [dbDistricts, userProfile, preFilterByUserProfile]);

  useEffect(() => {
    if (isDbLoaded) {
      getSchoolsForDistrict(searchCriteria.district || 'all');
    }
  }, [searchCriteria.district, isDbLoaded, getSchoolsForDistrict]);

  // ---------------------
  // Initialize search criteria from user profile
  // ---------------------
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

  // ---------------------
  // Search handler
  // ---------------------
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

  const updateField = (field: keyof SearchCriteria, value: any) => {
    const newCriteria = { ...searchCriteria, [field]: value };
    if (field === 'district') newCriteria.school = 'all';
    setSearchCriteria(newCriteria);
  };

  const handleSelectPlayer = (player: MasterPlayer) => {
    onPlayerSelected(player);
    onOpenChange(false);
  };

  if (!isOpen) return null;

  // ---------------------
  // JSX
  // ---------------------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-2">{title}</h2>
            <p className="text-sm text-gray-600">Search the master database for players to add to your roster.</p>
          </div>
          <a href="https://new.uschess.org/civicrm/player-search" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            Find on USCF <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Filters */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Database Search</h3>
          <p className="text-sm text-blue-700">Fill in your search criteria and click "Search Database" to find players.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">USCF ID</label>
            <input type="text" value={searchCriteria.uscfId || ''} onChange={e => updateField('uscfId', e.target.value)} placeholder="32052572" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input type="text" value={searchCriteria.firstName || ''} onChange={e => updateField('firstName', e.target.value)} placeholder="John" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input type="text" value={searchCriteria.lastName || ''} onChange={e => updateField('lastName', e.target.value)} placeholder="Smith" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">District</label>
            <select value={searchCriteria.district || 'all'} onChange={e => updateField('district', e.target.value)} className="w-full border rounded px-3 py-2" disabled={!isDbLoaded}>
              <option value="all">{!isDbLoaded ? 'Loading districts...' : 'All Available Districts'}</option>
              <option value="Unassigned">Unassigned Players</option>
              {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">School</label>
            <select value={searchCriteria.school || 'all'} onChange={e => updateField('school', e.target.value)} className="w-full border rounded px-3 py-2" disabled={!isDbLoaded}>
              <option value="all">{!isDbLoaded ? 'Loading schools...' : 'All Available Schools'}</option>
              <option value="Unassigned">Unassigned Players</option>
              {availableSchools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">State</label>
            <select value={searchCriteria.state || ''} onChange={e => updateField('state', e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">All States</option>
              <option value="TX">Texas</option>
              <option value="CA">California</option>
              <option value="NY">New York</option>
              <option value="FL">Florida</option>
            </select>
          </div>
        </div>

        {/* Ratings / Expiration */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Min Rating</label>
            <input type="number" value={searchCriteria.minRating || ''} onChange={e => updateField('minRating', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Rating</label>
            <input type="number" value={searchCriteria.maxRating || ''} onChange={e => updateField('maxRating', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        <div className="flex space-x-4 mb-6">
          <button onClick={handleSearch} disabled={isSearching} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">{isSearching ? 'Searching...' : 'Search Database'}</button>
          <button onClick={clearSearch} className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700">Clear All</button>
        </div>

        {/* Results */}
        {searchResult && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Search Results ({searchResult.players?.length || 0} found)</h3>
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
                      <th className="border border-gray-300 px-4 py-2 text-left">Expiration Date</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.players?.map(player => (
                      <tr key={player.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{player.firstName} {player.middleName} {player.lastName}</td>
                        <td className="border border-gray-300 px-4 py-2">{player.uscfId}</td>
                        <td className="border border-gray-300 px-4 py-2">{player.state}</td>
                        <td className="border border-gray-300 px-4 py-2">{player.school}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input type="number" value={player.regularRating || ''} onChange={e => player.regularRating = parseInt(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <input type="date" value={player.expirationDate || ''} onChange={e => player.expirationDate = e.target.value} className="w-full border rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <button onClick={() => handleSelectPlayer(player)} className="bg-green-500 text-white px-2 py-1 rounded text-xs">Select</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Close */}
        <div className="border-t pt-4 mt-6">
          <div className="flex justify-end space-x-4">
            <button onClick={() => onOpenChange(false)} className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
