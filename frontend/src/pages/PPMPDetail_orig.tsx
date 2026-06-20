import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import LoginPage from "./LoginPage";

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

const fmt = (n: number) =>
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

const IconEdit = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const IconPrint = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
    />
  </svg>
);

const IconBack = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

// ─── Official NEMSU Letterhead Header ────────────────────────────────────────
// Logo file: public/nemsu-logo.png
const NemsuLetterhead = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: "8px",
      borderBottom: "none",
      marginBottom: "6px",
      textAlign: "center",
    }}
  >
    {/* NEMSU Logo — on top */}
    <img
      src="/nemsu-logo.png"
      alt="NEMSU Logo"
      style={{
        width: "72px",
        height: "72px",
        objectFit: "contain",
        marginBottom: "-15px",
      }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
    {/* University text — below logo */}
    <p style={{ fontSize: "10px", margin: 0 }}>Republic of the Philippines</p>
    <p
      style={{
        fontSize: "14px",
        fontWeight: "bold",
        margin: "2px 0",
        marginTop: "-5px",
        color: "#000000",
      }}
    >
      NORTH EASTERN MINDANAO STATE UNIVERSITY
    </p>
  </div>
);

// ─── Official NEMSU Page Footer ───────────────────────────────────────────────
// Logo files: public/alpas-logo.png, public/iso-logo.png,
//             public/ukas-logo.png, public/bagong-pilipinas-logo.png
const NemsuPageFooter = ({ pageNum }: { pageNum: number }) => (
  <div
    className="ppmp-footer"
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderTop: "none",
      paddingTop: "5px",
      marginTop: "auto",
      fontSize: "8px",
      width: "100%",
    }}
  >
    {/* Left: address block */}
    <div style={{ lineHeight: "1.8", color: "#333", fontSize: "8px" }}>
      <p
        style={{
          margin: 0,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          marginBottom: -5,
        }}
      >
        {/* Location pin icon */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="black"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
        Tagbina, Surigao del Sur 8308
      </p>
      <p style={{ margin: 1, fontWeight: "bold", marginBottom: -5 }}>
        <span style={{ filter: "grayscale(1) brightness(0)" }}>☎</span>{" "}
        <span style={{ marginLeft: 4 }}>086-628-0714</span>
      </p>
      <p style={{ margin: 0 }}>
        <span style={{ filter: "grayscale(1) brightness(0)" }}>🌐</span>{" "}
        <span style={{ marginLeft: 2 }}>www.nemsu.edu.ph</span>
      </p>
    </div>
    {/* Right: certification logos + page number beside Bagong Pilipinas */}
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <img
        src="/alpas-logo.png"
        alt="A.L.P.A.S."
        style={{
          height: "45px",
          objectFit: "contain",
          marginBottom: "-18px",
          boxSizing: "content-box",
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <img
        src="/ukas-logo.png"
        alt="UKAS"
        style={{
          height: "32px",
          marginLeft: "-8px",
          objectFit: "contain",
          boxSizing: "content-box",
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {/* Bagong Pilipinas + Page number side by side */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <img
          src="/bagong-pilipinas-logo.png"
          alt="Bagong Pilipinas"
          style={{
            height: "35px",
            objectFit: "contain",
            marginBottom: "-7px",
            marginRight: "-4px",
            marginLeft: "-5px",
          }}
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
            marginBottom: "-15px",
            whiteSpace: "nowrap",
          }}
        />
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const PPMPDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ppmp, setPpmp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get(`/ppmp/${id}`)
      .then((res) => setPpmp(res.data))
      .catch(() => setError("Failed to load PPMP."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
        ⚠️ {error}
      </div>
    );

  if (!ppmp) return null;

  // ─── Normalize header fields ───────────────────────────────────────────
  // The backend may return prepared_by/designation either nested inside
  // `header` or at the top level (or both). Read defensively from
  // whichever location actually has the value, so PPMPDetail always
  // reflects exactly what was entered in PPMPForm regardless of which
  // shape the API happens to send.
  const h = ppmp.header || {};
  const endUserUnit = h.end_user_unit ?? ppmp.end_user_unit ?? "";
  const chargedTo = h.charged_to ?? ppmp.charged_to ?? "STF";
  const pap = h.pap ?? ppmp.pap ?? "";
  const date = h.date ?? ppmp.date ?? "";
  const revision = h.revision ?? ppmp.revision ?? "0";
  const preparedBy = h.prepared_by ?? ppmp.prepared_by ?? "";
  const designation = h.designation ?? ppmp.designation ?? "";

  const items = ppmp.items || [];
  const grandTotal = items.reduce(
    (s: number, i: any) => s + (i.total_cost || 0),
    0,
  );

  // Group by PAP category (preserve order)
  const grouped: Record<string, any[]> = {};
  items.forEach((item: any) => {
    const cat = item.pap_category || "Others";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const getQty = (item: any, m: string) => item.schedule?.[`${m}_qty`] || 0;
  const getAmt = (item: any, m: string) => item.schedule?.[`${m}_amt`] || 0;
  const getATotal = (item: any, months: string[]) =>
    months.reduce((s, m) => s + getAmt(item, m), 0);

  return (
    <div className="space-y-4">
      {/* ── Action Bar (screen only) ────────────────────────────────────── */}
      <div className="print:hidden">
        <div
          className="rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
          }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-white opacity-10 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-widest font-semibold">
                PPMP Detail — FY {ppmp.year}
              </p>
              <h1 className="text-xl font-bold mt-1">
                {endUserUnit || "No Unit"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/ppmp")}
                className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
              >
                <IconBack /> Back
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
              >
                <IconPrint /> Print
              </button>
              <button
                onClick={() => navigate(`/ppmp/${id}/edit`)}
                className="flex items-center gap-1.5 text-xs font-bold bg-white text-blue-900 px-3 py-2 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <IconEdit /> Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── OFFICIAL PPMP FORM (screen + print) ───────────────────────────── */}
      <div
        id="ppmp-print"
        className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
        style={{
          fontFamily: "Calibri, sans-serif",
          fontSize: "9px",
          padding: "16px 20px",
        }}
      >
        {/* ── LETTERHEAD ─────────────────────────────────────────────────── */}
        <NemsuLetterhead />

        {/* ── DOCUMENT TITLE ─────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", margin: "6px 0" }}>
          <p
            style={{
              fontSize: "10px",
              fontWeight: "bold",
              marginBottom: "10px",
            }}
          >
            FY {ppmp.year}
          </p>
          <p
            style={{
              fontSize: "12px",
              fontWeight: "bold",
              margin: "2px 0",
              marginBottom: "5px",
              color: "#000000",
              textDecoration: "underline",
              textDecorationColor: "#000000",
              textDecorationThickness: "2px",
            }}
          >
            PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP)
          </p>
        </div>

        {/* ── PPMP META HEADER ───────────────────────────────────────────── */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "9px",
            lineHeight: 1.0,
            marginBottom: "0px",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  padding: "0px 6px",
                  width: "50%",
                }}
              >
                <strong>END-USER/UNIT:</strong> {endUserUnit}
              </td>
              <td
                style={{
                  padding: "0px 6px",
                  width: "50%",
                }}
              >
                <strong>Date:</strong> {date}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "3px 6px", marginBottom: "0px" }}>
                <strong>Charged to:</strong> {chargedTo}
              </td>
              <td style={{ padding: "3px 6px" }}>
                <strong>Revision #:</strong> {revision}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "0px 6px 2px" }} colSpan={1}>
                <strong>Projects, Activities and Programs (PAPs):</strong> {pap}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── MAIN PPMP TABLE ────────────────────────────────────────────── */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "7.5px",
              tableLayout: "auto",
            }}
          >
            <colgroup>
              <col style={{ width: "8%" }} /> {/* CODE */}
              <col style={{ width: "13%" }} /> {/* GENERAL DESC */}
              <col style={{ width: "4%" }} /> {/* UNIT */}
              <col style={{ width: "4.5%" }} /> {/* QUANTITY/SIZE */}
              <col style={{ width: "4.5%" }} /> {/* UNIT COST */}
              <col style={{ width: "4.5%" }} /> {/* TOTAL COST */}
              <col style={{ width: "6%" }} /> {/* MODE */}
              {/* 12 months × 2 cols + 4 quarter totals */}
              {Array.from({ length: 12 }).map((_, i) => (
                <React.Fragment key={i}>
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "3.5%" }} />
                </React.Fragment>
              ))}
              <col style={{ width: "4%" }} /> {/* Q1 */}
              <col style={{ width: "4%" }} /> {/* Q2 */}
              <col style={{ width: "4%" }} /> {/* Q3 */}
              <col style={{ width: "4%" }} /> {/* Q4 */}
            </colgroup>

            <thead>
              {/* ── Row 1: Top-level labels ── */}
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
                <th
                  style={{ ...thStyle, backgroundColor: "#fff" }}
                  colSpan={28}
                >
                  SCHEDULE / MILESTONE OF ACTIVITIES
                </th>
              </tr>

              {/* ── Row 2: Budget sub-cols + Quarter groups ── */}
              <tr style={{ backgroundColor: "#fff", color: "black" }}>
                <th style={{ ...thStyle, backgroundColor: "#fff" }} rowSpan={2}>
                  Unit Cost
                </th>
                <th style={{ ...thStyle, backgroundColor: "#fff" }} rowSpan={2}>
                  Total Cost
                </th>
                {/* Q1 */}
                <th style={thStyle} colSpan={2}>
                  Jan
                </th>
                <th style={thStyle} colSpan={2}>
                  Feb
                </th>
                <th style={thStyle} colSpan={2}>
                  Mar
                </th>
                <th style={{ ...thStyle, backgroundColor: "#C5D9F1" }}>
                  TOTAL Q1
                </th>
                {/* Q2 */}
                <th style={thStyle} colSpan={2}>
                  Apr
                </th>
                <th style={thStyle} colSpan={2}>
                  May
                </th>
                <th style={thStyle} colSpan={2}>
                  Jun
                </th>
                <th style={{ ...thStyle, backgroundColor: "#FCE4D6" }}>
                  TOTAL Q2
                </th>
                {/* Q3 */}
                <th style={thStyle} colSpan={2}>
                  Jul
                </th>
                <th style={thStyle} colSpan={2}>
                  Aug
                </th>
                <th style={thStyle} colSpan={2}>
                  Sep
                </th>
                <th style={{ ...thStyle, backgroundColor: "#D9D9D9" }}>
                  TOTAL Q3
                </th>
                {/* Q4 */}
                <th style={thStyle} colSpan={2}>
                  Oct
                </th>
                <th style={thStyle} colSpan={2}>
                  Nov
                </th>
                <th style={thStyle} colSpan={2}>
                  Dec
                </th>
                <th style={{ ...thStyle, backgroundColor: "#E2EFDA" }}>
                  TOTAL Q4
                </th>
              </tr>

              {/* ── Row 3: Qty/Amt per month ── */}
              <tr style={{ backgroundColor: "#fff", color: "black" }}>
                {/* 12 months of Qty/Amt, with Q totals inserted after every 3rd month */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((mi) => (
                  <React.Fragment key={mi}>
                    <th style={thStyle}>Qty.</th>
                    <th style={thStyle}>Amt.</th>
                    {/* Q total placeholder col (already placed in Row 2 rowSpan) */}
                    {(mi === 2 || mi === 5 || mi === 8 || mi === 11) && (
                      <th
                        style={{
                          ...thStyle,
                          backgroundColor:
                            mi === 2
                              ? "#C5D9F1"
                              : mi === 5
                                ? "#FCE4D6"
                                : mi === 8
                                  ? "#D9D9D9"
                                  : "#E2EFDA",
                        }}
                      ></th>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {Object.entries(grouped).map(([cat, catItems]) => {
                const catTotal = catItems.reduce(
                  (s, i) => s + (i.total_cost || 0),
                  0,
                );

                return (
                  <React.Fragment key={cat}>
                    {/* PAP Category header row */}
                    <tr style={{ backgroundColor: "#fff" }}>
                      <td style={tdStyle}></td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: "bold",
                          color: "black",
                          fontStyle: "Calibri, sans-serif",
                        }}
                      >
                        {cat}
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
                          {(mi === 2 || mi === 5 || mi === 8 || mi === 11) && (
                            <td
                              style={{
                                ...tdStyle,
                                backgroundColor:
                                  mi === 2
                                    ? "#C5D9F1"
                                    : mi === 5
                                      ? "#FCE4D6"
                                      : mi === 8
                                        ? "#D9D9D9"
                                        : "#E2EFDA",
                              }}
                            ></td>
                          )}
                        </React.Fragment>
                      ))}
                    </tr>

                    {/* Item rows */}
                    {catItems.map((item: any, idx: number) => (
                      <tr
                        key={idx}
                        style={{
                          backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb",
                        }}
                      >
                        <td style={{ ...tdStyle, textAlign: "left" }}>
                          {item.code || ""}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "left" }}>
                          {item.general_description}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {item.unit_of_issue}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {item.quantity || ""}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {fmt(item.unit_cost)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontWeight: "bold",
                          }}
                        >
                          {fmt(item.total_cost)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "center",
                            fontSize: "6.5px",
                          }}
                        >
                          {item.mode_of_procurement || ""}
                        </td>
                        {MONTHS.map((m, mi) => (
                          <React.Fragment key={m.key}>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {getQty(item, m.key) || ""}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {getAmt(item, m.key)
                                ? fmt(getAmt(item, m.key))
                                : ""}
                            </td>
                            {mi === 2 && (
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: "right",
                                  fontWeight: "bold",
                                  backgroundColor: "#C5D9F1",
                                }}
                              >
                                {fmt(getATotal(item, ["jan", "feb", "mar"]))}
                              </td>
                            )}
                            {mi === 5 && (
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: "right",
                                  fontWeight: "bold",
                                  backgroundColor: "#FCE4D6",
                                }}
                              >
                                {fmt(getATotal(item, ["apr", "may", "jun"]))}
                              </td>
                            )}
                            {mi === 8 && (
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: "right",
                                  fontWeight: "bold",
                                  backgroundColor: "#D9D9D9",
                                }}
                              >
                                {fmt(getATotal(item, ["jul", "aug", "sep"]))}
                              </td>
                            )}
                            {mi === 11 && (
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: "right",
                                  fontWeight: "bold",
                                  backgroundColor: "#E2EFDA",
                                }}
                              >
                                {fmt(getATotal(item, ["oct", "nov", "dec"]))}
                              </td>
                            )}
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}

                    {/* Subtotal row */}
                    <tr
                      style={{ backgroundColor: "#fef9c3", fontWeight: "bold" }}
                    >
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td
                        colSpan={3}
                        style={{ ...tdStyle, textAlign: "center" }}
                      >
                        Sub-total
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {fmt(catTotal)}
                      </td>
                      <td style={tdStyle}></td>
                      {MONTHS.map((m, mi) => {
                        const colQty = catItems.reduce(
                          (s, i) => s + getQty(i, m.key),
                          0,
                        );
                        const colAmt = catItems.reduce(
                          (s, i) => s + getAmt(i, m.key),
                          0,
                        );
                        const qMonths =
                          mi === 2
                            ? ["jan", "feb", "mar"]
                            : mi === 5
                              ? ["apr", "may", "jun"]
                              : mi === 8
                                ? ["jul", "aug", "sep"]
                                : mi === 11
                                  ? ["oct", "nov", "dec"]
                                  : null;
                        const qTotal = qMonths
                          ? catItems.reduce(
                              (s, i) => s + getATotal(i, qMonths!),
                              0,
                            )
                          : 0;
                        return (
                          <React.Fragment key={m.key}>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {colQty || ""}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {colAmt ? fmt(colAmt) : ""}
                            </td>
                            {qMonths && (
                              <td
                                style={{
                                  ...tdStyle,
                                  textAlign: "right",
                                  fontWeight: "bold",
                                  backgroundColor:
                                    mi === 2
                                      ? "#C5D9F1"
                                      : mi === 5
                                        ? "#FCE4D6"
                                        : mi === 8
                                          ? "#D9D9D9"
                                          : "#E2EFDA",
                                }}
                              >
                                {fmt(qTotal)}
                              </td>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Grand Total row */}
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
                  const colQty = items.reduce(
                    (s: number, i: any) => s + getQty(i, m.key),
                    0,
                  );
                  const col = items.reduce(
                    (s: number, i: any) => s + getAmt(i, m.key),
                    0,
                  );
                  const colAmt = items.reduce(
                    (s: number, i: any) => s + getAmt(i, m.key),
                    0,
                  );
                  const qMonths =
                    mi === 2
                      ? ["jan", "feb", "mar"]
                      : mi === 5
                        ? ["apr", "may", "jun"]
                        : mi === 8
                          ? ["jul", "aug", "sep"]
                          : mi === 11
                            ? ["oct", "nov", "dec"]
                            : null;
                  const qTotal = qMonths
                    ? items.reduce(
                        (s: number, i: any) => s + getATotal(i, qMonths!),
                        0,
                      )
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
                            backgroundColor:
                              mi === 2
                                ? "#C5D9F1"
                                : mi === 5
                                  ? "#FCE4D6"
                                  : mi === 8
                                    ? "#D9D9D9"
                                    : "#E2EFDA",
                          }}
                        >
                          {fmt(qTotal)}
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

              {/* PROVISION FOR INFLATION */}
              <tr>
                <td
                  colSpan={2}
                  style={{ ...tdStyle, fontWeight: "bold", textAlign: "left" }}
                >
                  + 10% Provision for Inflation
                </td>
                <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
                  {fmt(grandTotal * 0.1)}
                </td>
              </tr>

              {/* CONTINGENCY */}
              <tr>
                <td
                  colSpan={2}
                  style={{ ...tdStyle, fontWeight: "bold", textAlign: "left" }}
                >
                  + 10% Contingency
                </td>
                <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
                  {fmt(grandTotal * 0.1)}
                </td>
              </tr>

              {/* TOTAL ESTIMATED BUDGET */}

              <tr style={{ fontWeight: "bold" }}>
                <td
                  colSpan={2}
                  style={{ ...tdStyle, fontWeight: "bold", textAlign: "left" }}
                >
                  TOTAL ESTIMATED BUDGET:
                </td>
                <td colSpan={4} style={{ ...tdStyle, textAlign: "right" }}>
                  {fmt(grandTotal * 1.2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── SIGNATORY BLOCK ─────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "16px",
            marginTop: "24px",
            fontSize: "9px",
          }}
        >
          {/* Prepared by */}
          <div>
            <p
              style={{
                marginBottom: "32px",
                fontWeight: "bold",
                fontFamily:
                  "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
              }}
            >
              Prepared by:
            </p>
            <div style={{ textAlign: "left" }}>
              <p
                style={{
                  fontWeight: "bold",
                  textDecoration: "underline",
                  textTransform: "uppercase",
                  fontFamily:
                    "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
                  margin: 0,
                }}
              >
                {preparedBy || "___________________________"}
              </p>
              <p
                style={{
                  color: "#555",
                  marginTop: "2px",
                  fontSize: "8px",
                  fontFamily:
                    "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
                }}
              >
                {designation || "Designation"}
              </p>
            </div>
          </div>

          {/* Noted by */}
          <div>
            <p
              style={{
                marginBottom: "32px",
                fontWeight: "bold",
                fontFamily:
                  "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
              }}
            >
              Noted by:
            </p>
            <div style={{ textAlign: "left" }}>
              <p
                style={{
                  fontWeight: "bold",
                  textDecoration: "underline",
                  textTransform: "uppercase",
                  fontFamily:
                    "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
                  margin: 0,
                }}
              >
                JERIEL U. REPOYLO
              </p>
              <p
                style={{
                  color: "#555",
                  marginTop: "2px",
                  fontSize: "8px",
                  fontFamily:
                    "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
                }}
              >
                AO-III / Procurement Officer
              </p>
            </div>
          </div>

          {/* Checked and Reviewed by */}
          <div>
            <p
              style={{
                marginBottom: "32px",
                fontWeight: "bold",
                fontFamily:
                  "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
              }}
            >
              Checked and Reviewed by:
            </p>
            <div style={{ textAlign: "left" }}>
              <p
                style={{
                  fontWeight: "bold",
                  textDecoration: "underline",
                  textTransform: "uppercase",
                  fontFamily:
                    "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
                  margin: 0,
                }}
              >
                DARLENE ABIGAIL T. DABALOS
              </p>
              <p
                style={{
                  color: "#555",
                  marginTop: "2px",
                  fontSize: "8px",
                  fontFamily:
                    "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
                }}
              >
                Administrative Officer IV / Budget Officer
              </p>
            </div>
          </div>

          {/* Approved */}
          <div>
            <p
              style={{
                marginBottom: "32px",
                fontWeight: "bold",
                fontFamily:
                  "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
              }}
            >
              Approved:
            </p>
            <div style={{ textAlign: "left" }}>
              <p
                style={{
                  fontWeight: "bold",
                  textDecoration: "underline",
                  textTransform: "uppercase",
                  fontFamily:
                    "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
                  margin: 0,
                }}
              >
                ARISTON O. RONQUILLO, DM
              </p>
              <p
                style={{
                  color: "#555",
                  marginTop: "2px",
                  fontSize: "8px",
                  fontFamily:
                    "Book Antiqua, Platino, Garamond, Georgia, Times New Roman, serif",
                }}
              >
                Campus Director
              </p>
            </div>
          </div>
        </div>

        {/* ── PAGE FOOTER ─────────────────────────────────────────────────── */}
        <NemsuPageFooter pageNum={1} />
      </div>

      {/* ── Print Styles ────────────────────────────────────────────────────── */}
      <style>{`
    /* ── Screen: make the print area fill height so footer sits at bottom ── */
    #ppmp-print {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }
    .ppmp-footer {
      margin-top: auto;
    }

    /* ── Print ─────────────────────────────────────────────────────────── */
    @media print {
      /* Force the browser to actually print background colors instead of
         silently stripping them. This is what was causing the table to
         come out black-and-white even though every cell has an inline
         backgroundColor — Chrome/Edge/Firefox disable "background
         graphics" by default for print/PDF unless told otherwise. */
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

      /* Tighten cell padding/font specifically for print so more item
         rows fit on a page, without touching on-screen sizing. */
      #ppmp-print table th,
      #ppmp-print table td {
        padding: 1px 3px !important;
        font-size: 6.5px !important;
        line-height: 1.05 !important;
      }

      #ppmp-print table {
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

      .ppmp-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        margin: 0;
        padding: 3px 8mm;
        background: white;
      }

      tr { page-break-inside: avoid; }

      .ppmp-cat-header { page-break-before: auto; }
    }
  `}</style>
    </div>
  );
};

export default PPMPDetail;
