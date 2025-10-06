'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMasterDb } from '@/context/master-db-context';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type PlayerRow = {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  uscfId?: string;
  grade?: string | number;
  dob?: string;
  email?: string;
  zip?: string;
  uscfExpiration?: string;
  registrationInvoice?: string;
  uscfInvoice?: string;
  pdReg?: string;
  pdUscf?: string;
  schoolName?: string; // used for Count grouping if available
};

const normalizePlayer = (p: any): PlayerRow => ({
  id: p.id || crypto.randomUUID(),
  firstName: String(p.firstName ?? ''),
  middleName: String(p.middleName ?? ''),
  lastName: String(p.lastName ?? ''),
  uscfId: String(p.uscfId ?? ''),
  grade: String(p.grade ?? ''),
  dob: p.dob && isValid(new Date(p.dob)) ? new Date(p.dob).toISOString() : '',
  email: String(p.email ?? ''),
  zip: String(p.zip ?? ''),
  uscfExpiration:
    p.uscfExpiration && isValid(new Date(p.uscfExpiration))
      ? new Date(p.uscfExpiration).toISOString()
      : '',
  registrationInvoice: String(p.registrationInvoice ?? ''),
  uscfInvoice: String(p.uscfInvoice ?? ''),
  pdReg: String(p.pdReg ?? ''),
  pdUscf: String(p.pdUscf ?? ''),
  schoolName: String(p.schoolName ?? ''),
});

