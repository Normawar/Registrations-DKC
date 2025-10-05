"use client";

import React, { useState, useMemo } from "react";
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
};

function RostersPageContent() {
  const { players: initialPlayers = [] } = useMasterDb() ?? {};
  const [players, setPlayers] = useState<PlayerRow[]>(initialPlayers);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof PlayerRow | "Name";
    direction: "asc" | "desc";
  } | null>(null);

  const [newPlayer, setNewPlayer] = useState<Partial<PlayerRow>>({});

  const notifications = useMemo(() => {
    const incomplete: string[] = [];
    const emailMap: Record<string, string[]> = {};

    (players ?? []).forEach((p) => {
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
  }, [players]);

  const sortedPlayers = useMemo(() => {
    const sortable = [...(players ?? [])];
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
  }, [players, sortConfig]);

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
        "USCF Exp": expired ? "Expired" : uscfExpFormatted,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Roster");
    const wbout = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "Roster.xlsx");
  };

  const addNewPlayer = () => {
    if (!newPlayer.firstName || !newPlayer.lastName || !newPlayer.email) {
      alert("First Name, Last Name, and Email are required.");
      return;
    }

    const id = `NEW_${Date.now()}_${newPlayer.firstName[0]}${newPlayer.lastName[0]}`;
    setPlayers([...players, { ...newPlayer, id }]);
    setNewPlayer({});
  };

  return (
    <div className="p-4">
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

      <div className="flex justify-between items-center gap-2 mb-4 flex-wrap">
        <Button onClick={exportToExcel}>Export Roster</Button>
        <div className="flex gap-2 flex-wrap">
          <input placeholder="First Name" value={newPlayer.firstName || ""} onChange={(e) => setNewPlayer({ ...newPlayer, firstName: e.target.value })} className="border p-1" />
          <input placeholder="Middle Name" value={newPlayer.middleName || ""} onChange={(e) => setNewPlayer({ ...newPlayer, middleName: e.target.value })} className="border p-1" />
          <input placeholder="Last Name" value={newPlayer.lastName || ""} onChange={(e) => setNewPlayer({ ...newPlayer, lastName: e.target.value })} className="border p-1" />
          <input placeholder="Email" value={newPlayer.email || ""} onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })} className="border p-1" />
          <input placeholder="USCF ID" value={newPlayer.uscfId || ""} onChange={(e) => setNewPlayer({ ...newPlayer, uscfId: e.target.value })} className="border p-1" />
          <input placeholder="Grade" value={newPlayer.grade || ""} onChange={(e) => setNewPlayer({ ...newPlayer, grade: e.target.value })} className="border p-1" />
          <input placeholder="DOB (YYYY-MM-DD)" value={newPlayer.dob || ""} onChange={(e) => setNewPlayer({ ...newPlayer, dob: e.target.value })} className="border p-1" />
          <input placeholder="Zip" value={newPlayer.zip || ""} onChange={(e) => setNewPlayer({ ...newPlayer, zip: e.target.value })} className="border p-1" />
          <Button onClick={addNewPlayer}>Create New Player</Button>
        </div>
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            {["Name", "Player USCF ID", "Grade", "DOB", "Email", "Zip", "USCF Exp"].map((col) => (
              <th key={col} className="p-2 border-b cursor-pointer" onClick={() => requestSort(col as keyof PlayerRow | "Name")}>{col}</th>
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
                <td className={`p-2 ${expired ? "text-red-600 font-bold" : ""}`}>{expired ? "Expired" : uscfExp}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
