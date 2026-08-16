import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Office } from "../types";

// Matches _enrich_pr's actual response shape — same types PRDetailPage.tsx
// uses. Keeping this file in sync with that shape is what makes the Excel
// export actually mirror what's on screen instead of drifting out of date.
interface PRItem {
  item_name: string;
  unit: string;
  unit_price: number;
  requested_quantity: number;
  total_cost: number;
}

interface PRLotGroup {
  label: string;
  items: PRItem[];
}

interface PR {
  id: string;
  pr_number: string | null;
  date: string;
  purpose: string | null;
  responsibility_center_code?: string | null; // not yet a real backend field — always blank until it is
  requested_by_name?: string | null;
  requested_by_designation?: string | null;
  approved_by_name?: string | null;
  approved_by_designation?: string | null;
  bac_secretariat_chairman_name?: string | null;
  bac_secretariat_chairman_designation?: string | null;
  budget_officer_name?: string | null;
  budget_officer_designation?: string | null;
  lots: PRLotGroup[];
  grand_total: number;
}

// Same helper as PRDetailPage.tsx — capitalizes only the first character so
// proper nouns inside the purpose text aren't forced to lowercase.
const toSentenceCase = (s: string) =>
  s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const FONT = "Times New Roman";
const THIN = { style: "thin" as const };

// Builds a per-cell border object for one row of the Requested by/Approved
// by signature block. Only the OUTSIDE of the whole two-column block should
// ever be drawn — no line down the center — so `left` only applies to
// column 1 and `right` only to column 6, regardless of which columns
// actually hold text.
function sigBorder(opts: {
  top?: boolean;
  bottom?: boolean;
  isLeftEdge?: boolean;
  isRightEdge?: boolean;
}): Partial<ExcelJS.Borders> {
  return {
    top: opts.top ? THIN : undefined,
    bottom: opts.bottom ? THIN : undefined,
    left: opts.isLeftEdge ? THIN : undefined,
    right: opts.isRightEdge ? THIN : undefined,
  };
}

function applySigRowBorders(
  row: ExcelJS.Row,
  opts: { top?: boolean; bottom?: boolean },
) {
  for (let col = 1; col <= 6; col++) {
    row.getCell(col).border = sigBorder({
      ...opts,
      isLeftEdge: col === 1,
      isRightEdge: col === 6,
    });
  }
}

// Border helper for the BAC Secretariat Chairman / Budget Officer boxes
// below. Unlike the signature block above, these ARE two fully separate,
// self-contained rectangles side by side (matching the reference stamps),
// so each half (cols 1-3, cols 4-6) gets its OWN left+right border, not
// just the outer edge of the combined width.
function applyTwinBoxBorders(
  row: ExcelJS.Row,
  opts: { top?: boolean; bottom?: boolean },
) {
  const base = (
    isLeft: boolean,
    isRight: boolean,
  ): Partial<ExcelJS.Borders> => ({
    top: opts.top ? THIN : undefined,
    bottom: opts.bottom ? THIN : undefined,
    left: isLeft ? THIN : undefined,
    right: isRight ? THIN : undefined,
  });
  row.getCell(1).border = base(true, false);
  row.getCell(2).border = base(false, false);
  row.getCell(3).border = base(false, true);
  row.getCell(4).border = base(true, false);
  row.getCell(5).border = base(false, false);
  row.getCell(6).border = base(false, true);
}

