'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMasterDb, type SearchCriteria, type SearchResult, type MasterPlayer } from '@/context/master-db-context';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';

export default function RosterPage({ userProfile }: { userProfile?: SponsorProfile | null }) {
  const { searchPlayers } = useMasterDb();

  const [dbDistricts, setDbDistricts] = useState<string[]>([]);
  const [dbSchools, setDbSchools] = useState<string[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const [searchCriteria, setSearchCriteria] = useState<Partial<SearchCriteria>>({});
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<string[]>([]);

  // --- Safe .split() helper to prevent crashes ---
  const safeSplit = (val: any, delimiter = ','): string[] => {
    if (!val || typeof val !== 'string') return [];
    return val.split(delimiter).map(s => s.trim()).filter(Boolean);
  };

  // --- Fetch districts and schools ---
  useEffect(() => {
    async function fetchData() {
      try {
        const [districtsRes, schoolsRes] = await Promise.all([
          fetch('/api/districts'),
          fetch('/api/schools')
        ]);
        const districts = await districtsRes.json();
        const schools = await schoolsRes.json();

        const safeDistricts = Array.isArray(districts)
          ? districts.filter(d => typeof d === 'string' && d.trim() !== '')
          : [];
        const safeSchools = Array.isArray(schools)
          ? schools.filter(s => typeof s === 'string' && s.trim() !== '')
          : [];

        setDbDistricts(safeDistricts);
        setDbSchools(safeSchools);
        setIsDbLoaded(true);
      } catch (error) {
        console.error('Failed to load districts or schools:', error);
        setDbDistricts([]);
        setDbSchools([]);
        setIsDbLoaded(true);
      }
    }
    fetchData();
  }, []);

  // --- Filter schools by district ---
  const getSchoolsForDistrict = useCallback(
    async (district: string) => {
      if (!district || district === 'all') {
        setAvailableSchools(dbSchools);
        return;
      }
      try {
        const res = await fetch(`/api/schools?district=${encodeURIComponent(district)}`);
        const schools = await res.json();
        const safeSchools = Array.isArray(schools)
          ? schools.filter(s => typeof s === 'string' && s.trim() !== '')
          : [];
        setAvailableSchools(safeSchools);
      } catch (error) {
        console.error(`Failed to fetch schools for district ${district}:`, error);
        setAvailableSchools([]);
      }
    },
    [dbSchools]
  );

  const availableDistricts = React.useMemo(() => {
    if (!Array.isArray(dbDistricts)) return [];
    if (!userProfile || userProfile.role === 'organizer' || userProfile.isDistrictCoordinator) {
      return dbDistricts;
    }
    if (userProfile.district && userProfile.district !== 'All Districts') {
      return dbDistricts.filter(d => d === userProfile.district);
    }
    return dbDistricts;
  }, [dbDistricts, userProfile]);

  useEffect(() => {
    if (isDbLoaded) {
      getSchoolsForDistrict(searchCriteria.district || 'all');
    }
  }, [searchCriteria.district, isDbLoaded, getSchoolsForDistrict]);

  // --- Initialize criteria based on user profile ---
  useEffect(() => {
    if (!userProfile) return;
    const initialCriteria: Partial<SearchCriteria> = {};

    if (userProfile.role !== 'organizer' && userProfile.district && userProfile.district !== 'All Districts') {
      initialCriteria.district = userProfile.district;
    }

    if (!userProfile.isDistrictCoordinator && userProfile.role === 'sponsor' &&
        userProfile.school && userProfile.school !== 'All Schools') {
      initialCriteria.school = userProfile.school;
    }

    setSearchCriteria(initialCriteria);
  }, [userProfile]);

  // --- Update criteria fields ---
  const updateField = (field: keyof SearchCriteria, value: any) => {
    const newCriteria = { ...searchCriteria, [field]: value };
    if (field === 'district') {
      newCriteria.school = 'all';
    }
    setSearchCriteria(newCriteria);
  };

  // --- Perform search ---
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
    alert(`Selected player: ${player.firstName} ${player.lastName}`);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Roster Management</h1>

      {/* --- Search Form --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block mb-1">USCF ID</label>
          <input
            type="text"
            value={searchCriteria.uscfId || ''}
            onChange={e => updateField('uscfId', e.target.value)}
            className="border rounded px-3 py-2 w-full"
            placeholder="12345678"
          />
        </div>
        <div>
          <label className="block mb-1">First Name</label>
          <input
            type="text"
            value={searchCriteria.firstName || ''}
            onChange={e => updateField('firstName', e.target.value)}
            className="border rounded px-3 py-2 w-full"
            placeholder="John"
          />
        </div>
        <div>
          <label className="block mb-1">Last Name</label>
          <input
            type="text"
            value={searchCriteria.lastName || ''}
            onChange={e => updateField('lastName', e.target.value)}
            className="border rounded px-3 py-2 w-full"
            placeholder="Doe"
          />
        </div>
        <div>
          <label className="block mb-1">District</label>
          <select
            value={searchCriteria.district || 'all'}
            onChange={e => updateField('district', e.target.value)}
            className="border rounded px-3 py-2 w-full"
            disabled={!isDbLoaded}
          >
            <option value="all">All Districts</option>
            {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1">School</label>
          <select
            value={searchCriteria.school || 'all'}
            onChange={e => updateField('school', e.target.value)}
            className="border rounded px-3 py-2 w-full"
            disabled={!isDbLoaded}
          >
            <option value="all">All Schools</option>
            {availableSchools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1">State</label>
          <select
            value={searchCriteria.state || ''}
            onChange={e => updateField('state', e.target.value)}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="">All States</option>
            <option value="TX">Texas</option>
            <option value="CA">California</option>
            <option value="NY">New York</option>
            <option value="FL">Florida</option>
          </select>
        </div>
        <div>
          <label className="block mb-1">Min Rating</label>
          <input
            type="number"
            value={searchCriteria.minRating || ''}
            onChange={e => updateField('minRating', e.target.value ? parseInt(e.target.value) : undefined)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block mb-1">Max Rating</label>
          <input
            type="number"
            value={searchCriteria.maxRating || ''}
            onChange={e => updateField('maxRating', e.target.value ? parseInt(e.target.value) : undefined)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      </div>

      <div className="flex space-x-4 mb-4">
        <button onClick={handleSearch} disabled={isSearching} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
          {isSearching ? 'Searching...' : 'Search Database'}
        </button>
        <button onClick={clearSearch} className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700">
          Clear
        </button>
      </div>

      {/* --- Search Results --- */}
      {searchResult && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-4 py-2">Name</th>
                <th className="border px-4 py-2">USCF ID</th>
                <th className="border px-4 py-2">State</th>
                <th className="border px-4 py-2">School</th>
                <th className="border px-4 py-2">Rating</th>
                <th className="border px-4 py-2">Expiration</th>
                <th className="border px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResult.players?.map(player => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="border px-4 py-2">{player.firstName} {player.middleName} {player.lastName}</td>
                  <td className="border px-4 py-2">{player.uscfId}</td>
                  <td className="border px-4 py-2">{player.state}</td>
                  <td className="border px-4 py-2">{player.school}</td>
                  <td className="border px-4 py-2">{player.regularRating}</td>
                  <td className="border px-4 py-2">{player.expirationDate || 'N/A'}</td>
                  <td className="border px-4 py-2">
                    <button onClick={() => handleSelectPlayer(player)} className="bg-green-500 text-white px-2 py-1 rounded text-xs">Select</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- Enhanced Player Search Dialog --- */}
      <EnhancedPlayerSearchDialog
        isOpen={false} // Replace with actual state when you implement modal toggle
        onOpenChange={() => {}}
        onPlayerSelected={() => {}}
        userProfile={userProfile || null}
      />
    </div>
  );
}
