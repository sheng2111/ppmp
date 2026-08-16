import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { PPMP, Office } from "../types";

// Prepared by / Submitted by (fallback signatories) are stored and displayed
// in ALL CAPS, matching the Create PPMP form and PPMPDetailPage.
const toDisplayName = (value?: string | null) =>
  value ? value.toUpperCase() : "";

// Matches the `fmt` helper in PPMPDetailPage.tsx — used for the inline
// "(₱price/unit)" text inside each item's description.
const fmtNum = (n?: number) =>
  n
    ? n.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
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

const COLUMN_HEADERS = [
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
];
const TOTAL_COLS = COLUMN_HEADERS.length; // 12

// Same grouping used by PPMPDetailPage — up to 3 signatories per row, each
// getting a 4-column-wide block (A:D / E:H / I:L) so 3 fit across the sheet.
const SIGNATORIES_PER_ROW = 3;
const SIG_BLOCK_COLS = 3;

export async function exportPPMPToExcel(ppmp: PPMP, office: Office) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PPMP", {
    pageSetup: {
      paperSize: 5, // Legal — matches @page { size: legal landscape } in print CSS
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

  // Widths scaled from PPMPDetailPage's colgroup percentages
  // (16,7,14,9,5,6,6,7,6,8,9,7) so the export matches the on-screen
  // proportions instead of using its own separate ratios.
  ws.columns = [
    { width: 34 }, // 1 - Description (16%)
    { width: 15 }, // 2 - Type (7%)
    { width: 30 }, // 3 - Qty & Size (14%)
    { width: 19 }, // 4 - Mode (9%)
    { width: 11 }, // 5 - Pre-proc (5%)
    { width: 13 }, // 6 - Start (6%)
    { width: 13 }, // 7 - End (6%)
    { width: 15 }, // 8 - Delivery (7%)
    { width: 13 }, // 9 - Source (6%)
    { width: 17 }, // 10 - Budget (8%)
    { width: 19 }, // 11 - Docs (9%)
    { width: 15 }, // 12 - Remarks (7%)
  ];

  // ── Images for the letterhead and footer, matching PPMPDetailPage
  // (nemsu-logo.png + text lines on top, contact info + accreditation
  // logos at the bottom).
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

  const headerFont = { name: "Calibri", bold: true, size: 8 };
  const boldFont = { name: "Calibri", bold: true, size: 8 };
  const dataFont = { name: "Calibri", size: 8 };
  const bannerFont = { name: "Calibri", bold: true, size: 9 };
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
    wrapText: true,
  };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  const noBottomBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  const colNumberFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F2F2" },
  };
  const codeFill: ExcelJS.Fill = {
    // matches codeRowStyle backgroundColor: "#EAF1D9"
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEAF1D9" },
  };
  const subtotalFill: ExcelJS.Fill = {
    // matches subtotal label/value backgroundColor: "#D3D3D3"
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // ── Letterhead — matches PPMPDetailPage: NEMSU logo centered, then
  // "Republic of the Philippines" / "NORTH EASTERN MINDANAO STATE
  // UNIVERSITY" / the PPMP title as separate centered lines.
  const PX_PER_COL_UNIT = 12; // approximate Excel column-width→pixel ratio
  const EMU_PER_PIXEL = 9525;
  const colWidthsPx = ws.columns.map((c) =>
    Math.round(((c as any).width || 8.43) * PX_PER_COL_UNIT),
  );
  const sheetWidthPx = colWidthsPx.reduce((a, b) => a + b, 0);

  if (logoImageId !== null) {
    const logoRow = ws.addRow([""]);
    ws.mergeCells(`A${logoRow.number}:L${logoRow.number}`);
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
  ws.mergeCells(`A${republicRow.number}:L${republicRow.number}`);
  republicRow.getCell(1).font = { name: "Calibri", size: 10 };
  republicRow.getCell(1).alignment = centerAlign;
  republicRow.height = 14;

  const nemsuRow = ws.addRow(["NORTH EASTERN MINDANAO STATE UNIVERSITY"]);
  ws.mergeCells(`A${nemsuRow.number}:L${nemsuRow.number}`);
  nemsuRow.getCell(1).font = { name: "Calibri", bold: true, size: 12 };
  nemsuRow.getCell(1).alignment = centerAlign;
  nemsuRow.height = 16;

  // ── PPMP title (directly under the letterhead lines, matching the JSX
  // where both sit in the same centered cell)
  const titleRow = ws.addRow([
    `PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. ${ppmp.ppmp_no || "___"}`,
  ]);
  ws.mergeCells(`A${titleRow.number}:L${titleRow.number}`);
  titleRow.getCell(1).font = { name: "Calibri", bold: true, size: 13 };
  titleRow.getCell(1).alignment = centerAlign;
  titleRow.height = 18;

  // ── Indicative / Final
  const checkRow = ws.addRow([
    `${ppmp.ppmp_type === "indicative" ? "[✔]" : "[ ]"} INDICATIVE          ${ppmp.ppmp_type === "final" ? "[✔]" : "[ ]"} FINAL`,
  ]);
  ws.mergeCells(`A${checkRow.number}:L${checkRow.number}`);
  checkRow.getCell(1).font = { name: "Calibri", size: 9 };
  checkRow.getCell(1).alignment = centerAlign;
  checkRow.height = 14;

  // ── Fiscal Year / End-User — label sits in a fixed-width column (A:C)
  // and the value always starts in column D, so the two values line up
  // regardless of how long each label text is.
  ws.addRow([]);
  const fyRow = ws.addRow([]);
  ws.mergeCells(`A${fyRow.number}:C${fyRow.number}`);
  ws.mergeCells(`D${fyRow.number}:L${fyRow.number}`);
  fyRow.getCell(1).value = "Fiscal Year:";
  fyRow.getCell(1).font = { name: "Calibri", bold: true, size: 9 };
  fyRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  fyRow.getCell(2).value = ppmp.year;
  fyRow.getCell(2).font = { name: "Calibri", size: 9 };
  fyRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  fyRow.height = 10;

  const euRow = ws.addRow([]);
  ws.mergeCells(`A${euRow.number}:C${euRow.number}`);
  ws.mergeCells(`D${euRow.number}:L${euRow.number}`);
  euRow.getCell(1).value = "End-User or Implementing Unit:";
  euRow.getCell(1).font = { name: "Calibri", bold: true, size: 9 };
  euRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  euRow.getCell(2).value = office?.name || "___";
  euRow.getCell(2).font = { name: "Calibri", size: 9 };
  euRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  euRow.height = 10;

  ws.addRow([]);

  // ── Group header row (rowSpan for Docs/Remarks handled via vertical
  // merge with the column-header row below; no fill, matching thStyle
  // which sets no backgroundColor)
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

  // ── Column header row (only 10 values — cols 11/12 are the rowSpan
  // merge continuing from r9)
  const r10 = ws.addRow(COLUMN_HEADERS.slice(0, 10));
  r10.height = 68;
  ws.mergeCells(`K${r9.number}:K${r10.number}`);
  ws.mergeCells(`L${r9.number}:L${r10.number}`);

  [r9, r10].forEach((row) => {
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      cell.font = headerFont;
      cell.alignment = centerAlign;
      cell.border = thinBorder;
    }
  });

  // ── Column number row — this is the only one of the three header rows
  // with a fill (#f2f2f2), matching the JSX exactly
  const r11 = ws.addRow(
    Array.from({ length: 12 }, (_, i) => `Column ${i + 1}`),
  );
  r11.height = 14;
  r11.eachCell((cell) => {
    cell.font = headerFont;
    cell.alignment = centerAlign;
    cell.fill = colNumberFill;
    cell.border = thinBorder;
  });

  // ── Short Description — PPMP-level, shown once, green banner
  const shortDescription = (ppmp as any).description || "";
  if (shortDescription.trim()) {
    const row = ws.addRow([shortDescription]);
    ws.mergeCells(`A${row.number}:L${row.number}`);
    const cell = row.getCell(1);
    cell.font = { name: "Calibri", size: 9 };
    cell.alignment = leftAlign;
    cell.fill = codeFill;
    cell.border = thinBorder;
    row.height = 18;
  }

  // ── Additional Description — PPMP-level, shown once, white banner
  const additionalDescription = (ppmp as any).additional_description || "";
  if (additionalDescription.trim()) {
    const row = ws.addRow([additionalDescription]);
    ws.mergeCells(`A${row.number}:L${row.number}`);
    const cell = row.getCell(1);
    cell.font = { name: "Calibri", size: 9 };
    cell.alignment = leftAlign;
    cell.border = thinBorder;
    row.height = 18;
  }

  // ── Projects → entries. Each entry is ONE row — every item belonging to
  // that entry is combined into the Qty & Size column (column 3), each on
  // its own line, rather than being split across separate rows.
  let grandTotal = 0;

  (ppmp.projects ?? []).forEach((project: any, pIndex: number) => {
    const entries =
      (project.entries ?? []).length > 0
        ? project.entries
        : [
            {
              id: `${pIndex}-empty`,
              category_description: "",
              description: "",
              project_type: "",
              procurement_mode: "",
              pre_proc_conference: "",
              start_activity: "",
              end_activity: "",
              delivery_period: "",
              source_of_funds: "",
              items: [],
            },
          ];

    const projectSubtotal = entries.reduce(
      (es: number, e: any) =>
        es +
        (e.items ?? []).reduce(
          (is: number, it: any) =>
            is + (it.quantity || 0) * (it.unit_price || 0),
          0,
        ),
      0,
    );
    grandTotal += projectSubtotal;

    const rowBg: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: pIndex % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB" },
    };

    // Code is project-level and shared by all entries under it, so one
    // banner prints per distinct code, with every entry that uses it
    // beneath (legacy PPMPs may carry different codes per entry).
    const entryGroups = entries.reduce(
      (acc: Map<string, any[]>, e: any) => {
        const code = e.category_description || "";
        if (!acc.has(code)) acc.set(code, []);
        acc.get(code)!.push(e);
        return acc;
      },
      new Map<string, any[]>(),
    );

    const renderEntryRow = (entry: any) => {
      const items = entry.items ?? [];
      const entryAmount = items.reduce(
        (sum: number, it: any) =>
          sum + (it.quantity || 0) * (it.unit_price || 0),
        0,
      );

      // ── Single row for the whole entry
      const row = ws.addRow([
        entry.description || "",
        entry.project_type || "",
        "", // set below as combined rich text
        entry.procurement_mode || "",
        entry.pre_proc_conference || "",
        entry.start_activity || "",
        entry.end_activity || "",
        entry.delivery_period || "",
        entry.source_of_funds || "",
        entryAmount || "",
        project.supporting_docs || "",
        project.remarks || "",
      ]);
      // Grow the row to fit however many items are stacked in column 3
      row.height = Math.max(30, items.length * 26);

      // Column 3 — every item in this entry, each as bold "[qty unit] " +
      // plain item name/price, stacked on its own line within the cell
      if (items.length > 0) {
        const richText: { font: any; text: string }[] = [];
        items.forEach((item: any, iIndex: number) => {
          if (!item.item_name) return;
          const qty = item.quantity || 0;
          const unit = item.unit || "";
          const price = item.unit_price || 0;
          const priceText = price
            ? ` (₱${fmtNum(price)}/${unit || "unit"})`
            : "";
          if (iIndex > 0) richText.push({ font: dataFont, text: "\n" });
          richText.push({
            font: { name: "Calibri", bold: true, size: 8 },
            text: `[${qty} ${unit}] `,
          });
          richText.push({
            font: dataFont,
            text: `${item.item_name}${priceText}`,
          });
        });
        if (richText.length > 0) {
          row.getCell(3).value = { richText };
        }
      }

      row.eachCell((cell, colNumber) => {
        cell.font = colNumber === 1 ? boldFont : dataFont;
        cell.border =
          colNumber === 11 || colNumber === 12 ? noBottomBorder : thinBorder;
        cell.fill = rowBg;

        if ([2, 5, 6, 7, 8, 9].includes(colNumber)) {
          cell.alignment = centerAlign;
        } else if (colNumber === 10) {
          cell.alignment = rightAlign;
          cell.font = boldFont;
          if (cell.value) cell.numFmt = "₱#,##0.00";
        } else {
          cell.alignment = leftAlign;
        }
      });
    };

    entryGroups.forEach((list, code) => {
      if (code) {
        // Code banner row — project-level, green fill, bold, prints once
        const codeRow = ws.addRow([code]);
        ws.mergeCells(`A${codeRow.number}:L${codeRow.number}`);
        const codeCell = codeRow.getCell(1);
        codeCell.font = bannerFont;
        codeCell.alignment = leftAlign;
        codeCell.fill = codeFill;
        codeCell.border = thinBorder;
        codeRow.height = 16;
      }
      list.forEach(renderEntryRow);
    });

    // ── Per-project subtotal row
    const subRow = ws.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      projectSubtotal,
      "",
      "",
    ]);
    subRow.height = 16;
    ws.mergeCells(`A${subRow.number}:I${subRow.number}`);
    const labelCell = subRow.getCell(1);
    labelCell.value = "Sub-Total:";
    labelCell.font = boldFont;
    labelCell.alignment = rightAlign;
    labelCell.fill = subtotalFill;
    labelCell.border = thinBorder;

    const valueCell = subRow.getCell(10);
    valueCell.font = boldFont;
    valueCell.alignment = rightAlign;
    valueCell.fill = subtotalFill;
    valueCell.numFmt = "₱#,##0.00";
    valueCell.border = thinBorder;

    subRow.getCell(11).border = thinBorder;
    subRow.getCell(12).border = thinBorder;
  });

  // ── Grand total row — cols 1-7 borderless, 8-9 merged label, 10 value,
  // 11-12 borderless (matches the JSX exactly)
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
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: "Calibri", bold: true, size: 8 };
    if (colNumber <= 7) {
      cell.border = {};
    } else if (colNumber === 8) {
      cell.alignment = rightAlign;
      cell.border = thinBorder;
    } else if (colNumber === 10) {
      cell.alignment = rightAlign;
      cell.numFmt = "₱#,##0.00";
      cell.border = thinBorder;
    } else {
      cell.border = {};
    }
  });

  ws.addRow([]);

  // ── Signatories — dynamic list from ppmp.signatories (sign_off, name,
  // position, order_no), grouped 3-per-row across 4-column blocks
  // (A:D / E:H / I:L). Falls back to a static Prepared by / Submitted by
  // pair (no Reviewed By) when no signatories are set, matching
  // PPMPDetailPage exactly.
  const signatories: any[] = [...((ppmp as any).signatories ?? [])].sort(
    (a: any, b: any) => (a.order_no ?? 0) - (b.order_no ?? 0),
  );
  const signatoryGroups: any[][] = [];
  for (let i = 0; i < signatories.length; i += SIGNATORIES_PER_ROW) {
    signatoryGroups.push(signatories.slice(i, i + SIGNATORIES_PER_ROW));
  }

  const sigLabelFont = { name: "Calibri", bold: true, size: 9 };
  const sigNameFont = { name: "Calibri", bold: true, size: 9, underline: true };
  const sigSmallFont = { name: "Calibri", size: 8 };

  const writeSignatureBlock = (
    entries: { label: string; name: string; position: string }[],
  ) => {
    // Row 1: labels
    const labelRow = ws.addRow([]);
    labelRow.height = 14;
    // blank spacer row for the physical signature
    ws.addRow([]).height = 14;
    ws.addRow([]).height = 14;
    const nameRow = ws.addRow([]);
    const posRow = ws.addRow([]);
    const dateRow = ws.addRow([]);

    entries.forEach((entry, idx) => {
      const startCol = idx * SIG_BLOCK_COLS + 1;
      const endCol = startCol + SIG_BLOCK_COLS - 1;
      const startLetter = String.fromCharCode(64 + startCol);
      const endLetter = String.fromCharCode(64 + endCol);

      ws.mergeCells(
        `${startLetter}${labelRow.number}:${endLetter}${labelRow.number}`,
      );
      ws.mergeCells(
        `${startLetter}${nameRow.number}:${endLetter}${nameRow.number}`,
      );
      ws.mergeCells(
        `${startLetter}${posRow.number}:${endLetter}${posRow.number}`,
      );
      ws.mergeCells(
        `${startLetter}${dateRow.number}:${endLetter}${dateRow.number}`,
      );

      const lCell = labelRow.getCell(startCol);
      lCell.value = `${entry.label}:`;
      lCell.font = sigLabelFont;
      lCell.alignment = { horizontal: "left", vertical: "bottom" };

      const nCell = nameRow.getCell(startCol);
      nCell.value = entry.name || "________________________________";
      nCell.font = sigNameFont;
      nCell.alignment = { horizontal: "left", vertical: "bottom" };

      const pCell = posRow.getCell(startCol);
      pCell.value = entry.position || "Position/Designation";
      pCell.font = sigSmallFont;
      pCell.alignment = { horizontal: "left", vertical: "top" };

      const dCell = dateRow.getCell(startCol);
      dCell.value = "Date: _________________";
      dCell.font = sigSmallFont;
      dCell.alignment = { horizontal: "left", vertical: "top" };
    });
  };

  if (signatoryGroups.length > 0) {
    signatoryGroups.forEach((group) => {
      writeSignatureBlock(
        group.map((s: any) => ({
          label: s.sign_off,
          name: toDisplayName(s.name),
          position: s.position,
        })),
      );
    });
  } else {
    const preparedByName = toDisplayName((ppmp as any).prepared_by);
    const submittedByName = toDisplayName((ppmp as any).submitted_by);
    writeSignatureBlock([
      {
        label: "Prepared by",
        name: preparedByName,
        position: "Position/Designation",
      },
      {
        label: "Submitted by",
        name: submittedByName,
        position: "Position/Designation",
      },
    ]);
  }

  // ── Footer — matches the .ppmp-footer block in PPMPDetailPage: contact
  // info on the left, accreditation logos + "Page 1" on the right.
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
    ws.addImage(
      pinImageId,
      footerImagePosition(0, 0, 0, 14, 14),
    );
  }

  if (alpasImageId !== null) {
    ws.addImage(
      alpasImageId,
      footerImagePosition(8, 0, 4, 55, 55),
    );
  }
  if (ukasImageId !== null) {
    ws.addImage(
      ukasImageId,
      footerImagePosition(9, 2, 13, 60, 37),
    );
  }
  if (bagongImageId !== null) {
    ws.addImage(
      bagongImageId,
      footerImagePosition(10, 2, 6, 48, 50),
    );
  }

  const pageCell = footerRow.getCell(12);
  pageCell.value = "Page 1";
  pageCell.font = { name: "Calibri", size: 9 };
  pageCell.alignment = { horizontal: "right", vertical: "bottom" };

  // ── Save file
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `PPMP_${office.name}_FY${ppmp.year}_No${ppmp.ppmp_no}.xlsx`);
}
