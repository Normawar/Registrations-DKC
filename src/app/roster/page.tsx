'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import AppLayout from '@/components/app-layout';
import { useMasterDb } from '@/context/master-db-context';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';
import EnhancedPlayerSearchDialog from '@/components/EnhancedPlayerSearchDialog';
import { Button } from '@/components/ui/button';
import { format, parseISO, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Defensive helpers (Reference #13)
 */
function safeString(v: any): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  try {
    return String(v);
  } catch {
    return '';
  }
}

function safeDateToIso(v: any): string {
  if (!v && v !== 0) return '';
  if (typeof v === 'string' && v.trim()) {
    // try ISO or YYYY-MM-DD
    try {
      const parsed = parseISO(v);
      if (isValid(parsed)) return parsed.toISOString();
    } catch { /* fallthrough */ }
    // fallback: try Date constructor
  }
  try {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
    return '';
  }
  return '';
}

type SafePlayer = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  uscfId: string;
  grade: string;
  dob: string; // ISO or empty
  email: string;
  zip: string;
  state: string;
  school: string;
  district: string;
  regularRating?: number | null;
  uscfExpiration?: string; // ISO or empty
  [key: string]: any;
};

type SortConfig = { key: keyof SafePlayer | 'Name'; direction: 'asc' | 'desc' } | null;

