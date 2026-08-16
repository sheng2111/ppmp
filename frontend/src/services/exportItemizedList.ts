import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ItemizedItem,
  ItemizedListReport,
  ProcurementCodeGroup,
} from "./reports";

// A single numbered row within a group — "No." is a running counter across
// the WHOLE report, not restarted per group (see buildNumberedGroups).
export interface NumberedItem {
  no: number;
  item: ItemizedItem;
}

// A Procurement Code group augmented with its numbered rows.
export interface NumberedGroup extends ProcurementCodeGroup {
  numberedItems: NumberedItem[];
}

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

// Zero reads as "nothing entered" and renders as an em dash everywhere.
const DASH = "—";
const qtyOrDash = (n: number): string | number => (n === 0 ? DASH : n);

const prStatusText = (item: ItemizedItem) =>
  item.is_pr_requested
    ? `Already PR'd (${item.requested_quantity} of ${item.total_quantity})`
    : "";

const loadImageBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );
  } catch {
    return null;
  }
};

const TOTAL_COLS = 15; // No., Name, Unit, Qty, Unit Cost, Total Cost, Q1..Q4 (2 each), PR Status

// ── Excel export (ExcelJS) — letterhead header and signatory footer match
//    the APP/PPMP exports; the items sit in the GPPB itemized-list table.
export async function exportItemizedListToExcel(
  report: ItemizedListReport,
  numberedGroups: NumberedGroup[],
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Itemized List", {
    pageSetup: {
      paperSize: 5, // Legal — matches the APP/PPMP exports and print CSS
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
    { width: 6 }, // 1  - No.
    { width: 34 }, // 2  - Name of Item
    { width: 10 }, // 3  - Unit
    { width: 10 }, // 4  - Quantity
    { width: 12 }, // 5  - Unit Cost
    { width: 14 }, // 6  - Total Cost
    { width: 8 }, // 7  - Q1 Qty
    { width: 12 }, // 8  - Q1 Amount
    { width: 8 }, // 9  - Q2 Qty
    { width: 12 }, // 10 - Q2 Amount
    { width: 8 }, // 11 - Q3 Qty
    { width: 12 }, // 12 - Q3 Amount
    { width: 8 }, // 13 - Q4 Qty
    { width: 12 }, // 14 - Q4 Amount
    { width: 26 }, // 15 - PR Status
  ];

  const headerFont = { name: "Calibri", bold: true, size: 8 };
  const boldFont = { name: "Calibri", bold: true, size: 8 };
  const dataFont = { name: "Calibri", size: 8 };
  const bannerFont = { name: "Calibri", bold: true, size: 9 };
  const centerAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  const leftMiddleAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  const rightAlign: Partial<ExcelJS.Alignment> = {
    horizontal: "right",
    vertical: "middle",
    wrapText: true,
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  const codeFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEAF1D9" },
  };
  const subtotalFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };
  const grandTotalFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF08A" },
  };

  // ── Images for the letterhead and footer, matching the PPMP export:
  //    NEMSU logo + text lines on top, contact info + accreditation logos
  //    at the bottom.
  const [logoImageId, pinImageId, alpasImageId, ukasImageId, bagongImageId] =
    await Promise.all(
      [
        "/nemsu-logo.png",
        "/logo-transparent.png",
        "/alpas-logo.png",
        "/ukas-logo.png",
        "/bagong-pilipinas-logo.png",
      ].map(async (url) => {
        const base64 = await loadImageBase64(url);
        return base64 === null ? null : wb.addImage({ base64, extension: "png" });
      }),
    );

  // ── Letterhead — matches the PPMP detail page layout: NEMSU logo
  //    centered, then "Republic of the Philippines" / "NORTH EASTERN
  //    MINDANAO STATE UNIVERSITY" / the itemized-list title as separate
  //    centered lines.
  const PX_PER_COL_UNIT = 12;
  const EMU_PER_PIXEL = 9525;
  const lastColLetter = String.fromCharCode(64 + TOTAL_COLS);
  const colWidthsPx = ws.columns.map((c) =>
    Math.round(((c as any).width || 8.43) * PX_PER_COL_UNIT),
  );
  const sheetWidthPx = colWidthsPx.reduce((a, b) => a + b, 0);

  if (logoImageId !== null) {
    const logoRow = ws.addRow([""]);
    ws.mergeCells(`A${logoRow.number}:${lastColLetter}${logoRow.number}`);
    logoRow.height = 90;

    const LOGO_WIDTH = 89; // 233x235 source → near-square, ~90px tall
    const LOGO_HEIGHT = 90;
    const leftOffsetPx = Math.max(0, (sheetWidthPx - LOGO_WIDTH) / 2);

    let remaining = leftOffsetPx;
    let colIndex = 0;
    for (; colIndex < colWidthsPx.length - 1; colIndex++) {
      if (remaining < colWidthsPx[colIndex]) break;
      remaining -= colWidthsPx[colIndex];
    }

    const logoPosition: any = {
      tl: {
        col: colIndex,
        colOff: Math.round(remaining * EMU_PER_PIXEL),
        row: logoRow.number - 1,
        rowOff: 0,
      },
      ext: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
    };
    ws.addImage(logoImageId, logoPosition);
  }

  const republicRow = ws.addRow(["Republic of the Philippines"]);
  ws.mergeCells(`A${republicRow.number}:${lastColLetter}${republicRow.number}`);
  republicRow.getCell(1).font = { name: "Calibri", size: 10 };
  republicRow.getCell(1).alignment = centerAlign;
  republicRow.height = 14;

  const nemsuRow = ws.addRow(["NORTH EASTERN MINDANAO STATE UNIVERSITY"]);
  ws.mergeCells(`A${nemsuRow.number}:${lastColLetter}${nemsuRow.number}`);
  nemsuRow.getCell(1).font = { name: "Calibri", bold: true, size: 12 };
  nemsuRow.getCell(1).alignment = centerAlign;
  nemsuRow.height = 16;

  // ── Title (directly under the letterhead lines, matching the JSX)
  const titleRow = ws.addRow([
    `ITEMIZED PROCUREMENT LIST FOR FY ${report.fiscal_year}`,
  ]);
  ws.mergeCells(`A${titleRow.number}:${lastColLetter}${titleRow.number}`);
  titleRow.getCell(1).font = { name: "Calibri", bold: true, size: 13 };
  titleRow.getCell(1).alignment = centerAlign;
  titleRow.height = 18;

  // ── Indicative / Final
  const type = report.ppmp_type;
  const checkRow = ws.addRow([
    `${type === "indicative" ? "[✔]" : "[ ]"} INDICATIVE          ${type === "final" ? "[✔]" : "[ ]"} FINAL`,
  ]);
  ws.mergeCells(`A${checkRow.number}:${String.fromCharCode(64 + TOTAL_COLS)}${checkRow.number}`);
  checkRow.getCell(1).font = { name: "Calibri", size: 9 };
  checkRow.getCell(1).alignment = centerAlign;
  checkRow.height = 14;

  // ── End-User or Implementing Unit
  const officeRow = ws.addRow([
    `End-User or Implementing Unit: ${report.office || "All Offices"}`,
  ]);
  ws.mergeCells(`A${officeRow.number}:${String.fromCharCode(64 + TOTAL_COLS)}${officeRow.number}`);
  officeRow.getCell(1).font = { name: "Calibri", bold: true, size: 10 };
  officeRow.getCell(1).alignment = centerAlign;
  officeRow.height = 14;

  ws.addRow([]);

  // ── Table header — two rows: the base columns span both rows, while each
  //    quarter spans two sub-columns (Qty / Amount).
  const h1 = ws.addRow([
    "No.",
    "Name of Item",
    "Unit",
    "Quantity",
    "Unit Cost",
    "Total Cost",
    "Q1",
    "",
    "Q2",
    "",
    "Q3",
    "",
    "Q4",
    "",
    "PR Status",
  ]);
  const h2 = ws.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "Qty",
    "Amount",
    "Qty",
    "Amount",
    "Qty",
    "Amount",
    "Qty",
    "Amount",
    "",
  ]);
  h1.height = 18;
  h2.height = 14;

  // No./Name/Unit/Qty/Unit Cost/Total Cost/PR Status span both header rows
  [1, 2, 3, 4, 5, 6, 15].forEach((c) =>
    ws.mergeCells(h1.number, c, h2.number, c),
  );
  // Q1..Q4 each span their Qty + Amount columns in the top header row
  [7, 9, 11, 13].forEach((c) => ws.mergeCells(h1.number, c, h1.number, c + 1));

  [h1, h2].forEach((row) => {
    row.eachCell((cell) => {
      cell.font = headerFont;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
    });
  });

  // ── Groups → items → subtotal, then a single grand-total row
  numberedGroups.forEach((group) => {
    const codeRow = ws.addRow([group.code]);
    ws.mergeCells(`A${codeRow.number}:${String.fromCharCode(64 + TOTAL_COLS)}${codeRow.number}`);
    const codeCell = codeRow.getCell(1);
    codeCell.font = bannerFont;
    codeCell.alignment = leftMiddleAlign;
    codeCell.fill = codeFill;
    codeCell.border = thinBorder;
    codeRow.height = 16;

    group.numberedItems.forEach(({ no, item }) => {
      const r = ws.addRow([
        no,
        item.item_name,
        item.unit,
        qtyOrDash(item.total_quantity),
        qtyOrDash(item.unit_price),
        qtyOrDash(item.total_cost),
        qtyOrDash(item.q1_qty),
        qtyOrDash(item.q1_amount),
        qtyOrDash(item.q2_qty),
        qtyOrDash(item.q2_amount),
        qtyOrDash(item.q3_qty),
        qtyOrDash(item.q3_amount),
        qtyOrDash(item.q4_qty),
        qtyOrDash(item.q4_amount),
        prStatusText(item),
      ]);
      r.height = 16;
      r.eachCell((cell, col) => {
        const isAmount = [5, 6, 8, 10, 12, 14].includes(col);
        cell.font = item.is_pr_requested
          ? { name: "Calibri", size: 8, color: { argb: "FFDC2626" } }
          : dataFont;
        cell.border = thinBorder;
        cell.alignment =
          col === 1
            ? centerAlign
            : col === 2 || col === 15
              ? leftMiddleAlign
              : rightAlign;
        if (isAmount && typeof cell.value === "number") {
          cell.numFmt = "₱#,##0.00";
        }
      });
    });

    const subRow = ws.addRow([
      "",
      `Subtotal — ${group.code}`,
      "",
      qtyOrDash(group.subtotal_quantity),
      "",
      qtyOrDash(group.subtotal_cost),
      qtyOrDash(group.q1_subtotal_qty),
      qtyOrDash(group.q1_subtotal_amount),
      qtyOrDash(group.q2_subtotal_qty),
      qtyOrDash(group.q2_subtotal_amount),
      qtyOrDash(group.q3_subtotal_qty),
      qtyOrDash(group.q3_subtotal_amount),
      qtyOrDash(group.q4_subtotal_qty),
      qtyOrDash(group.q4_subtotal_amount),
      "",
    ]);
    subRow.height = 16;
    subRow.eachCell((cell, col) => {
      cell.font = boldFont;
      cell.border = thinBorder;
      cell.fill = subtotalFill;
      const isAmount = [5, 6, 8, 10, 12, 14].includes(col);
      cell.alignment =
        col === 2
          ? leftMiddleAlign
          : isAmount || col >= 4
            ? rightAlign
            : centerAlign;
      if (isAmount && typeof cell.value === "number") {
        cell.numFmt = "₱#,##0.00";
      }
    });
  });

  const totalRow = ws.addRow([
    "",
    "GRAND TOTAL",
    "",
    qtyOrDash(report.grand_total_quantity),
    "",
    qtyOrDash(report.grand_total_cost),
    qtyOrDash(report.q1_grand_qty),
    qtyOrDash(report.q1_grand_amount),
    qtyOrDash(report.q2_grand_qty),
    qtyOrDash(report.q2_grand_amount),
    qtyOrDash(report.q3_grand_qty),
    qtyOrDash(report.q3_grand_amount),
    qtyOrDash(report.q4_grand_qty),
    qtyOrDash(report.q4_grand_amount),
    "",
  ]);
  totalRow.height = 18;
  totalRow.eachCell((cell, col) => {
    cell.font = boldFont;
    cell.border = thinBorder;
    cell.fill = grandTotalFill;
    const isAmount = [5, 6, 8, 10, 12, 14].includes(col);
    cell.alignment =
      col === 2
        ? leftMiddleAlign
        : isAmount || col >= 4
          ? rightAlign
          : centerAlign;
    if (isAmount && typeof cell.value === "number") {
      cell.numFmt = "₱#,##0.00";
    }
  });

  // ── Signatories — no configured signatories for an itemized list, so a
  //    fixed Prepared/Submitted/Approved set with blank lines.
  ws.addRow([]);

  const sigBlocks = [
    { label: "Prepared by:", startCol: 1, endCol: 5 },
    { label: "Submitted by:", startCol: 6, endCol: 10 },
    { label: "Approved by:", startCol: 11, endCol: 15 },
  ];

  const sigLabelFont = { name: "Calibri", bold: true, size: 9 };
  const sigNameFont = { name: "Calibri", bold: true, size: 9, underline: true };
  const sigSmallFont = { name: "Calibri", size: 8 };

  const labelRow = ws.addRow([]);
  labelRow.height = 14;
  ws.addRow([]).height = 18;
  const nameRow = ws.addRow([]);
  const posRow = ws.addRow([]);
  const dateRow = ws.addRow([]);

  sigBlocks.forEach((block) => {
    const endLetter = String.fromCharCode(64 + block.endCol);
    ws.mergeCells(
      `${String.fromCharCode(64 + block.startCol)}${labelRow.number}:${endLetter}${labelRow.number}`,
    );
    ws.mergeCells(
      `${String.fromCharCode(64 + block.startCol)}${nameRow.number}:${endLetter}${nameRow.number}`,
    );
    ws.mergeCells(
      `${String.fromCharCode(64 + block.startCol)}${posRow.number}:${endLetter}${posRow.number}`,
    );
    ws.mergeCells(
      `${String.fromCharCode(64 + block.startCol)}${dateRow.number}:${endLetter}${dateRow.number}`,
    );

    const lCell = labelRow.getCell(block.startCol);
    lCell.value = block.label;
    lCell.font = sigLabelFont;
    lCell.alignment = { horizontal: "left", vertical: "bottom" };

    const nCell = nameRow.getCell(block.startCol);
    nCell.value = "_________________________";
    nCell.font = sigNameFont;
    nCell.alignment = { horizontal: "left", vertical: "bottom" };

    const pCell = posRow.getCell(block.startCol);
    pCell.value = "Position/Designation";
    pCell.font = sigSmallFont;
    pCell.alignment = { horizontal: "left", vertical: "top" };

    const dCell = dateRow.getCell(block.startCol);
    dCell.value = "Date: _________________";
    dCell.font = sigSmallFont;
    dCell.alignment = { horizontal: "left", vertical: "top" };
  });

  // ── Footer — matches the PPMP detail page footer: contact info on the
  //    left, accreditation logos + "Page 1" on the right.
  ws.addRow([]).height = 8;
  const footerRow = ws.addRow([]);
  footerRow.height = 62;

  ws.mergeCells(`A${footerRow.number}:H${footerRow.number}`);
  const contactCell = footerRow.getCell(1);
  contactCell.value =
    "Tagbina, Surigao del Sur 8308\n\u260E\uFE0E 086-628-0714\n\ud83c\udf10\uFE0E www.nemsu.edu.ph";
  contactCell.font = { name: "Calibri", size: 8 };
  contactCell.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
    indent: 1,
  };

  const footerImagePosition = (
    col: number,
    colOff: number,
    rowOff: number,
    width: number,
    height: number,
  ): any => ({
    tl: {
      col,
      colOff,
      row: footerRow.number - 1,
      rowOff,
    },
    ext: { width, height },
  });

  if (pinImageId !== null) {
    ws.addImage(pinImageId, footerImagePosition(0, 0, 0, 14, 14));
  }
  if (alpasImageId !== null) {
    ws.addImage(alpasImageId, footerImagePosition(8, 0, 4, 55, 55));
  }
  if (ukasImageId !== null) {
    ws.addImage(ukasImageId, footerImagePosition(9, 2, 13, 60, 37));
  }
  if (bagongImageId !== null) {
    ws.addImage(bagongImageId, footerImagePosition(10, 2, 6, 48, 50));
  }

  const pageCell = footerRow.getCell(15);
  pageCell.value = "Page 1";
  pageCell.font = { name: "Calibri", size: 9 };
  pageCell.alignment = { horizontal: "right", vertical: "bottom" };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(
    blob,
    `Itemized_Procurement_List_FY${report.fiscal_year}.xlsx`,
  );
}

