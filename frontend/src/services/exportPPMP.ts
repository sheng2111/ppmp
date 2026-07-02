import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { PPMP, Office } from "../types";

export async function exportPPMPToExcel(ppmp: PPMP, office: Office) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PPMP", {
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
    { width: 33 }, // Col 1 - Description (wider for long text)
    { width: 13 }, // Col 2 - Type
    { width: 30 }, // Col 3 - Qty & Size
    { width: 16 }, // Col 4 - Mode
    { width: 13 }, // Col 5 - Pre-proc
    { width: 11 }, // Col 6 - Start
    { width: 11 }, // Col 7 - End
    { width: 13 }, // Col 8 - Delivery
    { width: 10 }, // Col 9 - Source
    { width: 16 }, // Col 10 - Budget
    { width: 25 }, // Col 11 - Docs
    { width: 20 }, // Col 12 - Remarks
  ];

  // ── Try to load logo
  let logoImageId: number | null = null;
  try {
    const response = await fetch("/nemsu-logo.png");
    if (response.ok) {
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          "",
        ),
      );
      logoImageId = wb.addImage({ base64, extension: "png" });
    }
  } catch (e) {
    // logo not found, skip
  }

  const headerFont = { name: "Calibri", bold: true, size: 8 };
  const dataFont = { name: "Calibri", size: 8 };
  const centerAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  const leftAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  const rightAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "right",
    vertical: "middle",
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9E1F2" },
  };
  const totalFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEC9706" },
  };

  // ── Logo
  if (logoImageId !== null) {
    ws.addImage(logoImageId, {
      tl: { col: 5, row: 0 },
      ext: { width: 110, height: 110 },
    });
    const logoRow = ws.addRow([""]);
    ws.mergeCells(`A${logoRow.number}:L${logoRow.number}`);
    logoRow.height = 45;
  }

  // ── Row: Republic of the Philippines
  const r1 = ws.addRow(["Republic of the Philippines"]);
  ws.mergeCells(`A${r1.number}:L${r1.number}`);
  r1.getCell(1).font = { name: "Calibri", size: 10 };
  r1.getCell(1).alignment = centerAlign;
  r1.height = 14;

  // ── Row: University name
  const r2 = ws.addRow(["NORTH EASTERN MINDANAO STATE UNIVERSITY"]);
  ws.mergeCells(`A${r2.number}:L${r2.number}`);
  r2.getCell(1).font = { name: "Calibri", bold: true, size: 13 };
  r2.getCell(1).alignment = centerAlign;
  r2.height = 18;

  // ── Row: PPMP Title
  const r3 = ws.addRow([
    `PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. ${ppmp.ppmp_no || "___"}`,
  ]);
  ws.mergeCells(`A${r3.number}:L${r3.number}`);
  r3.getCell(1).font = { name: "Calibri", bold: true, size: 13 };
  r3.getCell(1).alignment = centerAlign;
  r3.height = 18;

  // ── Empty row
  ws.addRow([]);

  // ── Row: Indicative/Final
  const r5 = ws.addRow([
    `${ppmp.ppmp_type === "indicative" ? "☑" : "☐"} INDICATIVE          ${ppmp.ppmp_type === "final" ? "☑" : "☐"} FINAL`,
  ]);
  ws.mergeCells(`A${r5.number}:L${r5.number}`);
  r5.getCell(1).font = { name: "Calibri", size: 10 };
  r5.getCell(1).alignment = centerAlign;
  r5.height = 14;

  // ── Row: Fiscal Year
  const r6 = ws.addRow([`Fiscal Year:          ${ppmp.year}`]);
  ws.mergeCells(`A${r6.number}:L${r6.number}`);
  r6.getCell(1).font = { name: "Calibri", size: 10 };
  r6.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  r6.height = 14;

  // ── Row: End-User
  const r7 = ws.addRow([
    `End-User or Implementing Unit:          ${office.name}`,
  ]);
  ws.mergeCells(`A${r7.number}:L${r7.number}`);
  r7.getCell(1).font = { name: "Calibri", size: 10 };
  r7.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  r7.height = 14;

  // ── Empty row
  ws.addRow([]);

  // ── Row: Group headers
  const r9 = ws.addRow([
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
    "ATTACHED SUPPORTING DOCUMENTS",
    "REMARKS",
  ]);
  ws.mergeCells(`A${r9.number}:D${r9.number}`);
  ws.mergeCells(`E${r9.number}:H${r9.number}`);
  ws.mergeCells(`I${r9.number}:J${r9.number}`);
  r9.height = 20;
  r9.eachCell((cell) => {
    cell.font = headerFont;
    cell.alignment = centerAlign;
    cell.border = thinBorder;
  });

  // ── Row: Column headers
  const r10 = ws.addRow([
    "General Description and Objective of the Project to be Procured",
    "Type of the Project to be Procured (whether Goods, Infrastructure and Consulting Services)",
    "Quantity and Size of the Project to be Procured",
    "Recommended Mode of Procurement",
    "Pre-Procurement Conference, if applicable (Yes/No)",
    "Start of Procurement Activity",
    "End of Procurement Activity",
    "Expected Delivery/ Implementation Period",
    "Source of Funds",
    "Estimated Budget / Authorized Budgetary Allocation (PhP)",
    "Attached Supporting Document/s",
    "Remarks",
  ]);
  r10.height = 50;
  r10.eachCell((cell) => {
    cell.font = headerFont;
    cell.alignment = centerAlign;
    cell.border = thinBorder;
  });

  // ── Row: Column numbers
  const r11 = ws.addRow([
    "Column 1",
    "Column 2",
    "Column 3",
    "Column 4",
    "Column 5",
    "Column 6",
    "Column 7",
    "Column 8",
    "Column 9",
    "Column 10",
    "Column 11",
    "Column 12",
  ]);
  r11.height = 14;
  r11.eachCell((cell) => {
    cell.font = headerFont;
    cell.alignment = centerAlign;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "f2f2f2" },
    };
    cell.border = thinBorder;
  });

  // ── Data rows
  let grandTotal = 0;
  ppmp.projects.forEach((project, pIndex) => {
    const lots =
      project.lots.length > 0
        ? project.lots
        : [{ id: 0, lot_no: "", quantity_size: "", estimated_budget: 0 }];
    const bgColor = pIndex % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

    lots.forEach((lot, lIndex) => {
      grandTotal += lot.estimated_budget || 0;
      const rowData = [
        lIndex === 0 ? project.description : "",
        lIndex === 0 ? project.project_type : "",
        lots.length > 1
          ? `${lot.lot_no}: ${lot.quantity_size}`
          : lot.quantity_size,
        lIndex === 0 ? project.procurement_mode || "" : "",
        lIndex === 0 ? project.pre_proc_conference : "",
        lIndex === 0 ? project.start_activity || "" : "",
        lIndex === 0 ? project.end_activity || "" : "",
        lIndex === 0 ? project.delivery_period || "" : "",
        lIndex === 0 ? project.source_of_funds : "",
        lot.estimated_budget || "",
        lIndex === 0 ? project.supporting_docs || "" : "",
        lIndex === 0 ? project.remarks || "" : "",
      ];

      const dr = ws.addRow(rowData);
      dr.height = 40;
      dr.eachCell((cell, colNumber) => {
        cell.font = dataFont;
        cell.border = thinBorder;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        if (colNumber === 10) {
          cell.alignment = rightAlign;
          if (cell.value) cell.numFmt = "₱#,##0.00";
        } else if (colNumber === 2 || colNumber === 5) {
          cell.alignment = centerAlign;
        } else {
          cell.alignment = leftAlign;
        }
      });

      // Merge cells for multi-lot projects
      if (lots.length > 1 && lIndex === 0) {
        const startRow = dr.number;
        const endRow = startRow + lots.length - 1;
        [1, 2, 4, 5, 6, 7, 8, 9, 11, 12].forEach((col) => {
          const colLetter = String.fromCharCode(64 + col);
          ws.mergeCells(`${colLetter}${startRow}:${colLetter}${endRow}`);
        });
      }
    });
  });

  // ── Total row
  const totalRow = ws.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "TOTAL BUDGET:",
    "",
    grandTotal,
    "",
    "",
  ]);
  totalRow.height = 18;
  ws.mergeCells(`H${totalRow.number}:I${totalRow.number}`);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Calibri", bold: true, size: 9 };
    if (colNumber === 8) {
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.border = thinBorder;
    } else if (colNumber === 10) {
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.numFmt = "₱#,##0.00";
      cell.border = thinBorder;
    } else if (colNumber === 11 || colNumber === 12) {
      cell.border = thinBorder;
    }
    // cols 1-7 no border intentionally
  });

  // ── Empty row
  ws.addRow([]);

  // ── Signature block
  const sig1 = ws.addRow([
    "Prepared by:",
    "",
    "",
    "",
    "Submitted by:",
    "",
    "",
    "",
    "Approved by:",
    "",
    "",
    "",
  ]);
  ws.mergeCells(`A${sig1.number}:D${sig1.number}`);
  ws.mergeCells(`E${sig1.number}:H${sig1.number}`);
  ws.mergeCells(`I${sig1.number}:L${sig1.number}`);
  [1, 5, 9].forEach((c) => {
    sig1.getCell(c).font = { name: "Calibri", bold: true, size: 9 };
    sig1.getCell(c).alignment = { horizontal: "left", vertical: "bottom" };
  });

  ws.addRow([]);
  ws.addRow([]);

  const sig2 = ws.addRow([
    "________________________________",
    "",
    "",
    "",
    "________________________________",
    "",
    "",
    "",
    "________________________________",
    "",
    "",
    "",
  ]);
  ws.mergeCells(`A${sig2.number}:D${sig2.number}`);
  ws.mergeCells(`E${sig2.number}:H${sig2.number}`);
  ws.mergeCells(`I${sig2.number}:L${sig2.number}`);
  [1, 5, 9].forEach((c) => {
    sig2.getCell(c).font = { name: "Calibri", size: 9 };
    sig2.getCell(c).alignment = { horizontal: "left", vertical: "bottom" };
  });

  const sig3 = ws.addRow([
    "Signature over Printed Name",
    "",
    "",
    "",
    "Signature over Printed Name",
    "",
    "",
    "",
    "Signature over Printed Name",
    "",
    "",
    "",
  ]);
  ws.mergeCells(`A${sig3.number}:D${sig3.number}`);
  ws.mergeCells(`E${sig3.number}:H${sig3.number}`);
  ws.mergeCells(`I${sig3.number}:L${sig3.number}`);
  [1, 5, 9].forEach((c) => {
    sig3.getCell(c).font = { name: "Calibri", size: 8 };
    sig3.getCell(c).alignment = { horizontal: "left", vertical: "top" };
  });

  const sig4 = ws.addRow([
    "Position/Designation",
    "",
    "",
    "",
    "Position/Designation",
    "",
    "",
    "",
    "Position/Designation",
    "",
    "",
    "",
  ]);
  ws.mergeCells(`A${sig4.number}:D${sig4.number}`);
  ws.mergeCells(`E${sig4.number}:H${sig4.number}`);
  ws.mergeCells(`I${sig4.number}:L${sig4.number}`);
  [1, 5, 9].forEach((c) => {
    sig4.getCell(c).font = { name: "Calibri", size: 8 };
    sig4.getCell(c).alignment = { horizontal: "left", vertical: "top" };
  });

  const sig5 = ws.addRow([
    "Date: _________________",
    "",
    "",
    "",
    "Date: _________________",
    "",
    "",
    "",
    "Date: _________________",
    "",
    "",
    "",
  ]);
  ws.mergeCells(`A${sig5.number}:D${sig5.number}`);
  ws.mergeCells(`E${sig5.number}:H${sig5.number}`);
  ws.mergeCells(`I${sig5.number}:L${sig5.number}`);
  [1, 5, 9].forEach((c) => {
    sig5.getCell(c).font = { name: "Calibri", size: 8 };
    sig5.getCell(c).alignment = { horizontal: "left", vertical: "top" };
  });

  // ── Save file
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `PPMP_${office.name}_FY${ppmp.year}_No${ppmp.ppmp_no}.xlsx`);
}
