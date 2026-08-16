import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  FileText,
  FileCheck2,
  Clock,
  Package,
  Users,
  Layers,
  FileSpreadsheet,
  CheckCheck,
  ArrowRight,
  Inbox,
  Briefcase,
  SlidersHorizontal,
  PenLine,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { colors, gradients } from "./theme";
import ProcurementOverview from "../ProcurementOverview";
import {
  fetchDashboardSummary,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  fetchOfficeOptions,
  type DashboardSummary,
  type AdminNotification,
  type FlatOfficeOption,
} from "../../services/adminDashboard";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-amber-100 text-amber-700",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Card({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-3 py-2.5 flex items-center gap-2">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: `${accent}18`, color: accent }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p
          className="text-lg font-bold leading-tight truncate"
          style={{ color: colors.text }}
        >
          {value}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{label}</p>
        {hint && <p className="text-[10px] text-slate-400 truncate">{hint}</p>}
      </div>
    </div>
  );
}

function NotificationBell({ requesterUid }: { requesterUid: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const count = await fetchUnreadNotificationCount(requesterUid);
      setUnread(count);
    } catch {
      /* endpoint is admin-only; ignore transient failures */
    }
  }, [requesterUid]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        !(target instanceof Element && target.closest("[data-notif-menu]"))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const list = await fetchNotifications(requesterUid, 50);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadItems();
  };

  const handleOpenNotification = async (n: AdminNotification) => {
    setOpen(false);
    if (!n.read) {
      try {
        await markNotificationRead(n.id, requesterUid);
        setUnread((u) => Math.max(0, u - 1));
        setItems((prev) =>
          prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)),
        );
      } catch {
        /* still navigate even if marking read fails */
      }
    }
    navigate(`/ppmps/${n.ppmp_id}`);
  };

  const handleReadAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(requesterUid);
      setUnread(0);
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white transition"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-notif-menu
          className="absolute right-0 top-12 w-[22rem] max-w-[85vw] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-bold" style={{ color: colors.text }}>
                Notifications
              </p>
              <p className="text-[11px] text-slate-400">
                PPMP submissions from offices
              </p>
            </div>
            <button
              onClick={handleReadAll}
              disabled={markingAll || unread === 0}
              className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800 disabled:opacity-40"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {loading && (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Loading...
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm text-slate-400 mt-2">No notifications</p>
              </div>
            )}
            {!loading &&
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleOpenNotification(n)}
                  className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50/50 transition"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        n.read ? "bg-slate-200" : "bg-sky-500"
                      }`}
                      title={n.read ? "Read" : "Unread"}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: colors.text }}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                        {n.office_name || "Unknown Office"} · PPMP No.{" "}
                        {n.ppmp_no || "—"} · FY {n.year}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {n.ppmp_type ? (
                          <span className="capitalize">{n.ppmp_type}</span>
                        ) : null}
                        {n.prepared_by ? ` · Prepared by ${n.prepared_by}` : ""}
                        {n.submitted_at ? (
                          <span className="block">
                            Submitted {formatDateTime(n.submitted_at)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 mt-1.5 shrink-0" />
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickActionLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white hover:border-sky-300 hover:bg-blue-50/60 transition px-4 py-3 text-left"
    >
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${colors.primary}14`, color: colors.primary }}
      >
        <Icon className="w-4 h-4" />
      </span>
      <span
        className="text-sm font-semibold flex-1"
        style={{ color: colors.text }}
      >
        {label}
      </span>
      <ArrowRight className="w-4 h-4 text-slate-300" />
    </button>
  );
}

