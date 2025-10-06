'use client';

import React, { useState, useMemo } from 'react';
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
};

export default function PlayerSearchDialog() {
  const { players: initialPlayers = [] } = useMasterDb() ?? {};
  const [players, setPlayers] = useState<PlayerRow[]>(
    () =>
      initialPlayers.map((p) => ({
        ...p,
        firstName: String(p.firstName || ''),
        middleName: String(p.middleName || ''),
        lastName: String(p.lastName || ''),
        uscfId: String(p.uscfId || ''),
        grade: p.grade !== undefined ? String(p.grade) : '',
        dob: p.dob ? new Date(p.dob).toISOString() : '',
        email: p.email ? String(p.email) : '',
        zip: p.zip ? String(p.zip) : '',
        uscfExpiration: p.uscfExpiration ? new Date(p.uscfExpiration).toISOString() : '',
        registrationInvoice: p.registrationInvoice ? String(p.registrationInvoice) : '',
        uscfInvoice: p.uscfInvoice ? String(p.uscfInvoice) : '',
        pdReg: p.pdReg ? String(p.pdReg) : '',
        pdUscf: p.pdUscf ? String(p.pdUscf) : '',
      }))
  );

  const [sortConfig, setSortConfig] = useState<{ key: keyof PlayerRow | 'Name'; direction: 'asc' | 'desc' } | null>(null);
  const [newPlayer, setNewPlayer] = useState<Partial<PlayerRow>>({});

  const sortedPlayers = useMemo(() => {
    const sortable = [...players];
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
  }, [players, sortConfig]);

  const requestSort = (key: keyof PlayerRow | 'Name') => {
    setSortConfig((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const exportToExcel = () => {
    const data = sortedPlayers.map((p) => {
      const dobFormatted = p.dob && isValid(parseISO(p.dob)) ? format(parseISO(p.dob), 'MM/dd/yyyy') : '';
      const expired = p.uscfExpiration && new Date(p.uscfExpiration).getTime() < Date.now();
      const expFormatted = expired ? 'Expired' : p.uscfExpiration && isValid(parseISO(p.uscfExpiration)) ? format(parseISO(p.uscfExpiration), 'MM/dd/yyyy') : '';

      return {
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
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Roster.xlsx');
  };

  const addNewPlayer = () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.email) {
      alert('First Name, Last Name, and Email are required.');
      return;
    }
    const id = `NEW_${Date.now()}_${newPlayer.firstName[0]}${newPlayer.lastName[0]}`;
    setPlayers([...players, { ...newPlayer, id }]);
    setNewPlayer({});
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center gap-2 mb-4 flex-wrap">
        <Button onClick={exportToExcel}>Export Roster</Button>
        <div className="flex gap-2 flex-wrap">
          {['firstName', 'middleName', 'lastName', 'email', 'uscfId', 'grade', 'dob', 'zip'].map((field) => (
            <input
              key={field}
              placeholder={field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              value={(newPlayer as any)[field] || ''}
              onChange={(e) => setNewPlayer({ ...newPlayer, [field]: e.target.value })}
              className="border p-1"
            />
          ))}
          <Button onClick={addNewPlayer}>Create New Player</Button>
        </div>
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            {['Name', 'Player USCF ID', 'Grade', 'DOB', 'Email', 'Zip', 'USCF Exp', 'Registration Invoice', 'USCF Invoice', 'PD REG', 'PD USCF'].map((col) => (
              <th key={col} className="p-2 border-b cursor-pointer" onClick={() => requestSort(col as keyof PlayerRow | 'Name')}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p) => {
            const dob = p.dob && isValid(parseISO(p.dob)) ? format(parseISO(p.dob), 'MM/dd/yyyy') : '';
            const expired = p.uscfExpiration && new Date(p.uscfExpiration).getTime() < Date.now();
            const uscfExp = expired ? 'Expired' : p.uscfExpiration && isValid(parseISO(p.uscfExpiration)) ? format(parseISO(p.uscfExpiration), 'MM/dd/yyyy') : '';

            return (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{`${p.lastName}, ${p.firstName} ${p.middleName}`.trim()}</td>
                <td className="p-2">{p.uscfId ?? ''}</td>
                <td className="p-2">{p.grade ?? ''}</td>
                <td className="p-2">{dob}</td>
                <td className="p-2">{p.email ?? ''}</td>
                <td className="p-2">{p.zip ?? ''}</td>
                <td className={`p-2 ${expired ? 'text-red-600 font-bold' : ''}`}>{uscfExp}</td>
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
