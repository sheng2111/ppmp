import React from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface MonthSchedule {
  [key: string]: number | undefined;
}

interface PPMPItem {
  code?: string;
  general_description?: string;
  unit_of_issue?: string;
  quantity?: number;
  unit_cost?: number;
  total_cost?: number;
  mode_of_procurement?: string;
  pap_category?: string;
  schedule?: MonthSchedule;
}

interface PPMPHeader {
  end_user_unit?: string;
  charged_to?: string;
  pap?: string;
  date?: string;
  revision?: string;
  prepared_by?: string;
  designation?: string;
}

interface PPMPData {
  header?: PPMPHeader;
  end_user_unit?: string;
  charged_to?: string;
  pap?: string;
  date?: string;
  revision?: string;
  prepared_by?: string;
  designation?: string;
  year?: string | number;
  items?: PPMPItem[];
}

interface PPMPTemplateProps {
  ppmp?: PPMPData;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MONTHS = [
  { key: "jan", label: "Jan" },
  { key: "feb", label: "Feb" },
  { key: "mar", label: "Mar" },
  { key: "apr", label: "Apr" },
  { key: "may", label: "May" },
  { key: "jun", label: "Jun" },
  { key: "jul", label: "Jul" },
  { key: "aug", label: "Aug" },
  { key: "sep", label: "Sep" },
  { key: "oct", label: "Oct" },
  { key: "nov", label: "Nov" },
  { key: "dec", label: "Dec" },
];

// Default PAP category section order. If real items use category names
// outside this list, they're appended as their own sections (see
// buildCategorySections below) so no data is ever silently dropped.
const DEFAULT_PAP_CATEGORIES = [
  "Faculty Development",
  "Curriculum Development",
  "Student Development",
  "Research",
  "Extension",
];

// Minimum number of rows shown per category (real items + blank
// top-up rows). If a category has more real items than this, every
// item still shows — only the *blank* top-up rows are reduced to 0.
const BLANK_ROWS_PER_CATEGORY = 15;

const fmt = (n?: number) =>
  n
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";

const thStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "3px 6px",
  textAlign: "center",
  verticalAlign: "middle",
  fontSize: "8px",
  lineHeight: 1.2,
};

const tdStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "3px 6px",
  textAlign: "center",
  verticalAlign: "middle",
  fontSize: "8px",
};

const sigCellStyle: React.CSSProperties = {
  border: "none",
  padding: "0 8px",
  verticalAlign: "bottom",
  width: "25%",
  textAlign: "left",
  fontSize: "9px",
};

const sigSerifFont =
  "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif";

const quarterColor = (mi: number) =>
  mi === 2
    ? "#C5D9F1"
    : mi === 5
      ? "#FCE4D6"
      : mi === 8
        ? "#D9D9D9"
        : "#E2EFDA";

const quarterMonths = (mi: number): string[] | null =>
  mi === 2
    ? ["jan", "feb", "mar"]
    : mi === 5
      ? ["apr", "may", "jun"]
      : mi === 8
        ? ["jul", "aug", "sep"]
        : mi === 11
          ? ["oct", "nov", "dec"]
          : null;

// ─── Data helpers ────────────────────────────────────────────────────────────
const getQty = (item: PPMPItem, m: string) => item.schedule?.[`${m}_qty`] || 0;
const getAmt = (item: PPMPItem, m: string) => item.schedule?.[`${m}_amt`] || 0;
const getQTotal = (item: PPMPItem, months: string[]) =>
  months.reduce((s, m) => s + getAmt(item, m), 0);

interface CategorySection {
  name: string;
  items: PPMPItem[];
}

