import { useState, useEffect, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/feedback/ToastProvider";
import type { PPMP, Office } from "../../types";
import { Download } from "lucide-react";
import { exportPPMPToExcel } from "../../services/exportPPMP";
import PageHeader from "../../components/layout/PageHeader";

const fmt = (n?: number) =>
  n
    ? n.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";

// Prepared by / Submitted by are stored and displayed in ALL CAPS,
// matching the Create PPMP form. Uppercase again here as a safety net
// in case a name was ever saved another way.
const toDisplayName = (value?: string | null) =>
  value ? value.toUpperCase() : "";

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
const sigCellStyle: React.CSSProperties = {
  border: "none",
  padding: "0 8px",
  verticalAlign: "bottom",
  width: "260px",
  textAlign: "left",
  fontSize: "9px",
};
// Empty spacer cell between signatory blocks — bump this width up or down
// to control how far apart they sit.
const sigSpacerStyle: React.CSSProperties = {
  border: "none",
  width: "80px",
};
const sigSerifFont =
  "Book Antiqua, Palatino, Garamond, Georgia, Times New Roman, serif";

// ── Redesigned section-row styles (project-details area only) ─────────────
// These match the Excel PPMP layout: full-width banner rows for
// Short/Additional Description (PPMP-level, shown once) and Code
// (entry-level, repeated per procurement entry), plus the item and
// subtotal rows beneath them.
const bannerRowStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "4px 8px",
  textAlign: "left",
  fontSize: "9px",
  fontWeight: "bold",
  whiteSpace: "normal",
};
const codeRowStyle: React.CSSProperties = {
  ...bannerRowStyle,
  backgroundColor: "#EAF1D9",
  fontWeight: "bold",
};
const subtotalLabelStyle: React.CSSProperties = {
  ...tdStyle,
  border: "1px solid black",
  textAlign: "right",
  fontWeight: "bold",
  backgroundColor: "#FFFFFF",
};
const subtotalValueStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontWeight: "bold",
  backgroundColor: "#FFFFFF",
};

// Text-presentation emoji for the footer — the \uFE0E variation selector
// forces these to render as plain black glyphs instead of colorful emoji
// art. The pin doesn't have a text-presentation fallback (most fonts keep
// it colorful regardless), so that one uses /logo-transparent.png instead.
const PHONE_ICON = "\u260E\uFE0E"; // ☎ (text presentation)
const GLOBE_ICON = "\uD83C\uDF10\uFE0E"; // 🌐 (text presentation)

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

const TOTAL_COLS = COLUMN_HEADERS.length; // 12 — used for full-width banner rows

// Signatories always render on a single line, however many there are —
// see sigCellWidth/sigSpacerWidth below, which shrink per-signatory width
// as the count grows instead of wrapping to a new row.

