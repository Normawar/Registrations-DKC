'use client';

import React, { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/app-layout";
import { useMasterDb } from "@/context/master-db-context";
import { format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver/dist/FileSaver";
import { useToast } from "@/hooks/use-toast";

type PlayerRow = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  uscfId: string;
  grade: string;
  dob: string;
  email: string;
  zipCode: string;
  district?: string;
  school?: string;
  regularRating?: string | number;
};

export default function RostersPageContent() {
  const { database, updatePlayer, deletePlayer, dbDistricts, getSchoolsForDistrictFromPlayers, refreshDatabase, isDbLoaded } = useMasterDb();
  const { toast } = useToast();
  const [districtFilter, setDistrictFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof PlayerRow | "Name"; direction: "asc" | "desc" } | null>(null);
  const [editPlayer, setEditPlayer] = useState<PlayerRow | null>(null);

  const schoolsForDistrict = useMemo(() => {
    if (districtFilter === "all") return getSchoolsForDistrictFromPlayers(districtFilter);
    return getSchoolsForDistrictFromPlayers(districtFilter);
  }, [districtFilter, getSchoolsForDistrictFromPlayers]);

  const filteredPlayers = useMemo(() => {
    return database.filter(p => {
      const districtMatch = districtFilter === "all" || p.district === districtFilter;
      const schoolMatch = schoolFilter === "all" || p.school === schoolFilter;
      return districtMatch && schoolMatch;
    });
  }, [database, districtFilter, schoolFilter]);

  const sortedPlayers = useMemo(() => {
    if (!sortConfig) return filteredPlayers;
    const sorted = [...filteredPlayers].sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortConfig.key === "Name") {
        aVal = `${a.lastName}, ${a.firstName} ${a.middleName || ""}`.toLowerCase();
        bVal = `${b.lastName}, ${b.firstName} ${b.middleName || ""}`.toLowerCase();
      } else {
        aVal = (a as any)[sortConfig.key] ?? "";
        bVal = (b as any)[sortConfig.key] ?? "";
        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredPlayers, sortConfig]);

  const requestSort = (key: keyof PlayerRow | "Name") => {
    setSortConfig(prev => prev?.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  };

  const exportToExcel = () => {
    const data = sortedPlayers.map(p => ({
      Name: `${p.lastName}, ${p.firstName} ${p.middleName || ""}`.trim(),
      "Player USCF ID": p.uscfId,
      Grade: p.grade,
      DOB: p.dob && isValid(parseISO(p.dob)) ? format(parseISO(p.dob), "MM/dd/yyyy") : "",
      Email: p.email,
      Zip: p.zipCode,
      District: p.district ?? "",
      School: p.school ?? "",
      Rating: p.regularRating ?? "UNR",
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Roster");
    const wbout = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Roster.xlsx");
  };

  const handleSave = async () => {
    if (!editPlayer) return;
    try {
      await updatePlayer(editPlayer, null); // null = sponsor context
      toast({ title: "Saved", description: "Player updated successfully." });
      setEditPlayer(null);
      setSelectedPlayer(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save player.", variant: "destructive" });
    }
  };

  const handleRemoveRoster = async (playerId: string) => {
    try {
      await deletePlayer(playerId, 'sponsor');
      toast({ title: "Removed", description: "Player removed from your roster." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to remove player.", variant: "destructive" });
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Player Roster</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1">District</label>
          <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} className="border p-2 rounded">
            <option value="all">All Districts</option>
            {dbDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">School</label>
          <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)} className="border p-2 rounded">
            <option value="all">All Schools</option>
            {schoolsForDistrict.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => { setDistrictFilter("all"); setSchoolFilter("all"); }}>Clear Filters</Button>
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-between items-center gap-2 mb-4 flex-wrap">
        <Button onClick={exportToExcel}>Export Roster</Button>
        <span className="text-sm text-gray-600">Showing {sortedPlayers.length} of {database.length} players</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              {["Name","Player USCF ID","Grade","DOB","Email","Zip","District","School","Rating"].map(col => (
                <th key={col} className="p-2 border-b cursor-pointer hover:bg-gray-200" onClick={() => requestSort(col as keyof PlayerRow | "Name")}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-2 text-blue-600 cursor-pointer" onClick={() => { setSelectedPlayer(p); setEditPlayer(p); }}>
                  {`${p.lastName}, ${p.firstName} ${p.middleName || ""}`.trim()}
                </td>
                <td className="p-2">{p.uscfId}</td>
                <td className="p-2">{p.grade}</td>
                <td className="p-2">{p.dob && isValid(parseISO(p.dob)) ? format(parseISO(p.dob), "MM/dd/yyyy") : ""}</td>
                <td className="p-2">{p.email}</td>
                <td className="p-2">{p.zipCode}</td>
                <td className="p-2">{p.district ?? ""}</td>
                <td className="p-2">{p.school ?? ""}</td>
                <td className="p-2">{p.regularRating ?? "UNR"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Player Detail / Edit */}
      {selectedPlayer && editPlayer && (
        <div className="fixed inset-0 bg-black/30 flex justify-center items-start pt-20 z-50 overflow-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-lg">
            <h2 className="text-xl font-bold mb-4">Edit Player</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {["firstName","middleName","lastName","uscfId","grade","dob","email","zipCode","district","school","regularRating"].map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-1">{field}</label>
                  <input
                    type="text"
                    className="border p-2 rounded w-full"
                    value={(editPlayer as any)[field] || ""}
                    onChange={e => setEditPlayer(prev => prev ? ({ ...prev, [field]: e.target.value }) : null)}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="destructive" onClick={() => handleRemoveRoster(editPlayer.id)}>Remove from Roster</Button>
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => { setSelectedPlayer(null); setEditPlayer(null); }}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
