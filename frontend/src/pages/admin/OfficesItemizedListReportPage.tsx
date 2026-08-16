import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  FileDown,
  FileSpreadsheet,
  RefreshCcw,
  ClipboardList,
} from "lucide-react";
import api from "../../services/api";
import {
  fetchItemizedListReport,
  type ItemizedListReport,
} from "../../services/reports";
import {
  exportItemizedListToExcel,
  exportItemizedListToPDF,
  type NumberedGroup,
  type NumberedItem,
} from "../../services/exportItemizedList";
import PageHeader from "../../components/layout/PageHeader";

const font = {
  stack:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// ── Design tokens (mirrors CreatePPMPPage.tsx so this reads as the same
//    product rather than a bolted-on report screen) ─────────────────────────

const FONT_FAMILY = font.stack;

const T = {
  pageBg: "bg-[#F8FAFC]",
  card: "bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
};

const BTN_PRIMARY =
  "bg-[#0284C7] hover:bg-[#0369A1] text-white font-medium transition shadow-sm";
const BTN_SECONDARY =
  "border border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC] font-medium transition";

const inputClass =
  "w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-[15px] text-[#1E293B] bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0284C7] transition";

const YEAR_OPTIONS = [
  2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035,
];

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

// Zero reads as "nothing entered for this quarter/row" rather than a real
// value, so it renders as an em dash instead of a placeholder "0" or
// "₱0.00" everywhere quantities/amounts show up — on screen, in the PDF,
// and in the Excel export.
const DASH = "—";
const qtyOrDash = (n: number): string | number => (n === 0 ? DASH : n);
const amtOrDash = (n: number): string => (n === 0 ? DASH : `₱${fmt(n)}`);

// Office data — fetched the same way CreatePPMPPage.tsx does, from
// /fee-categories/tree, then flattened for search. Duplicated here rather
// than imported from that page since it isn't a shared module; consider
// extracting flattenTree/FlatOffice into a shared hook if you need this a
// third time.
interface FeeCategoryOfficeNode {
  id: string;
  name: string;
  fee_category_id: string;
  parent_office_id: string | null;
  children: FeeCategoryOfficeNode[];
}

interface FeeCategoryNode {
  id: string;
  name: string;
  offices: FeeCategoryOfficeNode[];
}

interface FlatOffice {
  id: string;
  name: string;
  categoryName: string;
  parentName: string | null;
}

function flattenTree(categories: FeeCategoryNode[]): FlatOffice[] {
  const rows: FlatOffice[] = [];
  for (const cat of categories) {
    for (const office of cat.offices) {
      rows.push({
        id: office.id,
        name: office.name,
        categoryName: cat.name,
        parentName: null,
      });
      for (const child of office.children) {
        rows.push({
          id: child.id,
          name: child.name,
          categoryName: cat.name,
          parentName: office.name,
        });
      }
    }
  }
  return rows;
}

// Searchable office combobox — type to filter by office name, parent
// office, or fee category. "All Offices" always sits at the top so admins
// can clear back to the aggregate view without hunting for it.
function OfficeSearchPicker({
  value,
  flatOffices,
  onChange,
  allLabel = "All Offices",
}: {
  value: string; // "" = allLabel
  flatOffices: FlatOffice[];
  onChange: (id: string) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = flatOffices.find((o) => o.id === value);
  const displayLabel =
    value === ""
      ? allLabel
      : selected
        ? selected.parentName
          ? `${selected.parentName} / ${selected.name}`
          : selected.name
        : "";

  const matches =
    text.trim().length === 0
      ? flatOffices
      : flatOffices.filter(
          (o) =>
            o.name.toLowerCase().includes(text.toLowerCase()) ||
            o.categoryName.toLowerCase().includes(text.toLowerCase()) ||
            (o.parentName || "").toLowerCase().includes(text.toLowerCase()),
        );

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
    setText("");
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        className={inputClass}
        value={open ? text : displayLabel}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search office..."
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto overscroll-contain bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1">
          <button
            type="button"
            onClick={() => select("")}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#E0F2FE] font-medium ${
              value === "" ? "text-[#0369A1] bg-[#E0F2FE]" : "text-[#1E293B]"
            }`}
          >
            {allLabel}
          </button>
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[#64748B]">
              No matching office.
            </p>
          ) : (
            matches.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => select(o.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[#E0F2FE] flex items-center justify-between gap-2 ${
                  value === o.id
                    ? "text-[#0369A1] bg-[#E0F2FE] font-medium"
                    : "text-[#1E293B]"
                }`}
              >
                <span className="truncate">
                  {o.parentName ? `${o.parentName} / ${o.name}` : o.name}
                </span>
                <span className="text-xs text-[#64748B] shrink-0">
                  {o.categoryName}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// A Procurement Code group augmented with its numbered rows — see
// exportItemizedList.ts for the definition shared with the export service.

// ── Table column layout (two-row header: quarters each split into
//    Qty / Amount sub-columns, per the GPPB itemized list format) ─────────

const BASE_COLS = [
  "No.",
  "Name of Item",
  "Unit",
  "Quantity",
  "Unit Cost",
  "Total Cost",
];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

// "Offices Itemized List" — admin-only cross-office browser. This is the
// view that used to live inside ItemizedListReportPage's isAdmin branch;
// it's been split out so /reports/itemized-list ("Itemized List") can stay
// scoped to the logged-in user everywhere, admins included. Mount this at
// /admin/offices-itemized-list.
export default function OfficesItemizedListReportPage() {
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [officeId, setOfficeId] = useState<string>(""); // "" = All Offices
  const [categoryTree, setCategoryTree] = useState<FeeCategoryNode[]>([]);
  const flatOffices = useMemo(() => flattenTree(categoryTree), [categoryTree]);
  const [ppmpType, setPpmpType] = useState<"" | "indicative" | "final">("");

  const [report, setReport] = useState<ItemizedListReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/fee-categories/tree")
      .then((res) => setCategoryTree(res.data))
      .catch(() => setCategoryTree([]));
  }, []);

  const runReport = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchItemizedListReport({
        year,
        officeId: officeId || undefined,
        ppmpType: ppmpType || undefined,
      });
      setReport(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "Failed to load the Itemized Procurement List. Please try again.",
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Running "No." counter across every group, so numbering is continuous
  // (1, 2, 3...) rather than restarting inside each Procurement Code.
  const numberedGroups = useMemo<NumberedGroup[]>(() => {
    if (!report) return [];
    let counter = 0;
    return report.groups.map((g): NumberedGroup => {
      const numberedItems: NumberedItem[] = g.items.map((item) => {
        counter += 1;
        return { no: counter, item };
      });
      return { ...g, numberedItems };
    });
  }, [report]);

  // ── Excel / PDF exports — built by the shared exportItemizedList service
  //    (letterhead header + signatory footer, items in the GPPB table). ────

  const exportToExcel = () => {
    if (!report) return;
    exportItemizedListToExcel(report, numberedGroups);
  };

  const exportToPDF = () => {
    if (!report) return;
    exportItemizedListToPDF(report, numberedGroups);
  };

  return (
    <div
      className={`w-full max-w-full min-h-full ${T.pageBg} px-4 sm:px-6 lg:px-8 py-6`}
      style={{ fontFamily: FONT_FAMILY }}
    >
      <PageHeader
        title="Offices Itemized List"
        subtitle="Auto-generated from approved PPMPs across every office — quarterly quantities are pulled from what was already entered, never re-entered here."
      />

      {/* Filters */}
      <div className={`${T.card} p-5 mb-6 flex flex-wrap items-end gap-4`}>
        <div className="w-32">
          <label className="text-sm text-[#334155] mb-1.5 block font-medium">
            Fiscal Year
          </label>
          <select
            className={inputClass}
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="w-64 max-w-full">
          <label className="text-sm text-[#334155] mb-1.5 block font-medium">
            Office
          </label>
          <OfficeSearchPicker
            value={officeId}
            flatOffices={flatOffices}
            onChange={setOfficeId}
          />
        </div>

        <div className="w-48">
          <label className="text-sm text-[#334155] mb-1.5 block font-medium">
            PPMP Type
          </label>
          <select
            className={inputClass}
            value={ppmpType}
            onChange={(e) => setPpmpType(e.target.value as typeof ppmpType)}
          >
            <option value="">Both</option>
            <option value="indicative">Indicative</option>
            <option value="final">Final</option>
          </select>
        </div>

        <button
          onClick={runReport}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-[15px] rounded-lg disabled:opacity-50 ${BTN_PRIMARY}`}
        >
          <RefreshCcw className="w-4 h-4" strokeWidth={2} />
          {loading ? "Loading..." : "Generate Report"}
        </button>

        <div className="flex-1" />

        <button
          onClick={exportToExcel}
          disabled={!report || report.groups.length === 0}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[15px] rounded-lg disabled:opacity-50 ${BTN_SECONDARY}`}
        >
          <FileSpreadsheet className="w-4 h-4" strokeWidth={2} />
          Export Excel
        </button>
        <button
          onClick={exportToPDF}
          disabled={!report || report.groups.length === 0}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[15px] rounded-lg disabled:opacity-50 ${BTN_SECONDARY}`}
        >
          <FileDown className="w-4 h-4" strokeWidth={2} />
          Export PDF
        </button>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-[15px] text-red-700">
          {error}
        </div>
      )}

      {/* Report header (Fiscal Year / Office) */}
      {report && (
        <div className={`${T.card} p-4 mb-4 flex flex-wrap gap-6`}>
          <div>
            <span className="text-[#64748B] text-sm block">Fiscal Year</span>
            <span className="text-[#1E293B] font-semibold">
              {report.fiscal_year}
            </span>
          </div>
          <div>
            <span className="text-[#64748B] text-sm block">Office</span>
            <span className="text-[#1E293B] font-semibold">
              {report.office || "All Offices"}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`${T.card} p-0 overflow-hidden`}>
        {!report || report.groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#64748B]">
            <ClipboardList className="w-8 h-8" strokeWidth={1.5} />
            <p className="text-sm">
              {loading
                ? "Loading report..."
                : "No approved PPMP items found for these filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-white text-[#0F172A] text-xs uppercase tracking-wide">
                  {BASE_COLS.map((c) => (
                    <th
                      key={c}
                      rowSpan={2}
                      className="px-3 py-2 border border-[#E2E8F0] text-left align-bottom"
                    >
                      {c}
                    </th>
                  ))}
                  {QUARTERS.map((q) => (
                    <th
                      key={q}
                      colSpan={2}
                      className="px-3 py-2 border border-[#E2E8F0] text-center"
                    >
                      {q}
                    </th>
                  ))}
                </tr>
                <tr className="bg-white text-[#0F172A] text-xs uppercase tracking-wide">
                  {QUARTERS.map((q) => (
                    <Fragment key={q}>
                      <th className="px-3 py-1.5 border border-[#E2E8F0] text-right">
                        Qty
                      </th>
                      <th className="px-3 py-1.5 border border-[#E2E8F0] text-right">
                        Amount
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {numberedGroups.map((group) => (
                  <Fragment key={group.code}>
                    <tr className="bg-green-100">
                      <td
                        colSpan={14}
                        className="px-3 py-2 font-semibold text-green-800 border border-green-200"
                      >
                        {group.code}
                      </td>
                    </tr>
                    {group.numberedItems.map(({ no, item }) => {
                      // Once any quantity of this item has been PR'd, the
                      // whole row goes red — same join as the PR wizard's
                      // "remaining_quantity" check, so this never disagrees
                      // with what Create PR shows as still available.
                      const cellText = item.is_pr_requested
                        ? "text-red-600"
                        : "text-[#1E293B]";
                      const rowTitle = item.is_pr_requested
                        ? `${item.requested_quantity} of ${item.total_quantity} already requested via PR`
                        : undefined;
                      return (
                        <tr
                          key={`${group.code}-${no}`}
                          title={rowTitle}
                          className="hover:bg-[#F8FAFC]"
                        >
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] ${item.is_pr_requested ? "text-red-600" : "text-[#64748B]"}`}
                          >
                            {no}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] ${cellText}`}
                          >
                            {item.item_name}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] ${cellText}`}
                          >
                            {item.unit}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {qtyOrDash(item.total_quantity)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {amtOrDash(item.unit_price)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right font-medium ${item.is_pr_requested ? "text-red-600" : "text-[#0F172A]"}`}
                          >
                            {amtOrDash(item.total_cost)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {qtyOrDash(item.q1_qty)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {amtOrDash(item.q1_amount)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {qtyOrDash(item.q2_qty)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {amtOrDash(item.q2_amount)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {qtyOrDash(item.q3_qty)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {amtOrDash(item.q3_amount)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {qtyOrDash(item.q4_qty)}
                          </td>
                          <td
                            className={`px-3 py-1.5 border border-[#E2E8F0] text-right ${cellText}`}
                          >
                            {amtOrDash(item.q4_amount)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-200 font-semibold">
                      <td className="px-3 py-1.5 border border-gray-300" />
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-700">
                        Subtotal — {group.code}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300" />
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {qtyOrDash(group.subtotal_quantity)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300" />
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {amtOrDash(group.subtotal_cost)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {qtyOrDash(group.q1_subtotal_qty)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {amtOrDash(group.q1_subtotal_amount)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {qtyOrDash(group.q2_subtotal_qty)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {amtOrDash(group.q2_subtotal_amount)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {qtyOrDash(group.q3_subtotal_qty)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {amtOrDash(group.q3_subtotal_amount)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {qtyOrDash(group.q4_subtotal_qty)}
                      </td>
                      <td className="px-3 py-1.5 border border-gray-300 text-right text-gray-700">
                        {amtOrDash(group.q4_subtotal_amount)}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-yellow-300 text-gray-900 font-semibold">
                  <td className="px-3 py-2 border border-yellow-400" />
                  <td className="px-3 py-2 border border-yellow-400">
                    GRAND TOTAL
                  </td>
                  <td className="px-3 py-2 border border-yellow-400" />
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {qtyOrDash(report.grand_total_quantity)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400" />
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {amtOrDash(report.grand_total_cost)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {qtyOrDash(report.q1_grand_qty)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {amtOrDash(report.q1_grand_amount)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {qtyOrDash(report.q2_grand_qty)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {amtOrDash(report.q2_grand_amount)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {qtyOrDash(report.q3_grand_qty)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {amtOrDash(report.q3_grand_amount)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {qtyOrDash(report.q4_grand_qty)}
                  </td>
                  <td className="px-3 py-2 border border-yellow-400 text-right">
                    {amtOrDash(report.q4_grand_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