const buildCategorySections = (items: PPMPItem[]): CategorySection[] => {
  const grouped: Record<string, PPMPItem[]> = {};
  items.forEach((item) => {
    const cat = item.pap_category || "Others";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const seen = new Set<string>();
  const sections: CategorySection[] = [];

  DEFAULT_PAP_CATEGORIES.forEach((cat) => {
    sections.push({ name: cat, items: grouped[cat] || [] });
    seen.add(cat);
  });

  Object.keys(grouped).forEach((cat) => {
    if (!seen.has(cat)) {
      sections.push({ name: cat, items: grouped[cat] });
    }
  });

  return sections;
};

// ─── Official NEMSU Letterhead (table; logo + text reliably centered) ──────
const NemsuLetterhead = () => (
  <table
    className="ppmp-letterhead"
    style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6px" }}
  >
    <tbody>
      <tr>
        <td style={{ border: "none", textAlign: "center", padding: 0 }}>
          {/*
            display:block + margin:0 auto is the reliable cross-browser /
            print-engine fix for image centering — relying only on the
            parent's text-align:center can fail for <img> in some print
            paths since images don't always inherit text-align the way
            inline text does.
          */}
          <img
            src="/nemsu-logo.png"
            alt="NEMSU Logo"
            style={{
              display: "block",
              margin: "0 auto -15px auto",
              width: "72px",
              height: "72px",
              objectFit: "contain",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <p style={{ fontSize: "10px", margin: 0, textAlign: "center" }}>
            Republic of the Philippines
          </p>
          <p
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              margin: "2px 0",
              marginTop: "-5px",
              color: "#000000",
              textAlign: "center",
            }}
          >
            NORTH EASTERN MINDANAO STATE UNIVERSITY
          </p>
        </td>
      </tr>
    </tbody>
  </table>
);

// ─── Document Title block ────────────────────────────────────────────────────
const DocumentTitle = ({ year }: { year?: string | number }) => (
  <table
    className="ppmp-title"
    style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0px" }}
  >
    <tbody>
      <tr>
        <td
          style={{
            border: "none",
            textAlign: "center",
            fontSize: "10px",
            fontWeight: "bold",
            paddingBottom: "10px",
          }}
        >
          FY {year || "______"}
        </td>
      </tr>
      <tr>
        <td
          style={{
            border: "none",
            textAlign: "center",
            fontSize: "12px",
            fontWeight: "bold",
            paddingBottom: "5px",
            color: "#000000",
            textDecoration: "underline",
            textDecorationColor: "#000000",
            textDecorationThickness: "2px",
          }}
        >
          PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP)
        </td>
      </tr>
    </tbody>
  </table>
);

// ─── PPMP Meta Header ────────────────────────────────────────────────────────
const MetaHeaderTable = ({
  endUserUnit,
  date,
  chargedTo,
  revision,
  pap,
}: {
  endUserUnit?: string;
  date?: string;
  chargedTo?: string;
  revision?: string;
  pap?: string;
}) => (
  <table
    className="ppmp-meta"
    style={{
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "9px",
      lineHeight: 1.0,
      marginBottom: "4px",
    }}
  >
    <tbody>
      <tr>
        <td style={{ border: "none", padding: "0px 6px", width: "50%" }}>
          <strong>END-USER/UNIT:</strong>{" "}
          {endUserUnit || "___________________________"}
        </td>
        <td style={{ border: "none", padding: "0px 6px", width: "50%" }}>
          <strong>Date:</strong> {date || "___________________________"}
        </td>
      </tr>
      <tr>
        <td style={{ border: "none", padding: "3px 6px" }}>
          <strong>Charged to:</strong>{" "}
          {chargedTo || "___________________________"}
        </td>
        <td style={{ border: "none", padding: "3px 6px" }}>
          <strong>Revision #:</strong>{" "}
          {revision || "___________________________"}
        </td>
      </tr>
      <tr>
        <td style={{ border: "none", padding: "0px 6px 2px" }} colSpan={2}>
          <strong>Projects, Activities and Programs (PAPs):</strong>{" "}
          {pap || "___________________________"}
        </td>
      </tr>
    </tbody>
  </table>
);

// ─── Item Row (real data) ────────────────────────────────────────────────────
const ItemRow = ({ item, zebra }: { item: PPMPItem; zebra: boolean }) => (
  <tr style={{ backgroundColor: zebra ? "#f9fafb" : "#fff" }}>
    <td style={{ ...tdStyle, textAlign: "left" }}>{item.code || ""}</td>
    <td style={{ ...tdStyle, textAlign: "left" }}>
      {item.general_description || ""}
    </td>
    <td style={tdStyle}>{item.unit_of_issue || ""}</td>
    <td style={tdStyle}>{item.quantity || ""}</td>
    <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(item.unit_cost)}</td>
    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
      {fmt(item.total_cost)}
    </td>
    <td style={{ ...tdStyle, fontSize: "6.5px" }}>
      {item.mode_of_procurement || ""}
    </td>
    {MONTHS.map((m, mi) => {
      const qMonths = quarterMonths(mi);
      return (
        <React.Fragment key={m.key}>
          <td style={{ ...tdStyle, textAlign: "right" }}>
            {getQty(item, m.key) || ""}
          </td>
          <td style={{ ...tdStyle, textAlign: "right" }}>
            {getAmt(item, m.key) ? fmt(getAmt(item, m.key)) : ""}
          </td>
          {qMonths && (
            <td
              style={{
                ...tdStyle,
                textAlign: "right",
                fontWeight: "bold",
                backgroundColor: quarterColor(mi),
              }}
            >
              {fmt(getQTotal(item, qMonths))}
            </td>
          )}
        </React.Fragment>
      );
    })}
  </tr>
);