export default function PPMPDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [ppmp, setPpmp] = useState<PPMP | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [feeCategory, setFeeCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPrs, setHasPrs] = useState(false);
  const [unsubmitting, setUnsubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Split into two independent steps: the PPMP itself, and its office.
    // A broken/missing office_id (deleted office, bad reference, etc.)
    // should NOT fail the whole page — it should just show the PPMP with
    // an "Unknown Office" fallback instead of a blank error screen.
    api
      .get(`/ppmps/${id}`, { params: { requester_uid: user?.id } })
      .then(async (res) => {
        if (cancelled) return;
        const ppmpData = res.data;
        setPpmp(ppmpData);

        try {
          const prsRes = await api.get(`/ppmps/${id}/has-prs`);
          if (!cancelled) setHasPrs(prsRes.data.has_prs);
        } catch {
          // Ignore
        }

        if (ppmpData?.office_id) {
          try {
            const officeRes = await api.get(`/offices/${ppmpData.office_id}`);
            if (!cancelled) setOffice(officeRes.data);

            // Fetch fee category name using the office's fee_category_id
            if (officeRes.data?.fee_category_id) {
              try {
                const feeCatRes = await api.get(`/fee-categories/${officeRes.data.fee_category_id}`);
                if (!cancelled) setFeeCategory(feeCatRes.data?.name || null);
              } catch {
                // Ignore fee category fetch errors
              }
            }
          } catch (officeErr) {
            console.error(
              "Failed to load office for this PPMP (continuing without it):",
              officeErr,
            );
            // Leave office as null — the page renders an "Unknown Office"
            // fallback below rather than failing outright.
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load PPMP:", err.response?.data || err);
        if (!cancelled) toast.error("Failed to load PPMP.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const handleUnsubmit = async () => {
    if (!ppmp || !user) return;

    const hasLinkedPrs = hasPrs;
    const confirmMessage = hasLinkedPrs
      ? `This PPMP has linked Purchase Request(s). Reverting to draft will remove it from the consolidated PPMP and APP views, but the PRs will not be affected.\n\nAre you sure you want to revert this PPMP to draft?`
      : "Are you sure you want to revert this PPMP to draft? It will be removed from the consolidated PPMP and APP views.";

    if (!window.confirm(confirmMessage)) return;

    setUnsubmitting(true);
    try {
      await api.put(`/ppmps/${id}/unsubmit`, null, {
        params: { requester_uid: user.id },
      });
      toast.success("PPMP reverted to draft.");
      // Reload the page to reflect the new status
      window.location.reload();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || "Failed to revert PPMP. Please try again.";
      toast.error(msg);
    } finally {
      setUnsubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!ppmp) return null;

  // Data shape note: CreatePPMP now sends projects[].entries[] (each entry
  // carries its own category_description/description/procurement_mode/
  // timeline/funding + items[]) instead of the old projects[].lots[].
  // Guarded with (?? []) so a PPMP saved under an older shape, or a
  // still-loading/partial response, doesn't crash the page.
  const grandTotal = (ppmp.projects ?? []).reduce(
    (sum, p) =>
      sum +
      (p.entries ?? []).reduce(
        (es: any, e: { items: any }) =>
          es +
          (e.items ?? []).reduce(
            (is: number, it: { quantity: any; unit_price: any }) =>
              is + (it.quantity || 0) * (it.unit_price || 0),
            0,
          ),
        0,
      ),
    0,
  );

  const preparedByName = toDisplayName((ppmp as any).prepared_by);
  const submittedByName = toDisplayName((ppmp as any).submitted_by);

  const signatories: any[] = [...((ppmp as any).signatories ?? [])].sort(
    (a: any, b: any) => (a.order_no ?? 0) - (b.order_no ?? 0),
  );
  // Keep every signatory on one line: shrink the per-column width and the
  // gap between columns as the count grows, instead of wrapping to a new
  // row. 760px is roughly the printable width budget for this block on
  // the 13in landscape page after the 0.5in margins; below 3 signatories
  // there's no need to shrink below the original 260px/80px sizing.
  const sigCount = signatories.length;
  const sigCellWidth =
    sigCount > 3 ? Math.max(130, Math.floor(760 / sigCount)) : 260;
  const sigSpacerWidth = sigCount > 3 ? 20 : 80;

  const shortDescription = (ppmp as any).description || "";
  const additionalDescription = (ppmp as any).additional_description || "";
  const officeDisplayName = office?.name || "Unknown Office";

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <PageHeader
        title={officeDisplayName}
        subtitle={
          feeCategory
            ? `${feeCategory} · PPMP Detail — FY ${ppmp.year} (${ppmp.ppmp_type === "indicative" ? "Indicative" : "Final"})`
            : `PPMP Detail — FY ${ppmp.year} (${ppmp.ppmp_type === "indicative" ? "Indicative" : "Final"})`
        }
        backTo="/ppmps"
        variant="dark"
        actions={
          <>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
            >
              🖨 Print
            </button>
            <button
              onClick={() => ppmp && office && exportPPMPToExcel(ppmp, office)}
              disabled={!office}
              title={
                !office ? "Office info unavailable — can't export" : undefined
              }
              className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Export Excel
            </button>
            <button
              onClick={() => navigate(`/ppmps/${id}/edit`)}
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-blue-900 px-3 py-2 rounded-xl shadow-md hover:shadow-lg transition"
            >
              ✏ Edit
            </button>
            {ppmp.status === "submitted" &&
              ppmp.created_by === user?.id && (
                <button
                  onClick={handleUnsubmit}
                  disabled={unsubmitting}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition disabled:opacity-40"
                  title="Revert this PPMP back to draft status"
                >
                  {unsubmitting ? "Reverting..." : "↩ Revert to Draft"}
                </button>
              )}
          </>
        }
      />

      {!office && (
        <div className="print:hidden bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
          ⚠️ This PPMP's office record couldn't be found (it may have been
          deleted or renamed). The PPMP is shown below, but the office name and
          Excel export are unavailable until this is corrected.
        </div>
      )}

      {hasPrs && (
        <div className="print:hidden bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-xl">
          Some items on this PPMP are linked to Purchase Requests and cannot be
          edited.
        </div>
      )}

      {/* Print area */}
      <div
        id="ppmp-print"
        className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none"
        style={{
          fontFamily: "Calibri, sans-serif",
          fontSize: "9px",
          padding: "16px 20px",
        }}
      >
        {/* Letterhead */}
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
                  PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO.{" "}
                  {ppmp.ppmp_no || "___"}
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
                    {ppmp.ppmp_type === "indicative" ? "✔" : ""}
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
                    {ppmp.ppmp_type === "final" ? "✔" : ""}
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
                {ppmp.year}
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", padding: "1px 6px" }} colSpan={2}>
                <strong style={{ display: "inline-block", width: "220px" }}>
                  End-User or Implementing Unit:
                </strong>
                {officeDisplayName}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main procurement table */}
        <div style={{ overflowX: "auto" }}>
          <table
            className="ppmp-schedule-table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "auto",
            }}
          >
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "7%" }} />
            </colgroup>
            <thead>
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
              <tr>
                {COLUMN_HEADERS.map((_, i) => (
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
              {shortDescription?.trim() && (
                <tr>
                  <td colSpan={TOTAL_COLS} style={codeRowStyle}>
                    {" "}
                    <span style={{ fontWeight: "normal" }}>
                      {shortDescription}
                    </span>
                  </td>
                </tr>
              )}

              {/* ── Additional Description — PPMP-level, shown ONCE. Only
                  rendered when it actually has content. ─────────────────── */}
              {additionalDescription?.trim() && (
                <tr>
                  <td
                    colSpan={TOTAL_COLS}
                    style={{ ...bannerRowStyle, backgroundColor: "#FFFFFF" }}
                  >
                    {" "}
                    <span style={{ fontWeight: "normal" }}>
                      {additionalDescription}
                    </span>
                  </td>
                </tr>
              )}

              {(ppmp.projects ?? []).map((project, pIndex) => {
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
                  (es, e) =>
                    es +
                    (e.items ?? []).reduce(
                      (
                        is: number,
                        it: { quantity?: number; unit_price?: number },
                      ) => is + (it.quantity || 0) * (it.unit_price || 0),
                      0,
                    ),
                  0,
                );

                const rowBg = pIndex % 2 === 0 ? "#fff" : "#f9fafb";

                // The Code is selected once per project in the UI and shared
                // by all of its procurement entries, so ONE Code banner
                // prints with every entry that uses it underneath — never
                // repeated above each entry. Bucketing by distinct value
                // also keeps legacy PPMPs (where entries may carry different
                // codes) rendering correctly, and guarantees every entry is
                // rendered exactly once.
                const entryGroups = entries.reduce(
                  (acc: Map<string, any[]>, e: any) => {
                    const code = e.category_description || "";
                    if (!acc.has(code)) acc.set(code, []);
                    acc.get(code)!.push(e);
                    return acc;
                  },
                  new Map<string, any[]>(),
                );

                const renderEntryRow = (entry: any, eIndex: number) => {
                  const entryItems =
                    (entry.items as
                      | Array<{
                          item_name?: string;
                          quantity?: number;
                          unit?: string;
                          unit_price?: number;
                        }>
                      | undefined) ?? [];
                  const entryAmount = entryItems.reduce(
                    (
                      sum: number,
                      it: { quantity?: number; unit_price?: number },
                    ) => sum + (it.quantity || 0) * (it.unit_price || 0),
                    0,
                  );

                  return (
                    <tr
                      key={(entry as any).id ?? eIndex}
                      style={{ backgroundColor: rowBg }}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          verticalAlign: "middle",
                        }}
                      >
                        <strong>{entry.description}</strong>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {entry.project_type}
                      </td>
                      {/* Column 3 — each item's "[qty unit]" bracket
                          stays bold, the rest stays normal weight;
                          multiple items stack on their own lines
                          within this single cell. */}
                      <td style={tdStyle}>
                        {entryItems.map((item, iIndex) => {
                          if (!item.item_name) return null;
                          const qty = item.quantity || 0;
                          const unit = item.unit || "";
                          const price = item.unit_price || 0;
                          return (
                            <div
                              key={iIndex}
                              style={{
                                marginBottom:
                                  iIndex < entryItems.length - 1 ? "4px" : 0,
                              }}
                            >
                              <strong>
                                [{qty} {unit}]
                              </strong>{" "}
                              {item.item_name}
                              {price
                                ? ` (₱${fmt(price)}/${unit || "unit"})`
                                : ""}
                            </div>
                          );
                        })}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {entry.procurement_mode}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {entry.pre_proc_conference}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {entry.start_activity}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {entry.end_activity}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {entry.delivery_period}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {entry.source_of_funds}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          verticalAlign: "middle",
                          fontWeight: "bold",
                        }}
                      >
                        {entryAmount ? `₱${fmt(entryAmount)}` : ""}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          borderBottom: "none",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {(project as any).attached_document_title || ""}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          borderBottom: "none",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        {project.remarks}
                      </td>
                    </tr>
                  );
                };

                return (
                  <Fragment key={pIndex}>
                    {/* Each entry renders as ONE row — all of its items are
                        combined (stacked) inside the Qty & Size cell rather
                        than being split across separate rows. */}
                    {Array.from(entryGroups.entries()).map(([code, list]) => (
                      <Fragment key={code}>
                        {/* Code — project-level, prints once with all
                              entries that use it beneath. */}
                        {code && (
                          <tr>
                            <td colSpan={TOTAL_COLS} style={codeRowStyle}>
                              {" "}
                              <span style={{ fontWeight: "bold" }}>{code}</span>
                            </td>
                          </tr>
                        )}
                        {list.map(renderEntryRow)}
                      </Fragment>
                    ))}

                    <tr>
                      <td
                        colSpan={TOTAL_COLS - 3}
                        style={{
                          ...subtotalLabelStyle,
                          backgroundColor: "#D3D3D3",
                        }}
                      >
                        Sub-Total:
                      </td>
                      <td
                        style={{
                          ...subtotalValueStyle,
                          backgroundColor: "#D3D3D3",
                        }}
                      >
                        ₱{fmt(projectSubtotal)}
                      </td>
                      <td style={{ ...tdStyle, borderTop: "none" }} />
                      <td
                        style={{
                          ...tdStyle,
                          border: "1px solid #000",
                          borderTop: "none",
                        }}
                      />
                    </tr>
                  </Fragment>
                );
              })}

              <tr style={{ fontWeight: "bold" }}>
                {[...Array(7)].map((_, i) => (
                  <td key={i} style={{ ...tdStyle, border: "none" }} />
                ))}
                <td
                  colSpan={2}
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    borderColor: "#000",
                  }}
                >
                  TOTAL BUDGET:
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    borderColor: "#000",
                  }}
                >
                  ₱{fmt(grandTotal)}
                </td>
                <td style={{ ...tdStyle, border: "none" }} />
                <td style={{ ...tdStyle, border: "none" }} />
              </tr>
            </tbody>
          </table>
        </div>

        {signatories.length > 0 ? (
          <table
            className="ppmp-sig-block"
            style={{
              borderCollapse: "collapse",
              marginTop: "16px",
              fontSize: "9px",
              width: "100%",
              tableLayout: "fixed",
            }}
          >
            <tbody>
              <tr>
                {signatories.map((s, idx) => (
                  <Fragment key={`label-${s.order_no}`}>
                    <td
                      style={{
                        ...sigCellStyle,
                        width: `${sigCellWidth}px`,
                        fontWeight: "bold",
                        fontFamily: sigSerifFont,
                      }}
                    >
                      {s.sign_off}:
                    </td>
                    {idx < signatories.length - 1 && (
                      <td
                        style={{
                          ...sigSpacerStyle,
                          width: `${sigSpacerWidth}px`,
                        }}
                      />
                    )}
                  </Fragment>
                ))}
              </tr>
              <tr>
                {signatories.map((s, idx) => (
                  <Fragment key={`space-${s.order_no}`}>
                    <td
                      style={{
                        ...sigCellStyle,
                        width: `${sigCellWidth}px`,
                        height: "20px",
                      }}
                    />
                    {idx < signatories.length - 1 && (
                      <td
                        style={{
                          ...sigSpacerStyle,
                          width: `${sigSpacerWidth}px`,
                        }}
                      />
                    )}
                  </Fragment>
                ))}
              </tr>
              <tr>
                {signatories.map((s, idx) => (
                  <Fragment key={`name-${s.order_no}`}>
                    <td
                      style={{
                        ...sigCellStyle,
                        width: `${sigCellWidth}px`,
                        fontWeight: "bold",
                        fontFamily: sigSerifFont,
                      }}
                    >
                      {toDisplayName(s.name)}
                    </td>
                    {idx < signatories.length - 1 && (
                      <td
                        style={{
                          ...sigSpacerStyle,
                          width: `${sigSpacerWidth}px`,
                        }}
                      />
                    )}
                  </Fragment>
                ))}
              </tr>
              <tr>
                {signatories.map((s, idx) => (
                  <Fragment key={`position-${s.order_no}`}>
                    <td
                      style={{
                        ...sigCellStyle,
                        width: `${sigCellWidth}px`,
                        fontSize: "8px",
                        paddingTop: "2px",
                        fontFamily: "times new roman, calibri, cambria",
                        textTransform: "capitalize",
                      }}
                    >
                      {s.position}
                    </td>
                    {idx < signatories.length - 1 && (
                      <td
                        style={{
                          ...sigSpacerStyle,
                          width: `${sigSpacerWidth}px`,
                        }}
                      />
                    )}
                  </Fragment>
                ))}
              </tr>
              <tr>
                {signatories.map((s, idx) => (
                  <Fragment key={`date-${s.order_no}`}>
                    <td
                      style={{
                        ...sigCellStyle,
                        width: `${sigCellWidth}px`,
                        fontSize: "8px",
                        paddingTop: "6px",
                        fontFamily: sigSerifFont,
                      }}
                    >
                      Date: _________________
                    </td>
                    {idx < signatories.length - 1 && (
                      <td
                        style={{
                          ...sigSpacerStyle,
                          width: `${sigSpacerWidth}px`,
                        }}
                      />
                    )}
                  </Fragment>
                ))}
              </tr>
            </tbody>
          </table>
        ) : (
          <table
            className="ppmp-sig-block"
            style={{
              borderCollapse: "collapse",
              marginTop: "16px",
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
                <td style={sigSpacerStyle} />
                <td
                  style={{
                    ...sigCellStyle,
                    fontWeight: "bold",
                    fontFamily: sigSerifFont,
                  }}
                >
                  Submitted by:
                </td>
              </tr>
              <tr>
                <td style={{ ...sigCellStyle, height: "20px" }} />
                <td style={sigSpacerStyle} />
                <td style={{ ...sigCellStyle, height: "20px" }} />
              </tr>
              <tr>
                <td
                  style={{
                    ...sigCellStyle,
                    fontWeight: "bold",
                    fontFamily: sigSerifFont,
                  }}
                >
                  {preparedByName || "________________________________"}
                </td>
                <td style={sigSpacerStyle} />
                <td
                  style={{
                    ...sigCellStyle,
                    fontWeight: "bold",
                    fontFamily: sigSerifFont,
                  }}
                >
                  {submittedByName || "________________________________"}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    ...sigCellStyle,
                    fontSize: "8px",
                    paddingTop: "2px",
                    fontFamily: sigSerifFont,
                  }}
                >
                  Position/Designation
                </td>
                <td style={sigSpacerStyle} />
                <td
                  style={{
                    ...sigCellStyle,
                    fontSize: "8px",
                    paddingTop: "2px",
                    fontFamily: sigSerifFont,
                  }}
                >
                  Position/Designation
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    ...sigCellStyle,
                    fontSize: "8px",
                    paddingTop: "6px",
                    fontFamily: sigSerifFont,
                  }}
                >
                  Date: _________________
                </td>
                <td style={sigSpacerStyle} />
                <td
                  style={{
                    ...sigCellStyle,
                    fontSize: "8px",
                    paddingTop: "6px",
                    fontFamily: sigSerifFont,
                  }}
                >
                  Date: _________________
                </td>
              </tr>
            </tbody>
          </table>
        )}

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

            {/* Screen-only static label. During print this is hidden and
                replaced by the native, page-count-aware numbering added via
                the @page bottom-right margin box below — a plain DOM node
                like this one has no way of knowing which physical page it
                lands on, so it can't be made dynamic on its own. */}
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
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #ppmp-print, #ppmp-print * { visibility: visible; }
          #ppmp-print img { visibility: visible !important; display: block !important; }
          #ppmp-print { width: 100%; padding: 0; font-size: 8px; }
          .ppmp-schedule-table th, .ppmp-schedule-table td { padding: 2px 4px !important; font-size: 7.5px !important; line-height: 1.15 !important; }

          /* Don't let the browser repeat the grouped header (PROCUREMENT
             PROJECT DETAILS / PROJECTED TIMELINE / FUNDING DETAILS /
             ATTACHED SUPPORTING DOCUMENTS / REMARKS + the numbered
             "Column X" row) on every continuation page. Browsers
             auto-repeat a real <thead> across page breaks; switching its
             display to table-row-group makes it print only once, right
             where it naturally falls — the top of page 1. */
          .ppmp-schedule-table thead {
            display: table-row-group;
          }

          /* Tighten the signatory blocks and footer for print so more
             procurement rows fit per page before a break is needed. */
          .ppmp-sig-block { margin-top: 10px !important; }

          /* Narrow margins (0.5in on all sides — matches Word's "Narrow"
             preset) on Long/Folio bond paper (13 x 8.5 in), landscape. */
          @page {
            size: 13in 8.5in;
            margin: 0.5in;

            /* Native, accurate page numbering — this is the only place a
               printed page actually knows its own number / the total page
               count, since regular in-flow elements (like the .ppmp-footer
               span above) have no concept of physical pages. Supported in
               Chromium-based browsers (what window.print() runs through
               here); Firefox support for the "pages" total is inconsistent,
               so this will show "Page X" without the total there. */
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-family: Calibri, sans-serif;
              font-size: 8px;
            }
          }

          /* Repeats on every printed page — position: fixed is relative
             to the physical page during print, not to the scrolling
             document, so this re-renders at the bottom of each sheet.
             Aligned to the new 0.5in page margins. The static "Page 1"
             label inside it is hidden during print since the @page
             margin box above supplies the real, dynamic page count. */
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