export default function PlayerSearchDialog() {
  const { players: initialPlayers = [] } = useMasterDb() ?? {};
  const { toast } = useToast();

  const [players, setPlayers] = useState<PlayerRow[]>(
    () => initialPlayers.map(normalizePlayer)
  );

  // update when master db players change
  useEffect(() => {
    if (initialPlayers.length) {
      setPlayers(initialPlayers.map(normalizePlayer));
    }
  }, [initialPlayers]);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof PlayerRow | 'Name';
    direction: 'asc' | 'desc';
  } | null>(null);

  const [newPlayer, setNewPlayer] = useState<Partial<PlayerRow>>({});

  const requestSort = (key: keyof PlayerRow | 'Name') => {
    setSortConfig((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  // deduplicate by uscfId or name
  const dedupedPlayers = useMemo(() => {
    const uniqueMap = new Map<string, PlayerRow>();
    for (const p of players) {
      const key =
        p.uscfId && p.uscfId.trim() !== ''
          ? p.uscfId
          : `${p.firstName?.trim().toLowerCase()}_${p.lastName?.trim().toLowerCase()}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, p);
    }
    return Array.from(uniqueMap.values());
  }, [players]);

  const sortedPlayers = useMemo(() => {
    const sortable = [...dedupedPlayers];
    if (sortConfig) {
      sortable.sort((a, b) => {
        let aVal: any, bVal: any;
        if (sortConfig.key === 'Name') {
          aVal = `${a.lastName}, ${a.firstName} ${a.middleName}`.toLowerCase();
          bVal = `${b.lastName}, ${b.firstName} ${b.middleName}`.toLowerCase();
        } else {
          aVal = (a as any)[sortConfig.key] ?? '';
          bVal = (b as any)[sortConfig.key] ?? '';
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [dedupedPlayers, sortConfig]);

  // compute counts per school
  const schoolCounts = useMemo(() => {
    return sortedPlayers.reduce((acc, p) => {
      const school = p.schoolName || 'Unknown';
      acc[school] = (acc[school] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [sortedPlayers]);

  const exportToExcel = () => {
    const data = sortedPlayers.map((p, index) => {
      const dobFormatted =
        p.dob && isValid(parseISO(p.dob))
          ? format(parseISO(p.dob), 'MM/dd/yyyy')
          : '';
      const expired =
        p.uscfExpiration && new Date(p.uscfExpiration).getTime() < Date.now();
      const expFormatted = expired
        ? 'Expired'
        : p.uscfExpiration && isValid(parseISO(p.uscfExpiration))
        ? format(parseISO(p.uscfExpiration), 'MM/dd/yyyy')
        : '';

      return {
        '#': index + 1,
        Count: schoolCounts[p.schoolName || 'Unknown'],
        School: p.schoolName || '',
        Name: `${p.lastName}, ${p.firstName} ${p.middleName}`.trim(),
        'Player USCF ID': p.uscfId ?? '',
        Grade: p.grade ?? '',
        DOB: dobFormatted,
        Email: p.email ?? '',
        Zip: p.zip ?? '',
        'USCF Exp': expFormatted,
        'Registration Invoice': p.registrationInvoice ?? '',
        'USCF Invoice': p.uscfInvoice ?? '',
        'PD REG': p.pdReg ?? '',
        'PD USCF': p.pdUscf ?? '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Roster');
    const wbout = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const filename = `Roster_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);

    toast({ title: 'Export Complete', description: `${filename} has been downloaded.` });
  };

  const addNewPlayer = () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.email) {
      toast({
        title: 'Missing required fields',
        description: 'First Name, Last Name, and Email are required.',
        variant: 'destructive',
      });
      return;
    }
    const id = `NEW_${Date.now()}_${newPlayer.firstName[0]}${newPlayer.lastName[0]}`;
    setPlayers([...players, { ...newPlayer, id } as PlayerRow]);
    setNewPlayer({});
    toast({ title: 'Player Added', description: 'New player added to the roster.' });
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center gap-2 mb-4 flex-wrap">
        <Button onClick={exportToExcel}>Export Roster</Button>
        <div className="flex gap-2 flex-wrap">
          {[
            'firstName',
            'middleName',
            'lastName',
            'email',
            'uscfId',
            'grade',
            'dob',
            'zip',
            'schoolName',
          ].map((field) => (
            <input
              key={field}
              placeholder={field
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase())}
              value={(newPlayer as any)[field] || ''}
              onChange={(e) => setNewPlayer({ ...newPlayer, [field]: e.target.value })}
              className="border p-1 text-sm rounded"
            />
          ))}
          <Button onClick={addNewPlayer}>Create New Player</Button>
        </div>
      </div>

      <table className="min-w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            {[
              '#',
              'Count',
              'School',
              'Name',
              'Player USCF ID',
              'Grade',
              'DOB',
              'Email',
              'Zip',
              'USCF Exp',
              'Registration Invoice',
              'USCF Invoice',
              'PD REG',
              'PD USCF',
            ].map((col) => (
              <th
                key={col}
                className="p-2 border-b cursor-pointer"
                onClick={() => requestSort(col as keyof PlayerRow | 'Name')}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p, index) => {
            const dob =
              p.dob && isValid(parseISO(p.dob))
                ? format(parseISO(p.dob), 'MM/dd/yyyy')
                : '';
            const expired =
              p.uscfExpiration && new Date(p.uscfExpiration).getTime() < Date.now();
            const uscfExp = expired
              ? 'Expired'
              : p.uscfExpiration && isValid(parseISO(p.uscfExpiration))
              ? format(parseISO(p.uscfExpiration), 'MM/dd/yyyy')
              : '';

            return (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{index + 1}</td>
                <td className="p-2">{schoolCounts[p.schoolName || 'Unknown']}</td>
                <td className="p-2">{p.schoolName || ''}</td>
                <td className="p-2">{`${p.lastName}, ${p.firstName} ${p.middleName}`.trim()}</td>
                <td className="p-2">{p.uscfId ?? ''}</td>
                <td className="p-2">{p.grade ?? ''}</td>
                <td className="p-2">{dob}</td>
                <td className="p-2">{p.email ?? ''}</td>
                <td className="p-2">{p.zip ?? ''}</td>
                <td className={`p-2 ${expired ? 'text-red-600 font-bold' : ''}`}>
                  {uscfExp}
                </td>
                <td className="p-2">{p.registrationInvoice ?? ''}</td>
                <td className="p-2">{p.uscfInvoice ?? ''}</td>
                <td className="p-2">{p.pdReg ?? ''}</td>
                <td className="p-2">{p.pdUscf ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
