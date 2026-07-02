import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Office } from "../types";

export async function exportPRToExcel(pr: any, office: Office) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PR", {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
    },
  });

  ws.columns = [
    { width: 14 }, // Stock/Property No
    { width: 10 }, // Unit
    { width: 45 }, // Description
    { width: 10 }, // Quantity
    { width: 14 }, // Amount
    { width: 14 }, // Total Cost
  ];

  const thin: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  const bold9 = { name: "Calibri", bold: true, size: 9 };
  const reg9 = { name: "Calibri", size: 9 };
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

  // Appendix 60
  const r0 = ws.addRow(["", "", "", "", "", "Appendix 60"]);
  r0.getCell(6).font = reg9;
  r0.getCell(6).alignment = right;

  // Title
  const r1 = ws.addRow(["PURCHASE REQUEST"]);
  ws.mergeCells(`A${r1.number}:F${r1.number}`);
  r1.getCell(1).font = { name: "Calibri", bold: true, size: 14 };
  r1.getCell(1).alignment = center;
  r1.height = 20;

  // University + Fund Cluster
  const r2 = ws.addRow([
    `NORTH EASTERN MINDANAO STATE UNIVERSITY          Fund Cluster: ${pr.fund_cluster || "___________"}`,
  ]);
  ws.mergeCells(`A${r2.number}:F${r2.number}`);
  r2.getCell(1).font = bold9;

  // Department + PR Number + Date
  const r3 = ws.addRow([
    `Department: ${office.name}`,
    "",
    "",
    `PR Number: ${pr.pr_number || "___"}          Date: ${pr.requested_date ? new Date(pr.requested_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "___"}`,
  ]);
  ws.mergeCells(`A${r3.number}:C${r3.number}`);
  ws.mergeCells(`D${r3.number}:F${r3.number}`);
  r3.getCell(1).font = reg9;
  r3.getCell(4).font = reg9;

  // Responsibility code
  const r4 = ws.addRow([
    `Responsibility Center Code: ${pr.responsibility_center_code || "___________"}`,
  ]);
  ws.mergeCells(`A${r4.number}:F${r4.number}`);
  r4.getCell(1).font = reg9;

  ws.addRow([]);

  // Table header
  const th = ws.addRow([
    "Stock/ Property No.",
    "Unit",
    "Item Description",
    "Quantity",
    "Amount",
    "Total Cost",
  ]);
  th.height = 25;
  th.eachCell((cell) => {
    cell.font = bold9;
    cell.alignment = center;
    cell.border = thin;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
  });

  // Items
  let grandTotal = 0;
  pr.items.forEach((item: any) => {
    const isLotHeader = item.lot_label && !item.unit && item.quantity === 0;
    if (isLotHeader) {
      const lr = ws.addRow([item.item_description, "", "", "", "", "0"]);
      ws.mergeCells(`A${lr.number}:E${lr.number}`);
      lr.getCell(1).font = {
        name: "Calibri",
        bold: true,
        italic: true,
        size: 9,
      };
      lr.getCell(1).alignment = left;
      lr.getCell(1).border = thin;
      lr.getCell(6).border = thin;
      lr.getCell(6).alignment = right;
      lr.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFF6FF" },
      };
    } else {
      const total = item.quantity * item.unit_price;
      grandTotal += total;
      const dr = ws.addRow([
        item.stock_property_no || "",
        item.unit || "",
        item.item_description,
        item.quantity || 0,
        item.unit_price || "",
        total || 0,
      ]);
      dr.height = 30;
      dr.eachCell((cell, col) => {
        cell.font = reg9;
        cell.border = thin;
        if (col === 1 || col === 2 || col === 4) cell.alignment = center;
        else if (col === 5 || col === 6) {
          cell.alignment = right;
          if (cell.value) cell.numFmt = "#,##0.00";
        } else cell.alignment = left;
      });
    }
  });

  // Grand total
  const tr = ws.addRow(["", "", "", "Grand Total:", "", grandTotal]);
  ws.mergeCells(`A${tr.number}:C${tr.number}`);
  ws.mergeCells(`D${tr.number}:E${tr.number}`);
  tr.getCell(4).font = bold9;
  tr.getCell(4).alignment = right;
  tr.getCell(6).font = bold9;
  tr.getCell(6).alignment = right;
  tr.getCell(6).numFmt = "₱#,##0.00";
  tr.eachCell((cell) => {
    cell.border = thin;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF9C3" },
    };
  });

  ws.addRow([]);

  // Purpose
  const pr_row = ws.addRow([`Purpose: ${pr.purpose || "___"}`]);
  ws.mergeCells(`A${pr_row.number}:F${pr_row.number}`);
  pr_row.getCell(1).font = reg9;

  ws.addRow([]);

  // Signatures
  const s1 = ws.addRow(["Requested by:", "", "", "Approved by:"]);
  ws.mergeCells(`A${s1.number}:C${s1.number}`);
  ws.mergeCells(`D${s1.number}:F${s1.number}`);
  s1.getCell(1).font = bold9;
  s1.getCell(4).font = bold9;

  ws.addRow([]);
  ws.addRow([]);

  const s2 = ws.addRow([
    pr.requested_by_name || "___________________________",
    "",
    "",
    pr.approved_by_name || "___________________________",
  ]);
  ws.mergeCells(`A${s2.number}:C${s2.number}`);
  ws.mergeCells(`D${s2.number}:F${s2.number}`);
  s2.getCell(1).font = {
    name: "Calibri",
    bold: true,
    size: 9,
    underline: true,
  };
  s2.getCell(4).font = {
    name: "Calibri",
    bold: true,
    size: 9,
    underline: true,
  };

  const s3 = ws.addRow([
    pr.requested_by_designation || "Designation",
    "",
    "",
    pr.approved_by_designation || "Designation",
  ]);
  ws.mergeCells(`A${s3.number}:C${s3.number}`);
  ws.mergeCells(`D${s3.number}:F${s3.number}`);
  s3.getCell(1).font = reg9;
  s3.getCell(4).font = reg9;

  ws.addRow([]);
  const s4 = ws.addRow([
    "Date: _________________",
    "",
    "",
    "Date: _________________",
  ]);
  ws.mergeCells(`A${s4.number}:C${s4.number}`);
  ws.mergeCells(`D${s4.number}:F${s4.number}`);
  s4.getCell(1).font = reg9;
  s4.getCell(4).font = reg9;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `PR_${office.name}_${pr.pr_number || pr.id}.xlsx`);
}
