import { Fragment } from "react";
import type {
  ConsolidatedEntry,
  ConsolidatedOffice,
} from "../../services/consolidation";

const fmt = (n?: number) =>
  n
    ? n.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

// ── Shared cell styles, matching PPMPDetailPage.tsx exactly ───────────────
const thStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  textAlign: "center",
  verticalAlign: "middle",
  fontSize: "8px",
  lineHeight: 1.25,
  fontWeight: "bold",
};
const tdStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  textAlign: "left",
  verticalAlign: "top",
  fontSize: "8px",
  whiteSpace: "pre-line",
};
const codeRowStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 8px",
  textAlign: "left",
  fontSize: "9px",
  fontWeight: "bold",
  whiteSpace: "normal",
  backgroundColor: "#EAF1D9",
};
const bannerRowStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 8px",
  textAlign: "left",
  fontSize: "9px",
  fontWeight: "bold",
  whiteSpace: "normal",
};
const subtotalLabelStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontWeight: "bold",
  backgroundColor: "#D3D3D3",
};
const subtotalValueStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontWeight: "bold",
  backgroundColor: "#D3D3D3",
};

// Office banner row — the one piece that's intentionally different from
// the single-office detail page: yellow, so a consolidated report visually
// separates "office" (yellow) from "project" (white/bold) from "code/entry"
// (green, #EAF1D9) from "subtotal" (grey, #D3D3D3).
const officeRowStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "6px 8px",
  textAlign: "left",
  fontSize: "10px",
  fontWeight: "bold",
  backgroundColor: "#FFEB99",
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

const TOTAL_COLS = COLUMN_HEADERS.length; // 12 — matches the real PPMP schedule table

interface Props {
  office: ConsolidatedOffice;
}

export default function OfficeGroup({ office }: Props) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "Calibri, sans-serif",
          tableLayout: "auto",
        }}
      >
        <colgroup>
          <col style={{ width: "16%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "5%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td colSpan={TOTAL_COLS} style={officeRowStyle}>
              Office: {office.office_name}
              {office.ppmp_no && (
                <span
                  style={{
                    fontWeight: "normal",
                    fontSize: "9px",
                    marginLeft: "8px",
                  }}
                >
                  (PPMP No. {office.ppmp_no})
                </span>
              )}
              <span style={{ float: "right" }}>
                Office Total: ₱{fmt(office.office_total)}
              </span>
            </td>
          </tr>

          <tr>
                <th style={thStyle} colSpan={5}>
                  PROCUREMENT PROJECT DETAILS
                </th>
                <th style={thStyle} colSpan={3}>
                  PROJECTED TIMELINE (MM/YYYY)
                </th>
                <th style={thStyle} colSpan={2}>
                  FUNDING DETAILS
                </th>
                <th style={thStyle} rowSpan={2}>
                  ATTACHED SUPPORTING DOCUMENTS
                </th>
                <th style={thStyle} rowSpan={2}>
                  REMARKS
                </th>
              </tr>
              <tr>
                {COLUMN_HEADERS.slice(0, 10).map((h, i) => (
                  <th key={i} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>

              {office.description?.trim() && (
                <tr>
                  <td colSpan={TOTAL_COLS} style={codeRowStyle}>
                    <span style={{ fontWeight: "normal" }}>
                      {office.description}
                    </span>
                  </td>
                </tr>
              )}
              {office.additional_description?.trim() && (
                <tr>
                  <td
                    colSpan={TOTAL_COLS}
                    style={{ ...bannerRowStyle, backgroundColor: "#FFFFFF" }}
                  >
                    <span style={{ fontWeight: "normal" }}>
                      {office.additional_description}
                    </span>
                  </td>
                </tr>
              )}

              {office.projects.map((project, pIndex) => {
                const rowBg = pIndex % 2 === 0 ? "#fff" : "#f9fafb";

                // Code is project-level and shared by all entries under it,
                // so one banner prints per distinct code, with the entries
                // that use it beneath — never repeated above each entry.
                // Bucketing guarantees every entry renders exactly once.
                const entryGroups = project.entries.reduce(
                  (acc: Map<string, ConsolidatedEntry[]>, e) => {
                    const code = e.category_description?.trim() || "";
                    if (!acc.has(code)) acc.set(code, []);
                    acc.get(code)!.push(e);
                    return acc;
                  },
                  new Map<string, ConsolidatedEntry[]>(),
                );

                const renderEntryRow = (entry: ConsolidatedEntry) => {
                  const entryAmount = entry.items.reduce(
                    (sum, it) =>
                      sum + (it.quantity || 0) * (it.unit_price || 0),
                    0,
                  );

                  return (
                    <tr
                      key={entry.entry_id}
                      style={{ backgroundColor: rowBg }}
                    >
                      <td style={tdStyle}>
                        <strong>{entry.description}</strong>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {entry.project_type}
                      </td>
                      <td style={tdStyle}>
                        {entry.items.map((item, iIndex) => (
                          <div
                            key={iIndex}
                            style={{
                              marginBottom:
                                iIndex < entry.items.length - 1
                                  ? "4px"
                                  : 0,
                            }}
                          >
                            <strong>
                              [{item.quantity} {item.unit}]
                            </strong>{" "}
                            {item.item_name}
                            {item.unit_price
                              ? ` (₱${fmt(item.unit_price)}/${item.unit || "unit"})`
                              : ""}
                          </div>
                        ))}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {entry.procurement_mode}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {entry.pre_proc_conference}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {entry.start_activity}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {entry.end_activity}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {entry.delivery_period}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {entry.source_of_funds}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontWeight: "bold",
                        }}
                      >
                        {entryAmount ? `₱${fmt(entryAmount)}` : ""}
                      </td>
                      <td style={{ ...tdStyle, borderBottom: "none" }}>
                        {project.attached_document_title}
                      </td>
                      <td style={{ ...tdStyle, borderBottom: "none" }}>
                        {project.remarks}
                      </td>
                    </tr>
                  );
                };

                return (
                  <Fragment key={project.project_id}>
                    <tr>
                      <td colSpan={TOTAL_COLS} style={bannerRowStyle}>
                        Project: {project.project_label}
                      </td>
                    </tr>

                    {Array.from(entryGroups.entries()).map(
                      ([code, list]) => (
                        <Fragment key={code}>
                          {code && (
                            <tr>
                              <td
                                colSpan={TOTAL_COLS}
                                style={codeRowStyle}
                              >
                                <span style={{ fontWeight: "bold" }}>
                                  {code}
                                </span>
                              </td>
                            </tr>
                          )}
                          {list.map(renderEntryRow)}
                        </Fragment>
                      ),
                    )}

                    <tr>
                      <td colSpan={TOTAL_COLS - 1} style={subtotalLabelStyle}>
                        Project Subtotal:
                      </td>
                      <td style={subtotalValueStyle}>
                        ₱{fmt(project.project_subtotal)}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}

              <tr>
                <td
                  colSpan={TOTAL_COLS - 1}
                  style={{
                    ...subtotalLabelStyle,
                    backgroundColor: "#1e3a6e",
                    color: "white",
                  }}
                >
                  OFFICE TOTAL:
                </td>
                <td
                  style={{
                    ...subtotalValueStyle,
                    backgroundColor: "#1e3a6e",
                    color: "white",
                  }}
                >
                  ₱{fmt(office.office_total)}
                </td>
              </tr>
        </tbody>
      </table>
    </div>
  );
}