export default function RostersPage() {
  // READ-ONLY DB provider (safe: read-only)
  const master = useMasterDb();
  // Current logged-in profile and role-scoping
  const sponsorHook = useSponsorProfile();
  const userProfile: SponsorProfile | null = sponsorHook?.profile ?? null;

  // Dialog state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Local roster state (sanitized)
  const allPlayersRaw = master?.players ?? []; // may be undefined
  const safeAllPlayers = useMemo<SafePlayer[]>(() => {
    const safeDate = (val: any) => safeDateToIso(val);
    try {
      return (Array.isArray(allPlayersRaw) ? allPlayersRaw : []).map((p: any) => {
        const id = safeString(p?.id || p?.docId || p?.playerId || `unknown_${Math.random()}`);
        return {
          id,
          firstName: safeString(p?.firstName || p?.givenName || ''),
          middleName: safeString(p?.middleName || ''),
          lastName: safeString(p?.lastName || p?.familyName || ''),
          uscfId: safeString(p?.uscfId || p?.uscf_id || ''),
          grade: safeString(p?.grade ?? ''),
          dob: safeDate(p?.dob ?? p?.dateOfBirth),
          email: safeString(p?.email ?? ''),
          zip: safeString(p?.zip ?? p?.postalCode ?? ''),
          state: safeString(p?.state ?? ''),
          school: safeString(p?.school ?? ''),
          district: safeString(p?.district ?? ''),
          regularRating: typeof p?.regularRating === 'number' ? p.regularRating : (p?.regularRating ? Number(p.regularRating) : null),
          uscfExpiration: safeDate(p?.uscfExpiration ?? p?.expirationDate),
          // Preserve any other fields
          ...p,
        } as SafePlayer;
      });
    } catch (err) {
      console.error('safeAllPlayers transform failed', err);
      return [];
    }
  }, [allPlayersRaw]);

  // Apply role-based scoping
  const scopedPlayers = useMemo(() => {
    if (!userProfile) return safeAllPlayers; // if no profile, show all (or nothing?) — keep all for admin debugging
    const role = userProfile.role || (userProfile.isDistrictCoordinator ? 'district_coordinator' : 'sponsor');
    switch (role) {
      case 'organizer':
        return safeAllPlayers;
      case 'district_coordinator':
      case 'district':
      case 'district_coordinator': {
        const district = safeString(userProfile.district);
        return safeAllPlayers.filter(p => safeString(p.district) === district);
      }
      case 'sponsor': {
        const school = safeString(userProfile.school);
        // Sponsors see their school only
        return safeAllPlayers.filter(p => safeString(p.school) === school);
      }
      case 'individual':
      case 'player':
        // Individuals see only themselves (match by email or uid if available)
        const uid = safeString(userProfile.uid || '');
        return safeAllPlayers.filter(p => (p.uid && String(p.uid) === uid) || (p.email && p.email === userProfile.email));
      default:
        return safeAllPlayers;
    }
  }, [safeAllPlayers, userProfile]);

  // Editable roster state: we will initialize from scopedPlayers then keep local edits. Keep `players` as the list shown.
  const [players, setPlayers] = useState<SafePlayer[]>(() => scopedPlayers);
  useEffect(() => {
    setPlayers(scopedPlayers);
  }, [scopedPlayers]);

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const sortedPlayers = useMemo(() => {
    const arr = [...players];
    if (!sortConfig) return arr;
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (key === 'Name') {
        const aName = `${a.lastName}, ${a.firstName} ${a.middleName}`.trim().toLowerCase();
        const bName = `${b.lastName}, ${b.firstName} ${b.middleName}`.trim().toLowerCase();
        return aName < bName ? -1 * dir : aName > bName ? 1 * dir : 0;
      }
      const aVal = a[key] ?? '';
      const bVal = b[key] ?? '';
      // handle dates
      const isDate = (k: string) => ['dob', 'uscfExpiration'].includes(k);
      if (isDate(key as string)) {
        const ta = aVal ? new Date(aVal).getTime() : 0;
        const tb = bVal ? new Date(bVal).getTime() : 0;
        return (ta - tb) * dir;
      }
      // numbers
      if (typeof aVal === 'number' || typeof bVal === 'number') {
        const na = Number(aVal || 0);
        const nb = Number(bVal || 0);
        return (na - nb) * dir;
      }
      const as = String(aVal).toLowerCase();
      const bs = String(bVal).toLowerCase();
      if (as < bs) return -1 * dir;
      if (as > bs) return 1 * dir;
      return 0;
    });
    return arr;
  }, [players, sortConfig]);

  const requestSort = (key: keyof SafePlayer | 'Name') => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Notifications (incomplete or duplicate email)
  const notifications = useMemo(() => {
    const incomplete: string[] = [];
    const emailMap: Record<string, string[]> = {};
    players.forEach(p => {
      const full = `${p.lastName || ''}, ${p.firstName || ''} ${p.middleName || ''}`.trim();
      if (!p.firstName || !p.lastName || !p.email) incomplete.push(full);
      if (p.email) {
        const e = p.email.toLowerCase();
        emailMap[e] ||= [];
        emailMap[e].push(full);
      }
    });
    const duplicateEmails = Object.entries(emailMap).filter(([, names]) => names.length > 1)
      .map(([email, names]) => `${email} (${names.join(', ')})`);
    return { incomplete, duplicateEmails };
  }, [players]);

  // Inline edit handlers
  const updateLocalField = (id: string, field: keyof SafePlayer, value: any) => {
    setPlayers(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  // Server API helpers (use API routes so writes happen server-side per ref)
  const savePlayerToServer = useCallback(async (player: SafePlayer) => {
    try {
      const res = await fetch('/api/roster', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to update player');
      }
      const updated = await res.json();
      // optimistic update from server result
      setPlayers(prev => prev.map(p => (p.id === player.id ? { ...p, ...updated } : p)));
      return true;
    } catch (err) {
      console.error('savePlayerToServer error', err);
      alert(`Failed to save player: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, []);

  const addPlayerToServer = useCallback(async (player: Partial<SafePlayer>) => {
    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to create player');
      }
      const created = await res.json();
      // sanitize created
      const sp: SafePlayer = {
        id: safeString(created.id || created._id || created.id),
        firstName: safeString(created.firstName),
        middleName: safeString(created.middleName),
        lastName: safeString(created.lastName),
        uscfId: safeString(created.uscfId),
        grade: safeString(created.grade),
        dob: safeDateToIso(created.dob ?? created.dateOfBirth),
        email: safeString(created.email),
        zip: safeString(created.zip),
        state: safeString(created.state),
        school: safeString(created.school),
        district: safeString(created.district),
        regularRating: typeof created.regularRating === 'number' ? created.regularRating : (created.regularRating ? Number(created.regularRating) : null),
        uscfExpiration: safeDateToIso(created.uscfExpiration),
        ...created,
      };
      setPlayers(prev => [sp, ...prev]);
      return sp;
    } catch (err) {
      console.error('addPlayerToServer error', err);
      alert(`Failed to add player: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, []);

  const deletePlayerFromServer = useCallback(async (id: string) => {
    if (!confirm('Remove player from roster? This cannot be undone.')) return false;
    try {
      const res = await fetch(`/api/roster?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to delete player');
      }
      setPlayers(prev => prev.filter(p => p.id !== id));
      return true;
    } catch (err) {
      console.error('deletePlayerFromServer error', err);
      alert(`Failed to delete player: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, []);

  // Add from EnhancedPlayerSearchDialog
  const handlePlayerSelected = async (playerFromMaster: any) => {
    // Map to partial SafePlayer then POST
    const partial: Partial<SafePlayer> = {
      firstName: safeString(playerFromMaster.firstName),
      middleName: safeString(playerFromMaster.middleName),
      lastName: safeString(playerFromMaster.lastName),
      email: safeString(playerFromMaster.email),
      uscfId: safeString(playerFromMaster.uscfId),
      grade: safeString(playerFromMaster.grade),
      dob: safeDateToIso(playerFromMaster.dob),
      zip: safeString(playerFromMaster.zip),
      state: safeString(playerFromMaster.state),
      school: safeString(playerFromMaster.school),
      district: safeString(playerFromMaster.district),
      regularRating: typeof playerFromMaster.regularRating === 'number' ? playerFromMaster.regularRating : (playerFromMaster.regularRating ? Number(playerFromMaster.regularRating) : null),
      uscfExpiration: safeDateToIso(playerFromMaster.uscfExpiration || playerFromMaster.expirationDate),
    };
    await addPlayerToServer(partial);
    setIsSearchOpen(false);
  };

  // Create new player local form
  const [newPlayer, setNewPlayer] = useState<Partial<SafePlayer>>({});
  const createNewPlayer = async () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.email) {
      alert('First name, last name and email are required.');
      return;
    }
    await addPlayerToServer(newPlayer);
    setNewPlayer({});
  };

  // Export to Excel (same friendly export)
  const exportToExcel = () => {
    const data = (sortedPlayers ?? []).map(p => {
      const dob = p.dob && isValid(parseISO(p.dob)) ? format(parseISO(p.dob), 'MM/dd/yyyy') : '';
      const exp = p.uscfExpiration && isValid(parseISO(p.uscfExpiration)) ? format(parseISO(p.uscfExpiration), 'MM/dd/yyyy') : '';
      const expired = p.uscfExpiration ? new Date(p.uscfExpiration).getTime() < Date.now() : false;
      return {
        Name: `${p.lastName}, ${p.firstName} ${p.middleName}`.trim(),
        'USCF ID': p.uscfId,
        Grade: p.grade === 'K' ? 'K' : p.grade,
        DOB: dob,
        Email: p.email,
        Zip: p.zip,
        School: p.school,
        District: p.district,
        'USCF Exp': expired ? 'Expired' : exp,
        Rating: p.regularRating ?? '',
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Roster');
    const wbout = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Roster.xlsx');
  };

  // row save handler
  const handleSaveRow = async (id: string) => {
    const player = players.find(p => p.id === id);
    if (!player) return;
    // Sanitize date fields to ISO before sending
    const payload = {
      ...player,
      dob: player.dob ? safeDateToIso(player.dob) : '',
      uscfExpiration: player.uscfExpiration ? safeDateToIso(player.uscfExpiration) : '',
    };
    await savePlayerToServer(payload);
  };

  // small helper to format US dates for UI display (MM/dd/yyyy)
  const formatForDisplay = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = parseISO(iso);
      if (!isValid(d)) return '';
      return format(d, 'MM/dd/yyyy');
    } catch {
      return '';
    }
  };

  return (
    <AppLayout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Player Roster</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsSearchOpen(true)}>Add from Master DB</Button>
            <Button onClick={exportToExcel}>Export Excel</Button>
          </div>
        </div>

        {/* Create new player inline */}
        <div className="mb-4 bg-gray-50 p-3 rounded">
          <h3 className="font-medium mb-2">Create New Player</h3>
          <div className="flex flex-wrap gap-2">
            <input placeholder="First" value={newPlayer.firstName || ''} onChange={e => setNewPlayer({ ...newPlayer, firstName: e.target.value })} className="border p-1" />
            <input placeholder="Middle" value={newPlayer.middleName || ''} onChange={e => setNewPlayer({ ...newPlayer, middleName: e.target.value })} className="border p-1" />
            <input placeholder="Last" value={newPlayer.lastName || ''} onChange={e => setNewPlayer({ ...newPlayer, lastName: e.target.value })} className="border p-1" />
            <input placeholder="Email" value={newPlayer.email || ''} onChange={e => setNewPlayer({ ...newPlayer, email: e.target.value })} className="border p-1" />
            <input placeholder="USCF ID" value={newPlayer.uscfId || ''} onChange={e => setNewPlayer({ ...newPlayer, uscfId: e.target.value })} className="border p-1" />
            <input placeholder="Grade" value={newPlayer.grade || ''} onChange={e => setNewPlayer({ ...newPlayer, grade: e.target.value })} className="border p-1" />
            <input placeholder="DOB (YYYY-MM-DD)" value={newPlayer.dob || ''} onChange={e => setNewPlayer({ ...newPlayer, dob: e.target.value })} className="border p-1" />
            <input placeholder="Zip" value={newPlayer.zip || ''} onChange={e => setNewPlayer({ ...newPlayer, zip: e.target.value })} className="border p-1" />
            <Button onClick={createNewPlayer}>Create</Button>
          </div>
        </div>

        {/* Notifications */}
        {(notifications.incomplete.length > 0 || notifications.duplicateEmails.length > 0) && (
          <div className="mb-4 bg-yellow-100 p-3 rounded border-l-4 border-yellow-500">
            {notifications.incomplete.length > 0 && <div>Players missing required fields: {notifications.incomplete.join('; ')}</div>}
            {notifications.duplicateEmails.length > 0 && <div>Duplicate emails: {notifications.duplicateEmails.join('; ')}</div>}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                {[
                  { key: 'Name', label: 'Name' },
                  { key: 'uscfId', label: 'USCF ID' },
                  { key: 'grade', label: 'Grade' },
                  { key: 'dob', label: 'DOB' },
                  { key: 'email', label: 'Email' },
                  { key: 'zip', label: 'Zip' },
                  { key: 'school', label: 'School' },
                  { key: 'district', label: 'District' },
                  { key: 'regularRating', label: 'Rating' },
                  { key: 'uscfExpiration', label: 'USCF Exp' },
                  { key: 'actions', label: 'Actions' },
                ].map(col => (
                  <th key={col.key} className="p-2 text-left cursor-pointer" onClick={() => requestSort(col.key as any)}>
                    <div className="flex items-center gap-2">
                      <span>{col.label}</span>
                      {sortConfig?.key === col.key && <span className="text-xs">({sortConfig.direction})</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map(p => {
                const name = `${p.lastName}, ${p.firstName} ${p.middleName}`.trim();
                const dobDisplay = formatForDisplay(p.dob);
                const expDisplay = formatForDisplay(p.uscfExpiration);
                const expired = p.uscfExpiration ? new Date(p.uscfExpiration).getTime() < Date.now() : false;
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      <div className="flex gap-2 items-center">
                        <input className="border p-1" value={p.firstName} onChange={e => updateLocalField(p.id, 'firstName', e.target.value)} />
                        <input className="border p-1 w-28" value={p.middleName} onChange={e => updateLocalField(p.id, 'middleName', e.target.value)} />
                        <input className="border p-1 w-36" value={p.lastName} onChange={e => updateLocalField(p.id, 'lastName', e.target.value)} />
                      </div>
                    </td>

                    <td className="p-2">
                      <input className="border p-1 w-32" value={p.uscfId} onChange={e => updateLocalField(p.id, 'uscfId', e.target.value)} />
                    </td>

                    <td className="p-2">
                      <input className="border p-1 w-16" value={p.grade} onChange={e => updateLocalField(p.id, 'grade', e.target.value)} />
                    </td>

                    <td className="p-2">
                      <input className="border p-1 w-32" value={dobDisplay} onChange={e => updateLocalField(p.id, 'dob', e.target.value)} placeholder="MM/DD/YYYY or YYYY-MM-DD" />
                    </td>

                    <td className="p-2">
                      <input className="border p-1 w-48" value={p.email} onChange={e => updateLocalField(p.id, 'email', e.target.value)} />
                    </td>

                    <td className="p-2">
                      <input className="border p-1 w-20" value={p.zip} onChange={e => updateLocalField(p.id, 'zip', e.target.value)} />
                    </td>

                    <td className="p-2">
                      <input className="border p-1 w-40" value={p.school} onChange={e => updateLocalField(p.id, 'school', e.target.value)} />
                    </td>

                    <td className="p-2">
                      <input className="border p-1 w-36" value={p.district} onChange={e => updateLocalField(p.id, 'district', e.target.value)} />
                    </td>

                    <td className="p-2">
                      <input className="border p-1 w-20" type="number" value={p.regularRating ?? ''} onChange={e => updateLocalField(p.id, 'regularRating', e.target.value ? Number(e.target.value) : null)} />
                    </td>

                    <td className={`p-2 ${expired ? 'text-red-600 font-bold' : ''}`}>
                      <input className="border p-1 w-36" value={expDisplay} onChange={e => updateLocalField(p.id, 'uscfExpiration', e.target.value)} />
                    </td>

                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button onClick={() => handleSaveRow(p.id)}>Save</Button>
                        <Button onClick={() => deletePlayerFromServer(p.id)}>Remove</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <EnhancedPlayerSearchDialog
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          onPlayerSelected={handlePlayerSelected}
          userProfile={userProfile ?? undefined}
          preFilterByUserProfile={true}
        />
      </div>
    </AppLayout>
  );
}
