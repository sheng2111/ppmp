import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { exportAPPToExcel } from "../services/exportAPP";
import { useToast } from "../components/feedback/ToastProvider";
import {
  ArrowLeft,
  Printer,
  Download,
  BarChart3,
  Settings,
} from "lucide-react";

// Official GPPB Procurement Strategy / Tools list (APP Column 11).
const PROCUREMENT_STRATEGIES = [
  "Life Cycle Assessment (LCA) and Life Cycle Cost Analysis (LCCA)",
  "Subcontracting",
  "Multi-Year Contracting",
  "Design-and-Build Scheme for Infrastructure Projects",
  "Engagement of a Procurement Agent",
  "Use of Framework Agreement",
  "Pooled Procurement",
  "Renewal of Regular and Recurring Services",
  "Warehousing and Inventory Activities",
] as const;

// The three official APP category bands. Keys match the item_category
// values already used in Create/EditPPMPPage (ITEM_CATEGORIES); labels
// match the exact wording on the official template.
const CATEGORY_ORDER = [
  "General Requirements",
  "Miscellaneous Items",
  "Common Use Supplies and Equipment (CSE)",
] as const;

const CATEGORY_BAND_LABELS: Record<string, string> = {
  "General Requirements": "General Requirements",
  "Miscellaneous Items":
    "Miscellaneous Items (for Direct Acquisition only) Sec 32.2 of RA No. 12009",
  "Common Use Supplies and Equipment (CSE)":
    "Common Use Supplies and Equipment (CSE) to be purchased from PS-DBM (kindly indicate the summary/total amounts only)",
};

interface APPSignatory {
  sign_off: string;
  name: string;
  position: string;
  order_no: number;
}

interface APPRow {
  entry_id: string;
  // Unique per row even when an entry produces more than one (its items
  // span multiple categories) -- entry_id alone can repeat in that case,
  // so this is what React's list key should use instead.
  row_key: string;
  category: string;
  project_title: string;
  end_user: string;
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
}

interface APPData {
  ppmp_id: string;
  ppmp_no: string;
  year: number;
  office_name: string;
  prepared_by?: string | null;
  submitted_by?: string | null;
  version_type: "indicative" | "final" | "updated";
  version_no: string | null;
  signatories: APPSignatory[];
  total_rows: number;
  grand_total: number;
  rows: APPRow[];
}

interface PPMPOption {
  id: string;
  year: number;
  ppmp_no: string | null;
  ppmp_type: string;
  office_id: string;
}

interface Office {
  id: string;
  name: string;
  code: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

const toUpperCaseName = (name: string) => (name ? name.toUpperCase() : "");

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
  fontSize: "8px",
  fontWeight: "bold",
  backgroundColor: "#f2f2f2",
};
const subtotalStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 6px",
  fontSize: "8px",
  fontWeight: "bold",
};
const sigCellStyle: React.CSSProperties = {
  border: "none",
  padding: "0 8px",
  verticalAlign: "bottom",
  textAlign: "left",
  fontSize: "9px",
};
const sigSerifFont =
  "Book Antiqua, Palatino, Garamond, Georgia, Times New Roman, serif";

/** Group signatories for rendering: merge consecutive "Recommending Approval" into one visual group. */
interface SignatoryGroup {
  heading: string;
  signatories: APPSignatory[];
}

function groupSignatories(signatories: APPSignatory[]): SignatoryGroup[] {
  if (!signatories || signatories.length === 0) return [];
  const sorted = [...signatories].sort((a, b) => a.order_no - b.order_no);
  const groups: SignatoryGroup[] = [];
  let i = 0;
  while (i < sorted.length) {
    const s = sorted[i];
    if (s.sign_off === "Recommending Approval") {
      const group: APPSignatory[] = [];
      while (
        i < sorted.length &&
        sorted[i].sign_off === "Recommending Approval"
      ) {
        group.push(sorted[i]);
        i++;
      }
      groups.push({ heading: "Recommending Approval", signatories: group });
    } else {
      groups.push({ heading: s.sign_off, signatories: [s] });
      i++;
    }
  }
  return groups;
}