export default function AdminDashboardPage() {
  const { user: supabaseUser, dbUser } = useAuth();
  const navigate = useNavigate();
  const requesterUid = supabaseUser?.id ?? "";

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "mine" = this admin's own PPMP/PR activity, same view an end-user gets.
  // "managed" = the existing office-wide oversight below. Defaults to
  // "managed" so nothing about today's landing view changes.
  const [viewMode, setViewMode] = useState<"mine" | "managed">("managed");

  const [fiscalYear, setFiscalYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [officeId, setOfficeId] = useState("");
  const [officeOptions, setOfficeOptions] = useState<FlatOfficeOption[]>([]);

  const yearOptions = useCallback((): number[] => {
    const set = new Set<number>([fiscalYear]);
    const now = new Date().getFullYear();
    for (let y = now - 1; y <= now + 4; y++) set.add(y);
    summary?.fiscal_years.forEach((y) => set.add(y));
    return Array.from(set).sort((a, b) => b - a);
  }, [fiscalYear, summary]);

  // Load the office list for the filter dropdown.
  useEffect(() => {
    if (dbUser?.role !== "admin") return;
    fetchOfficeOptions()
      .then(setOfficeOptions)
      .catch(() => setOfficeOptions([]));
  }, [dbUser]);

  // Redirect non-admins away (also enforced server-side).
  useEffect(() => {
    if (dbUser && dbUser.role !== "admin")
      navigate("/dashboard", { replace: true });
  }, [dbUser, navigate]);

  const loadSummary = useCallback(() => {
    if (!requesterUid) return;
    setLoading(true);
    setError(null);
    fetchDashboardSummary(requesterUid, fiscalYear, officeId || undefined)
      .then((data) => setSummary(data))
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, [requesterUid, fiscalYear, officeId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Light auto-refresh so new submissions surface without a manual reload.
  useEffect(() => {
    if (!requesterUid) return;
    const interval = setInterval(loadSummary, 60000);
    return () => clearInterval(interval);
  }, [requesterUid, loadSummary]);

  if (dbUser?.role !== "admin") {
    return null;
  }

  const cards = summary?.cards;
  const isFiltered = officeId !== "";

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white shadow-lg relative"
        style={{ background: gradients.header }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-blue-100 text-xs uppercase tracking-widest font-semibold">
              Admin Oversight
            </p>
            <h1 className="text-xl font-bold mt-1">Admin Dashboard</h1>
            <p className="text-white/80 text-xs mt-1">
              Monitor PPMP submissions, offices, and consolidation progress
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <NotificationBell requesterUid={requesterUid} />

            {/* My Procurement / Managed Offices toggle */}
            <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-xl p-1">
              <button
                onClick={() => setViewMode("mine")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  viewMode === "mine"
                    ? "bg-white text-sky-700"
                    : "text-white/80 hover:text-white"
                }`}
              >
                My Procurement
              </button>
              <button
                onClick={() => setViewMode("managed")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  viewMode === "managed"
                    ? "bg-white text-sky-700"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Managed Offices
              </button>
            </div>

            {/* FY / office filters — same row as the toggle, so the header
                is the same height in both modes. Only relevant in Managed
                Offices; My Procurement has its own FY selector below. */}
            {viewMode === "managed" && (
              <>
                <select
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(Number(e.target.value))}
                  className="text-xs font-semibold bg-white/10 text-white px-2.5 py-1.5 rounded-xl border border-white/20 outline-none"
                >
                  {yearOptions().map((y) => (
                    <option key={y} value={y} style={{ color: "black" }}>
                      FY {y}
                    </option>
                  ))}
                </select>
                <select
                  value={officeId}
                  onChange={(e) => setOfficeId(e.target.value)}
                  className="text-xs font-semibold bg-white/10 text-white px-2.5 py-1.5 rounded-xl border border-white/20 outline-none max-w-[12rem]"
                >
                  <option value="" style={{ color: "black" }}>
                    All Offices
                  </option>
                  {officeOptions.map((o) => (
                    <option key={o.id} value={o.id} style={{ color: "black" }}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {viewMode === "mine" ? (
        <ProcurementOverview userId={dbUser.id} supabaseUid={requesterUid} />
      ) : (
        <>
          {/* ── Error / loading states ─────────────────────────────────────── */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          {loading && !summary && (
            <div className="bg-white border border-gray-200 rounded-2xl flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
              <div className="w-5 h-5 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
              Loading dashboard...
            </div>
          )}

          {summary && cards && (
            <>
              {/* ── Overview cards ─────────────────────────────────────────── */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <Card
                  label="Total Offices"
                  value={cards.total_offices}
                  icon={Building2}
                  accent={colors.primary}
                />
                <Card
                  label="Offices w/ Submissions"
                  value={cards.offices_with_submissions}
                  icon={Users}
                  accent="#8B5CF6"
                  hint="Offices that submitted a PPMP"
                />
                <Card
                  label="Submitted PPMPs"
                  value={cards.submitted_ppmps}
                  icon={FileText}
                  accent="#0EA5E9"
                  hint={`FY ${summary.current_fiscal_year}`}
                />
                <Card
                  label="Final PPMPs"
                  value={cards.final_ppmps}
                  icon={FileCheck2}
                  accent="#10B981"
                />
                <Card
                  label="Pending PPMPs"
                  value={cards.pending_ppmps}
                  icon={Clock}
                  accent="#F59E0B"
                  hint="Awaiting consolidation"
                />
                <Card
                  label="Total Items"
                  value={cards.total_items}
                  icon={Package}
                  accent="#EF4444"
                  hint="Individual line items"
                />
              </div>

              {/* ── Recent PPMP submissions ────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <h2
                      className="text-sm font-bold"
                      style={{ color: colors.text }}
                    >
                      Recent PPMP Submissions
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Most recent PPMPs submitted by offices
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/admin/offices-ppmp")}
                    className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-gray-100">
                        <th className="px-5 py-2.5 font-semibold">
                          Office / End-User
                        </th>
                        <th className="px-4 py-2.5 font-semibold">PPMP No.</th>
                        <th className="px-4 py-2.5 font-semibold">Type</th>
                        <th className="px-4 py-2.5 font-semibold">
                          Prepared By
                        </th>
                        <th className="px-4 py-2.5 font-semibold">Submitted</th>
                        <th className="px-5 py-2.5 font-semibold text-right">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recent_submissions.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-10 text-center text-slate-400 text-sm"
                          >
                            No PPMP submissions
                            {isFiltered ? " for the selected office" : ""} yet.
                          </td>
                        </tr>
                      )}
                      {summary.recent_submissions.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => navigate(`/ppmps/${p.id}`)}
                          className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer"
                        >
                          <td className="px-5 py-3">
                            <p className="font-semibold text-slate-700">
                              {p.office_name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {p.ppmp_type} · FY {p.year}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-sky-700">
                            {p.ppmp_no || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {p.ppmp_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {p.prepared_by || p.submitted_by || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDateTime(p.submitted_at)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full ${
                                STATUS_STYLES[p.status] ??
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Office overview ────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <h2
                      className="text-sm font-bold"
                      style={{ color: colors.text }}
                    >
                      Office Overview
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      PPMP status and items per office — FY{" "}
                      {summary.current_fiscal_year}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/admin/offices-ppmp")}
                    className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    Offices PPMP <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-gray-100">
                        <th className="px-5 py-2.5 font-semibold">Office</th>
                        <th className="px-4 py-2.5 font-semibold text-center">
                          PPMPs
                        </th>
                        <th className="px-4 py-2.5 font-semibold text-center">
                          Submitted
                        </th>
                        <th className="px-4 py-2.5 font-semibold text-center">
                          Drafts
                        </th>
                        <th className="px-4 py-2.5 font-semibold text-center">
                          Final
                        </th>
                        <th className="px-5 py-2.5 font-semibold text-right">
                          Items
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.office_overview.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-10 text-center text-slate-400 text-sm"
                          >
                            No PPMPs for FY {summary.current_fiscal_year}.
                          </td>
                        </tr>
                      )}
                      {summary.office_overview.map((o) => (
                        <tr
                          key={o.office_id}
                          onClick={() => navigate("/admin/offices-ppmp")}
                          className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer"
                        >
                          <td className="px-5 py-3 font-semibold text-slate-700">
                            {o.office_name}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {o.total_ppmps}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {o.submitted}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {o.draft}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {o.final}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-700">
                            {o.items}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Status cards: Consolidation / APP / Itemized ───────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: `${colors.primary}14`,
                        color: colors.primary,
                      }}
                    >
                      <Layers className="w-5 h-5" />
                    </span>
                    <button
                      onClick={() => navigate("/admin/ppmp-consolidation")}
                      className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                    >
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3
                    className="text-sm font-bold mt-3"
                    style={{ color: colors.text }}
                  >
                    PPMP Consolidation
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    FY {summary.consolidation.fiscal_year}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p
                        className="text-lg font-bold"
                        style={{ color: colors.primary }}
                      >
                        {summary.consolidation.total_ppmps}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Total
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600">
                        {summary.consolidation.submitted_ppmps}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Submitted
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600">
                        {summary.consolidation.final_ppmps}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Final
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "#10B98114", color: "#10B981" }}
                    >
                      <FileCheck2 className="w-5 h-5" />
                    </span>
                    <button
                      onClick={() => navigate("/admin/app-consolidation")}
                      className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                    >
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3
                    className="text-sm font-bold mt-3"
                    style={{ color: colors.text }}
                  >
                    APP Overview
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    FY {summary.app_overview.fiscal_year}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-emerald-600">
                        {summary.app_overview.submitted_ppmps}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Submitted
                      </p>
                    </div>
                    <div>
                      <p
                        className="text-lg font-bold"
                        style={{ color: colors.primary }}
                      >
                        {summary.app_overview.app_settings_count}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        With App Settings
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-700">
                        {summary.app_overview.last_submission
                          ? new Date(
                              summary.app_overview.last_submission,
                            ).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Last Submitted
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "#8B5CF614", color: "#8B5CF6" }}
                    >
                      <Package className="w-5 h-5" />
                    </span>
                    <button
                      onClick={() => navigate("/admin/items")}
                      className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                    >
                      Manage <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3
                    className="text-sm font-bold mt-3"
                    style={{ color: colors.text }}
                  >
                    Item Management
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Procurement catalog
                  </p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold text-violet-600">
                        {summary.item_management.catalog_items}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        Active Items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700">Latest</p>
                      <p className="text-[11px] text-slate-500 max-w-[9rem] truncate">
                        {summary.item_management.recently_added[0]?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Itemized summary ───────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <h2
                      className="text-sm font-bold"
                      style={{ color: colors.text }}
                    >
                      Offices Itemized List — Summary
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Item counts per office · FY {summary.itemized.fiscal_year}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/admin/offices-itemized-list")}
                    className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    Full Itemized List <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-100">
                  {summary.itemized.offices.length === 0 && (
                    <div className="bg-white col-span-full px-5 py-8 text-center text-slate-400 text-sm">
                      No itemized data for FY {summary.itemized.fiscal_year}.
                    </div>
                  )}
                  {summary.itemized.offices.map((o) => (
                    <div key={o.office_id} className="bg-white px-5 py-3">
                      <p
                        className="text-sm font-semibold text-slate-700 truncate"
                        title={o.office_name}
                      >
                        {o.office_name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        <span className="font-bold text-slate-600">
                          {o.items}
                        </span>{" "}
                        item{o.items === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Quick actions ──────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h2
                  className="text-sm font-bold mb-3"
                  style={{ color: colors.text }}
                >
                  Quick Actions
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                  <QuickActionLink
                    to="/admin/offices-ppmp"
                    label="Offices PPMP"
                    icon={FileText}
                  />
                  <QuickActionLink
                    to="/admin/ppmp-consolidation"
                    label="Consolidated PPMP"
                    icon={Layers}
                  />
                  <QuickActionLink
                    to="/admin/app-consolidation"
                    label="Consolidated APP"
                    icon={FileCheck2}
                  />
                  <QuickActionLink
                    to="/admin/offices-itemized-list"
                    label="Offices Itemized List"
                    icon={FileSpreadsheet}
                  />
                  <QuickActionLink
                    to="/admin/offices"
                    label="Manage Offices"
                    icon={Building2}
                  />
                  <QuickActionLink
                    to="/admin/items"
                    label="Item Management"
                    icon={Package}
                  />
                  <QuickActionLink
                    to="/admin/lot-priority"
                    label="Lot Priority"
                    icon={SlidersHorizontal}
                  />
                  <QuickActionLink
                    to="/admin/signatories"
                    label="Signatories"
                    icon={PenLine}
                  />
                </div>
              </div>

              {/* ── Footer note ────────────────────────────────────────────── */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                <Briefcase className="w-3.5 h-3.5" />
                {isFiltered
                  ? `Dashboard scoped to FY ${summary.current_fiscal_year} and the selected office.`
                  : `Dashboard scoped to FY ${summary.current_fiscal_year} across all offices.`}{" "}
                Refreshed {formatDateTime(summary.generated_at)}.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