// ── PDF export (jsPDF + autoTable) — letterhead header + signatory footer
//    match the APP/PPMP exports; the items sit in the same GPPB table.
export async function exportItemizedListToPDF(
  report: ItemizedListReport,
  numberedGroups: NumberedGroup[],
) {
  const doc = new jsPDF({ orientation: "landscape", format: "legal" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Letterhead — matches the PPMP detail page layout: NEMSU logo
  //    centered, then "Republic of the Philippines" / "NORTH EASTERN
  //    MINDANAO STATE UNIVERSITY" / the itemized-list title.
  const [logo, pinImg, alpasImg, ukasImg, bagongImg] = await Promise.all([
    loadImage("/nemsu-logo.png"),
    loadImage("/logo-transparent.png"),
    loadImage("/alpas-logo.png"),
    loadImage("/ukas-logo.png"),
    loadImage("/bagong-pilipinas-logo.png"),
  ]);
  let y = 8;
  if (logo) {
    const logoH = 22;
    const logoW = (logoH * logo.naturalWidth) / logo.naturalHeight;
    doc.addImage(logo, "PNG", (pageWidth - logoW) / 2, 6, logoW, logoH);
    y = 6 + logoH + 4;
  }

  doc.setFontSize(10);
  doc.text("Republic of the Philippines", pageWidth / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("NORTH EASTERN MINDANAO STATE UNIVERSITY", pageWidth / 2, y, {
    align: "center",
  });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(
    `ITEMIZED PROCUREMENT LIST FOR FY ${report.fiscal_year}`,
    pageWidth / 2,
    y,
    { align: "center" },
  );
  y += 7;

  const type = report.ppmp_type;
  doc.setFontSize(9);
  doc.text(
    `[${type === "indicative" ? "X" : " "}] INDICATIVE          [${type === "final" ? "X" : " "}] FINAL`,
    pageWidth / 2,
    y,
    { align: "center" },
  );
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `End-User or Implementing Unit: ${report.office || "All Offices"}`,
    pageWidth / 2,
    y,
    { align: "center" },
  );
  doc.setFont("helvetica", "normal");
  y += 8;

  const head = [
    [
      { content: "No.", rowSpan: 2 },
      { content: "Name of Item", rowSpan: 2 },
      { content: "Unit", rowSpan: 2 },
      { content: "Qty", rowSpan: 2 },
      { content: "Unit Cost", rowSpan: 2 },
      { content: "Total Cost", rowSpan: 2 },
      { content: "Q1", colSpan: 2 },
      { content: "Q2", colSpan: 2 },
      { content: "Q3", colSpan: 2 },
      { content: "Q4", colSpan: 2 },
    ],
    ["Qty", "Amount", "Qty", "Amount", "Qty", "Amount", "Qty", "Amount"],
  ];

  const body: any[] = [];
  numberedGroups.forEach((group) => {
    body.push([
      {
        content: group.code,
        colSpan: 14,
        styles: { fontStyle: "bold", fillColor: [224, 242, 254] },
      },
    ]);
    group.numberedItems.forEach(({ no, item }) => {
      const rawCells = [
        no,
        item.item_name,
        item.unit,
        qtyOrDash(item.total_quantity),
        item.unit_price === 0 ? DASH : fmt(item.unit_price),
        item.total_cost === 0 ? DASH : fmt(item.total_cost),
        qtyOrDash(item.q1_qty),
        item.q1_amount === 0 ? DASH : fmt(item.q1_amount),
        qtyOrDash(item.q2_qty),
        item.q2_amount === 0 ? DASH : fmt(item.q2_amount),
        qtyOrDash(item.q3_qty),
        item.q3_amount === 0 ? DASH : fmt(item.q3_amount),
        qtyOrDash(item.q4_qty),
        item.q4_amount === 0 ? DASH : fmt(item.q4_amount),
      ];
      body.push(
        item.is_pr_requested
          ? rawCells.map((content) => ({
              content,
              styles: { textColor: [220, 38, 38] },
            }))
          : rawCells,
      );
    });
    body.push([
      { content: "", styles: { fontStyle: "bold" } },
      {
        content: `Subtotal — ${group.code}`,
        styles: { fontStyle: "bold" },
      },
      "",
      {
        content: qtyOrDash(group.subtotal_quantity),
        styles: { fontStyle: "bold" },
      },
      "",
      {
        content: group.subtotal_cost === 0 ? DASH : fmt(group.subtotal_cost),
        styles: { fontStyle: "bold" },
      },
      qtyOrDash(group.q1_subtotal_qty),
      group.q1_subtotal_amount === 0 ? DASH : fmt(group.q1_subtotal_amount),
      qtyOrDash(group.q2_subtotal_qty),
      group.q2_subtotal_amount === 0 ? DASH : fmt(group.q2_subtotal_amount),
      qtyOrDash(group.q3_subtotal_qty),
      group.q3_subtotal_amount === 0 ? DASH : fmt(group.q3_subtotal_amount),
      qtyOrDash(group.q4_subtotal_qty),
      group.q4_subtotal_amount === 0 ? DASH : fmt(group.q4_subtotal_amount),
    ]);
  });

  body.push([
    { content: "", styles: { fontStyle: "bold" } },
    {
      content: "GRAND TOTAL",
      styles: { fontStyle: "bold", fillColor: [254, 240, 138] },
    },
    "",
    {
      content: qtyOrDash(report.grand_total_quantity),
      styles: { fontStyle: "bold", fillColor: [254, 240, 138] },
    },
    "",
    {
      content:
        report.grand_total_cost === 0 ? DASH : fmt(report.grand_total_cost),
      styles: { fontStyle: "bold", fillColor: [254, 240, 138] },
    },
    qtyOrDash(report.q1_grand_qty),
    report.q1_grand_amount === 0 ? DASH : fmt(report.q1_grand_amount),
    qtyOrDash(report.q2_grand_qty),
    report.q2_grand_amount === 0 ? DASH : fmt(report.q2_grand_amount),
    qtyOrDash(report.q3_grand_qty),
    report.q3_grand_amount === 0 ? DASH : fmt(report.q3_grand_amount),
    qtyOrDash(report.q4_grand_qty),
    report.q4_grand_amount === 0 ? DASH : fmt(report.q4_grand_amount),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      halign: "center",
    },
    columnStyles: { 1: { cellWidth: 45 } },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y;

  // ── Signatories — blank lines only (Prepared / Submitted / Approved).
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const usable = pageWidth - margin * 2;
  const blockWidth = usable / 3;

  let sy = finalY + 14;
  if (sy + 34 > pageHeight) {
    doc.addPage();
    sy = 14;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Prepared by:", margin, sy);
  doc.text("Submitted by:", margin + blockWidth, sy);
  doc.text("Approved by:", margin + blockWidth * 2, sy);

  const nameY = sy + 12;
  doc.setFontSize(9);
  doc.text("_________________________", margin, nameY);
  doc.text("_________________________", margin + blockWidth, nameY);
  doc.text("_________________________", margin + blockWidth * 2, nameY);

  const posY = nameY + 4;
  doc.setFont("helvetica", "normal");
  doc.text("Position/Designation", margin, posY);
  doc.text("Position/Designation", margin + blockWidth, posY);
  doc.text("Position/Designation", margin + blockWidth * 2, posY);

  const dateY = posY + 6;
  doc.text("Date: _________________", margin, dateY);
  doc.text("Date: _________________", margin + blockWidth, dateY);
  doc.text("Date: _________________", margin + blockWidth * 2, dateY);

  // ── Footer — matches the PPMP detail page footer: contact info on the
  //    left, accreditation logos + "Page 1" on the right.
  let fy = dateY + 9;
  if (fy + 26 > pageHeight) {
    doc.addPage();
    fy = 14;
  }

  if (pinImg) doc.addImage(pinImg, "PNG", margin, fy, 4, 4);
  doc.setFontSize(8);
  doc.text("Tagbina, Surigao del Sur 8308", margin + 5, fy + 3);
  doc.text("086-628-0714", margin + 5, fy + 7);
  doc.text("www.nemsu.edu.ph", margin + 5, fy + 11);

  const rightX = pageWidth - margin;
  if (alpasImg) doc.addImage(alpasImg, "PNG", rightX - 43, fy, 14.5, 14.5);
  if (ukasImg) doc.addImage(ukasImg, "PNG", rightX - 27, fy + 3, 13, 9.5);
  if (bagongImg)
    doc.addImage(bagongImg, "PNG", rightX - 12.5, fy + 1.5, 12.5, 13);
  doc.setFontSize(9);
  doc.text("Page 1", rightX, fy + 13, { align: "right" });

  doc.save(`Itemized_Procurement_List_FY${report.fiscal_year}.pdf`);
}

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
