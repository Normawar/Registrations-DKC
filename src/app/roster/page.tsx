'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { useMasterDb, type MasterPlayer } from '@/context/master-db-context';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { UserProfile } from '@/hooks/use-user-profile';
import { Button } from '@/components/ui/button';

export default function RosterPage() {
  const { allPlayers, removePlayer, createPlayer } = useMasterDb();
  const { user } = UserProfile(); // Assumes user object with role/district/school/id
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [dbDistricts, setDbDistricts] = useState<string[]>([]);
  const [dbSchools, setDbSchools] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Fetch districts and schools
  useEffect(() => {
    async function fetchData() {
      try {
        const [districtRes, schoolRes] = await Promise.all([
          fetch('/api/districts'),
          fetch('/api/schools')
        ]);
        const districts = await districtRes.json();
        const schools = await schoolRes.json();
        setDbDistricts(Array.isArray(districts) ? districts.filter(Boolean) : []);
        setDbSchools(Array.isArray(schools) ? schools.filter(Boolean) : []);
      } catch (err) {
        console.error('Failed to fetch districts/schools', err);
      }
    }
    fetchData();
  }, []);

  // Safe player mapping
  const safeAllPlayers = useMemo(() => {
    const safeDate = (d: any) => {
      if (!d) return '';
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '';
        return dt.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };

    let scopedPlayers: MasterPlayer[] = allPlayers ?? [];
    if (!user) return [];

    switch (user.role) {
      case 'organizer':
        break; // all players
      case 'district':
        scopedPlayers = scopedPlayers.filter(p => p.district === user.district);
        break;
      case 'sponsor':
        scopedPlayers = scopedPlayers.filter(p => p.school === user.school);
        break;
      case 'individual':
        scopedPlayers = scopedPlayers.filter(p => p.userId === user.id);
        break;
      default:
        scopedPlayers = [];
    }

    return scopedPlayers.map(p => ({
      ...p,
      firstName: String(p.firstName || ''),
      lastName: String(p.lastName || ''),
      middleName: p.middleName ? String(p.middleName) : '',
      district: String(p.district || ''),
      school: String(p.school || ''),
      uscfId: String(p.uscfId || ''),
      email: p.email ? String(p.email) : '',
      grade: p.grade ? String(p.grade) : '',
      zip: p.zip ? String(p.zip) : '',
      dob: safeDate(p.dob),
      uscfExpiration: safeDate(p.uscfExpiration),
      regularRating: p.regularRating ?? '',
    }));
  }, [allPlayers, user]);

  // Apply filters
  const filteredPlayers = useMemo(() => {
    return safeAllPlayers.filter(p => {
      const districtMatch = districtFilter === 'all' || p.district === districtFilter;
      const schoolMatch = schoolFilter === 'all' || p.school === schoolFilter;
      return districtMatch && schoolMatch;
    });
  }, [safeAllPlayers, districtFilter, schoolFilter]);

  // Update filters based on user role
  useEffect(() => {
    if (!user) return;
    switch (user.role) {
      case 'organizer':
        setDistrictFilter('all');
        setSchoolFilter('all');
        break;
      case 'district':
        setDistrictFilter(user.district);
        setSchoolFilter('all');
        break;
      case 'sponsor':
      case 'individual':
        setDistrictFilter(user.district);
        setSchoolFilter(user.school);
        break;
    }
  }, [user]);

  // Schools available for current district filter
  const availableSchools = useMemo(() => {
    if (districtFilter === 'all') return dbSchools;
    return dbSchools.filter(s => safeAllPlayers.some(p => p.school === s && p.district === districtFilter));
  }, [dbSchools, districtFilter, safeAllPlayers]);

  const handleRemovePlayer = async (playerId: string) => {
    if (!confirm('Remove this player from the roster?')) return;
    await removePlayer(playerId);
  };

  const handleAddPlayer = (player: MasterPlayer) => {
    createPlayer(player);
    setShowAddDialog(false);
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredPlayers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([buf]), 'Roster.xlsx');
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Roster</h1>
          <div className="flex space-x-2">
            <Button onClick={() => setShowAddDialog(true)}>Add Player</Button>
            <Button onClick={exportToExcel}>Export Excel</Button>
          </div>
        </div>

        <div className="flex space-x-4">
          {(user.role === 'organizer' || user.role === 'district') && (
            <div>
              <label className="block text-sm font-medium mb-1">District</label>
              <select
                className="border rounded px-3 py-2"
                value={districtFilter}
                onChange={e => setDistrictFilter(e.target.value)}
              >
                <option value="all">All Districts</option>
                {dbDistricts.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
          {(user.role === 'organizer' || user.role === 'district') && (
            <div>
              <label className="block text-sm font-medium mb-1">School</label>
              <select
                className="border rounded px-3 py-2"
                value={schoolFilter}
                onChange={e => setSchoolFilter(e.target.value)}
              >
                <option value="all">All Schools</option>
                {availableSchools.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-4 py-2">Name</th>
                <th className="border border-gray-300 px-4 py-2">USCF ID</th>
                <th className="border border-gray-300 px-4 py-2">District</th>
                <th className="border border-gray-300 px-4 py-2">School</th>
                <th className="border border-gray-300 px-4 py-2">Grade</th>
                <th className="border border-gray-300 px-4 py-2">Rating</th>
                <th className="border border-gray-300 px-4 py-2">USCF Expiration</th>
                <th className="border border-gray-300 px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2">{p.firstName} {p.middleName} {p.lastName}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.uscfId}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.district}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.school}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.grade}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.regularRating}</td>
                  <td className="border border-gray-300 px-4 py-2">{p.uscfExpiration}</td>
                  <td className="border border-gray-300 px-4 py-2 flex space-x-2">
                    <Button size="sm" variant="destructive" onClick={() => handleRemovePlayer(p.id)}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddDialog && (
        <EnhancedPlayerSearchDialog
          isOpen={showAddDialog}
          onOpenChange={setShowAddDialog}
          onPlayerSelected={handleAddPlayer}
          userProfile={user}
        />
      )}
    </AppLayout>
  );
}
