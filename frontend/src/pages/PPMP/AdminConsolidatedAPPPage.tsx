import { useEffect, useMemo, useState } from "react";
import {
  fetchConsolidatedAPP,
  downloadConsolidatedAPPExport,
  fetchConsolidatedAPPCategories,
} from "../../services/consolidatedAPP";
import type { ConsolidatedAPPResponse } from "../../services/consolidatedAPP";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";

const VERSION_TYPES = ["indicative", "final", "updated"] as const;

const fmt = (n?: number) =>
  n
    ? n.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

const PHONE_ICON = "\u260E\uFE0E";
const GLOBE_ICON = "\uD83C\uDF10\uFE0E";

const APP_COLUMN_HEADERS = [
  "Project Title",
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
];

const TOTAL_COLS = APP_COLUMN_HEADERS.length; // 11 — no End-User column

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
const categoryBandStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  textAlign: "left",
  fontSize: "9px",
  fontWeight: "bold",
  backgroundColor: "#f2f2f2",
};
const subtotalStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  fontSize: "8px",
  fontWeight: "bold",
};

export default function AdminConsolidatedAPPPage() {
  const { user: supabaseUser } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [feeCategory, setFeeCategory] = useState("");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [appVersionType, setAppVersionType] =
    useState<(typeof VERSION_TYPES)[number]>("final");
  const [search, setSearch] = useState("");

  const [data, setData] = useState<ConsolidatedAPPResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  useEffect(() => {
    if (!supabaseUser) return;
    fetchConsolidatedAPPCategories(supabaseUser.id)
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setFeeCategory((prev) => prev || cats[0]);
      })
      .catch(() => {});
  }, [supabaseUser]);

  useEffect(() => {
    if (!supabaseUser || !feeCategory) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchConsolidatedAPP(
      { feeCategory, fiscalYear, appVersionType },
      supabaseUser.id,
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load consolidated APP data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feeCategory, fiscalYear, appVersionType, supabaseUser]);

  const filteredCategories = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.categories;

    return data.categories
      .map((cat) => {
        const catMatches = cat.label.toLowerCase().includes(q);
        const matchingRows = cat.rows.filter(
          (r) =>
            r.project_title.toLowerCase().includes(q) ||
            r.general_description.toLowerCase().includes(q),
        );
        if (catMatches) return cat;
        if (matchingRows.length > 0)
          return { ...cat, rows: matchingRows, subtotal: matchingRows.reduce((s, r) => s + r.estimated_budget, 0) };
        return null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [data, search]);

  const handleExport = async (kind: "excel" | "pdf") => {
    if (!supabaseUser) return;
    setExporting(kind);
    try {
      await downloadConsolidatedAPPExport(
        kind,
        { feeCategory, fiscalYear, appVersionType },
        supabaseUser.id,
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <PageHeader
        title={
          data
            ? `${data.ppmp_count} PPMP${data.ppmp_count !== 1 ? "s" : ""}`
            : "Loading..."
        }
        subtitle={`Consolidated APP — ${feeCategory} — FY ${fiscalYear} (${appVersionType.charAt(0).toUpperCase() + appVersionType.slice(1)})`}
        variant="dark"
        actions={
          <>
            <select
              value={feeCategory}
              onChange={(e) => setFeeCategory(e.target.value)}
              className="text-xs font-semibold bg-white/10 text-white px-3 py-2 rounded-xl border border-white/20 outline-none"
            >
              {categories.length === 0 && (
                <option value="">Loading categories...</option>
              )}
              {categories.map((c) => (
                <option key={c} value={c} style={{ color: "black" }}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              min={2000}
              max={2099}
              className="text-xs font-semibold bg-white/10 text-white px-3 py-2 rounded-xl border border-white/20 outline-none w-20"
            />
            <div className="flex rounded-xl overflow-hidden border border-white/20">
              {VERSION_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setAppVersionType(t)}
                  className={`px-3 py-2 text-xs font-semibold transition ${
                    appVersionType === t
                      ? "bg-white text-blue-900"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project or description..."
              className="text-xs bg-white/10 text-white placeholder-white/60 px-3 py-2 rounded-xl border border-white/20 outline-none min-w-[12.5rem]"
            />
            <button
              onClick={() => handleExport("excel")}
              disabled={
                !data || data.categories.length === 0 || exporting !== null
              }
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition disabled:opacity-40"
            >
              📊 {exporting === "excel" ? "Exporting..." : "Export Excel"}
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={
                !data || data.categories.length === 0 || exporting !== null
              }
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-blue-900 px-3 py-2 rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-40"
            >
              📥 {exporting === "pdf" ? "Exporting..." : "Export PDF"}
            </button>
          </>
        }
      />

      <p className="text-xs text-slate-500 px-1">
        Read-only consolidated view. Items from all offices under this Fee
        Category are merged by procurement category.
      </p>

      {/* Report area */}
      <div
        id="app-consolidation-print"
        className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
        style={{
          fontFamily: "Calibri, sans-serif",
          fontSize: "9px",
          padding: "16px 20px",
        }}
      >
        {/* Letterhead + Meta — only show when there's data */}
        {!loading && !error && data && data.categories.length > 0 && (
          <>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "6px",
          }}
        >
          <tbody>
            <tr>
              <td style={{ border: "none", textAlign: "center", padding: 0 }}>
                <img
                  src="/nemsu-logo.png"
                  alt="NEMSU Logo"
                  style={{
                    display: "block",
                    margin: "0 auto",
                    width: "90%",
                    height: "90px",
                    objectFit: "contain",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <p
                  style={{
                    fontSize: "10px",
                    marginTop: "-18px",
                    textAlign: "center",
                  }}
                >
                  Republic of the Philippines
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    margin: "0",
                    textAlign: "center",
                    marginTop: "-7px",
                  }}
                >
                  NORTH EASTERN MINDANAO STATE UNIVERSITY
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    margin: "4px 0",
                    textAlign: "center",
                  }}
                >
                  ANNUAL PROCUREMENT PLAN (APP) — CONSOLIDATED
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Meta */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "9px",
            marginBottom: "6px",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  border: "none",
                  padding: "3px 6px",
                  textAlign: "center",
                }}
                colSpan={2}
              >
                {(["indicative", "final", "updated"] as const).map(
                  (vt, idx) => (
                    <span key={vt}>
                      {idx > 0 && (
                        <span
                          style={{ display: "inline-block", width: "24px" }}
                        />
                      )}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: "10px",
                            height: "10px",
                            border: "1px solid #000",
                            textAlign: "center",
                            lineHeight: "9px",
                            fontSize: "8px",
                          }}
                        >
                          {appVersionType === vt ? "✔" : ""}
                        </span>
                        {vt.toUpperCase()}
                      </span>
                    </span>
                  ),
                )}
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "1px 6px" }} colSpan={2}>
                <strong style={{ display: "inline-block", width: "220px" }}>
                  Fiscal Year:
                </strong>
                {fiscalYear}
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "1px 6px" }} colSpan={2}>
                <strong style={{ display: "inline-block", width: "220px" }}>
                  Fee Category:
                </strong>
                {feeCategory}
              </td>
            </tr>
          </tbody>
        </table>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
            <div className="w-5 h-5 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
            Loading consolidated APP data...
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && data && data.categories.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No submitted PPMPs with {appVersionType} APP found for{" "}
            {feeCategory} — FY {fiscalYear}.
          </div>
        )}

        {!loading &&
          !error &&
          filteredCategories.length === 0 &&
          data &&
          data.categories.length > 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              No projects or descriptions match "{search}".
            </div>
          )}

        {/* APP table */}
        {!loading && !error && filteredCategories.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "auto",
                border: "1px solid black",
              }}
            >
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "6%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={thStyle} colSpan={4}>
                    PROCUREMENT PROJECT DETAILS
                  </th>
                  <th style={thStyle} colSpan={4}>
                    PROJECTED TIMELINE (MM/YYYY)
                  </th>
                  <th style={thStyle} colSpan={2}>
                    FUNDING DETAILS
                  </th>
                  <th style={thStyle}>REMARKS</th>
                </tr>
                <tr>
                  {APP_COLUMN_HEADERS.map((h, i) => (
                    <th key={i} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => (
                  <CategoryBand key={cat.name} cat={cat} />
                ))}

                <tr style={{ fontWeight: "bold" }}>
                  <td
                    style={{ ...tdStyle, border: "1px solid black" }}
                    colSpan={7}
                  />
                  <td
                    colSpan={2}
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      border: "1px solid black",
                    }}
                  >
                    TOTAL BUDGET:
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      border: "1px solid black",
                    }}
                  >
                    ₱{fmt(data!.grand_total)}
                  </td>
                  <td
                    style={{ ...tdStyle, border: "1px solid black" }}
                  />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer — only show when there's data */}
        {!loading && !error && data && data.categories.length > 0 && (
        <div
          className="ppmp-footer"
          style={{
            marginTop: "16px",
            paddingTop: "6px",
            borderTop: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "8px",
            backgroundColor: "#fff",
          }}
        >
          <div style={{ lineHeight: 1.6, color: "#000" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <img
                src="/logo-transparent.png"
                alt="Location"
                style={{
                  width: 14,
                  height: 14,
                  objectFit: "contain",
                  marginRight: "-5px",
                  marginLeft: "-3px",
                }}
              />
              Tagbina, Surigao del Sur 8308
            </div>
            <div>{PHONE_ICON} 086-628-0714</div>
            <div>{GLOBE_ICON} www.nemsu.edu.ph</div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img
              src="/alpas-logo.png"
              alt="A.L.P.A.S."
              style={{
                height: "55px",
                objectFit: "contain",
                marginBottom: "-23px",
                marginRight: "-13px",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <img
              src="/ukas-logo.png"
              alt="UKAS"
              style={{
                height: "37px",
                width: "60px",
                marginBottom: "-2px",
                marginRight: "-13px",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <img
              src="/bagong-pilipinas-logo.png"
              alt="Bagong Pilipinas"
              style={{
                height: "50px",
                objectFit: "contain",
                marginBottom: "-3px",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />

            <span
              className="app-page-number"
              style={{
                fontSize: "9px",
                color: "#000",
                whiteSpace: "nowrap",
                marginBottom: "-32px",
              }}
            >
              Page 1
            </span>
          </div>
        </div>
        )}
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #app-consolidation-print, #app-consolidation-print * { visibility: visible; }
          #app-consolidation-print img { visibility: visible !important; display: block !important; }
          #app-consolidation-print { width: 100%; padding: 0; font-size: 8px; }

          @page {
            size: 13in 8.5in;
            margin: 0.5in;
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-family: Calibri, sans-serif;
              font-size: 8px;
            }
          }

          .ppmp-footer {
            position: fixed;
            bottom: 4mm;
            left: 0.5in;
            right: 0.5in;
            margin-top: 0 !important;
          }
          .app-page-number {
            display: none !important;
          }

          tr { page-break-inside: avoid; }
          th, td { overflow-wrap: anywhere; word-break: break-word; }
        }
      `}</style>
    </div>
  );
}

// ── Category Band sub-component ──────────────────────────────────────────

interface CategoryBandProps {
  cat: {
    name: string;
    label: string;
    rows: Array<{
      row_key: string;
      project_title: string;
      general_description: string;
      procurement_mode: string;
      early_procurement: string;
      bid_evaluation: string;
      start_activity: string;
      end_activity: string;
      source_of_funds: string;
      estimated_budget: number;
      procurement_strategy: string[];
      remarks: string;
    }>;
    subtotal: number;
  };
}

function CategoryBand({ cat }: CategoryBandProps) {
  return (
    <>
      <tr>
        <td style={categoryBandStyle} colSpan={TOTAL_COLS}>
          {cat.label}
        </td>
      </tr>
      {cat.rows.map((row, i) => (
        <tr
          key={row.row_key}
          style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f9fafb" }}
        >
          <td style={tdStyle}>{row.project_title}</td>
          <td style={tdStyle}>{row.general_description}</td>
          <td style={{ ...tdStyle, textAlign: "center" }}>
            {row.procurement_mode}
          </td>
          <td style={{ ...tdStyle, textAlign: "center" }}>
            {row.early_procurement || "—"}
          </td>
          <td style={{ ...tdStyle, textAlign: "center" }}>
            {row.bid_evaluation}
          </td>
          <td style={{ ...tdStyle, textAlign: "center" }}>
            {row.start_activity}
          </td>
          <td style={{ ...tdStyle, textAlign: "center" }}>
            {row.end_activity}
          </td>
          <td style={{ ...tdStyle, textAlign: "center" }}>
            {row.source_of_funds}
          </td>
          <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
            {row.estimated_budget ? `₱${fmt(row.estimated_budget)}` : ""}
          </td>
          <td style={tdStyle}>
            {row.procurement_strategy?.length
              ? row.procurement_strategy.join(", ")
              : "—"}
          </td>
          <td style={tdStyle}>{row.remarks}</td>
        </tr>
      ))}
      <tr>
        <td
          style={{ ...tdStyle, border: "1px solid black" }}
          colSpan={8}
        />
        <td style={subtotalStyle}>₱{fmt(cat.subtotal)}</td>
        <td style={{ ...tdStyle, border: "1px solid black" }} colSpan={2} />
      </tr>
    </>
  );
}
