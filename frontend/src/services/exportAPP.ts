import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface APPRow {
  project_title: string;
  end_user: string;
  general_description: string;
  procurement_mode: string;
  early_procurement: string;
  bid_evaluation: string;
  start_activity: string;
  end_activity: string;
  source_of_funds: string;
  estimated_budget: number;
  procurement_strategy: string;
  remarks: string;
}

interface APPData {
  year: number;
  office_name: string;
  grand_total: number;
  rows: APPRow[];
}

export async function exportAPPToExcel(appData: APPData, appType: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("APP", {
    pageSetup: {
      paperSize: 5,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  ws.columns = [
    { width: 30 },
    { width: 18 },
    { width: 20 },
    { width: 14 },
    { width: 8 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
  ];

  const hFont = { name: "Calibri", bold: true, size: 8 };
  const dFont = { name: "Calibri", size: 8 };
  const center: Partial<ExcelJS.Alignment> = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  const left: Partial<ExcelJS.Alignment> = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  const right: Partial<ExcelJS.Alignment> = {
    horizontal: "right",
    vertical: "middle",
  };
  const thin: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  const hFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9E1F2" },
  };
  const totalFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEC9706" },
  };

  const addMergedRow = (
    text: string,
    fontSize: number,
    bold: boolean,
    height: number,
  ) => {
    const r = ws.addRow([text]);
    ws.mergeCells(`A${r.number}:L${r.number}`);
    r.getCell(1).font = { name: "Calibri", size: fontSize, bold };
    r.getCell(1).alignment = center;
    r.height = height;
    return r;
  };

  addMergedRow("Republic of the Philippines", 10, false, 14);
  addMergedRow("NORTH EASTERN MINDANAO STATE UNIVERSITY", 13, true, 18);
  addMergedRow(`ANNUAL PROCUREMENT PLAN FOR FY ${appData.year}`, 13, true, 18);
  ws.addRow([]);

  const r5 = ws.addRow([
    `${appType === "indicative" ? "☑" : "☐"} INDICATIVE          ${appType === "final" ? "☑" : "☐"} FINAL`,
  ]);
  ws.mergeCells(`A${r5.number}:L${r5.number}`);
  r5.getCell(1).font = { name: "Calibri", size: 10 };
  r5.getCell(1).alignment = center;
  r5.height = 14;

  // End-User or Implementing Unit row
  const r6 = ws.addRow([
    `End-User or Implementing Unit: ${appData.office_name}`,
  ]);
  ws.mergeCells(`A${r6.number}:L${r6.number}`);
  r6.getCell(1).font = { name: "Calibri", size: 10, bold: true };
  r6.getCell(1).alignment = center;
  r6.height = 14;

  ws.addRow([]);

  // Group headers
  const r7 = ws.addRow([
    "PROCUREMENT PROJECT DETAILS",
    "",
    "",
    "",
    "PROJECTED TIMELINE (MM/YYYY)",
    "",
    "",
    "",
    "FUNDING DETAILS",
    "",
    "PROCUREMENT STRATEGY OR TOOLS",
    "REMARKS",
  ]);
  ws.mergeCells(`A${r7.number}:D${r7.number}`);
  ws.mergeCells(`E${r7.number}:H${r7.number}`);
  ws.mergeCells(`I${r7.number}:J${r7.number}`);
  r7.height = 20;
  [1, 5, 9, 11, 12].forEach((c) => {
    const cell = r7.getCell(c);
    cell.font = hFont;
    cell.alignment = center;
    cell.fill = hFill;
    cell.border = thin;
  });

  // Column headers
  const r8 = ws.addRow([
    "Project Title",
    "End-User or Implementing Unit",
    "General Description of the Project",
    "Mode of Procurement",
    "Early Procurement Activity? (Yes/No)",
    "Criteria for Bid Evaluation",
    "Start of Procurement Activity",
    "End of Procurement Activity",
    "Source of Fund",
    "Estimated Budget / ABC (PhP)",
    "Procurement Strategy or Tools",
    "Remarks",
  ]);
  r8.height = 45;
  r8.eachCell((cell) => {
    cell.font = hFont;
    cell.alignment = center;
    cell.fill = hFill;
    cell.border = thin;
  });

  // Column numbers
  const r9 = ws.addRow(Array.from({ length: 12 }, (_, i) => `Column ${i + 1}`));
  r9.height = 14;
  r9.eachCell((cell) => {
    cell.font = hFont;
    cell.alignment = center;
    cell.fill = hFill;
    cell.border = thin;
  });

  // Data rows
  appData.rows.forEach((row, i) => {
    const dr = ws.addRow([
      row.project_title,
      row.end_user,
      row.general_description,
      row.procurement_mode,
      row.early_procurement,
      row.bid_evaluation,
      row.start_activity,
      row.end_activity,
      row.source_of_funds,
      row.estimated_budget || "",
      row.procurement_strategy,
      row.remarks,
    ]);
    dr.height = 35;
    dr.eachCell((cell, col) => {
      cell.font = dFont;
      cell.border = thin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB" },
      };
      if (col === 10) {
        cell.alignment = right;
        if (cell.value) cell.numFmt = "₱#,##0.00";
      } else if (col === 5 || col === 6) {
        cell.alignment = center;
      } else {
        cell.alignment = left;
      }
    });
  });

  // Total row
  const tr = ws.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Total Amount of Estimated Budget:",
    appData.grand_total,
    "",
    "",
  ]);
  tr.height = 18;
  ws.mergeCells(`A${tr.number}:I${tr.number}`);
  tr.eachCell((cell, col) => {
    cell.font = { name: "Calibri", bold: true, size: 9 };
    cell.border = thin;
    cell.fill = totalFill;
    if (col === 9) cell.alignment = right;
    if (col === 10) {
      cell.alignment = right;
      cell.numFmt = "₱#,##0.00";
    }
  });

  ws.addRow([]);

  // Signatures
  const roles = [
    "BAC Secretariat",
    "BAC Chairperson",
    "Head of the Procuring Entity",
  ];
  const labels = ["Prepared by:", "Recommended by:", "Approved by:"];
  const s1 = ws.addRow([
    labels[0],
    "",
    "",
    "",
    labels[1],
    "",
    "",
    "",
    labels[2],
  ]);
  ws.mergeCells(`A${s1.number}:D${s1.number}`);
  ws.mergeCells(`E${s1.number}:H${s1.number}`);
  ws.mergeCells(`I${s1.number}:L${s1.number}`);
  s1.eachCell((cell) => {
    cell.font = { name: "Calibri", bold: true, size: 9 };
  });

  ws.addRow([]);
  ws.addRow([]);

  const s2 = ws.addRow([
    "________________________________",
    "",
    "",
    "",
    "________________________________",
    "",
    "",
    "",
    "________________________________",
  ]);
  ws.mergeCells(`A${s2.number}:D${s2.number}`);
  ws.mergeCells(`E${s2.number}:H${s2.number}`);
  ws.mergeCells(`I${s2.number}:L${s2.number}`);

  const s3 = ws.addRow([
    "Signature over Printed Name",
    "",
    "",
    "",
    "Signature over Printed Name",
    "",
    "",
    "",
    "Signature over Printed Name",
  ]);
  ws.mergeCells(`A${s3.number}:D${s3.number}`);
  ws.mergeCells(`E${s3.number}:H${s3.number}`);
  ws.mergeCells(`I${s3.number}:L${s3.number}`);
  s3.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 8 };
  });

  roles.forEach((role, i) => {
    const r = ws.addRow(
      i === 0 ? [role, "", "", "", roles[1], "", "", "", roles[2]] : [],
    );
    if (i === 0) {
      ws.mergeCells(`A${r.number}:D${r.number}`);
      ws.mergeCells(`E${r.number}:H${r.number}`);
      ws.mergeCells(`I${r.number}:L${r.number}`);
      r.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 8 };
      });
    }
  });

  const s4 = ws.addRow([
    "Date: _________________",
    "",
    "",
    "",
    "Date: _________________",
    "",
    "",
    "",
    "Date: _________________",
  ]);
  ws.mergeCells(`A${s4.number}:D${s4.number}`);
  ws.mergeCells(`E${s4.number}:H${s4.number}`);
  ws.mergeCells(`I${s4.number}:L${s4.number}`);
  s4.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 8 };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `APP_${appData.office_name}_FY${appData.year}_${appType}.xlsx`);
}