// ─── Blank Item Row (placeholder / top-up row) ──────────────────────────────
const BlankItemRow = () => (
  <tr>
    <td style={{ ...tdStyle, textAlign: "left" }}></td>
    <td style={{ ...tdStyle, textAlign: "left" }}></td>
    <td style={tdStyle}></td>
    <td style={tdStyle}></td>
    <td style={tdStyle}></td>
    <td style={tdStyle}></td>
    <td style={tdStyle}></td>
    {MONTHS.map((m, mi) => (
      <React.Fragment key={m.key}>
        <td style={tdStyle}></td>
        <td style={tdStyle}></td>
        {quarterMonths(mi) && (
          <td style={{ ...tdStyle, backgroundColor: quarterColor(mi) }}></td>
        )}
      </React.Fragment>
    ))}
  </tr>
);

// ─── Category Section ───────────────────────────────────────────────────────
const CategorySection = ({ section }: { section: CategorySection }) => {
  const { name, items } = section;
  const catTotal = items.reduce((s, i) => s + (i.total_cost || 0), 0);
  const blanksNeeded = Math.max(BLANK_ROWS_PER_CATEGORY - items.length, 0);

  return (
    <>
      <tr style={{ backgroundColor: "#fff" }}>
        <td style={tdStyle}></td>
        <td style={{ ...tdStyle, fontWeight: "bold", textAlign: "left" }}>
          {name}
        </td>
        <td style={tdStyle}></td>
        <td style={tdStyle}></td>
        <td style={tdStyle}></td>
        <td style={tdStyle}></td>
        <td style={tdStyle}></td>
        {MONTHS.map((m, mi) => (
          <React.Fragment key={m.key}>
            <td style={tdStyle}></td>
            <td style={tdStyle}></td>
            {quarterMonths(mi) && (
              <td
                style={{ ...tdStyle, backgroundColor: quarterColor(mi) }}
              ></td>
            )}
          </React.Fragment>
        ))}
      </tr>

      {items.map((item, idx) => (
        <ItemRow key={idx} item={item} zebra={idx % 2 === 1} />
      ))}

      {Array.from({ length: blanksNeeded }).map((_, ri) => (
        <BlankItemRow key={`${name}-blank-${ri}`} />
      ))}

      <tr style={{ backgroundColor: "#fef9c3", fontWeight: "bold" }}>
        <td style={tdStyle}></td>
        <td style={tdStyle}></td>
        <td colSpan={3} style={{ ...tdStyle, textAlign: "center" }}>
          Sub-total
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {items.length ? fmt(catTotal) : ""}
        </td>
        <td style={tdStyle}></td>
        {MONTHS.map((m, mi) => {
          const qMonths = quarterMonths(mi);
          const colQty = items.reduce((s, i) => s + getQty(i, m.key), 0);
          const colAmt = items.reduce((s, i) => s + getAmt(i, m.key), 0);
          const qTotal = qMonths
            ? items.reduce((s, i) => s + getQTotal(i, qMonths), 0)
            : 0;
          return (
            <React.Fragment key={m.key}>
              <td style={{ ...tdStyle, textAlign: "right" }}>{colQty || ""}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {colAmt ? fmt(colAmt) : ""}
              </td>
              {qMonths && (
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontWeight: "bold",
                    backgroundColor: quarterColor(mi),
                  }}
                >
                  {qTotal ? fmt(qTotal) : ""}
                </td>
              )}
            </React.Fragment>
          );
        })}
      </tr>
    </>
  );
};

