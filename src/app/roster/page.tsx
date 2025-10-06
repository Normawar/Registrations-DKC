"use client";

import React, { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/app-layout";
import { useMasterDb } from "@/context/master-db-context";
import { format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver/dist/FileSaver";
import { useToast } from "@/hooks/use-toast";
import EnhancedPlayerSearchDialog from "@/components/EnhancedPlayerSearchDialog";

// --- Helper: safe split ---
const splitSafe = (value: any, separator = ","): string[] => {
  if (!value) return [];
  if (typeof value === "string") return value.split(separator).map(v => v.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.filter(Boolean);
  return [String(value)];
};

// --- Types ---
type PlayerRow = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  uscfId: string;
  grade: string | number;
  dob: string;
  email: string;
  zip: string;
  uscfExpiration?: string;
  district?: string;
  school?: string;
};

// --- Roster Page Content ---
function RostersPageContent() {
  const { database, updatePlayer, dbPlayerDistricts, dbPlayerSchools, isDbLoaded, toast } = useMasterDb();
  const [sortConfig, setSortConfig] = useState<{ key: keyof PlayerRow | "Name"; direction: "asc" | "desc" } | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [searchText, setSearchText] = useState("");

  // --- Safe transformation & merge duplicates ---
  const players = useMemo(() => {
    const map: Record<string, PlayerRow> = {};
    database.forEach(p => {
      const id = p.uscfId.toUpperCase() === "NEW" ? p.id : p.uscfId;
      const email = p.email.toLowerCase();
      if (!map[id]) {
        map[id] = { ...p, uscfId: p.uscfId.toUpperCase(), middleName: p.middleName || "" };
      } else {
        // Merge data if duplicate
        map[id] = { ...map[id], ...p };
      }
    });
    return Object.values(map);
  }, [database]);

  // --- Filtering ---
  const filteredPlayers = useMemo(() => {
    let list = [...players];
    if (districtFilter !== "all") list = list.filter(p => p.district === districtFilter);
    if (schoolFilter !== "all") list = list.filter(p => p.school === schoolFilter);
    if (searchText.trim()) {
      const txt = searchText.toLowerCase();
      list = list.filter(p =>
        `${p.firstName} ${p.middleName || ""} ${p.lastName}`.toLowerCase().includes(txt) ||
        p.email.toLowerCase().includes(txt) ||
        p.uscfId.toLowerCase().includes(txt)
      );
    }
    return list;
  }, [players, districtFilter, schoolFilter, searchText]);

  // --- Sorting ---
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

  // --- Excel Export ---
  const exportToExcel = () => {
    const data = sortedPlayers.map(p => {
      const dobFormatted = p.dob && isValid(parseISO(p.dob)) ? format(parseISO(p.dob), "MM/dd/yyyy") : "";
      const uscfExpFormatted = p.uscfExpiration && isValid(parseISO(p.uscfExpiration)) ? format(parseISO(p.uscfExpiration), "MM/dd/yyyy") : "";
      const expired = p.uscfExpiration && new Date(p.uscfExpiration).getTime() < Date.now();
      return {
        Name: `${p.lastName}, ${p.firstName} ${p.middleName || ""}`.trim(),
        "Player USCF ID": p.uscfId,
        Grade: p.grade,
        DOB: dobFormatted,
        Email: p.email,
        Zip: p.zip,
        District: p.district,
        School: p.school,
        "USCF Exp": expired ? "Expired" : uscfExpFormatted,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Roster");
    const wbout = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Roster.xlsx");
  };

  // --- Save edited player ---
  const handleSave = async (player: PlayerRow) => {
    try {
      // Ensure required fields
      const requiredFields: (keyof PlayerRow)[] = ["firstName", "lastName", "uscfId", "grade", "email", "dob", "zip"];
      for (const field of requiredFields) {
        if (!player[field] || (typeof player[field] === "string" && !player[field].trim())) {
          toast({ title: `Error: ${field} is required`, variant: "destructive" });
          return;
        }
      }
      // Uppercase USCF ID if present
      if (player.uscfId.toUpperCase() === "NEW") player.uscfId = "NEW";
      await updatePlayer(player, null);
      toast({ title: "Player saved successfully" });
      setSelectedPlayer(null);
    } catch (e) {
      console.error(e);
      toast({ title: "Error saving player", variant: "destructive" });
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Player Roster</h1>

      <div className="flex gap-4 mb-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1">District</label>
          <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} className="border p-2 rounded">
            <option value="all">All Districts</option>
            {dbPlayerDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">School</label>
          <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)} className="border p-2 rounded">
            <option value="all">All Schools</option>
            {dbPlayerSchools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Search</label>
          <input type="text" className="border p-2 rounded" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search name, email, USCF ID..." />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => { setDistrictFilter("all"); setSchoolFilter("all"); setSearchText(""); }}>
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center gap-2 mb-4 flex-wrap">
        <Button onClick={exportToExcel}>Export Roster</Button>
        <span className="text-sm text-gray-600">Showing {sortedPlayers.length} of {players.length} players</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              {["Name", "Player USCF ID", "Grade", "DOB", "Email", "Zip", "District", "School", "USCF Exp"].map(col => (
                <th
                  key={col}
                  className="p-2 border cursor-pointer"
                  onClick={() => requestSort(col as keyof PlayerRow | "Name")}
                >
                  {col} {sortConfig?.key === col ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(player => {
              const dobFormatted = player.dob && isValid(parseISO(player.dob)) ? format(parseISO(player.dob), "MM/dd/yyyy") : "";
              const uscfExpFormatted = player.uscfExpiration && isValid(parseISO(player.uscfExpiration)) ? format(parseISO(player.uscfExpiration), "MM/dd/yyyy") : "";
              const expired = player.uscfExpiration && new Date(player.uscfExpiration).getTime() < Date.now();
              return (
                <tr key={player.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPlayer(player)}>
                  <td className="p-2 border">{`${player.lastName}, ${player.firstName} ${player.middleName || ""}`.trim()}</td>
                  <td className="p-2 border">{player.uscfId}</td>
                  <td className="p-2 border">{player.grade}</td>
                  <td className="p-2 border">{dobFormatted}</td>
                  <td className="p-2 border">{player.email}</td>
                  <td className="p-2 border">{player.zip}</td>
                  <td className="p-2 border">{player.district}</td>
                  <td className="p-2 border">{player.school}</td>
                  <td className="p-2 border">{expired ? "Expired" : uscfExpFormatted}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedPlayer && (
        <EnhancedPlayerSearchDialog
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default function RosterPage() {
  return <AppLayout><RostersPageContent /></AppLayout>;
}
