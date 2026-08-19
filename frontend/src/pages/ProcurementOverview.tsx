import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  ClipboardList,
  Banknote,
  FileEdit,
  ListChecks,
  ChevronDown,
  Eye,
  ExternalLink,
  PackageCheck,
  Plus,
  FolderKanban,
  ShoppingCart,
  BarChart3,
  Archive,
  UserRound,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { colors, font } from "./admin/theme";

// ══════════════════════════════════════════════════════════════════════════
// ProcurementOverview — "what's happening with MY procurement?"
//
// Extracted from EndUserDashboard (DashboardPage.tsx) so it can be reused
// wherever someone needs to see their OWN PPMP/PR activity — originally
// just the end-user dashboard, now also the admin dashboard's "My
// Procurement" tab, since admins create PPMP/APP/PR the same way end-users
// do but previously had no view of their own progress.
//
// Key difference from the original inline version in DashboardPage.tsx:
// that version's data fetch skipped PRs/my-items entirely whenever
// `isAdmin` was true (see fetchAll() there). This component is scoped by
// an explicit userId/supabaseUid instead of a role flag, and always fetches
// — so an admin viewing their OWN procurement gets real data, not the
// empty-by-default behavior the role check used to force.
//
// Design tokens are pulled from theme.ts (colors, font) — same source as
// DashboardPage.tsx and AdminDashboardPage.tsx, so this renders consistently
// wherever it's dropped in.
// ══════════════════════════════════════════════════════════════════════════

const PRIMARY = colors.primary;
const ACTIVE_BG = colors.activeBg;
const HEADING = colors.heading;
const BORDER = colors.border;
const TEXT = colors.text;
const FONT_STACK = font.stack;
const SUCCESS = colors.success;
const WARN = colors.warning;
const DANGER = colors.error;
const SUCCESS_BG = colors.successBg;
const WARN_BG = colors.warningBg;

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });
const fmtCompact = (n: number) =>
  n >= 1_000_000
    ? `₱${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `₱${(n / 1_000).toFixed(0)}K`
      : `₱${fmt(n)}`;
const fmtDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

// ── Types — same shapes as DashboardPage.tsx (kept in sync manually since
// there's no shared types module yet; if one gets added later, both files
// should import from it instead of each keeping their own copy). ──────────
interface EntryItem {
  id?: string;
  item_name?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  total_cost?: number;
  category?: string;
}
interface Entry {
  id?: string;
  category_description?: string;
  description?: string;
  estimated_budget?: number;
  items?: EntryItem[];
}
interface Project {
  order_no?: number;
  total_budget?: number;
  entries?: Entry[];
}
interface PPMPListItem {
  id: string | number;
  ppmp_no?: string;
  ppmp_type?: string;
  year?: number;
  status?: string;
  office_id?: string | number;
  allocated_budget?: number;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  approved_at?: string;
  projects?: Project[];
}
interface OfficeOption {
  id: string | number;
  name: string;
  code: string;
}
interface PRItemRef {
  ppmp_item_id?: string | number;
}
interface PurchaseRequestItem {
  id: string | number;
  pr_no?: string;
  status?: string;
  created_at?: string;
  ppmp_id?: string | number;
  items?: PRItemRef[];
}
interface PPMPStats {
  total_ppmps: number;
  draft: number;
  submitted: number;
  approved: number;
  archived: number;
  indicative: number;
  final: number;
  total_budget: number;
}
interface MyPrdItemRow {
  id: string;
  pr_id: string;
  ppmp_item_id: string;
  stored_ppmp_item_id?: string | number;
  is_arrived: boolean;
}
interface MyPrdCounts {
  total: number;
  arrived: number;
  notArrived: number;
}
interface ItemStatusCounts {
  total: number;
  arrived: number;
  prd: number;
  notPrd: number;
}

const projectBudget = (p: Project) =>
  p.total_budget ??
  (p.entries || []).reduce((sum, entry) => {
    if (entry.estimated_budget !== undefined) {
      return sum + (entry.estimated_budget || 0);
    }
    return (
      sum +
      (entry.items || []).reduce(
        (s, it) =>
          s + (it.total_cost ?? (it.quantity || 0) * (it.unit_price || 0)),
        0,
      )
    );
  }, 0);

const ppmpBudget = (p: PPMPListItem) =>
  (p.projects || []).reduce((sum, proj) => sum + projectBudget(proj), 0);

// ── Shared building blocks (copied from DashboardPage.tsx's identical
// components — kept local so this file has no dependency on that one). ────
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl p-5 ${className}`}
      style={{ border: `1px solid ${BORDER}` }}
    >
      {children}
    </div>
  );
}

function CardTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2
        className="text-[13px] tracking-wide"
        style={{ color: HEADING, fontWeight: 700 }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  onClick,
  compact,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 bg-white rounded-2xl transition-colors duration-[250ms] ${
        compact ? "px-3 py-2.5" : "p-4"
      } ${onClick ? "cursor-pointer hover:bg-[#F0F9FF]" : ""}`}
      style={{ border: `1px solid ${BORDER}` }}
    >
      <div
        className={`shrink-0 inline-flex items-center justify-center rounded-full ${
          compact ? "w-8 h-8" : "w-10 h-10"
        }`}
        style={{ background: ACTIVE_BG, color: PRIMARY }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className={`tracking-tight leading-tight truncate ${
            compact ? "text-lg" : "text-xl"
          }`}
          style={{ color: TEXT, fontWeight: 700 }}
        >
          {value}
        </p>
        <p
          className={`text-slate-500 mt-0.5 truncate ${compact ? "text-[11px]" : "text-[12px]"}`}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 text-left p-4 rounded-2xl bg-white hover:bg-[#F0F9FF] transition-colors duration-[250ms]"
      style={{ border: `1px solid ${BORDER}` }}
    >
      <span
        className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full"
        style={{ background: ACTIVE_BG, color: PRIMARY }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm" style={{ color: TEXT, fontWeight: 600 }}>
          {label}
        </p>
        <p className="text-[12px] text-slate-500 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status?: string }) {
  const isDraft = status === "draft";
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
      style={
        isDraft
          ? { background: "#FEF3C7", color: "#92400E" }
          : { background: ACTIVE_BG, color: HEADING }
      }
    >
      {status || "final"}
    </span>
  );
}

function TypePill({ type }: { type?: string }) {
  const isFinal = type === "final";
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
      style={
        isFinal
          ? { background: SUCCESS_BG, color: SUCCESS }
          : { background: "#F1F5F9", color: "#475569" }
      }
    >
      {isFinal ? "Final" : "Indicative"}
    </span>
  );
}

// Horizontal budget-utilization bar. Green under 80%, amber 80–100%, red
// past 100% — semantic status color, unrelated to the donut's palette, so
// left as-is.
function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = pct > 100 ? DANGER : pct >= 80 ? WARN : SUCCESS;
  return (
    <div>
      <div
        className="w-full h-2.5 rounded-full overflow-hidden"
        style={{ background: "#F1F5F9" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <p className="text-[11px] mt-1.5" style={{ color, fontWeight: 600 }}>
        {pct.toFixed(0)}% of allocated budget used
        {pct > 100 ? " — over budget" : ""}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-xs text-slate-400 text-center px-4">
      {text}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════

export default function ProcurementOverview({
  userId,
  supabaseUid,
}: {
  /** dbUser.id of whoever's procurement this shows — end-user or admin. */
  userId?: string | number;
  /** dbUser.supabase_uid — needed for the same requester_uid params the
   * backend already expects on /ppmps/, /prs/, and /prs/my-items. */
  supabaseUid?: string;
}) {
  const navigate = useNavigate();

  const [ppmpStats, setPpmpStats] = useState<PPMPStats | null>(null);
  const [ppmpList, setPpmpList] = useState<PPMPListItem[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<
    PurchaseRequestItem[]
  >([]);
  const [myPrdItems, setMyPrdItems] = useState<MyPrdItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFY, setSelectedFY] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [fySelectedByUser, setFySelectedByUser] = useState(false);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("all");

  const listParams = useMemo(() => ({ created_by: userId }), [userId]);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const ppmpRes = await api.get("/ppmps/summary/stats", {
        params: listParams,
      });
      setPpmpStats(ppmpRes.data);

      // Unlike the original EndUserDashboard fetch (which skipped these
      // three calls whenever the viewer was flagged isAdmin), this always
      // fetches them — this component is only ever used for "my own
      // procurement" scope, regardless of the viewer's role.
      const [listRes, officesRes, prRes, myItemsRes] = await Promise.all([
        api
          .get("/ppmps/", {
            params: { ...listParams, requester_uid: supabaseUid },
          })
          .catch(() => ({ data: [] })),
        api.get("/offices/").catch(() => ({ data: [] })),
        api
          .get("/prs/", {
            params: { created_by: userId, requester_uid: supabaseUid },
          })
          .catch(() => ({ data: [] })),
        api
          .get("/prs/my-items", {
            params: { requester_uid: supabaseUid },
          })
          .catch(() => ({ data: [] })),
      ]);
      setPpmpList(Array.isArray(listRes.data) ? listRes.data : []);
      setOffices(Array.isArray(officesRes.data) ? officesRes.data : []);
      setPurchaseRequests(Array.isArray(prRes.data) ? prRes.data : []);
      setMyPrdItems(Array.isArray(myItemsRes.data) ? myItemsRes.data : []);
    } finally {
      setLoading(false);
    }
  }, [userId, supabaseUid, listParams]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    const onFocus = () => fetchAll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAll]);

  const officeMap = useMemo(
    () => new Map(offices.map((o) => [String(o.id), o])),
    [offices],
  );

  const recentPPMPs = useMemo(
    () =>
      [...ppmpList]
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        )
        .slice(0, 8),
    [ppmpList],
  );

  const fiscalYears = useMemo(() => {
    const years = new Set<number>(
      ppmpList.map((p) => p.year).filter((y): y is number => !!y),
    );
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [ppmpList]);

  useEffect(() => {
    if (fySelectedByUser) return;
    if (ppmpList.length === 0) return;
    const mostRecent = Math.max(...ppmpList.map((p) => p.year || 0));
    if (mostRecent > 0) setSelectedFY(mostRecent);
  }, [ppmpList, fySelectedByUser]);

  const myOfficeOptions = useMemo(() => {
    const seen = new Map<string, OfficeOption>();
    ppmpList.forEach((p) => {
      const key = String(p.office_id ?? "");
      if (!key || seen.has(key)) return;
      const office = officeMap.get(key);
      if (office) seen.set(key, office);
    });
    return Array.from(seen.values());
  }, [ppmpList, officeMap]);

  const fyPPMPs = useMemo(
    () =>
      ppmpList.filter(
        (p) =>
          p.year === selectedFY &&
          (selectedOfficeId === "all" ||
            String(p.office_id) === selectedOfficeId),
      ),
    [ppmpList, selectedFY, selectedOfficeId],
  );

  const myAllocated = useMemo(
    () => fyPPMPs.reduce((s, p) => s + (p.allocated_budget || 0), 0),
    [fyPPMPs],
  );
  const myDraftCount = useMemo(
    () => fyPPMPs.filter((p) => p.status === "draft").length,
    [fyPPMPs],
  );

  const prdItemIds = useMemo(() => {
    const set = new Set<string>();
    myPrdItems.forEach((i) => {
      if (i.ppmp_item_id) set.add(String(i.ppmp_item_id));
    });
    return set;
  }, [myPrdItems]);

  const arrivedItemIds = useMemo(() => {
    const set = new Set<string>();
    myPrdItems.forEach((i) => {
      if (i.is_arrived && i.ppmp_item_id) set.add(String(i.ppmp_item_id));
    });
    return set;
  }, [myPrdItems]);

  const ppmpItemsOf = useCallback((p: PPMPListItem): EntryItem[] => {
    return (p.projects || []).flatMap((proj) =>
      (proj.entries || []).flatMap((entry) => entry.items || []),
    );
  }, []);

  const classifyItems = useCallback(
    (items: EntryItem[]): ItemStatusCounts => {
      let arrived = 0;
      let prd = 0;
      let notPrd = 0;
      items.forEach((item) => {
        const id = item.id !== undefined ? String(item.id) : undefined;
        if (id && arrivedItemIds.has(id)) arrived += 1;
        else if (id && prdItemIds.has(id)) prd += 1;
        else notPrd += 1;
      });
      const total = arrived + prd + notPrd;
      return { total, arrived, prd, notPrd };
    },
    [arrivedItemIds, prdItemIds],
  );

  const procurementProgress = useMemo(() => {
    const counts = classifyItems(fyPPMPs.flatMap(ppmpItemsOf));
    const total = counts.total;
    const arrivedPct =
      total > 0 ? Math.round((counts.arrived / total) * 100) : 0;
    const prdPct = total > 0 ? Math.round((counts.prd / total) * 100) : 0;
    return {
      ...counts,
      arrivedPct,
      prdPct,
      notPrdPct: total > 0 ? 100 - arrivedPct - prdPct : 0,
    };
  }, [fyPPMPs, classifyItems, ppmpItemsOf]);

  const myPrdCounts = useMemo<MyPrdCounts>(() => {
    return {
      total: procurementProgress.prd + procurementProgress.arrived,
      arrived: procurementProgress.arrived,
      notArrived: procurementProgress.prd,
    };
  }, [procurementProgress]);

  const latestPPMPs = useMemo(
    () =>
      [...fyPPMPs]
        .sort(
          (a, b) =>
            new Date(b.submitted_at || b.created_at || 0).getTime() -
            new Date(a.submitted_at || a.created_at || 0).getTime(),
        )
        .slice(0, 3)
        .map((p) => {
          const allocated = p.allocated_budget || 0;
          const spent = ppmpBudget(p);
          const itemStatus = classifyItems(ppmpItemsOf(p));
          return {
            id: p.id,
            ppmp_no: p.ppmp_no,
            ppmp_type: p.ppmp_type,
            status: p.status,
            created_at: p.created_at,
            office_id: p.office_id,
            year: p.year,
            allocated,
            spent,
            remaining: allocated - spent,
            utilizationPct: allocated > 0 ? (spent / allocated) * 100 : 0,
            itemStatus: {
              ...itemStatus,
              arrivedPct:
                itemStatus.total > 0
                  ? Math.round((itemStatus.arrived / itemStatus.total) * 100)
                  : 0,
              prdPct:
                itemStatus.total > 0
                  ? Math.round((itemStatus.prd / itemStatus.total) * 100)
                  : 0,
              notPrdPct:
                itemStatus.total > 0
                  ? 100 -
                    Math.round((itemStatus.arrived / itemStatus.total) * 100) -
                    Math.round((itemStatus.prd / itemStatus.total) * 100)
                  : 0,
            },
          };
        }),
    [fyPPMPs, classifyItems, ppmpItemsOf],
  );

  // "Generated a PR" events in the activity feed; PPMP create/update/submit
  // events too.
  const activityFeed = useMemo(() => {
    type Evt = {
      id: string;
      label: string;
      date?: string;
      kind: "create" | "update" | "pr" | "submit" | "approve";
    };
    const events: Evt[] = [];
    ppmpList.forEach((p) => {
      events.push({
        id: `c-${p.id}`,
        label: `Created PPMP No. ${p.ppmp_no || p.id}`,
        date: p.created_at,
        kind: "create",
      });
      if (p.updated_at && p.updated_at !== p.created_at) {
        events.push({
          id: `u-${p.id}`,
          label: `Updated PPMP No. ${p.ppmp_no || p.id}`,
          date: p.updated_at,
          kind: "update",
        });
      }
      if (p.submitted_at) {
        events.push({
          id: `s-${p.id}`,
          label: `Submitted PPMP No. ${p.ppmp_no || p.id}`,
          date: p.submitted_at,
          kind: "submit",
        });
      }
      if (p.approved_at) {
        events.push({
          id: `a-${p.id}`,
          label: `PPMP No. ${p.ppmp_no || p.id} approved`,
          date: p.approved_at,
          kind: "approve",
        });
      }
    });
    purchaseRequests.forEach((pr) => {
      const forPPMP = ppmpList.find((p) => String(p.id) === String(pr.ppmp_id));
      events.push({
        id: `pr-${pr.id}`,
        label: `Generated ${pr.pr_no ? `PR ${pr.pr_no}` : "a PR"}${
          forPPMP ? ` for PPMP No. ${forPPMP.ppmp_no || forPPMP.id}` : ""
        }`,
        date: pr.created_at,
        kind: "pr",
      });
    });
    return events
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      )
      .slice(0, 6);
  }, [ppmpList, purchaseRequests]);

  const [ppmpFilter, setPpmpFilter] = useState<"all" | "active" | "purchased">(
    "all",
  );
  const filteredLatestPPMPs = useMemo(() => {
    if (ppmpFilter === "all") return latestPPMPs;
    return latestPPMPs.filter((p) => {
      const s = p.itemStatus;
      if (ppmpFilter === "purchased") return s.total > 0 && s.notPrd === 0;
      return s.notPrd > 0;
    });
  }, [latestPPMPs, ppmpFilter]);

  const fyPPMPCount = fyPPMPs.length;

  if (loading) {
    return (
      <div
        className="grid grid-cols-3 md:grid-cols-6 gap-3"
        style={{ fontFamily: FONT_STACK }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 animate-pulse"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <div className="h-3 bg-slate-100 rounded w-16 mb-2" />
            <div className="h-6 bg-slate-100 rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT_STACK }}>
      {/* Summary cards — scoped to the selected fiscal year */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        <StatCard
          label={`My PPMPs (FY ${selectedFY})`}
          value={fyPPMPCount}
          icon={<ClipboardList className="w-[18px] h-[18px]" />}
          onClick={() => navigate("/ppmps")}
          compact
        />
        <StatCard
          label="Draft"
          value={myDraftCount}
          icon={<FileEdit className="w-[18px] h-[18px]" />}
          compact
        />
        <StatCard
          label="Indicative"
          value={ppmpStats?.indicative ?? 0}
          icon={<ClipboardList className="w-[18px] h-[18px]" />}
          compact
        />
        <StatCard
          label="Submitted"
          value={ppmpStats?.submitted ?? 0}
          icon={<ListChecks className="w-[18px] h-[18px]" />}
          compact
        />
        <StatCard
          label="Final"
          value={ppmpStats?.final ?? 0}
          icon={<ListChecks className="w-[18px] h-[18px]" />}
          compact
        />
        <StatCard
          label="Total Budget"
          value={fmtCompact(myAllocated)}
          icon={<Banknote className="w-[18px] h-[18px]" />}
          compact
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-3">
          <CardTitle
            action={
              <div className="flex items-center gap-2">
                {myOfficeOptions.length > 1 && (
                  <div className="relative">
                    <select
                      value={selectedOfficeId}
                      onChange={(e) => setSelectedOfficeId(e.target.value)}
                      className="appearance-none text-xs pl-3 pr-7 py-1.5 rounded-lg bg-white cursor-pointer"
                      style={{ border: `1px solid ${BORDER}`, color: TEXT }}
                    >
                      <option value="all">All Offices</option>
                      {myOfficeOptions.map((o) => (
                        <option key={o.id} value={String(o.id)}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                )}
                <div className="relative">
                  <select
                    value={selectedFY}
                    onChange={(e) => {
                      setFySelectedByUser(true);
                      setSelectedFY(Number(e.target.value));
                    }}
                    className="appearance-none text-xs pl-3 pr-7 py-1.5 rounded-lg bg-white cursor-pointer"
                    style={{ border: `1px solid ${BORDER}`, color: TEXT }}
                  >
                    {fiscalYears.map((y) => (
                      <option key={y} value={y}>
                        FY {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={ppmpFilter}
                    onChange={(e) =>
                      setPpmpFilter(
                        e.target.value as "all" | "active" | "purchased",
                      )
                    }
                    className="appearance-none text-xs pl-3 pr-7 py-1.5 rounded-lg bg-white cursor-pointer"
                    style={{ border: `1px solid ${BORDER}`, color: TEXT }}
                  >
                    <option value="all">All PPMPs</option>
                    <option value="active">With items to procure</option>
                    <option value="purchased">Fully purchased</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
              </div>
            }
          >
            Budget Overview
          </CardTitle>
          <p className="text-[11px] text-slate-400 -mt-2 mb-4">
            Fiscal Year {selectedFY} · Latest {filteredLatestPPMPs.length || 0}{" "}
            of {fyPPMPCount} PPMP
            {fyPPMPCount === 1 ? "" : "s"}
            {ppmpFilter !== "all" && (
              <>
                {" "}
                ·{" "}
                {ppmpFilter === "purchased"
                  ? "fully purchased"
                  : "with items to procure"}
              </>
            )}
          </p>

          {latestPPMPs.length === 0 ? (
            <EmptyState text="No PPMPs for this fiscal year yet." />
          ) : filteredLatestPPMPs.length === 0 ? (
            <EmptyState text="No PPMPs match this filter — switch back to All PPMPs to see them." />
          ) : (
            <div className="space-y-4">
              {filteredLatestPPMPs.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl p-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                  style={{ border: `1px solid ${BORDER}` }}
                  onClick={() =>
                    navigate(
                      p.ppmp_type !== "final"
                        ? `/ppmps/${p.id}/edit`
                        : `/ppmps/${p.id}`,
                    )
                  }
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-xs"
                        style={{ color: TEXT, fontWeight: 700 }}
                      >
                        PPMP No. {p.ppmp_no || p.id}
                      </p>
                      <TypePill type={p.ppmp_type} />
                      <StatusPill status={p.status} />
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "#EEF2FF", color: "#4338CA" }}
                      >
                        {p.office_name || officeMap.get(String(p.office_id))?.name || "—"}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "#F1F5F9", color: "#475569" }}
                      >
                        FY {p.year || "—"}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {fmtDate(p.created_at)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">
                        Allocated
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: TEXT, fontWeight: 700 }}
                      >
                        ₱{fmt(p.allocated)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">
                        Procurement Cost
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: HEADING, fontWeight: 700 }}
                      >
                        ₱{fmt(p.spent)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">
                        Remaining
                      </p>
                      <p
                        className="text-sm"
                        style={{
                          color: p.remaining < 0 ? DANGER : SUCCESS,
                          fontWeight: 700,
                        }}
                      >
                        ₱{fmt(p.remaining)}
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(
                        `/my-prd-items?ppmpId=${encodeURIComponent(String(p.id))}`,
                      );
                    }}
                    title="View PR'd items for this PPMP"
                    className="flex items-center gap-4 mb-3 rounded-lg p-2 -m-2 cursor-pointer transition-colors hover:bg-[#F0F9FF]"
                  >
                    <div className="relative w-24 h-24 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "Arrived",
                                value: p.itemStatus.arrivedPct,
                                count: p.itemStatus.arrived,
                              },
                              {
                                name: "PR'd",
                                value: p.itemStatus.prdPct,
                                count: p.itemStatus.prd,
                              },
                              {
                                name: "Not Yet PR'd",
                                value: p.itemStatus.notPrdPct,
                                count: p.itemStatus.notPrd,
                              },
                            ]}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={32}
                            outerRadius={46}
                            startAngle={90}
                            endAngle={-270}
                            paddingAngle={2}
                          >
                            {/* Blue color scheme (previously green/red) */}
                            <Cell fill={PRIMARY} />
                            <Cell fill="#7DD3FC" />
                            <Cell fill="#E2E8F0" />
                          </Pie>
                          <Tooltip
                            formatter={(v: any, _n: any, entry: any) => [
                              `${entry.payload.count} items · ${v}%`,
                              entry.payload.name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p
                          className="text-sm"
                          style={{ color: TEXT, fontWeight: 700 }}
                        >
                          {p.itemStatus.arrivedPct}%
                        </p>
                        <p className="text-[8px] text-slate-400">Arrived</p>
                      </div>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      <p className="text-slate-500 col-span-2">
                        Total Items:{" "}
                        <span className="font-semibold" style={{ color: TEXT }}>
                          {p.itemStatus.total}
                        </span>
                      </p>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: PRIMARY }}
                        />
                        <span className="text-slate-500">
                          Arrived {p.itemStatus.arrived}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: "#7DD3FC" }}
                        />
                        <span className="text-slate-500">
                          PR'd {p.itemStatus.prd}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 col-span-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: "#E2E8F0" }}
                        />
                        <span className="text-slate-500">
                          Not Yet PR'd {p.itemStatus.notPrd}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 col-span-2">
                        <ExternalLink
                          className="w-3 h-3"
                          style={{ color: PRIMARY }}
                        />
                        <span
                          className="text-[11px]"
                          style={{ color: PRIMARY, fontWeight: 600 }}
                        >
                          View PR'd items for this PPMP
                        </span>
                      </span>
                    </div>
                  </div>
                  <ProgressBar pct={p.utilizationPct} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* My PR'd Items — arrival summary. Derived from the same item-level
          data as each PPMP's procurement-progress donut, so the numbers can
          never contradict each other. */}
      <Card className="mb-4">
        <CardTitle
          action={
            <button
              onClick={() => navigate("/my-prd-items")}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full transition-colors"
              style={{ background: ACTIVE_BG, color: HEADING, fontWeight: 600 }}
            >
              <Eye className="w-3 h-3" />
              View My PR'd Items
            </button>
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4" style={{ color: PRIMARY }} />
            My PR'd Items
          </span>
        </CardTitle>
        {myPrdCounts.total === 0 ? (
          <EmptyState text="Items included in your Purchase Requests will appear here once you create a PR." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#F8FAFC" }}>
              <p
                className="text-2xl tracking-tight"
                style={{ color: TEXT, fontWeight: 700 }}
              >
                {myPrdCounts.total}
              </p>
              <p className="text-[12px] text-slate-500 mt-0.5">Total Items</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: SUCCESS_BG }}>
              <p
                className="text-2xl tracking-tight"
                style={{ color: SUCCESS, fontWeight: 700 }}
              >
                {myPrdCounts.arrived}
              </p>
              <p className="text-[12px] text-slate-500 mt-0.5">Arrived</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: WARN_BG }}>
              <p
                className="text-2xl tracking-tight"
                style={{ color: WARN, fontWeight: 700 }}
              >
                {myPrdCounts.notArrived}
              </p>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Not Yet Arrived
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle>Recent PPMPs</CardTitle>
        {recentPPMPs.length === 0 ? (
          <EmptyState text="You haven't created any PPMPs yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr
                  className="text-left text-slate-400 border-b"
                  style={{ borderColor: BORDER }}
                >
                  <th className="py-2 font-medium">PPMP No.</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">FY</th>
                  <th className="py-2 font-medium">Updated</th>
                  <th className="py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: BORDER }}>
                {recentPPMPs.slice(0, 5).map((p) => {
                  const isIndicative = p.ppmp_type !== "final";
                  return (
                    <tr key={p.id}>
                      <td
                        className="py-2"
                        style={{ color: TEXT, fontWeight: 600 }}
                      >
                        {p.ppmp_no || "—"}
                      </td>
                      <td className="py-2">
                        <TypePill type={p.ppmp_type} />
                      </td>
                      <td className="py-2">
                        <StatusPill status={p.status} />
                      </td>
                      <td className="py-2 text-slate-500">{p.year || "—"}</td>
                      <td className="py-2 text-slate-400">
                        {fmtDate(p.updated_at || p.created_at)}
                      </td>
                      <td className="py-2 text-right">
                        {isIndicative ? (
                          <button
                            onClick={() => navigate(`/ppmps/${p.id}/edit`)}
                            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors"
                            style={{
                              background: ACTIVE_BG,
                              color: HEADING,
                              fontWeight: 600,
                            }}
                          >
                            <FileEdit className="w-3 h-3" />
                            Continue Editing
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/ppmps/${p.id}`)}
                            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors"
                            style={{
                              background: "#F1F5F9",
                              color: "#475569",
                              fontWeight: 600,
                            }}
                          >
                            <Eye className="w-3 h-3" />
                            View Details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle>Recent Activities</CardTitle>
        {activityFeed.length === 0 ? (
          <EmptyState text="No recent activity." />
        ) : (
          <div className="space-y-0">
            {activityFeed.map((a, i) => {
              const iconMap: Record<string, React.ReactNode> = {
                create: <Plus className="w-3 h-3" />,
                update: <FileEdit className="w-3 h-3" />,
                pr: <ClipboardList className="w-3 h-3" />,
                submit: <ExternalLink className="w-3 h-3" />,
                approve: <ListChecks className="w-3 h-3" />,
              };
              return (
                <div key={a.id ?? i} className="flex items-start gap-3 py-2.5">
                  <div className="flex flex-col items-center shrink-0">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: ACTIVE_BG, color: PRIMARY }}
                    >
                      {iconMap[a.kind] || (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: PRIMARY }}
                        />
                      )}
                    </span>
                    {i < activityFeed.length - 1 && (
                      <span
                        className="w-px flex-1 mt-1"
                        style={{ background: BORDER }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-xs" style={{ color: TEXT }}>
                      {a.label}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      {fmtDate(a.date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick Actions — landscape layout */}
      <Card>
        <CardTitle>Quick Actions</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickAction
            icon={<Plus className="w-5 h-5" />}
            label="Create PPMP"
            desc="Start a new plan"
            onClick={() => navigate("/ppmps/create")}
          />
          <QuickAction
            icon={<FolderKanban className="w-5 h-5" />}
            label="View My PPMP"
            desc="All my PPMPs"
            onClick={() => navigate("/ppmps")}
          />
          <QuickAction
            icon={<ShoppingCart className="w-5 h-5" />}
            label="Generate PR"
            desc="From pending items"
            onClick={() => navigate("/purchase-requests/create")}
          />
          <QuickAction
            icon={<BarChart3 className="w-5 h-5" />}
            label="Reports"
            desc="Analytics"
            onClick={() => navigate("/reports")}
          />
          <QuickAction
            icon={<Archive className="w-5 h-5" />}
            label="Archive"
            desc="Archived PPMPs"
            onClick={() => navigate("/archived")}
          />
          <QuickAction
            icon={<UserRound className="w-5 h-5" />}
            label="Profile"
            desc="Account settings"
            onClick={() => navigate("/profile")}
          />
        </div>
      </Card>
    </div>
  );
}
