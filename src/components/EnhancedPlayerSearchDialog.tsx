'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMasterDb, type MasterPlayer, type SearchCriteria, type SearchResult } from '@/context/master-db-context';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { ExternalLink } from 'lucide-react';

export function EnhancedPlayerSearchDialog({
  isOpen,
  onOpenChange,
  userProfile = null,
  preFilterByUserProfile = true,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userProfile?: SponsorProfile | null;
  preFilterByUserProfile?: boolean;
}) {
  const { searchPlayers, updatePlayer } = useMasterDb();

  const [dbDistricts, setDbDistricts] = useState<string[]>([]);
  const [dbSchools, setDbSchools] = useState<string[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const [searchCriteria, setSearchCriteria] = useState<Partial<SearchCriteria>>({});
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<string[]>([]);

  const [selectedPlayer, setSelectedPlayer] = useState<MasterPlayer | null>(null);
  const [editFields, setEditFields] = useState<Partial<MasterPlayer>>({});

  // Load districts and schools
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
        console.error("Failed to load districts/schools:", error);
        setDbDistricts([]);
        setDbSchools([]);
        setIsDbLoaded(true);
      }
    }
    fetchData();
  }, []);

  const getSchoolsForDistrict = useCallback((district: string) => {
    if (!district || district === 'all') return setAvailableSchools(dbSchools);
    const filtered = dbSchools.filter(s => s && s.trim() !== '');
    setAvailableSchools(filtered);
  }, [dbSchools]);

  // Pre-filter by user profile if needed
  const availableDistricts = React.useMemo(() => {
    if (!preFilterByUserProfile || !userProfile || userProfile.role === 'organizer' || userProfile.isDistrictCoordinator) {
      return dbDistricts;
    }
    if (userProfile.district && userProfile.district !== 'All Districts') {
      return dbDistricts.filter(d => d === userProfile.district);
    }
    return dbDistricts;
  }, [dbDistricts, userProfile, preFilterByUserProfile]);

  useEffect(() => {
    if (isDbLoaded) getSchoolsForDistrict(searchCriteria.district || 'all');
  }, [searchCriteria.district, isDbLoaded, getSchoolsForDistrict]);

  // Initialize search criteria based on user profile
  useEffect(() => {
    if (!preFilterByUserProfile || !userProfile || !isOpen) return;

    const initialCriteria: Partial<SearchCriteria> = {};
    if (userProfile.role !== 'organizer' && userProfile.district && userProfile.district !== 'All Districts') {
      initialCriteria.district = userProfile.district;
    }
    if (!userProfile.isDistrictCoordinator && userProfile.role === 'sponsor' && userProfile.school && userProfile.school !== 'All Schools') {
      initialCriteria.school = userProfile.school;
    }
    setSearchCriteria(initialCriteria);
  }, [userProfile, preFilterByUserProfile, isOpen]);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const result = await searchPlayers({ ...searchCriteria, pageSize: 100 });
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

  const handleSelectPlayer = (player: MasterPlayer) => {
    setSelectedPlayer(player);
    setEditFields({
      school: player.school || '',
      state: player.state || 'TX',
      regularRating: player.regularRating || undefined,
      uscfExpiration: player.uscfExpiration || undefined,
    });
  };

  const handleFieldChange = (field: keyof MasterPlayer, value: any) => {
    setEditFields(prev => ({ ...prev, [field]: value }));
  };

  const handleSavePlayer = async () => {
    if (!selectedPlayer) return;
    const updatedPlayer: MasterPlayer = {
      ...selectedPlayer,
      ...editFields,
    };
    try {
      await updatePlayer(updatedPlayer, userProfile || null);
      setSelectedPlayer(null);
      handleSearch(); // refresh search results
    } catch (error) {
      console.error('Failed to update player:', error);
      alert('Failed to save player. See console for details.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-2">Search Master Player Database</h2>
            <p className="text-sm text-gray-600">Search for players to add missing information.</p>
          </div>
          <a href="https://new.uschess.org/civicrm/player-search" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            Find on USCF <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Search Criteria */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">USCF ID</label>
            <input type="text" value={searchCriteria.uscfId || ''} onChange={e => setSearchCriteria(prev => ({ ...prev, uscfId: e.target.value }))} className="w-full border rounded px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input type="text" value={searchCriteria.firstName || ''} onChange={e => setSearchCriteria(prev => ({ ...prev, firstName: e.target.value }))} className="w-full border rounded px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input type="text" value={searchCriteria.lastName || ''} onChange={e => setSearchCriteria(prev => ({ ...prev, lastName: e.target.value }))} className="w-full border rounded px-3 py-2"/>
          </div>
        </div>

        <div className="flex space-x-4 mb-6">
          <button onClick={handleSearch} disabled={isSearching} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">{isSearching ? 'Searching...' : 'Search Database'}</button>
          <button onClick={clearSearch} className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700">Clear</button>
        </div>

        {/* Search Results */}
        {searchResult && (
          <div className="overflow-x-auto border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">Results ({searchResult.players?.length || 0})</h3>
            {searchResult.players?.length ? (
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2">Name</th>
                    <th className="border border-gray-300 px-4 py-2">USCF ID</th>
                    <th className="border border-gray-300 px-4 py-2">State</th>
                    <th className="border border-gray-300 px-4 py-2">School</th>
                    <th className="border border-gray-300 px-4 py-2">Rating</th>
                    <th className="border border-gray-300 px-4 py-2">Expiration</th>
                    <th className="border border-gray-300 px-4 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResult.players.map(player => (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">{player.firstName} {player.middleName} {player.lastName}</td>
                      <td className="border border-gray-300 px-4 py-2">{player.uscfId}</td>
                      <td className="border border-gray-300 px-4 py-2">{player.state}</td>
                      <td className="border border-gray-300 px-4 py-2">{player.school}</td>
                      <td className="border border-gray-300 px-4 py-2">{player.regularRating}</td>
                      <td className="border border-gray-300 px-4 py-2">{player.uscfExpiration || ''}</td>
                      <td className="border border-gray-300 px-4 py-2">
                        <button onClick={() => handleSelectPlayer(player)} className="bg-green-500 text-white px-2 py-1 rounded text-xs">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-gray-500">No players found.</p>}
          </div>
        )}

        {/* Edit Modal */}
        {selectedPlayer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Edit {selectedPlayer.firstName} {selectedPlayer.lastName}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">School</label>
                  <input type="text" value={editFields.school || ''} onChange={e => handleFieldChange('school', e.target.value)} className="w-full border rounded px-3 py-2"/>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State</label>
                  <input type="text" value={editFields.state || ''} onChange={e => handleFieldChange('state', e.target.value)} className="w-full border rounded px-3 py-2"/>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rating</label>
                  <input type="number" value={editFields.regularRating || ''} onChange={e => handleFieldChange('regularRating', parseInt(e.target.value) || undefined)} className="w-full border rounded px-3 py-2"/>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">USCF Expiration</label>
                  <input type="date" value={editFields.uscfExpiration || ''} onChange={e => handleFieldChange('uscfExpiration', e.target.value)} className="w-full border rounded px-3 py-2"/>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-4">
                <button onClick={handleSavePlayer} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save</button>
                <button onClick={() => setSelectedPlayer(null)} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-4 mt-6 flex justify-end">
          <button onClick={() => onOpenChange(false)} className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700">Close</button>
        </div>
      </div>
    </div>
  );
}
