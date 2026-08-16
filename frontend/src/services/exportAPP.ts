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

interface APPSignatory {
  sign_off: string;
  name: string;
  position: string;
  order_no: number;
}

interface APPData {
  year: number;
  office_name: string;
  grand_total: number;
  signatories: APPSignatory[];
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

  // Signatories — grouped layout: Recommending Approval spans two columns
  const signatories = (appData.signatories ?? [])
    .slice()
    .sort((a, b) => a.order_no - b.order_no);

  if (signatories.length > 0) {
    // Group signatories: merge consecutive "Recommending Approval"
    interface SignatoryGroup {
      heading: string;
      signatories: typeof signatories;
    }
    const groups: SignatoryGroup[] = [];
    let i = 0;
    while (i < signatories.length) {
      const s = signatories[i];
      if (s.sign_off === "Recommending Approval") {
        const group: typeof signatories = [];
        while (i < signatories.length && signatories[i].sign_off === "Recommending Approval") {
          group.push(signatories[i]);
          i++;
        }
        groups.push({ heading: "Recommending Approval", signatories: group });
      } else {
        groups.push({ heading: s.sign_off, signatories: [s] });
        i++;
      }
    }

    // Calculate columns per group (each signatory gets 3 columns)
    const COLS_PER_SIGNATORY = 3;

    // Heading row
    const headingCells: string[] = [];
    const headingMerges: { start: number; end: number }[] = [];
    let colIdx = 1;
    groups.forEach((group) => {
      const startCol = colIdx;
      const numCols = group.signatories.length * COLS_PER_SIGNATORY;
      headingCells.push(group.heading, ...Array(numCols - 1).fill(""));
      headingMerges.push({ start: startCol, end: startCol + numCols - 1 });
      colIdx += numCols;
    });
    const s1 = ws.addRow(headingCells);
    headingMerges.forEach(({ start, end }) => {
      const startLetter = String.fromCharCode(64 + start);
      const endLetter = String.fromCharCode(64 + end);
      ws.mergeCells(`${s1.number}:${startLetter}${s1.number}:${endLetter}${s1.number}`);
    });
    s1.eachCell((cell) => {
      cell.font = { name: "Calibri", bold: true, size: 8 };
    });

    ws.addRow([]);
    ws.addRow([]);

    // Signature lines
    const sigCells: string[] = [];
    groups.forEach((group) => {
      group.signatories.forEach(() => {
        sigCells.push("________________________________", "", "");
      });
    });
    const s2 = ws.addRow(sigCells);
    colIdx = 1;
    groups.forEach((group) => {
      group.signatories.forEach(() => {
        const startLetter = String.fromCharCode(64 + colIdx);
        const endLetter = String.fromCharCode(64 + colIdx + 2);
        ws.mergeCells(`${s2.number}:${startLetter}${s2.number}:${endLetter}${s2.number}`);
        colIdx += COLS_PER_SIGNATORY;
      });
    });

    // Names (UPPERCASE)
    const nameCells: string[] = [];
    groups.forEach((group) => {
      group.signatories.forEach((s) => {
        nameCells.push((s.name || "").toUpperCase(), "", "");
      });
    });
    const sName = ws.addRow(nameCells);
    colIdx = 1;
    groups.forEach((group) => {
      group.signatories.forEach(() => {
        const startLetter = String.fromCharCode(64 + colIdx);
        const endLetter = String.fromCharCode(64 + colIdx + 2);
        ws.mergeCells(`${sName.number}:${startLetter}${sName.number}:${endLetter}${sName.number}`);
        colIdx += COLS_PER_SIGNATORY;
      });
    });
    sName.eachCell((cell) => {
      cell.font = { name: "Calibri", bold: true, size: 8 };
      cell.alignment = { horizontal: "center" };
    });

    // Positions
    const posCells: string[] = [];
    groups.forEach((group) => {
      group.signatories.forEach((s) => {
        posCells.push(s.position || "", "", "");
      });
    });
    const sPos = ws.addRow(posCells);
    colIdx = 1;
    groups.forEach((group) => {
      group.signatories.forEach(() => {
        const startLetter = String.fromCharCode(64 + colIdx);
        const endLetter = String.fromCharCode(64 + colIdx + 2);
        ws.mergeCells(`${sPos.number}:${startLetter}${sPos.number}:${endLetter}${sPos.number}`);
        colIdx += COLS_PER_SIGNATORY;
      });
    });
    sPos.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 8 };
      cell.alignment = { horizontal: "center" };
    });

    // Date row
    const dateCells: string[] = [];
    groups.forEach((group) => {
      group.signatories.forEach(() => {
        dateCells.push("Date: _________________", "", "");
      });
    });
    const s4 = ws.addRow(dateCells);
    colIdx = 1;
    groups.forEach((group) => {
      group.signatories.forEach(() => {
        const startLetter = String.fromCharCode(64 + colIdx);
        const endLetter = String.fromCharCode(64 + colIdx + 2);
        ws.mergeCells(`${s4.number}:${startLetter}${s4.number}:${endLetter}${s4.number}`);
        colIdx += COLS_PER_SIGNATORY;
      });
    });
    s4.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 8 };
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `APP_${appData.office_name}_FY${appData.year}_${appType}.xlsx`);
}
