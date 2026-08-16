import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  PackageCheck,
  Undo2,
  CheckCircle2,
  Circle,
  ChevronDown,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/feedback/ToastProvider";
import { EmptyState } from "../../components/feedback/EmptyState";
import { SkeletonRow } from "../../components/feedback/Skeleton";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { useConfirmState } from "../../components/feedback/useConfirm";
import { LoadingButton } from "../../components/feedback/LoadingButton";
import PageHeader from "../../components/layout/PageHeader";

// Flat item row as returned by GET /prs/my-items
interface MyPrdItem {
  id: string;
  pr_id: string;
  ppmp_id: string;
  ppmp_item_id: string;
  stored_ppmp_item_id?: string;
  ppmp_entry_id?: string;
  ppmp_no: string | null;
  office_id?: string | null;
  end_user_unit: string | null;
  pr_number: string;
  pr_date: string;
  item_name: string;
  unit: string;
  unit_price: number;
  category?: string | null;
  stock_property_no?: string | null;
  requested_quantity: number;
  amount: number;
  is_arrived: boolean;
  arrival_date: string | null;
}

type ArrivalFilter = "arrived" | "not-arrived";

const fmtPeso = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export default function MyPrdItemsPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } =
    useConfirmState();

  // Optional PPMP drill-down: /my-prd-items?ppmpId=<PPMP_ID> shows only the
  // PR'd items that came from that exact PPMP (matched on the real
  // ppmp_id relationship, never on descriptions). Without the param the
  // page keeps its normal all-items behavior.
  const ppmpId = searchParams.get("ppmpId");

  const [items, setItems] = useState<MyPrdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ArrivalFilter>("not-arrived");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const requestor = dbUser?.supabase_uid;

  const fetchItems = useCallback(async () => {
    if (!requestor) return;
    setLoading(true);
    try {
      const res = await api.get("/prs/my-items", {
        params: { requester_uid: requestor },
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Could not load your PR'd items.",
      );
    } finally {
      setLoading(false);
    }
  }, [requestor, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // When a PPMP filter is active, only that PPMP's items are considered —
  // totals, filter chips, search, and the footer all stay scoped to it.
  const scopeItems = useMemo(
    () => (ppmpId ? items.filter((i) => i.ppmp_id === ppmpId) : items),
    [items, ppmpId],
  );

  // Distinct offices among the scoped items (keyed by the PPMP's office_id,
  // labeled with its End-User/Unit name) so the list can be narrowed per
  // office instead of being one confusing mixed list.
  const officeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    scopeItems.forEach((i) => {
      const key = i.office_id ? String(i.office_id) : "unknown";
      if (seen.has(key)) return;
      seen.set(key, i.end_user_unit || "Unassigned office");
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [scopeItems]);

  // Apply the office filter first — the arrival chips/search and totals all
  // stay scoped to the selected office so the numbers always match the rows.
  const officeScope = useMemo(
    () =>
      officeFilter === "all"
        ? scopeItems
        : scopeItems.filter((i) =>
            i.office_id
              ? String(i.office_id) === officeFilter
              : officeFilter === "unknown",
          ),
    [scopeItems, officeFilter],
  );

  const updateArrival = useCallback(
    async (itemId: string, is_arrived: boolean) => {
      const target = items.find((i) => i.id === itemId);
      if (!target) return;
      setProcessingId(itemId);
      try {
        await api.patch(
          `/prs/${target.pr_id}/items/${
            target.stored_ppmp_item_id ?? target.ppmp_item_id
          }/arrival`,
          { is_arrived },
          { params: { requester_uid: requestor } },
        );
        toast.success(
          is_arrived
            ? "Item marked as arrived successfully."
            : "Item marked as not arrived.",
        );
        // Update immediately + refresh from the server so counts stay correct
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  is_arrived,
                  arrival_date: is_arrived
                    ? new Date().toISOString()
                    : null,
                }
              : i,
          ),
        );
      } catch (err: any) {
        toast.error(
          err.response?.data?.detail ||
            "Unable to update item arrival status. Please try again.",
        );
      } finally {
        setProcessingId(null);
      }
    },
    [items, requestor, toast],
  );

  const handleMarkArrived = useCallback(
    async (item: MyPrdItem) => {
      const confirmed = await confirm({
        title: "Confirm arrival",
        description: "Confirm that this item has arrived?",
        confirmLabel: "Confirm Arrival",
        tone: "primary",
      });
      if (!confirmed) return;
      await updateArrival(item.id, true);
    },
    [confirm, updateArrival],
  );

  const handleMarkNotArrived = useCallback(
    async (item: MyPrdItem) => {
      const confirmed = await confirm({
        title: "Undo arrival",
        description: "Are you sure you want to mark this item as not arrived?",
        confirmLabel: "Mark as Not Arrived",
        tone: "warning",
      });
      if (!confirmed) return;
      await updateArrival(item.id, false);
    },
    [confirm, updateArrival],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return officeScope.filter((i) => {
      if (filter === "arrived" && !i.is_arrived) return false;
      if (filter === "not-arrived" && i.is_arrived) return false;
      if (!q) return true;
      return (
        i.item_name.toLowerCase().includes(q) ||
        (i.pr_number || "").toLowerCase().includes(q) ||
        (i.ppmp_no || "").toLowerCase().includes(q)
      );
    });
  }, [officeScope, filter, search]);

  const totals = useMemo(() => {
    const arrived = officeScope.filter((i) => i.is_arrived).length;
    return {
      total: officeScope.length,
      arrived,
      notArrived: officeScope.length - arrived,
    };
  }, [officeScope]);

  return (
    <div>
      <PageHeader
        title="My PR'd Items"
        subtitle="Items included in the Purchase Requests you've created — track which ones have already arrived."
        actions={
          <button
            onClick={() => navigate("/prs/create")}
            className="bg-white text-sky-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition shadow-sm"
          >
            + Create PR
          </button>
        }
      />

      {ppmpId && items.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 px-5 py-3 rounded-xl border border-[#009CC4]/30 bg-[#F0F9FF]">
          <p className="text-sm text-gray-700">
            Showing PR'd items for{" "}
            <span className="font-semibold text-gray-900">
              PPMP No. {scopeItems[0]?.ppmp_no || ppmpId}
            </span>
          </p>
          <button
            onClick={() => navigate("/my-prd-items")}
            className="text-xs font-semibold text-[#009CC4] hover:underline whitespace-nowrap"
          >
            Clear filter
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow columns={6} />
          <SkeletonRow columns={6} />
          <SkeletonRow columns={6} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PackageCheck className="w-8 h-8" />}
          title="No PR'd Items Yet"
          description="Items included in your Purchase Requests will appear here once you create a PR."
          action={{
            label: "Create your first PR",
            onClick: () => navigate("/prs/create"),
          }}
        />
      ) : scopeItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">
            No PR'd items for this PPMP yet.
          </p>
          <button
            onClick={() => navigate("/my-prd-items")}
            className="mt-3 text-xs font-semibold text-[#009CC4] hover:underline"
          >
            Show all PR'd items
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Toolbar: filter chips + search */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-xs font-medium bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40 text-gray-700"
              >
                <option value="all">All Offices</option>
                {officeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="flex items-center gap-1.5">
              {(
                [
                  {
                    key: "not-arrived",
                    label: `Not Yet Arrived (${totals.notArrived})`,
                  },
                  { key: "arrived", label: `Arrived (${totals.arrived})` },
                ] as { key: ArrivalFilter; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    filter === opt.key
                      ? "bg-[#F0F9FF] text-[#009CC4] border border-[#009CC4]/40"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40"
                placeholder="Search item, PR number, or PPMP number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="py-2.5 px-4 font-medium">PR No.</th>
                  <th className="py-2.5 px-4 font-medium">PR Date</th>
                  <th className="py-2.5 px-4 font-medium">PPMP No.</th>
                  <th className="py-2.5 px-4 font-medium">End-User / Unit</th>
                  <th className="py-2.5 px-4 font-medium">Item / Description</th>
                  <th className="py-2.5 px-4 font-medium text-right">Qty</th>
                  <th className="py-2.5 px-4 font-medium">Unit</th>
                  <th className="py-2.5 px-4 font-medium text-right">Unit Price</th>
                  <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                  <th className="py-2.5 px-4 font-medium">Stock No.</th>
                  <th className="py-2.5 px-4 font-medium">Arrival Status</th>
                  <th className="py-2.5 px-4 font-medium">Arrival Date</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC] transition">
                    <td
                      className="py-2.5 px-4 font-medium text-gray-800 whitespace-nowrap"
                    >
                      <button
                        onClick={() => navigate(`/prs/${item.pr_id}`)}
                        className="text-[#009CC4] hover:underline"
                      >
                        {item.pr_number || `PR #${item.pr_id}`}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                      {fmtDate(item.pr_date)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                      {item.ppmp_no || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                      {item.end_user_unit || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-gray-800 max-w-[260px]">
                      <span className="line-clamp-2">{item.item_name}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-gray-700">
                      {item.requested_quantity}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500">{item.unit}</td>
                    <td className="py-2.5 px-4 text-right text-gray-700 whitespace-nowrap">
                      ₱{fmtPeso(item.unit_price ?? 0)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-gray-800 whitespace-nowrap">
                      ₱{fmtPeso(item.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                      {item.stock_property_no || "—"}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {item.is_arrived ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Arrived
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">
                          <Circle className="w-3.5 h-3.5" />
                          Not Yet Arrived
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                      {fmtDate(item.arrival_date)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {processingId === item.id ? (
                        <LoadingButton
                          onClick={() => {}}
                          busy
                          busyLabel="Saving..."
                          variant="primary"
                          className="text-xs px-3 py-1.5 rounded-lg"
                        >
                          Saving...
                        </LoadingButton>
                      ) : item.is_arrived ? (
                        <button
                          onClick={() => handleMarkNotArrived(item)}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Mark as Not Arrived
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkArrived(item)}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark as Arrived
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-10">
                No items match your filter or search.
              </div>
            )}
          </div>

          {/* Footer: totals */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            Showing {filtered.length} of {scopeItems.length} item
            {scopeItems.length !== 1 ? "s" : ""} ·{" "}
            <span className="text-green-700 font-semibold">
              {totals.arrived} arrived
            </span>{" "}
            ·{" "}
            <span className="text-gray-600 font-semibold">
              {totals.notArrived} not yet arrived
            </span>
          </div>
        </div>
      )}

      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        processing={processingId !== null}
      />
    </div>
  );
}