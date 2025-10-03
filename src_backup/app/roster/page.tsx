'use client';

import React, { useState, useMemo } from 'react';
import { useMasterDb } from '@/context/master-db-context';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type PlayerRow = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  uscfId?: string;
  grade?: string | number;
  dob?: string;
  email?: string;
  zip?: string;
  uscfExpiration?: string;
};

export default function RostersPage() {
  const { players } = useMasterDb();
  const [sortConfig, setSortConfig] = useState<{ key: keyof PlayerRow; direction: 'asc' | 'desc' } | null>(null);

  // Notifications for incomplete fields or duplicate emails
  const notifications = useMemo(() => {
    const incomplete: string[] = [];
    const emailMap: Record<string, string[]> = {};

    players.forEach((p) => {
      if (!p.firstName || !p.lastName || !p.email) {
        incomplete.push(`${p.lastName || ''}, ${p.firstName || ''} ${p.middleName || ''}`.trim());
      }
      if (p.email) {
        const email = p.email.toLowerCase();
        emailMap[email] = emailMap[email] || [];
        emailMap[email].push(`${p.lastName}, ${p.firstName} ${p.middleName || ''}`.trim());
      }
    });

    const duplicateEmails = Object.entries(emailMap)
      .filter(([, names]) => names.length > 1)
      .map(([email, names]) => `${email} (${names.join(', ')})`);

    return { incomplete, duplicateEmails };
  }, [players]);

  // Sorting logic
  const sortedPlayers = useMemo(() => {
    const sortable = [...players];
    if (sortConfig) {
      sortable.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [players, sortConfig]);

  const requestSort = (key: keyof PlayerRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Export to Excel
  const exportToExcel = () => {
    const data = sortedPlayers.map((p) => ({
      Name: `${p.lastName}, ${p.firstName} ${p.middleName || ''}`.trim(),
      'Player USCF ID': p.uscfId ?? '',
      Grade: p.grade === 'K' ? 'K' : p.grade ?? '',
      DOB: p.dob ? format(parseISO(p.dob), 'MM/dd/yyyy') : '',
      Email: p.email ?? '',
      Zip: p.zip ?? '',
      'USCF Exp': p.uscfExpiration
        ? new Date(p.uscfExpiration) < new Date()
          ? 'Expired'
          : format(parseISO(p.uscfExpiration), 'MM/dd/yyyy')
        : '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Roster');
    const wbout = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Roster.xlsx');
  };

  return (
    <div className="p-4">
      {(notifications.incomplete.length > 0 || notifications.duplicateEmails.length > 0) && (
        <div className="bg-yellow-100 p-4 mb-4 border-l-4 border-yellow-500">
          {notifications.incomplete.length > 0 && (
            <p>Players with incomplete required fields: {notifications.incomplete.join(', ')}</p>
          )}
          {notifications.duplicateEmails.length > 0 && (
            <p>Duplicate emails detected: {notifications.duplicateEmails.join('; ')}</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mb-2">
        <Button onClick={exportToExcel}>Export Roster</Button>
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            {['Name', 'Player USCF ID', 'Grade', 'DOB', 'Email', 'Zip', 'USCF Exp'].map((col) => (
              <th
                key={col}
                className="p-2 border-b cursor-pointer"
                onClick={() => requestSort(col as keyof PlayerRow)}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((p) => (
            <tr key={p.id} className="border-b hover:bg-gray-50">
              <td className="p-2">{`${p.lastName}, ${p.firstName} ${p.middleName || ''}`.trim()}</td>
              <td className="p-2">{p.uscfId ?? ''}</td>
              <td className="p-2">{p.grade === 'K' ? 'K' : p.grade ?? ''}</td>
              <td className="p-2">{p.dob ? format(parseISO(p.dob), 'MM/dd/yyyy') : ''}</td>
              <td className="p-2">{p.email ?? ''}</td>
              <td className="p-2">{p.zip ?? ''}</td>
              <td
                className={`p-2 ${
                  p.uscfExpiration && new Date(p.uscfExpiration) < new Date()
                    ? 'text-red-600 font-bold'
                    : ''
                }`}
              >
                {p.uscfExpiration
                  ? new Date(p.uscfExpiration) < new Date()
                    ? 'Expired'
                    : format(parseISO(p.uscfExpiration), 'MM/dd/yyyy')
                  : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