const APP_COLUMN_HEADERS = [
  "Project Title",
  "End-User or Implementing Unit",
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

const PHONE_ICON = "\u260E\uFE0E";
const GLOBE_ICON = "\uD83C\uDF10\uFE0E";

const selectCls =
  "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40 focus:border-transparent transition";

export default function APPPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdmin = dbUser?.role === "admin";

  const [filteredPpmps, setFilteredPpmps] = useState<PPMPOption[]>([]);
  const [selectedPpmpId, setSelectedPpmpId] = useState<string | null>(null);
  const [appData, setAppData] = useState<APPData | null>(null);
  const [loading, setLoading] = useState(false);

  const [offices, setOffices] = useState<Office[]>([]);
  const [filterOfficeId, setFilterOfficeId] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [initialPpmpId] = useState(() => searchParams.get("ppmpId"));
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    col: "epa" | "strategy";
  } | null>(null);
  const [draftStrategy, setDraftStrategy] = useState<string[]>([]);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const toast = useToast();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

  useEffect(() => {
    if (isAdmin) {
      api.get("/offices/").then((res) => setOffices(res.data));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!dbUser?.id) return;
    const params: Record<string, any> = {};
    if (isAdmin) {
      if (filterOfficeId) params.office_id = filterOfficeId;
      if (filterYear) params.year = Number(filterYear);
    } else {
      params.created_by = dbUser.id;
    }
    api.get("/ppmps/", { params }).then((res) => {
      setFilteredPpmps(res.data);
      // If a ppmpId was passed via query param, auto-select it.
      // Otherwise fall back to the first PPMP in the list.
      if (initialPpmpId && res.data.some((p: PPMPOption) => p.id === initialPpmpId)) {
        setSelectedPpmpId(initialPpmpId);
      } else if (res.data.length > 0) {
        setSelectedPpmpId(res.data[0].id);
      } else {
        setSelectedPpmpId(null);
      }
    });
  }, [dbUser, filterOfficeId, filterYear]);

  useEffect(() => {
    if (!selectedPpmpId) {
      setAppData(null);
      return;
    }
    setLoading(true);
    api
      .get(`/app/generate/from-ppmp/${selectedPpmpId}`)
      .then((res) => setAppData(res.data))
      .catch(() => setAppData(null))
      .finally(() => setLoading(false));
  }, [selectedPpmpId]);

  const saveEntryDetails = async (
    entryId: string,
    patch: Partial<Pick<APPRow, "early_procurement" | "procurement_strategy">>,
  ) => {
    if (!appData) return;
    setSavingRowId(entryId);
    try {
      await api.patch(
        `/app/entry-details/${appData.ppmp_id}/${entryId}`,
        patch,
      );
      setAppData((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) =>
                r.entry_id === entryId ? { ...r, ...patch } : r,
              ),
            }
          : prev,
      );
    } catch (err) {
      toast.error("Failed to save — please try again.");
    } finally {
      setSavingRowId(null);
    }
  };

  const commitEPA = (entryId: string, value: "Yes" | "No") => {
    setEditingCell(null);
    saveEntryDetails(entryId, { early_procurement: value });
  };

  const commitStrategy = (entryId: string) => {
    setEditingCell(null);
    saveEntryDetails(entryId, { procurement_strategy: draftStrategy });
  };

  const getExportableAppData = (data: APPData) => ({
    ...data,
    rows: data.rows.map((row) => ({
      ...row,
      procurement_strategy: row.procurement_strategy.join(", "),
    })),
  });

  const rowsByCategory = (data: APPData) => {
    const buckets: Record<string, APPRow[]> = {
      "General Requirements": [],
      "Miscellaneous Items": [],
      "Common Use Supplies and Equipment (CSE)": [],
    };
    data.rows.forEach((row) => {
      const bucket = buckets[row.category]
        ? row.category
        : "General Requirements";
      buckets[bucket].push(row);
    });
    return buckets;
  };

  const categorySubtotal = (rows: APPRow[]) =>
    rows.reduce((sum, r) => sum + (r.estimated_budget || 0), 0);

  const epaTotal = (data: APPData) =>
    data.rows
      .filter((r) => r.early_procurement === "Yes")
      .reduce((sum, r) => sum + (r.estimated_budget || 0), 0);

  const versionLabel = (data: APPData) => {
    if (data.version_type === "updated") {
      return `UPDATED${data.version_no ? ` [Version No. ${data.version_no}]` : " [Version No. ___]"}`;
    }
    return data.version_type === "final" ? "FINAL" : "INDICATIVE";
  };

  const getSignatoryGroups = (data: APPData): SignatoryGroup[] => {
    if (data.signatories && data.signatories.length > 0) {
      return groupSignatories(data.signatories);
    }
    const legacy: APPSignatory[] = [];
    if (data.prepared_by) {
      legacy.push({
        sign_off: "Prepared by",
        name: data.prepared_by,
        position: "BAC Secretariat",
        order_no: 1,
      });
    }
    if (data.submitted_by) {
      legacy.push({
        sign_off: "Recommended by",
        name: data.submitted_by,
        position: "BAC Chairperson",
        order_no: 2,
      });
    }
    return legacy.length > 0 ? groupSignatories(legacy) : [];
  };

  const renderDataRow = (row: APPRow, i: number) => (
    <tr
      key={row.row_key || row.entry_id || i}
      style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f9fafb" }}
    >
      <td style={tdStyle}>{row.project_title}</td>
      <td style={tdStyle}>{row.end_user}</td>
      <td style={tdStyle}>{row.general_description}</td>
      <td style={tdStyle}>{row.procurement_mode}</td>

      <td style={{ ...tdStyle, textAlign: "center", verticalAlign: "middle" }}>
        {editingCell?.rowId === row.row_key && editingCell.col === "epa" ? (
          <div className="print:hidden flex items-center justify-center gap-1">
            <button
              type="button"
              disabled={savingRowId === row.entry_id}
              onClick={() => commitEPA(row.entry_id, "Yes")}
              className="text-[9px] font-semibold px-2 py-0.5 rounded bg-[#009CC4] text-white disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              disabled={savingRowId === row.entry_id}
              onClick={() => commitEPA(row.entry_id, "No")}
              className="text-[9px] font-semibold px-2 py-0.5 rounded border border-gray-300 text-gray-600 disabled:opacity-50"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setEditingCell(null)}
              className="text-[9px] text-gray-400 ml-1"
            >
              X
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center justify-center gap-1">
            {row.early_procurement || "—"}
            <button
              type="button"
              onClick={() => setEditingCell({ rowId: row.row_key, col: "epa" })}
              className="print:hidden text-[8px] text-[#009CC4] underline"
            >
              {row.early_procurement ? "edit" : "add"}
            </button>
          </span>
        )}
      </td>

      <td style={{ ...tdStyle, textAlign: "center", verticalAlign: "middle" }}>
        {row.bid_evaluation}
      </td>
      <td style={tdStyle}>{row.start_activity}</td>
      <td style={tdStyle}>{row.end_activity}</td>
      <td style={tdStyle}>{row.source_of_funds}</td>
      <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
        {row.estimated_budget ? `₱${fmt(row.estimated_budget)}` : ""}
      </td>

      <td style={tdStyle}>
        {editingCell?.rowId === row.row_key &&
        editingCell.col === "strategy" ? (
          <div className="print:hidden bg-white border border-gray-200 rounded-lg p-2 shadow-sm w-56">
            {PROCUREMENT_STRATEGIES.map((s) => {
              const checked = draftStrategy.includes(s);
              return (
                <label
                  key={s}
                  className="flex items-start gap-1.5 text-[9px] leading-tight text-gray-700 mb-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={() =>
                      setDraftStrategy((prev) =>
                        checked ? prev.filter((x) => x !== s) : [...prev, s],
                      )
                    }
                  />
                  {s}
                </label>
              );
            })}
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                disabled={savingRowId === row.entry_id}
                onClick={() => commitStrategy(row.entry_id)}
                className="text-[9px] font-semibold text-white bg-[#009CC4] px-2 py-1 rounded disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="text-[9px] text-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <span className="inline-flex items-start gap-1">
            {row.procurement_strategy?.length
              ? row.procurement_strategy.join(", ")
              : "—"}
            <button
              type="button"
              onClick={() => {
                setDraftStrategy(row.procurement_strategy || []);
                setEditingCell({ rowId: row.row_key, col: "strategy" });
              }}
              className="print:hidden text-[8px] text-[#009CC4] underline shrink-0"
            >
              {row.procurement_strategy?.length ? "edit" : "add"}
            </button>
          </span>
        )}
      </td>

      <td style={tdStyle}>{row.remarks}</td>
    </tr>
  );

  return (
    <div
      className="space-y-4"
      style={{ fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" }}
    >
      <div
        className="print:hidden rounded-xl p-5 text-white shadow-md relative overflow-hidden"
        style={{ background: "#061451" }}
      >
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: "#009CC4", transform: "translate(30%, -50%)" }}
        />

        <div className="flex items-center justify-between relative z-10 flex-wrap gap-3">
          <div>
            <p
              className="text-xs uppercase tracking-widest font-semibold mb-1"
              style={{ color: "#009CC4" }}
            >
              Annual Procurement Plan
              {appData && ` — FY ${appData.year} (${versionLabel(appData)})`}
            </p>
            <h1 className="text-lg font-bold text-white">
              {appData?.office_name ||
                (isAdmin ? "View APP by Office" : "Generate APP from PPMP")}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            {appData && (
              <>
                <button
                  onClick={() => navigate(`/app/settings/${appData.ppmp_id}`)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Settings className="w-3.5 h-3.5" /> APP Settings
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() =>
                    appData &&
                    exportAPPToExcel(
                      getExportableAppData(appData),
                      appData.version_type,
                    )
                  }
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition"
                  style={{ background: "#009CC4", color: "#fff" }}
                >
                  <Download className="w-3.5 h-3.5" /> Export Excel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="print:hidden bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        {isAdmin && (
          <>
            <select
              className={selectCls}
              value={filterOfficeId}
              onChange={(e) => setFilterOfficeId(e.target.value)}
            >
              <option value="">All Offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">All Years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  FY {y}
                </option>
              ))}
            </select>
            <div className="w-px h-6 bg-gray-200" />
          </>
        )}

        <select
          className={selectCls}
          value={selectedPpmpId || ""}
          onChange={(e) => setSelectedPpmpId(e.target.value)}
        >
          {filteredPpmps.length === 0 ? (
            <option>No PPMPs available</option>
          ) : (
            filteredPpmps.map((p) => (
              <option key={p.id} value={p.id}>
                FY {p.year} — PPMP No. {p.ppmp_no} ({p.ppmp_type})
              </option>
            ))
          )}
        </select>

        {appData && (
          <span className="ml-auto text-xs text-gray-400">
            {appData.total_rows} line{appData.total_rows !== 1 ? "s" : ""}
            {" · "}
            <span className="font-semibold" style={{ color: "#061451" }}>
              ₱{fmt(appData.grand_total)}
            </span>
          </span>
        )}
      </div>

      {filteredPpmps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <BarChart3 className="w-8 h-8 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">
            {isAdmin
              ? "No PPMPs found for the selected filters."
              : "You need to create a PPMP first before generating an APP."}
          </p>
          {!isAdmin && (
            <button
              onClick={() => navigate("/ppmps/create")}
              className="mt-4 px-5 py-2 text-sm font-semibold text-white rounded-lg transition hover:opacity-90"
              style={{ background: "#061451" }}
            >
              Create your first PPMP
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div
            className="w-8 h-8 border-[3px] rounded-full animate-spin"
            style={{ borderColor: "#009CC4", borderTopColor: "transparent" }}
          />
          <p className="text-sm text-gray-400">Generating APP…</p>
        </div>
      ) : !appData ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
          <p className="text-gray-400 text-sm">Failed to generate APP data.</p>
        </div>
      ) : (
        <div
          id="app-print"
          className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
          style={{
            fontFamily: "Calibri, sans-serif",
            fontSize: "9px",
            padding: "16px 20px",
          }}
        >
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
                      width: "55px",
                      height: "55px",
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <p
                    style={{
                      fontSize: "10px",
                      margin: "0",
                      textAlign: "center",
                    }}
                  >
                    Republic of the Philippines
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: "bold",
                      margin: "2px 0",
                      textAlign: "center",
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
                    ANNUAL PROCUREMENT PLAN FOR FY {appData.year}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>

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
                            {appData.version_type === vt ? "✔" : ""}
                          </span>
                          {vt.toUpperCase()}
                          {vt === "updated" &&
                            appData.version_type === "updated" &&
                            ` [Version No. ${appData.version_no || "___"}]`}
                        </span>
                      </span>
                    ),
                  )}
                </td>
              </tr>
              {/* <tr>
                <td style={{ border: "none", padding: "1px 6px" }} colSpan={2}>
                  <strong style={{ display: "inline-block", width: "220px" }}>
                    End-User or Implementing Unit:
                  </strong>
                  {appData.office_name}
                </td>
              </tr> */}
            </tbody>
          </table>

          <div style={{ overflowX: "auto" }}>
            <table
              className="app-schedule-table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "auto",
                border: "1px solid black",
              }}
            >
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "7%" }} />
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
                  <th style={thStyle}>PROCUREMENT STRATEGY OR TOOLS</th>
                  <th style={thStyle}>REMARKS</th>
                </tr>
                <tr>
                  {APP_COLUMN_HEADERS.map((h, i) => (
                    <th key={i} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
                <tr>
                  {APP_COLUMN_HEADERS.map((_, i) => (
                    <th
                      key={i}
                      style={{ ...thStyle, backgroundColor: "#f2f2f2" }}
                    >
                      Column {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const buckets = rowsByCategory(appData);
                  // Only render category bands that actually have rows —
                  // an empty category (e.g. no Miscellaneous Items) is
                  // skipped entirely instead of showing an empty band
                  // with a ₱0.00 subtotal.
                  const visibleCategories = CATEGORY_ORDER.filter(
                    (cat) => buckets[cat].length > 0,
                  );

                  if (visibleCategories.length === 0) {
                    return (
                      <tr>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "center",
                            color: "#94a3b8",
                          }}
                          colSpan={12}
                        >
                          No items yet.
                        </td>
                      </tr>
                    );
                  }

                  return visibleCategories.map((cat) => {
                    const rows = buckets[cat];
                    const subtotal = categorySubtotal(rows);
                    return (
                      <React.Fragment key={cat}>
                        <tr>
                          <td style={categoryBandStyle} colSpan={12}>
                            {CATEGORY_BAND_LABELS[cat]}
                          </td>
                        </tr>
                        {rows.map((row, i) => renderDataRow(row, i))}
                        <tr>
                          <td
                            style={{ ...tdStyle, border: "1px solid black" }}
                            colSpan={9}
                          />
                          <td style={subtotalStyle}>₱{fmt(subtotal)}</td>
                          <td
                            style={{ ...tdStyle, border: "1px solid black" }}
                            colSpan={2}
                          />
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()}
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
                    ₱{fmt(appData.grand_total)}
                  </td>
                  <td
                    style={{ ...tdStyle, border: "1px solid black" }}
                    colSpan={2}
                  />
                </tr>
              </tbody>
            </table>
          </div>

          {/* <p style={{ fontSize: "8px", margin: "4px 0" }}>
            Note: Insert additional rows as necessary
          </p> */}
          {/* <table style={{ fontSize: "9px", marginTop: "2px" }}>
            <tbody>
              <tr>
                <td
                  style={{
                    border: "none",
                    padding: "1px 0",
                    fontWeight: "bold",
                  }}
                >
                  Total Amount of Estimated Budget for EPA Projects:
                </td>
                <td style={{ border: "none", padding: "1px 0 1px 8px" }}>
                  ₱{fmt(epaTotal(appData))}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "none",
                    padding: "1px 0",
                    fontWeight: "bold",
                  }}
                >
                  Total Amount of CSEs to be purchased from PS-DBM:
                </td>
                <td style={{ border: "none", padding: "1px 0 1px 8px" }}>
                  ₱
                  {fmt(
                    categorySubtotal(
                      rowsByCategory(appData)[
                        "Common Use Supplies and Equipment (CSE)"
                      ],
                    ),
                  )}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "none",
                    padding: "1px 0",
                    fontWeight: "bold",
                  }}
                >
                  Total Amount of Estimated Budget:
                </td>
                <td style={{ border: "none", padding: "1px 0 1px 8px" }}>
                  ₱{fmt(appData.grand_total)}
                </td>
              </tr>
            </tbody>
          </table> */}

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "24px",
              fontSize: "9px",
            }}
          >
            <tbody>
              {getSignatoryGroups(appData).length === 0 ? (
                <tr>
                  <td
                    style={{
                      ...sigCellStyle,
                      fontStyle: "italic",
                      color: "#94a3b8",
                    }}
                  >
                    No APP signatories set yet — add them in APP Settings.
                  </td>
                </tr>
              ) : (
                (() => {
                  const groups = getSignatoryGroups(appData);
                  const totalCols = 5; // 5 signatory columns total
                  return (
                    <>
                      {/* Heading row */}
                      <tr>
                        {groups.map((group, gIdx) => (
                          <td
                            key={`heading-${gIdx}`}
                            colSpan={group.signatories.length}
                            style={{
                              ...sigCellStyle,
                              fontWeight: "bold",
                              fontFamily: sigSerifFont,
                              width: `${(group.signatories.length / totalCols) * 100}%`,
                            }}
                          >
                            {group.heading}:
                          </td>
                        ))}
                      </tr>
                      {/* Space row */}
                      <tr>
                        {groups.map((group, gIdx) => (
                          <td
                            key={`space-${gIdx}`}
                            colSpan={group.signatories.length}
                            style={{
                              ...sigCellStyle,
                              height: "28px",
                              width: `${(group.signatories.length / totalCols) * 100}%`,
                            }}
                          />
                        ))}
                      </tr>
                       {/* Name row */}
                       <tr>
                         {groups.map((group, gIdx) =>
                           group.signatories.map((_s, sIdx) => (
                             <td
                               key={`name-${gIdx}-${sIdx}`}
                               style={{
                                 ...sigCellStyle,
                                 fontWeight: "bold",
                                textDecoration: "underline",
                                fontFamily: sigSerifFont,
                                width: `${(1 / totalCols) * 100}%`,
                              }}
                            >
                              {toUpperCaseName(s.name) ||
                                "________________________________"}
                            </td>
                          )),
                        )}
                      </tr>
                      {/* Position row */}
                      <tr>
                        {groups.map((group, gIdx) =>
                          group.signatories.map((s, sIdx) => (
                            <td
                              key={`pos-${gIdx}-${sIdx}`}
                              style={{
                                ...sigCellStyle,
                                fontSize: "8px",
                                paddingTop: "2px",
                                fontFamily: sigSerifFont,
                                width: `${(1 / totalCols) * 100}%`,
                              }}
                            >
                              {s.position}
                            </td>
                          )),
                        )}
                      </tr>
                      {/* Date row */}
                      <tr>
                        {groups.map((group, gIdx) =>
                          group.signatories.map((_s, sIdx) => (
                            <td
                              key={`date-${gIdx}-${sIdx}`}
                              style={{
                                ...sigCellStyle,
                                fontSize: "8px",
                                paddingTop: "8px",
                                fontFamily: sigSerifFont,
                                width: `${(1 / totalCols) * 100}%`,
                              }}
                            >
                              Date: _________________
                            </td>
                          )),
                        )}
                      </tr>
                    </>
                  );
                })()
              )}
            </tbody>
          </table>

          <div
            className="app-footer"
            style={{
              marginTop: "24px",
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
        </div>
      )}

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #app-print, #app-print * { visibility: visible; }
          #app-print img { visibility: visible !important; display: block !important; }
          #app-print { position: fixed; top: 0; left: 0; width: 100%; padding: 8mm 10mm; font-size: 7px; }
          .app-schedule-table th, .app-schedule-table td { padding: 2px 4px !important; font-size: 7px !important; line-height: 1.2 !important; border: 1px solid black !important; }
          .app-schedule-table { border: 1px solid black !important; border-collapse: collapse !important; }
          @page { size: legal landscape; margin: 6mm 8mm; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          .app-footer {
            position: fixed;
            bottom: 4mm;
            left: 8mm;
            right: 8mm;
            margin-top: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
