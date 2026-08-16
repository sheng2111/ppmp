import { useEffect, useMemo, useState } from "react";
import {
  fetchConsolidatedPPMP,
  downloadConsolidatedExport,
  fetchFeeCategories,
} from "../../services/consolidation";
import type { ConsolidatedPPMPResponse } from "../../services/consolidation";
import OfficeGroup from "../../components/consolidation/OfficeGroup";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";

const PPMP_TYPES = ["indicative", "final"] as const;

const fmt = (n?: number) =>
  n
    ? n.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

const PHONE_ICON = "\u260E\uFE0E";
const GLOBE_ICON = "\uD83C\uDF10\uFE0E";

export default function AdminConsolidatedPPMPPage() {
  const { user: supabaseUser } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [feeCategory, setFeeCategory] = useState("");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [ppmpType, setPpmpType] =
    useState<(typeof PPMP_TYPES)[number]>("final");
  const [search, setSearch] = useState("");

  const [data, setData] = useState<ConsolidatedPPMPResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  // Load the real Fee Category list (STF, OJT Fees, Laboratory Fees, etc.)
  // — the same list shown in the Fee Categories admin tab. Default the
  // filter to the first one once they arrive.
  useEffect(() => {
    if (!supabaseUser) return;
    fetchFeeCategories(supabaseUser.id)
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

    fetchConsolidatedPPMP(
      { feeCategory, fiscalYear, ppmpType },
      supabaseUser.id,
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load consolidated PPMP data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feeCategory, fiscalYear, ppmpType, supabaseUser]);

  const filteredOffices = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.offices;

    return data.offices
      .map((office) => {
        const officeMatches = office.office_name.toLowerCase().includes(q);
        const matchingProjects = office.projects.filter(
          (p) =>
            p.project_label.toLowerCase().includes(q) ||
            p.entries.some((e) => e.description.toLowerCase().includes(q)),
        );
        if (officeMatches) return office;
        if (matchingProjects.length > 0)
          return { ...office, projects: matchingProjects };
        return null;
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);
  }, [data, search]);

  const handleExport = async (kind: "excel" | "pdf") => {
    if (!supabaseUser) return;
    setExporting(kind);
    try {
      await downloadConsolidatedExport(
        kind,
        { feeCategory, fiscalYear, ppmpType },
        supabaseUser.id,
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar — same gradient banner treatment as PPMPDetailPage */}
      <PageHeader
        title={
          data
            ? `${data.office_count} Office${data.office_count !== 1 ? "s" : ""}`
            : "Loading..."
        }
        subtitle={`Consolidated PPMP — ${feeCategory} — FY ${fiscalYear} (${ppmpType === "indicative" ? "Indicative" : "Final"})`}
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
              {PPMP_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setPpmpType(t)}
                  className={`px-3 py-2 text-xs font-semibold transition ${
                    ppmpType === t
                      ? "bg-white text-blue-900"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {t === "indicative" ? "Indicative" : "Final"}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search office or project..."
              className="text-xs bg-white/10 text-white placeholder-white/60 px-3 py-2 rounded-xl border border-white/20 outline-none min-w-[12.5rem]"
            />
            <button
              onClick={() => handleExport("excel")}
              disabled={
                !data || data.offices.length === 0 || exporting !== null
              }
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition disabled:opacity-40"
            >
              📊 {exporting === "excel" ? "Exporting..." : "Export Excel"}
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={
                !data || data.offices.length === 0 || exporting !== null
              }
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-blue-900 px-3 py-2 rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-40"
            >
              📥 {exporting === "pdf" ? "Exporting..." : "Export PDF"}
            </button>
          </>
        }
      />

      <p className="text-xs text-slate-500 px-1">
        Read-only consolidation. Edits must be made on each office's original
        PPMP.
      </p>

      {/* Report area */}
      <div
        id="ppmp-consolidation-print"
        className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
        style={{
          fontFamily: "Calibri, sans-serif",
          fontSize: "9px",
          padding: "16px 20px",
        }}
      >
        {/* Letterhead + Meta — only show when there's data */}
        {!loading && !error && data && data.offices.length > 0 && (
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
                  PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) — CONSOLIDATED
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
                    {ppmpType === "indicative" ? "✔" : ""}
                  </span>
                  INDICATIVE
                </span>
                <span style={{ display: "inline-block", width: "24px" }} />
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
                    {ppmpType === "final" ? "✔" : ""}
                  </span>
                  FINAL
                </span>
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
            Loading consolidated data...
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && data && data.offices.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No submitted PPMPs found for {feeCategory} — FY {fiscalYear} —{" "}
            {ppmpType}.
          </div>
        )}

        {!loading &&
          !error &&
          filteredOffices.length === 0 &&
          data &&
          data.offices.length > 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              No offices or projects match "{search}".
            </div>
          )}

        {!loading &&
          !error &&
          filteredOffices.map((office) => (
            <OfficeGroup key={office.office_id} office={office} />
          ))}

        {!loading && !error && data && data.offices.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "8px",
            }}
          >
            <tbody>
              <tr>
                <td
                  colSpan={4}
                  style={{
                    border: "1px solid black",
                    padding: "6px 8px",
                    textAlign: "right",
                    fontWeight: "bold",
                    fontSize: "11px",
                    backgroundColor: "#1e3a6e",
                    color: "white",
                  }}
                >
                  GRAND TOTAL:
                </td>
                <td
                  style={{
                    border: "1px solid black",
                    padding: "6px 8px",
                    textAlign: "right",
                    fontWeight: "bold",
                    fontSize: "11px",
                    backgroundColor: "#1e3a6e",
                    color: "white",
                  }}
                >
                  ₱{fmt(data.grand_total)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Footer — only show when there's data */}
        {!loading && !error && data && data.offices.length > 0 && (
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
              className="ppmp-page-number"
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
          #ppmp-consolidation-print, #ppmp-consolidation-print * { visibility: visible; }
          #ppmp-consolidation-print img { visibility: visible !important; display: block !important; }
          #ppmp-consolidation-print { width: 100%; padding: 0; font-size: 8px; }

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
          .ppmp-page-number {
            display: none !important;
          }

          tr { page-break-inside: avoid; }
          th, td { overflow-wrap: anywhere; word-break: break-word; }
        }
      `}</style>
    </div>
  );
}