// ─── Main PPMP Schedule Table ────────────────────────────────────────────────
const MainScheduleTable = ({ items }: { items: PPMPItem[] }) => {
  const sections = buildCategorySections(items);
  const grandTotal = items.reduce((s, i) => s + (i.total_cost || 0), 0);
  const inflation = grandTotal * 0.1;
  const contingency = grandTotal * 0.1;
  const totalEstimated = grandTotal + inflation + contingency;

  return (
    <table
      className="ppmp-main"
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "7.5px",
        tableLayout: "auto",
      }}
    >
      <colgroup>
        <col style={{ width: "8%" }} />
        <col style={{ width: "13%" }} />
        <col style={{ width: "4%" }} />
        <col style={{ width: "4.5%" }} />
        <col style={{ width: "4.5%" }} />
        <col style={{ width: "4.5%" }} />
        <col style={{ width: "6%" }} />
        {Array.from({ length: 12 }).map((_, i) => (
          <React.Fragment key={i}>
            <col style={{ width: "3.5%" }} />
            <col style={{ width: "3.5%" }} />
          </React.Fragment>
        ))}
        <col style={{ width: "4%" }} />
        <col style={{ width: "4%" }} />
        <col style={{ width: "4%" }} />
        <col style={{ width: "4%" }} />
      </colgroup>

      <thead>
        <tr style={{ backgroundColor: "#fff", color: "black" }}>
          <th style={thStyle} rowSpan={3}>
            CODE
          </th>
          <th style={thStyle} rowSpan={3}>
            GENERAL DESCRIPTION
          </th>
          <th style={thStyle} rowSpan={3}>
            Unit of Issue
          </th>
          <th style={thStyle} rowSpan={3}>
            QUANTITY/SIZE
          </th>
          <th style={{ ...thStyle, backgroundColor: "#fff" }} colSpan={2}>
            ESTIMATED BUDGET
          </th>
          <th style={thStyle} rowSpan={3}>
            Mode of Procurement
          </th>
          <th style={{ ...thStyle, backgroundColor: "#fff" }} colSpan={28}>
            SCHEDULE / MILESTONE OF ACTIVITIES
          </th>
        </tr>

        <tr style={{ backgroundColor: "#fff", color: "black" }}>
          <th style={{ ...thStyle, backgroundColor: "#fff" }} rowSpan={2}>
            Unit Cost
          </th>
          <th style={{ ...thStyle, backgroundColor: "#fff" }} rowSpan={2}>
            Total Cost
          </th>
          <th style={thStyle} colSpan={2}>
            Jan
          </th>
          <th style={thStyle} colSpan={2}>
            Feb
          </th>
          <th style={thStyle} colSpan={2}>
            Mar
          </th>
          <th style={{ ...thStyle, backgroundColor: "#C5D9F1" }}>TOTAL Q1</th>
          <th style={thStyle} colSpan={2}>
            Apr
          </th>
          <th style={thStyle} colSpan={2}>
            May
          </th>
          <th style={thStyle} colSpan={2}>
            Jun
          </th>
          <th style={{ ...thStyle, backgroundColor: "#FCE4D6" }}>TOTAL Q2</th>
          <th style={thStyle} colSpan={2}>
            Jul
          </th>
          <th style={thStyle} colSpan={2}>
            Aug
          </th>
          <th style={thStyle} colSpan={2}>
            Sep
          </th>
          <th style={{ ...thStyle, backgroundColor: "#D9D9D9" }}>TOTAL Q3</th>
          <th style={thStyle} colSpan={2}>
            Oct
          </th>
          <th style={thStyle} colSpan={2}>
            Nov
          </th>
          <th style={thStyle} colSpan={2}>
            Dec
          </th>
          <th style={{ ...thStyle, backgroundColor: "#E2EFDA" }}>TOTAL Q4</th>
        </tr>

        <tr style={{ backgroundColor: "#fff", color: "black" }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((mi) => (
            <React.Fragment key={mi}>
              <th style={thStyle}>Qty.</th>
              <th style={thStyle}>Amt.</th>
              {quarterMonths(mi) && (
                <th
                  style={{ ...thStyle, backgroundColor: quarterColor(mi) }}
                ></th>
              )}
            </React.Fragment>
          ))}
        </tr>
      </thead>

      <tbody>
        {sections.map((section) => (
          <CategorySection key={section.name} section={section} />
        ))}

        <tr
          style={{
            backgroundColor: "#EC9706",
            color: "black",
            fontWeight: "bold",
          }}
        >
          <td
            colSpan={5}
            style={{
              ...tdStyle,
              color: "black",
              borderColor: "#000000",
              textAlign: "center",
            }}
          >
            GRAND-TOTAL:
          </td>
          <td
            style={{
              ...tdStyle,
              color: "black",
              borderColor: "#000000",
              textAlign: "right",
            }}
          >
            {fmt(grandTotal)}
          </td>
          <td
            style={{ ...tdStyle, color: "black", borderColor: "#000000" }}
          ></td>
          {MONTHS.map((m, mi) => {
            const qMonths = quarterMonths(mi);
            const colQty = items.reduce((s, i) => s + getQty(i, m.key), 0);
            const colAmt = items.reduce((s, i) => s + getAmt(i, m.key), 0);
            const qTotal = qMonths
              ? items.reduce((s, i) => s + getQTotal(i, qMonths), 0)
              : 0;
            return (
              <React.Fragment key={m.key}>
                <td
                  style={{
                    ...tdStyle,
                    color: "black",
                    borderColor: "#000000",
                    textAlign: "right",
                  }}
                >
                  {colQty || ""}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    color: "black",
                    borderColor: "#000000",
                    textAlign: "right",
                  }}
                >
                  {colAmt ? fmt(colAmt) : ""}
                </td>
                {qMonths && (
                  <td
                    style={{
                      ...tdStyle,
                      color: "black",
                      borderColor: "#000000",
                      textAlign: "right",
                      backgroundColor: quarterColor(mi),
                    }}
                  >
                    {qTotal ? fmt(qTotal) : ""}
                  </td>
                )}
              </React.Fragment>
            );
          })}
        </tr>

        <tr>
          <td
            colSpan={2}
            style={{
              ...tdStyle,
              fontWeight: "bold",
              textDecoration: "underline",
              textAlign: "left",
            }}
          >
            TOTAL-BUDGET:
          </td>
          <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
            {fmt(grandTotal)}
          </td>
        </tr>

        <tr>
          <td
            colSpan={2}
            style={{ ...tdStyle, fontWeight: "bold", textAlign: "left" }}
          >
            + 10% Provision for Inflation
          </td>
          <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
            {fmt(inflation)}
          </td>
        </tr>

        <tr>
          <td
            colSpan={2}
            style={{ ...tdStyle, fontWeight: "bold", textAlign: "left" }}
          >
            + 10% Contingency
          </td>
          <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
            {fmt(contingency)}
          </td>
        </tr>

        <tr style={{ fontWeight: "bold" }}>
          <td
            colSpan={2}
            style={{ ...tdStyle, fontWeight: "bold", textAlign: "left" }}
          >
            TOTAL ESTIMATED BUDGET:
          </td>
          <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
            {fmt(totalEstimated)}
          </td>
        </tr>
      </tbody>
    </table>
  );
};