export async function exportPRToExcel(pr: PR, office: Office) {
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
    { width: 45 }, // Item Description
    { width: 10 }, // Quantity
    { width: 14 }, // Amount
    { width: 14 }, // Total Cost
  ];

  const bold9 = { name: FONT, bold: true, size: 9 };
  const reg9 = { name: FONT, size: 9 };
  const italic9 = { name: FONT, italic: true, size: 9 };
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

  // Appendix 60 — sits above the box, unbordered, same as the web version
  const r0 = ws.addRow(["", "", "", "", "", "Appendix 60"]);
  r0.getCell(6).font = { ...italic9 };
  r0.getCell(6).alignment = right;
  r0.height = 12;

  // Title
  const r1 = ws.addRow(["PURCHASE REQUEST"]);
  ws.mergeCells(`A${r1.number}:F${r1.number}`);
  r1.getCell(1).font = { name: FONT, bold: true, size: 15 };
  r1.getCell(1).alignment = center;
  r1.height = 20;

  // University + Fund Cluster — also unbordered, sits directly above the box
  const r2 = ws.addRow([
    "NORTH EASTERN MINDANAO STATE UNIVERSITY          Fund Cluster: ___________",
  ]);
  ws.mergeCells(`A${r2.number}:F${r2.number}`);
  r2.getCell(1).font = bold9;
  r2.height = 14;

  // ── From here down, everything is ONE continuous bordered box — no
  // blank unbordered rows are inserted between sections, matching the
  // web version's single <table>. ──

  // Department (A:B) / PR Number + Responsibility Center Code (C:D) / Date (E:F)
  const r3 = ws.addRow([
    "Department:",
    "",
    `PR Number: ${pr.pr_number || "___"}\nResponsibility Center Code: ${pr.responsibility_center_code || "___"}`,
    "",
    `Date: ${
      pr.date
        ? new Date(pr.date).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "___"
    }`,
    "",
  ]);
  ws.mergeCells(`A${r3.number}:B${r3.number}`);
  r3.getCell(1).font = reg9;
  r3.getCell(3).font = bold9;
  r3.getCell(5).font = bold9;
  r3.eachCell((cell) => {
    cell.border = { top: THIN, left: THIN, right: THIN };
    cell.alignment = { ...left, wrapText: true };
  });
  r3.height = 14;

  // Office name — its own row so it can be centered/italic under the
  // "Department:" label, the way PRDetailPage.tsx renders it on a second
  // line inside the same visual cell.
  const r3b = ws.addRow([office.name || "___"]);
  ws.mergeCells(`A${r3b.number}:B${r3b.number}`);
  r3b.getCell(1).font = { ...bold9, italic: true };
  r3b.getCell(1).alignment = center;
  r3b.getCell(1).border = { left: THIN, right: THIN, bottom: THIN };
  // Extend the C:D / E:F cells' border down to line up with the taller
  // department cell instead of leaving a gap.
  ws.mergeCells(`C${r3.number}:D${r3b.number}`);
  ws.mergeCells(`E${r3.number}:F${r3b.number}`);
  r3.getCell(3).alignment = { ...left, wrapText: true, vertical: "top" };
  r3.getCell(5).alignment = { ...left, wrapText: true, vertical: "top" };
  ws.getCell(`C${r3b.number}`).border = {
    left: THIN,
    right: THIN,
    bottom: THIN,
  };
  ws.getCell(`E${r3b.number}`).border = {
    left: THIN,
    right: THIN,
    bottom: THIN,
  };
  r3b.height = 14;

  // Table header — directly follows the department row, no gap
  const th = ws.addRow([
    "Stock/ Property No.",
    "Unit",
    "Item Description",
    "Quantity",
    "Amount",
    "Total Cost",
  ]);
  th.height = 24;
  th.eachCell((cell) => {
    cell.font = bold9;
    cell.alignment = center;
    cell.border = { top: THIN, left: THIN, right: THIN, bottom: THIN };
  });

  // Items — grouped by pr.lots, same as PRDetailPage.tsx. A LOT header row
  // only appears when there's more than one lot; a single-lot PR just
  // lists items flat. The label sits ONLY in column 3 (Item Description),
  // not merged across the row — matching PRDetailPage.tsx exactly.
  const showLotHeaders = pr.lots.length > 1;

  pr.lots.forEach((lot) => {
    if (showLotHeaders) {
      const lr = ws.addRow([
        "",
        "",
        lot.label.toUpperCase().startsWith("LOT")
          ? lot.label.toUpperCase()
          : `LOT ${lot.label.toUpperCase()}`,
        "",
        "",
        "",
      ]);
      lr.getCell(3).font = bold9;
      lr.getCell(3).alignment = left;
      lr.eachCell((cell) => (cell.border = { left: THIN, right: THIN }));
    }

    lot.items.forEach((item) => {
      const dr = ws.addRow([
        "", // no stock/property number field on the backend yet
        item.unit || "",
        item.item_name,
        item.requested_quantity || 0,
        item.unit_price || "",
        item.total_cost || 0,
      ]);
      dr.height = 22;
      dr.eachCell((cell, col) => {
        cell.font = reg9;
        cell.border = { left: THIN, right: THIN };
        if (col === 1 || col === 2 || col === 4) cell.alignment = center;
        else if (col === 5 || col === 6) {
          cell.alignment = right;
          if (cell.value) cell.numFmt = "#,##0.00";
        } else cell.alignment = left;
      });
    });
  });

  // Grand Total — read directly from pr.grand_total (backend-computed),
  // same as PRDetailPage.tsx, instead of re-summing client-side.
  const tr = ws.addRow(["", "", "", "", "Grand Total:", pr.grand_total]);
  ws.mergeCells(`A${tr.number}:D${tr.number}`);
  tr.getCell(5).font = bold9;
  tr.getCell(5).alignment = right;
  tr.getCell(6).font = bold9;
  tr.getCell(6).alignment = right;
  tr.getCell(6).numFmt = "₱#,##0.00";
  tr.eachCell((cell) => {
    cell.border = { top: THIN, left: THIN, right: THIN, bottom: THIN };
  });

  // Purpose — sentence-cased the same way PRDetailPage.tsx displays it —
  // directly follows Grand Total, no gap row.
  const purposeRow = ws.addRow([
    "Purpose:",
    pr.purpose ? toSentenceCase(pr.purpose) : "___",
  ]);
  ws.mergeCells(`B${purposeRow.number}:F${purposeRow.number}`);
  purposeRow.getCell(1).font = bold9;
  purposeRow.getCell(2).font = reg9;
  purposeRow.eachCell((cell) => {
    cell.border = { left: THIN, right: THIN, bottom: THIN };
    cell.alignment = { ...left, wrapText: true };
  });
  purposeRow.height = 26;

  // ── Signatures — directly follows Purpose, no gap row. Mirrors
  // PRDetailPage.tsx's sigStyle block: outer box only, no center divider
  // between "Requested by" and "Approved by", and no separate "Date:"
  // line since the current detail page doesn't have one either. ──
  const s1 = ws.addRow(["Requested by:", "", "", "Approved by:"]);
  ws.mergeCells(`A${s1.number}:C${s1.number}`);
  ws.mergeCells(`D${s1.number}:F${s1.number}`);
  s1.getCell(1).font = bold9;
  s1.getCell(4).font = bold9;
  applySigRowBorders(s1, { top: true });

  const spacer1 = ws.addRow([]);
  applySigRowBorders(spacer1, {});
  spacer1.height = 10;

  const spacer2 = ws.addRow([]);
  applySigRowBorders(spacer2, {});
  spacer2.height = 10;

  const s2 = ws.addRow(["Signature:", "", "", "Signature:"]);
  ws.mergeCells(`A${s2.number}:C${s2.number}`);
  ws.mergeCells(`D${s2.number}:F${s2.number}`);
  s2.getCell(1).font = reg9;
  s2.getCell(4).font = reg9;
  applySigRowBorders(s2, {});

  const s3 = ws.addRow([
    `${(pr.requested_by_name || "___").toUpperCase()}`,
    "",
    "",
    `${(pr.approved_by_name || "___").toUpperCase()}`,
  ]);
  ws.mergeCells(`A${s3.number}:C${s3.number}`);
  ws.mergeCells(`D${s3.number}:F${s3.number}`);
  s3.getCell(1).font = bold9;
  s3.getCell(4).font = bold9;
  s3.getCell(1).alignment = center;
  s3.getCell(4).alignment = center;
  applySigRowBorders(s3, {});

  const s4 = ws.addRow([
    `${pr.requested_by_designation || "___"}`,
    "",
    "",
    `${pr.approved_by_designation || "___"}`,
  ]);
  ws.mergeCells(`A${s4.number}:C${s4.number}`);
  ws.mergeCells(`D${s4.number}:F${s4.number}`);
  s4.getCell(1).font = italic9;
  s4.getCell(4).font = italic9;
  s4.getCell(1).alignment = center;
  s4.getCell(4).alignment = center;
  applySigRowBorders(s4, { bottom: true });

  // ── BAC Secretariat Chairman / Budget Officer — a visible gap row
  // first (matching "outside the table" on the web version), then two
  // fully separate boxes side by side: BAC Secretariat Chairman on the
  // left (A:C), Budget Officer under "Appropriation of Allotment" on the
  // right (D:F). Always shown, no threshold branch. ──
  const gap = ws.addRow([]);
  gap.height = 10;

  const e1 = ws.addRow(["", "", "", "APPROPRIATION OF ALLOTMENT"]);
  ws.mergeCells(`A${e1.number}:C${e1.number}`);
  ws.mergeCells(`D${e1.number}:F${e1.number}`);
  e1.getCell(4).font = bold9;
  e1.getCell(4).alignment = center;
  applyTwinBoxBorders(e1, { top: true });
  e1.height = 14;

  const spacer3 = ws.addRow([]);
  applyTwinBoxBorders(spacer3, {});
  spacer3.height = 16;

  const e2 = ws.addRow([
    (pr.bac_secretariat_chairman_name || "___").toUpperCase(),
    "",
    "",
    (pr.budget_officer_name || "___").toUpperCase(),
  ]);
  ws.mergeCells(`A${e2.number}:C${e2.number}`);
  ws.mergeCells(`D${e2.number}:F${e2.number}`);
  e2.getCell(1).font = bold9;
  e2.getCell(4).font = bold9;
  e2.getCell(1).alignment = center;
  e2.getCell(4).alignment = center;
  applyTwinBoxBorders(e2, {});

  const e3 = ws.addRow([
    pr.bac_secretariat_chairman_designation || "BAC Secretariat Chairman",
    "",
    "",
    pr.budget_officer_designation || "Designate, Budget Officer",
  ]);
  ws.mergeCells(`A${e3.number}:C${e3.number}`);
  ws.mergeCells(`D${e3.number}:F${e3.number}`);
  e3.getCell(1).font = reg9;
  e3.getCell(4).font = reg9;
  e3.getCell(1).alignment = center;
  e3.getCell(4).alignment = center;
  applyTwinBoxBorders(e3, {});

  const e4 = ws.addRow([
    "Date: ______________",
    "",
    "",
    "Date: ______________",
  ]);
  ws.mergeCells(`A${e4.number}:C${e4.number}`);
  ws.mergeCells(`D${e4.number}:F${e4.number}`);
  e4.getCell(1).font = reg9;
  e4.getCell(4).font = reg9;
  e4.getCell(1).alignment = left;
  e4.getCell(4).alignment = left;
  applyTwinBoxBorders(e4, { bottom: true });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `PR_${office.name}_${pr.pr_number || pr.id}.xlsx`);
}
