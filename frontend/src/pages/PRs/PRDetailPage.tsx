import { Fragment, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import type { Office } from "../../types";
import { exportPRToExcel } from "../../services/exportPR";
import { useToast } from "../../components/feedback/ToastProvider";
import { useConfirmState } from "../../components/feedback/useConfirm";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { LoadingButton } from "../../components/feedback/LoadingButton";
import PageHeader from "../../components/layout/PageHeader";

// Matches _enrich_pr's actual response shape — item_name/requested_quantity/
// assigned_lot, plus the system-generated stock_property_no (format
// MM-YY-###, assigned once per item by app/services/sequence.py and never
// user-editable).
interface PRItem {
  ppmp_entry_id: string;
  ppmp_item_id: string;
  stock_property_no: string | null;
  item_name: string;
  unit: string;
  unit_price: number;
  requested_quantity: number;
  assigned_lot: string;
  total_cost: number;
}

interface PRLotGroup {
  label: string;
  items: PRItem[];
}

interface PR {
  purpose: string | null;
  responsibility_center_code: string;
  fund_cluster: string | null;
  id: string;
  ppmp_id: string;
  ppmp_no: string | null;
  office_id: string | null;
  pr_number: string | null;
  date: string;
  status: string;
  requested_by_name?: string | null;
  requested_by_designation?: string | null;
  approved_by_name?: string | null;
  approved_by_designation?: string | null;
  bac_secretariat_chairman_name?: string | null;
  bac_secretariat_chairman_designation?: string | null;
  budget_officer_name?: string | null;
  budget_officer_designation?: string | null;
  items: PRItem[];
  lots: PRLotGroup[];
  grand_total: number;
  created_at: string;
  updated_at?: string | null;
}

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

// CSS text-transform has no "sentence case" value (only capitalize,
// uppercase, lowercase) — so this does it in JS instead. Only the first
// character is touched; the rest of the string is left exactly as typed,
// so proper nouns (school names, office names, etc.) inside the purpose
// text aren't forced to lowercase.
const toSentenceCase = (s: string) =>
  s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const COLUMN_WIDTHS = ["12%", "10%", "37%", "11%", "12%", "12%"] as const;

// Bounds for the on-screen preview scale — never affects print.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.6;

const tdStyle: React.CSSProperties = {
  border: "1px solid black",
  padding: "3px 6px",
  fontSize: "9px",
  verticalAlign: "top",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

// Signature-block cells reuse tdStyle's spacing/font but manage their own
// borders explicitly. Only the OUTSIDE of the block is drawn — left column
// never gets a right border and right column never gets a left border, so
// there's no divider line down the center between "Requested by" and
// "Approved by". Every row in this block must supply BOTH a left cell and
// a right cell (even if empty) or the border on whichever side is missing
// simply won't render for that row's height.
const sigStyle = (opts: {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}): React.CSSProperties => ({
  ...tdStyle,
  padding: "1px 6px",
  lineHeight: 1.3,
  fontFamily: "'Times New Roman', Times, serif",
  border: "none",
  borderTop: opts.top ? "1px solid #000" : "none",
  borderBottom: opts.bottom ? "1px solid #000" : "none",
  borderLeft: opts.left ? "1px solid #000" : "none",
  borderRight: opts.right ? "1px solid #000" : "none",
});

const extraSigBoxStyle: React.CSSProperties = {
  border: "3px solid #0041C2",
  width: "45%",
  margin: "0 auto",
  padding: "9px 3px",
  textAlign: "center",
  fontFamily: "Arial",
  fontSize: "12px",
};

export default function PRDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmState();
  const [pr, setPr] = useState<PR | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // ── On-screen auto-fit scaling ──────────────────────────────────────
  // The goal: the preview always occupies roughly the same visual height
  // on screen — a PR with 3 items renders BIG (zoomed in, easy to read),
  // a PR with 40 items renders smaller (zoomed out, so it still fits and
  // you don't have to scroll/zoom yourself). None of this ever reaches
  // print: #pr-print's own inline styles (tdStyle, sigStyle, column
  // widths, the fixed 1056px minHeight) are completely untouched, and the
  // @media print block below forces zoom back to a flat 1, so the
  // printed page is pixel-identical to before this feature existed.
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [autoFit, setAutoFit] = useState(true);

  // Recompute the auto-fit scale whenever the PR's content changes (item
  // count is what actually drives the natural height of the table) or
  // whenever auto-fit is turned back on. Deliberately NOT depending on
  // zoomLevel itself — that would just retrigger every time this effect
  // sets it, in a loop. Because CSS `zoom` scales layout proportionally,
  // the natural (unzoomed) height of the content can always be recovered
  // as `measuredHeight / zoomLevel`, regardless of what zoom happens to
  // be applied at the moment we measure — so we don't need to reset zoom
  // to 1 first just to measure.
  useLayoutEffect(() => {
    if (!autoFit || !printRef.current || !previewWrapperRef.current) return;

    const recalc = () => {
      const el = printRef.current;
      const wrapper = previewWrapperRef.current;
      if (!el || !wrapper) return;
      const measuredHeight = el.offsetHeight;
      if (!measuredHeight) return;
      const naturalHeight = measuredHeight / zoomLevel;
      if (!naturalHeight) return;
      const targetHeight = wrapper.clientHeight;
      const nextZoom = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, targetHeight / naturalHeight),
      );
      setZoomLevel((prev) =>
        Math.abs(prev - nextZoom) > 0.01 ? +nextZoom.toFixed(2) : prev,
      );
    };

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pr, autoFit]);

  const zoomOut = () => {
    setAutoFit(false);
    setZoomLevel((z) => Math.max(ZOOM_MIN, +(z - 0.1).toFixed(2)));
  };
  const zoomIn = () => {
    setAutoFit(false);
    setZoomLevel((z) => Math.min(ZOOM_MAX, +(z + 0.1).toFixed(2)));
  };
  const enableAutoFit = () => setAutoFit(true);

  useEffect(() => {
    api
      .get(`/prs/${id}`)
      .then(async (res) => {
        setPr(res.data);
        if (res.data.office_id) {
          const officeRes = await api.get(`/offices/${res.data.office_id}`);
          setOffice(officeRes.data);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: `Delete ${pr?.pr_number || `PR #${pr?.id}`}?`,
      description: "This action cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.delete(`/prs/${id}`);
      toast.success("Purchase Request deleted successfully.");
      navigate("/prs");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to delete this Purchase Request.",
      );
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!pr) return <p className="text-gray-400">PR not found.</p>;

  // Multiple lots only need their own header row when there's more than
  // one — a PR with everything in a single lot just shows a flat item list,
  // matching how the original spreadsheet only breaks items into labeled
  // LOT sections when a PR actually spans more than one.
  // Always shown — Lot is now a deliberate choice made up front in the
  // Create/Edit wizard (see CreatePRPage/EditPRPage's lot-first flow), so
  // the printed PR should always confirm which lot(s) items were placed
  // in, even when there's only one. (Previously suppressed for a
  // single-lot PR to match the original spreadsheet template, which only
  // labeled lots when a PR spanned more than one — that's no longer the
  // right default now that lot is chosen intentionally, not an
  // afterthought.)
  const showLotHeaders = true;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <PageHeader
        title={pr.pr_number || `PR #${pr.id}`}
        subtitle="Purchase Request"
        backTo="/prs"
        variant="dark"
        actions={
          <>
            <button
              onClick={() => navigate(`/prs/${id}/edit`)}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
            >
              ✎ Edit
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition"
            >
              🖨 Print
            </button>
            <button
              onClick={() => pr && office && exportPRToExcel(pr, office)}
              className="text-xs font-bold bg-white text-blue-900 px-3 py-2 rounded-xl shadow-md hover:shadow-lg transition"
            >
              📥 Export Excel
            </button>
            <LoadingButton
              onClick={handleDelete}
              busy={deleting}
              busyLabel="Deleting..."
              variant="destructive"
              className="text-xs px-3 py-2 rounded-xl"
            >
              Delete
            </LoadingButton>
          </>
        }
      />

      {/* Zoom control — screen only, never printed. "Auto-fit" (default)
          keeps the whole form filling roughly the same visual height
          whether it has 3 items or 40. Manual +/- overrides that. */}
      <div className="print:hidden flex items-center justify-end gap-2">
        {!autoFit && (
          <button
            onClick={enableAutoFit}
            className="text-xs text-blue-600 hover:text-blue-800 px-2"
          >
            ⤢ Auto-fit
          </button>
        )}
        <span className="text-xs text-gray-400 mr-1">Zoom</span>
        <button
          onClick={zoomOut}
          disabled={zoomLevel <= ZOOM_MIN}
          className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 text-gray-700 w-7 h-7 rounded-lg font-bold"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="text-xs text-gray-500 w-10 text-center tabular-nums">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={zoomLevel >= ZOOM_MAX}
          className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 text-gray-700 w-7 h-7 rounded-lg font-bold"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {/* Fixed-height preview "window" on screen only — this height is
          the target auto-fit scales against. Print ignores it completely
          (print:overflow-visible, and #pr-print goes position:fixed in
          the print media query same as before). */}
      <div
        ref={previewWrapperRef}
        className="overflow-auto print:overflow-visible rounded-2xl print:rounded-none"
        style={{ height: "min(78vh, 900px)" }}
      >
        <div
          id="pr-print"
          ref={printRef}
          className="bg-white shadow-sm border border-gray-200 rounded-2xl print:rounded-none print:shadow-none print:border-none mx-auto"
          style={{
            fontFamily: "Times New Roman, sans-serif",
            padding: "16px 20px",
            maxWidth: "800px",
            minHeight: "1056px", // A4 portrait height minus 20mm top/bottom margins
            zoom: zoomLevel, // screen-only scaling; forced back to 1 for print
          }}
        >
          <div
            style={{ textAlign: "right", fontSize: "8px", fontStyle: "italic" }}
          >
            Appendix 60
          </div>
          <div style={{ textAlign: "center", margin: "2px 0 8px" }}>
            <p
              style={{
                fontSize: "15px",
                fontWeight: "bold",
                margin: 0,
                letterSpacing: "0.5px",
                fontFamily: "Times New Roman, sans-serif",
              }}
            >
              PURCHASE REQUEST
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "9px",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            <span>NORTH EASTERN MINDANAO STATE UNIVERSITY</span>
            <span style={{ fontWeight: "bold" }}>
              Fund Cluster:{" "}
              {pr.fund_cluster || (
                <span style={{ color: "#9CA3AF" }}>___________</span>
              )}
            </span>
          </div>

          {/* Single table: header block → items → grand total → purpose →
              signatures. Everything shares this one 6-column grid — column
              widths come from the colgroup below, not from any row's cells,
              so they hold steady regardless of colspans in the header block
              or signature rows. */}
          <table
            style={{
              width: "100%",
              minHeight: "100%",
              borderCollapse: "collapse",
              fontSize: "9px",
              tableLayout: "auto",
            }}
          >
            <colgroup>
              {COLUMN_WIDTHS.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <tbody>
              {/* ── Header block: Department / PR Number / Date ── */}
              <tr>
                <td style={tdStyle} colSpan={2}>
                  Department:
                  <p
                    style={{
                      textAlign: "center",
                      fontFamily: "Times New Roman, sans-serif",
                      fontStyle: "italic",
                      margin: 0,
                    }}
                  >
                    <strong>
                      {office?.name || (
                        <span style={{ color: "#9CA3AF" }}>___</span>
                      )}
                    </strong>
                  </p>
                </td>
                <td style={tdStyle} colSpan={2}>
                  PR Number: <strong>{pr.pr_number || "___"}</strong>
                  <p style={{ margin: 0 }}> </p>
                  Responsibility Center Code:{" "}
                  <strong>{pr.responsibility_center_code || "___"}</strong>
                </td>
                <td style={tdStyle} colSpan={2}>
                  Date:{" "}
                  <strong>
                    {pr.date
                      ? new Date(pr.date).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "___"}
                  </strong>
                </td>
              </tr>

              <tr style={{ backgroundColor: "#fff" }}>
                <th
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "10%",
                  }}
                >
                  Stock/ Property No.
                </th>
                <th
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "3%",
                  }}
                >
                  Unit
                </th>
                <th
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "38%",
                  }}
                >
                  Item Description
                </th>
                <th
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "3%",
                  }}
                >
                  Quantity
                </th>
                <th
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "12%",
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "12%",
                  }}
                >
                  Total Cost
                </th>
              </tr>

              {/* ── Lots + items ── */}
              {pr.lots.map((lot, lotIdx) => (
                <Fragment key={`lot-group-${lotIdx}`}>
                  {showLotHeaders && (
                    <tr style={{ backgroundColor: "#fff" }}>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={{ ...tdStyle, fontWeight: "bold" }}>
                        {lot.label.toUpperCase().startsWith("LOT")
                          ? lot.label.toUpperCase()
                          : `LOT ${lot.label.toUpperCase()}`}
                      </td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                    </tr>
                  )}

                  {lot.items.map((item, i) => (
                    <tr key={`${lotIdx}-${i}`}>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {item.stock_property_no || ""}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {item.unit || ""}
                      </td>
                      <td style={tdStyle}>{item.item_name}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {item.requested_quantity}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {item.unit_price ? fmt(item.unit_price) : ""}
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
                    </tr>
                  ))}
                </Fragment>
              ))}

              {/* ── Grand Total ── */}
              <tr style={{ backgroundColor: "#fff", fontWeight: "bold" }}>
                <td colSpan={5} style={{ ...tdStyle, textAlign: "right" }}>
                  Grand Total:
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  ₱{fmt(pr.grand_total)}
                </td>
              </tr>

              {/* ── Purpose ── */}
              <tr style={{ backgroundColor: "#fff" }}>
                <td style={{ ...tdStyle, fontWeight: "bold" }}>Purpose:</td>
                <td colSpan={5} style={tdStyle}>
                  {pr.purpose ? (
                    toSentenceCase(pr.purpose)
                  ) : (
                    <span style={{ color: "#9CA3AF" }}>___</span>
                  )}
                </td>
              </tr>

              {/* ── Signatures ── each cell spans 3 of the 6 columns so the
                  two-column signature block lines up under the item table.
                  No border is drawn down the center — only the outer edge
                  of the whole block, plus the horizontal dividers between
                  rows. Every row supplies both a left AND a right cell (even
                  blank spacer rows) so the outer border never breaks. */}
              <tr>
                <td
                  colSpan={3}
                  style={{
                    ...sigStyle({ top: true, left: true }),
                    fontWeight: "bold",
                  }}
                >
                  Requested by:
                </td>
                <td
                  colSpan={3}
                  style={{
                    ...sigStyle({ top: true, right: true }),
                    fontWeight: "bold",
                  }}
                >
                  Approved by:
                </td>
              </tr>

              <tr>
                <td colSpan={3} style={sigStyle({ left: true })}></td>
                <td colSpan={3} style={sigStyle({ right: true })}></td>
              </tr>
              <tr>
                <td colSpan={3} style={sigStyle({ left: true })}></td>
                <td colSpan={3} style={sigStyle({ right: true })}></td>
              </tr>

              <tr>
                <td colSpan={3} style={sigStyle({ left: true })}>
                  Signature:
                </td>
                <td colSpan={3} style={sigStyle({ right: true })}>
                  Signature:
                </td>
              </tr>

              <tr>
                <td colSpan={3} style={sigStyle({ left: true })}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span>Printed Name :</span>
                    <strong
                      style={{
                        flex: 1,
                        textAlign: "center",
                        textTransform: "uppercase",
                      }}
                    >
                      {pr.requested_by_name || (
                        <span style={{ color: "#9CA3AF" }}>___</span>
                      )}
                    </strong>
                  </div>
                </td>
                <td colSpan={3} style={sigStyle({ right: true })}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span>Printed Name :</span>
                    <strong
                      style={{
                        flex: 1,
                        textAlign: "center",
                        textTransform: "uppercase",
                      }}
                    >
                      {pr.approved_by_name || (
                        <span style={{ color: "#9CA3AF" }}>___</span>
                      )}
                    </strong>
                  </div>
                </td>
              </tr>

              <tr>
                <td colSpan={3} style={sigStyle({ left: true })}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span>Designation :</span>
                    <span
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontStyle: "italic",
                      }}
                    >
                      {pr.requested_by_designation || (
                        <span style={{ color: "#9CA3AF" }}>___</span>
                      )}
                    </span>
                  </div>
                </td>
                <td colSpan={3} style={sigStyle({ right: true })}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span>Designation :</span>
                    <span
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontStyle: "italic",
                      }}
                    >
                      {pr.approved_by_designation || (
                        <span style={{ color: "#9CA3AF" }}>___</span>
                      )}
                    </span>
                  </div>
                </td>
              </tr>

              <tr>
                <td
                  colSpan={3}
                  style={sigStyle({ left: true, bottom: true })}
                ></td>
                <td
                  colSpan={3}
                  style={sigStyle({ right: true, bottom: true })}
                ></td>
              </tr>
            </tbody>
          </table>

          {/* ── BAC Secretariat Chairman / Budget Officer — OUTSIDE the
              table entirely, per spec. Always shown regardless of Grand
              Total (no threshold branch, unlike Requested/Approved By
              above). BAC Secretariat Chairman on the left, Budget Officer
              (under "Appropriation of Allotment") on the right. ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              marginTop: "10px",
            }}
          >
            <div style={extraSigBoxStyle}>
              <div style={{ height: "22px" }} />
              <p
                style={{
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  marginTop: "30px",
                  marginBottom: "-10px",
                  color: "#0041C2",
                  fontSize: "17px",
                }}
              >
                {pr.bac_secretariat_chairman_name || (
                  <span style={{ color: "#0041C2" }}>___</span>
                )}
              </p>
              <p
                style={{
                  margin: "1px 0 8px",
                  color: "#0041C2",
                  textTransform: "uppercase",
                }}
              >
                {pr.bac_secretariat_chairman_designation ||
                  "BAC Secretariat Chairman"}
              </p>
              <p
                style={{
                  textAlign: "center",
                  marginTop: "15px",
                  marginBottom: "-5px",
                  color: "#0041C2",
                  fontWeight: "bold",
                }}
              >
                Date: _______________
              </p>
            </div>

            <div style={extraSigBoxStyle}>
              <p
                style={{
                  fontWeight: "bold",
                  margin: "-10px -15px 16px",
                  color: "#0041C2",
                  fontSize: "17px",
                }}
              >
                APPROPRIATION OF ALLOTMENT
              </p>
              <p
                style={{
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  marginTop: "30px",
                  marginBottom: "-10px",
                  color: "#0041C2",
                  fontSize: "17px",
                }}
              >
                {pr.budget_officer_name || (
                  <span style={{ color: "#0041C2" }}>___</span>
                )}
              </p>
              <p
                style={{
                  margin: "1px 0 8px",
                  color: "#0041C2",
                  textTransform: "uppercase",
                }}
              >
                {pr.budget_officer_designation || "Designate, Budget Officer"}
              </p>
              <p
                style={{
                  textAlign: "center",
                  margin: 0,
                  color: "#0041C2",
                  fontWeight: "bold",
                }}
              >
                Date: _______________
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden; }
          #pr-print, #pr-print * { visibility: visible; }
          #pr-print {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 8mm 10mm;
            zoom: 1 !important; /* always print at 100%, regardless of on-screen auto-fit/zoom */
          }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        processing={deleting}
      />
    </div>
  );
}