// ─── Signatory Table ─────────────────────────────────────────────────────────
const SignatoryTable = ({
  preparedBy,
  designation,
}: {
  preparedBy?: string;
  designation?: string;
}) => (
  <table
    className="ppmp-signatory"
    style={{
      width: "100%",
      borderCollapse: "collapse",
      marginTop: "24px",
      fontSize: "9px",
    }}
  >
    <tbody>
      <tr>
        <td
          style={{
            ...sigCellStyle,
            fontWeight: "bold",
            fontFamily: sigSerifFont,
          }}
        >
          Prepared by:
        </td>
        <td
          style={{
            ...sigCellStyle,
            fontWeight: "bold",
            fontFamily: sigSerifFont,
          }}
        >
          Noted by:
        </td>
        <td
          style={{
            ...sigCellStyle,
            fontWeight: "bold",
            fontFamily: sigSerifFont,
          }}
        >
          Checked and Reviewed by:
        </td>
        <td
          style={{
            ...sigCellStyle,
            fontWeight: "bold",
            fontFamily: sigSerifFont,
          }}
        >
          Approved:
        </td>
      </tr>

      <tr>
        <td style={{ ...sigCellStyle, height: "28px" }} />
        <td style={{ ...sigCellStyle, height: "28px" }} />
        <td style={{ ...sigCellStyle, height: "28px" }} />
        <td style={{ ...sigCellStyle, height: "28px" }} />
      </tr>

      <tr>
        <td
          style={{
            ...sigCellStyle,
            fontWeight: "bold",
            textDecoration: "underline",
            textTransform: "uppercase",
            fontFamily: sigSerifFont,
          }}
        >
          {preparedBy || "___________________________"}
        </td>
        <td
          style={{
            ...sigCellStyle,
            fontWeight: "bold",
            textDecoration: "underline",
            textTransform: "uppercase",
            fontFamily: sigSerifFont,
          }}
        >
          JERIEL U. REPOYLO
        </td>
        <td
          style={{
            ...sigCellStyle,
            fontWeight: "bold",
            textDecoration: "underline",
            textTransform: "uppercase",
            fontFamily: sigSerifFont,
          }}
        >
          DARLENE ABIGAIL T. DABALOS
        </td>
        <td
          style={{
            ...sigCellStyle,
            fontWeight: "bold",
            textDecoration: "underline",
            textTransform: "uppercase",
            fontFamily: sigSerifFont,
          }}
        >
          ARISTON O. RONQUILLO, DM
        </td>
      </tr>

      <tr>
        <td
          style={{
            ...sigCellStyle,
            color: "#555",
            fontSize: "8px",
            paddingTop: "2px",
            fontFamily: sigSerifFont,
          }}
        >
          {designation || "Designation"}
        </td>
        <td
          style={{
            ...sigCellStyle,
            color: "#555",
            fontSize: "8px",
            paddingTop: "2px",
            fontFamily: sigSerifFont,
          }}
        >
          AO-III / Procurement Officer
        </td>
        <td
          style={{
            ...sigCellStyle,
            color: "#555",
            fontSize: "8px",
            paddingTop: "2px",
            fontFamily: sigSerifFont,
          }}
        >
          Administrative Officer IV / Budget Officer
        </td>
        <td
          style={{
            ...sigCellStyle,
            color: "#555",
            fontSize: "8px",
            paddingTop: "2px",
            fontFamily: sigSerifFont,
          }}
        >
          Campus Director
        </td>
      </tr>
    </tbody>
  </table>
);

