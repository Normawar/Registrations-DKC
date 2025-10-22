
import ExcelJS from "exceljs";

// Types (adjust to your actual data shape)
type Player = {
  name: string;
  uscfId?: string;
  studentType: "gt" | "ind";
};

type Registration = {
  schoolName: string;
  playerCount: number;
  gtCount: number;
  indCount: number;
  players: Player[];
};

type ReportData = {
  event: {
    name: string;
  };
  registrations: Registration[];
  totalPlayers: number;
  totalGt: number;
  totalInd: number;
};

export const handleExportTournament = async (reportData: ReportData) => {
  const { event, registrations, totalPlayers, totalGt, totalInd } = reportData;

  const wb = new ExcelJS.Workbook();

  // Common styles
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } }; // Excel blue
  const headerFont = { bold: true, color: { argb: "FFFFFF" } };
  const border = {
    top: { style: "thin", color: { argb: "000000" } },
    bottom: { style: "thin", color: { argb: "000000" } },
    left: { style: "thin", color: { argb: "000000" } },
    right: { style: "thin", color: { argb: "000000" } },
  };

  // Helper: style a row
  const styleRow = (row: ExcelJS.Row, fill?: string, isBold?: boolean) => {
    row.eachCell((cell) => {
      cell.border = border;
      if (fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      }
      if (isBold) {
        cell.font = { bold: true };
      }
    });
  };

  // --- Sheet 1: School Totals ---
  const ws1 = wb.addWorksheet("School Totals");

  ws1.columns = [
    { header: "School", key: "school", width: 40 },
    { header: "Total Players", key: "total", width: 15 },
    { header: "GT Players", key: "gt", width: 15 },
    { header: "Independent Players", key: "ind", width: 20 },
  ];

  registrations.forEach((r) => {
    ws1.addRow({
      school: r.schoolName,
      total: r.playerCount,
      gt: r.gtCount,
      ind: r.indCount,
    });
  });

  ws1.addRow({
    school: "Grand Total",
    total: totalPlayers,
    gt: totalGt,
    ind: totalInd,
  });

  // Style header
  const headerRow1 = ws1.getRow(1);
  headerRow1.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center" };
    cell.border = border;
  });

  // Style rows
  ws1.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // skip header
    if (rowNum === ws1.rowCount) {
      styleRow(row, "FFF2CC", true); // totals row: yellow + bold
    } else {
      styleRow(row, rowNum % 2 === 0 ? "FFFFFF" : "DCE6F1"); // striped
    }
  });

  ws1.autoFilter = { from: "A1", to: "D1" };

  // --- Sheet 2: GT Players ---
  const ws2 = wb.addWorksheet("GT Players");
  ws2.columns = [
    { header: "School", key: "school", width: 40 },
    { header: "Player Name", key: "name", width: 25 },
    { header: "USCF ID", key: "uscf", width: 15 },
  ];

  registrations.forEach((r) =>
    r.players
      .filter((p) => p.studentType === "gt")
      .forEach((p) => {
        ws2.addRow({ school: r.schoolName, name: p.name, uscf: p.uscfId });
      })
  );

  const headerRow2 = ws2.getRow(1);
  headerRow2.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = border;
  });

  ws2.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    styleRow(row, rowNum % 2 === 0 ? "FFFFFF" : "F2F2F2");
  });

  // --- Sheet 3: Independent Players ---
  const ws3 = wb.addWorksheet("Independent Players");
  ws3.columns = [
    { header: "School", key: "school", width: 40 },
    { header: "Player Name", key: "name", width: 25 },
    { header: "USCF ID", key: "uscf", width: 15 },
  ];

  registrations.forEach((r) =>
    r.players
      .filter((p) => p.studentType !== "gt")
      .forEach((p) => {
        ws3.addRow({ school: r.schoolName, name: p.name, uscf: p.uscfId });
      })
  );

  const headerRow3 = ws3.getRow(1);
  headerRow3.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = border;
  });

  ws3.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    styleRow(row, rowNum % 2 === 0 ? "FFFFFF" : "F2F2F2");
  });

  // --- Save file ---
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.name.replace(/[^a-zA-Z0-9]/g, "_")}_report.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
