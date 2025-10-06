"use client";

import React, { useState, useMemo, useEffect } from "react";
import { SimpleLayout } from "@/components/simple-layout";
import { useMasterDb } from "@/context/master-db-context";
import { format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver/dist/FileSaver";

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
  district?: string;
  school?: string;
};
function RostersPageContent() {
  const { 
    database: allPlayers = [],  // Change back to allPlayers
    dbPlayerSchools = [], 
    dbPlayerDistricts = [], 
    getSchoolsForDistrictFromPlayers,
    isDbLoaded 
  } = useMasterDb();

  // Sanitize all player data to prevent .split() errors
  const safeAllPlayers = useMemo(() => {
    return allPlayers.map(player => {
      // Helper to safely convert dates
      const safeDate = (dateValue: any): string => {
        if (!dateValue) return '';
        if (typeof dateValue === 'string' && dateValue.trim() !== '') return dateValue;
        try {
          const d = new Date(dateValue);
          if (isNaN(d.getTime())) return '';
          return d.toISOString();
        } catch {
          return '';
        }
      };
  
      return {
        ...player,
        district: String(player.district || ''),
        school: String(player.school || ''),
        firstName: String(player.firstName || ''),
        lastName: String(player.lastName || ''),
        middleName: player.middleName ? String(player.middleName) : '',
        uscfId: String(player.uscfId || ''),
        email: player.email ? String(player.email) : '',
        grade: player.grade ? String(player.grade) : '',
        zip: player.zip ? String(player.zip) : '',
        dob: safeDate(player.dob),
        uscfExpiration: safeDate(player.uscfExpiration),
      };
    });
  }, [allPlayers]);

  // Ultra-defensive filtering - ensure ONLY valid strings make it through
  const safeDistricts = useMemo(() => {
    if (!Array.isArray(dbPlayerDistricts)) {
      console.warn('dbPlayerDistricts is not an array:', typeof dbPlayerDistricts);
      return ['Homeschool'];
    }
    const filtered = dbPlayerDistricts
      .map(d => String(d || ''))
      .filter(d => d.trim() !== '');
    return filtered.length > 0 ? filtered : ['Homeschool'];
  }, [dbPlayerDistricts]);

  const safeSchools = useMemo(() => {
    if (!Array.isArray(dbPlayerSchools)) {
      console.warn('dbPlayerSchools is not an array:', typeof dbPlayerSchools);
      return [];
    }
    return dbPlayerSchools
      .map(s => String(s || ''))
      .filter(s => s.trim() !== '');
  }, [dbPlayerSchools]);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof PlayerRow | "Name";
    direction: "asc" | "desc";
  } | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [schoolsForDistrict, setSchoolsForDistrict] = useState<string[]>(safeSchools);

  // Cascading filter: update schools when district changes
  useEffect(() => {
    if (districtFilter === 'all') {
      setSchoolsForDistrict(safeSchools);
    } else {
      const filteredSchools = getSchoolsForDistrictFromPlayers 
        ? getSchoolsForDistrictFromPlayers(districtFilter)
        : [...new Set(allPlayers.filter(p => p.district === districtFilter).map(p => p.school).filter(s => s && typeof s === 'string'))].sort();
      setSchoolsForDistrict(filteredSchools);
    }
    setSchoolFilter('all');
  }, [districtFilter, safeSchools, allPlayers, getSchoolsForDistrictFromPlayers]);

  const notifications = useMemo(() => {
    const incomplete: string[] = [];
    const emailMap: Record<string, string[]> = {};

    (selectedPlayers ?? []).forEach((p) => {
      const fullName = `${p?.lastName || ""}, ${p?.firstName || ""} ${p?.middleName || ""}`.trim();

      if (!p?.firstName || !p?.lastName || !p?.email) {
        incomplete.push(fullName);
      }

      if (p?.email) {
        const email = p.email.toLowerCase();
        emailMap[email] = emailMap[email] || [];
        emailMap[email].push(fullName);
      }
    });

    const duplicateEmails = Object.entries(emailMap)
      .filter(([, names]) => names.length > 1)
      .map(([email, names]) => `${email} (${names.join(", ")})`);

    return { incomplete, duplicateEmails };
  }, [allPlayers]);

  const sortedPlayers = useMemo(() => {
    let sortable = [...(safeAllPlayers  ?? [])];
    
    // Apply filters
    if (districtFilter && districtFilter !== "all") {
      sortable = sortable.filter(p => p.district === districtFilter);
    }
    if (schoolFilter && schoolFilter !== "all") {
      sortable = sortable.filter(p => p.school === schoolFilter);
    }
    
    // Apply sorting
    if (sortConfig) {
      sortable.sort((a, b) => {
        if (sortConfig.key === "Name") {
          const aName = `${a.lastName || ""}, ${a.firstName || ""} ${a.middleName || ""}`.toLowerCase();
          const bName = `${b.lastName || ""}, ${b.firstName || ""} ${b.middleName || ""}`.toLowerCase();
          if (aName < bName) return sortConfig.direction === "asc" ? -1 : 1;
          if (aName > bName) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        } else {
          const aVal = (a as any)[sortConfig.key] ?? "";
          const bVal = (b as any)[sortConfig.key] ?? "";
          if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        }
      });
    }
    return sortable;
  }, [allPlayers, sortConfig, districtFilter, schoolFilter]);

  const requestSort = (key: keyof PlayerRow | "Name") => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const exportToExcel = () => {
    const data = (sortedPlayers ?? []).map((p) => {
      const dobFormatted = p?.dob && isValid(parseISO(p.dob)) ? format(parseISO(p.dob), "MM/dd/yyyy") : "";
      const uscfExpFormatted = p?.uscfExpiration && isValid(parseISO(p.uscfExpiration))
        ? format(parseISO(p.uscfExpiration), "MM/dd/yyyy")
        : "";
      const expired = p?.uscfExpiration && new Date(p.uscfExpiration).getTime() < Date.now();

      return {
        Name: `${p?.lastName || ""}, ${p?.firstName || ""} ${p?.middleName || ""}`.trim(),
        "Player USCF ID": p?.uscfId ?? "",
        Grade: p?.grade === "K" ? "K" : p?.grade ?? "",
        DOB: dobFormatted,
        Email: p?.email ?? "",
        Zip: p?.zip ?? "",
        District: p?.district ?? "",
        School: p?.school ?? "",
        "USCF Exp": expired ? "Expired" : uscfExpFormatted,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Roster");
    const wbout = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Roster.xlsx");
  };

  if (!isDbLoaded) {
    return (
      <div className="p-4">
        <p>Loading roster data...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Player Roster</h1>
      
      {(notifications.incomplete.length > 0 || notifications.duplicateEmails.length > 0) && (
        <div className="bg-yellow-100 p-4 mb-4 border-l-4 border-yellow-500">
          {notifications.incomplete.length > 0 && (
            <p>Players with incomplete required fields: {notifications.incomplete.join(", ")}</p>
          )}
          {notifications.duplicateEmails.length > 0 && (
            <p>Duplicate emails detected: {notifications.duplicateEmails.join("; ")}</p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1">District</label>
          <select 
            value={districtFilter} 
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="all">All Districts</option>
            {safeDistricts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">School</label>
          <select 
            value={schoolFilter} 
            onChange={(e) => setSchoolFilter(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="all">All Schools</option>
            {schoolsForDistrict.filter(s => s && typeof s === 'string').map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button 
            variant="outline"
            onClick={() => {
              setDistrictFilter("all");
              setSchoolFilter("all");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-2 items-center">
          <Button onClick={exportToExcel}>Export Roster</Button>
          <span className="text-sm text-gray-600">
            Showing {sortedPlayers.length} of {allPlayers.length} players
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              {["Name", "Player USCF ID", "Grade", "DOB", "Email", "Zip", "District", "School", "USCF Exp"].map((col) => (
                <th key={col} className="p-2 border-b cursor-pointer hover:bg-gray-200" onClick={() => requestSort(col as keyof PlayerRow | "Name")}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sortedPlayers ?? []).map((p) => {
              const dob = p?.dob && isValid(parseISO(p.dob)) ? format(parseISO(p.dob), "MM/dd/yyyy") : "";
              const expired = p?.uscfExpiration && new Date(p.uscfExpiration).getTime() < Date.now();
              const uscfExp = p?.uscfExpiration && isValid(parseISO(p.uscfExpiration)) ? format(parseISO(p.uscfExpiration), "MM/dd/yyyy") : expired ? "Expired" : "";

              return (
                <tr key={p?.id ?? Math.random().toString()} className="border-b hover:bg-gray-50">
                  <td className="p-2">{`${p?.lastName || ""}, ${p?.firstName || ""} ${p?.middleName || ""}`.trim()}</td>
                  <td className="p-2">{p?.uscfId ?? ""}</td>
                  <td className="p-2">{p?.grade === "K" ? "K" : p?.grade ?? ""}</td>
                  <td className="p-2">{dob}</td>
                  <td className="p-2">{p?.email ?? ""}</td>
                  <td className="p-2">{p?.zip ?? ""}</td>
                  <td className="p-2">{p?.district ?? ""}</td>
                  <td className="p-2">{p?.school ?? ""}</td>
                  <td className={`p-2 ${expired ? "text-red-600 font-bold" : ""}`}>{expired ? "Expired" : uscfExp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RostersPage() {
  return (
    <SimpleLayout>
      <RostersPageContent />
    </SimpleLayout>
  );
}
// Force rebuild Sat Oct  5 14:00:00 CDT 2025