// ─── Page Footer ─────────────────────────────────────────────────────────────
const NemsuPageFooter = () => (
  <table
    className="ppmp-footer"
    style={{ width: "100%", borderCollapse: "collapse" }}
  >
    <tbody>
      <tr>
        <td
          style={{
            border: "none",
            verticalAlign: "middle",
            lineHeight: "1.8",
            color: "#333",
            fontSize: "8px",
            width: "50%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="black"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span>Tagbina, Surigao del Sur 8308</span>
          </div>
          <div style={{ fontWeight: "bold" }}>
            <span style={{ filter: "grayscale(1) brightness(0)" }}>☎</span>{" "}
            <span style={{ marginLeft: 4 }}>086-628-0714</span>
          </div>
          <div>
            <span style={{ filter: "grayscale(1) brightness(0)" }}>🌐</span>{" "}
            <span style={{ marginLeft: 2 }}>www.nemsu.edu.ph</span>
          </div>
        </td>
        <td
          style={{
            border: "none",
            verticalAlign: "middle",
            textAlign: "right",
            width: "50%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "6px",
            }}
          >
            <img
              src="/alpas-logo.png"
              alt="A.L.P.A.S."
              style={{ height: "45px", objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <img
              src="/ukas-logo.png"
              alt="UKAS"
              style={{ height: "32px", objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <img
              src="/bagong-pilipinas-logo.png"
              alt="Bagong Pilipinas"
              style={{ height: "35px", objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span
              className="page-number"
              style={{
                fontWeight: "bold",
                fontSize: "8px",
                color: "#333",
                whiteSpace: "nowrap",
              }}
            />
          </div>
        </td>
      </tr>
    </tbody>
  </table>
);

// ─── Main Template Component ─────────────────────────────────────────────────
const PPMPTemplate: React.FC<PPMPTemplateProps> = ({ ppmp }) => {
  const h = ppmp?.header || {};
  const endUserUnit = h.end_user_unit ?? ppmp?.end_user_unit ?? "";
  const chargedTo = h.charged_to ?? ppmp?.charged_to ?? "";
  const pap = h.pap ?? ppmp?.pap ?? "";
  const date = h.date ?? ppmp?.date ?? "";
  const revision = h.revision ?? ppmp?.revision ?? "";
  const preparedBy = h.prepared_by ?? ppmp?.prepared_by ?? "";
  const designation = h.designation ?? ppmp?.designation ?? "";
  const items = ppmp?.items ?? [];

  return (
    <div
      id="ppmp-print"
      className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
      style={{
        fontFamily: "Calibri, sans-serif",
        fontSize: "9px",
        padding: "16px 20px",
      }}
    >
      <div className="ppmp-body">
        <NemsuLetterhead />
        <DocumentTitle year={ppmp?.year} />
        <MetaHeaderTable
          endUserUnit={endUserUnit}
          date={date}
          chargedTo={chargedTo}
          revision={revision}
          pap={pap}
        />
        <div style={{ overflowX: "auto" }}>
          <MainScheduleTable items={items} />
        </div>
      </div>

      <div className="ppmp-bottom">
        <SignatoryTable preparedBy={preparedBy} designation={designation} />
        <NemsuPageFooter />
      </div>

      <style>{`
        #ppmp-print {
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }
        .ppmp-body {
          flex: 1 1 auto;
        }
        .ppmp-bottom {
          margin-top: auto;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          #ppmp-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 4mm 8mm;
            font-size: 6.5px;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }

          .ppmp-body {
            flex: 1 1 auto;
          }

          .ppmp-bottom {
            margin-top: auto;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          #ppmp-print table th,
          #ppmp-print table td {
            padding: 1px 3px !important;
            font-size: 6.5px !important;
            line-height: 1.05 !important;
          }

          #ppmp-print table {
            font-size: 6.5px !important;
          }

          .ppmp-signatory td {
            font-size: 6.5px !important;
          }

          @page {
            size: legal landscape;
            margin: 6mm 8mm;
          }

          .page-number::after {
            content: "Page " counter(page);
          }

          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }

          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default PPMPTemplate;
