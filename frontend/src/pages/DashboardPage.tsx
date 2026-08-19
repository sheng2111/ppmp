import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  Package,
  ClipboardList,
  Banknote,
  Plus,
  FolderKanban,
  FileEdit,
  Layers,
  ListChecks,
  Archive,
  BarChart3,
  UserRound,
  RefreshCw,
  CalendarClock,
  PenLine,
  ShoppingCart,
  FileText,
  Send,
  CheckCircle2,
  ChevronDown,
  Eye,
  PackageCheck,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ── Design tokens — pulled from the shared theme.ts (single source of
// truth) instead of a local copy. Note: SUCCESS/WARN/DANGER previously
// pointed at different hex values than theme.ts (#059669 vs #10B981,
// #D97706 vs #F59E0B, #DC2626 vs #EF4444) — this import corrects that
// drift; every other value below is unchanged.
import { colors, gradients, font, chartColors } from "./admin/theme";
const PRIMARY = colors.primary;
const ACTIVE_BG = colors.activeBg;
const HEADING = colors.heading;
const BORDER = colors.border;
const TEXT = colors.text;
const HEADER_GRADIENT = gradients.header;
const FONT_STACK = font.stack;
const CHART_COLORS = chartColors;
const SUCCESS = colors.success;
const SUCCESS_BG = colors.successBg;
const WARN = colors.warning;
const WARN_BG = colors.warningBg;
const DANGER = colors.error;

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

// ── Types matching the REAL backend schema (app/models/ppmp.py +
// app/schemas/ppmp.py) — NOT a guessed shape. Corrections vs. the previous
// version of this file:
//   • Project.lots        → Project.entries       (backend calls it "entries")
//   • Lot                 → Entry (PPMPEntry)
//   • LotItem.description → EntryItem.item_name    (backend field name)
//   • Lot.estimated_budget → Entry.estimated_budget (same name, one level
//     under "entries" instead of "lots")
//   • Project had no total field before — PPMPProject.total_budget is
//     computed server-side in _build_projects() in ppmps.py, so we use it
//     directly instead of re-summing on the client.
//   • EntryItem.total_cost is also computed server-side (quantity *
//     unit_price, rounded) — prefer it over recomputing.
//   • There is NO pr_status field anywhere on the backend model. An item's
//     "waiting for PR" status can only be derived from whether its id shows
//     up inside a fetched Purchase Request's items[].ppmp_item_id — so
//     pr_status stays as an OPTIONAL, likely-always-undefined field here in
//     case a future backend change adds it, but the real signal is
//     prItemIds (built from GET /prs/).
//
// Remaining ASSUMPTIONS (verify / rename if your backend differs further):
//   • PPMPListItem.submitted_at / approved_at — approved_at does not exist
//     on the current PPMP model (only submitted_at does). Kept optional so
//     it simply never fires until/unless the backend adds it.
//   • GET /prs/ — returns owner-scoped PR headers with an `items` array of
//     { ppmp_item_id }. Wrapped in .catch(() => []) so its absence never
//     breaks the dashboard.
//   • GET /notifications/ — returns a flat notification list. Wrapped in
//     .catch(() => []); if unavailable, only the client-derived "Budget
//     exceeded" notice will show.
//   • dbUser.office_id — used to resolve the end-user's own office name for
//     the header and Budget Overview card. Falls back to the office on
//     their most recent PPMP.
interface EntryItem {
  id?: string;
  item_name?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  total_cost?: number;
  category?: string;
  // Not present on the backend today — see note above. Kept optional so
  // this dashboard degrades gracefully if/when the backend adds it.
  pr_status?: "pending" | "in_pr" | "purchased";
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
  ppmp_type?: string; // 'indicative' | 'final'
  year?: number;
  status?: string; // 'draft' | 'submitted' | 'approved' | ...
  office_id?: string | number;
  office_name?: string;
  allocated_budget?: number;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  approved_at?: string; // not on current backend model — always undefined for now
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
interface NotificationItem {
  id: string | number;
  type?: "ppmp_approved" | "pr_generated" | "budget_exceeded" | "returned";
  message?: string;
  created_at?: string;
  read?: boolean;
}

// Prefer the server-computed total; only fall back to summing items if a
// project somehow arrives without total_budget (e.g. an older cached
// response).
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

const ppmpItemCount = (p: PPMPListItem) =>
  (p.projects || []).reduce(
    (sum, proj) =>
      sum +
      (proj.entries || []).reduce(
        (s, entry) => s + (entry.items?.length || 0),
        0,
      ),
    0,
  );

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
interface AdminStats {
  total_offices: number;
  total_items: number;
}

// Shape of GET /prs/my-items rows — the item id + arrival flag let the
// Procurement Progress donut and the My PR'd Items card share ONE source of
// truth (the actual PPMP item records + their PR/arrival relationship).
interface MyPrdItemRow {
  id: string;
  pr_id: string;
  // Resolved to the id the item has in the PPMP right now (the backend
  // re-links PR items whose PPMP was edited after the PR was created).
  ppmp_item_id: string;
  stored_ppmp_item_id?: string | number;
  is_arrived: boolean;
}

interface MyPrdCounts {
  total: number;
  arrived: number;
  notArrived: number;
}

// One procurement item = exactly one status:
//   arrived   → the item is on a PR AND the user confirmed arrival (green)
//   prd       → the item is on a PR but arrival not confirmed (red)
//   notPrd    → the item is in the PPMP but not on any PR (grey)
interface ItemStatusCounts {
  total: number;
  arrived: number;
  prd: number;
  notPrd: number;
}

// Resolves the office label shown above the PPMP list. When a specific
// office is selected, that office's name is used. When "All Offices" is
// selected and the user actually has PPMPs under several offices, use a
// generic "All Offices" label instead of silently pinning one office name
// onto every PPMP — each PPMP card still shows its OWN End-User / Unit
// (resolved from that PPMP's office_id), independent of this label.
function officeScopeLabel(
  selectedOfficeId: string,
  officeOptions: OfficeOption[],
  officeMap: Map<string, OfficeOption>,
  fallback?: string,
): string {
  if (selectedOfficeId !== "all") {
    return (
      officeMap.get(selectedOfficeId)?.name || fallback || "Selected office"
    );
  }
  if (officeOptions.length > 1) return "All Offices";
  return officeOptions[0]?.name || fallback || "Your office";
}

export default function DashboardPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = dbUser?.role === "admin";
  const currentFY = new Date().getFullYear();

  const [ppmpStats, setPpmpStats] = useState<PPMPStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [ppmpList, setPpmpList] = useState<PPMPListItem[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<
    PurchaseRequestItem[]
  >([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [myPrdItems, setMyPrdItems] = useState<MyPrdItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFY, setSelectedFY] = useState<number>(currentFY);
  const [fySelectedByUser, setFySelectedByUser] = useState(false);
  // "all" = no office filter applied (default). Only surfaced as a selector
  // when the end-user actually has PPMPs under more than one office —
  // most users only ever have one, so the selector stays hidden for them.
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("all");

  // Same params pattern your existing stats call already uses — admins see
  // everything, end-users see only their own PPMPs. Kept identical here so
  // the new list fetch respects the same access rule as the unchanged stats.
  const listParams = useMemo(
    () => (isAdmin ? {} : { created_by: dbUser?.id }),
    [isAdmin, dbUser?.id],
  );

  const fetchAll = useCallback(
    async (isBackground = false) => {
      if (!dbUser) return;
      if (isBackground) setRefreshing(true);
      try {
        // ── Existing calls — untouched ──────────────────────────────────
        const ppmpRes = await api.get("/ppmps/summary/stats", {
          params: listParams,
        });
        setPpmpStats(ppmpRes.data);

        if (isAdmin) {
          const adminRes = await api.get("/offices/summary/stats");
          setAdminStats(adminRes.data);
        }

        // ── List + reference data fetch for derived aggregates ──────────
        // PRs are fetched from the real /prs/ endpoint (owner-scoped). The
        // old /purchase-requests/ path does not exist on the backend, so
        // this also fixes Items Waiting for PR / Recent Activities, which
        // were silently empty.
        const [listRes, officesRes, prRes, notifRes, myItemsRes] =
          await Promise.all([
            api
              .get("/ppmps/", {
                // End-users pass their requester_uid so their own draft
                // PPMPs (and the items inside them) are included too — the
                // backend hides drafts unless the requester is identified.
                // Admins keep the default (everything, no extra filtering).
                params: isAdmin
                  ? listParams
                  : { ...listParams, requester_uid: dbUser?.supabase_uid },
              })
              .catch(() => ({ data: [] })),
            api.get("/offices/").catch(() => ({ data: [] })),
            isAdmin
              ? Promise.resolve({ data: [] })
              : api
                  .get("/prs/", {
                    params: {
                      created_by: dbUser?.id,
                      requester_uid: dbUser?.supabase_uid,
                    },
                  })
                  .catch(() => ({ data: [] })),
            isAdmin
              ? Promise.resolve({ data: [] })
              : api.get("/notifications/", { params: { requester_uid: dbUser?.supabase_uid, unread_only: true } }).catch(() => ({ data: [] })),
            isAdmin
              ? Promise.resolve({ data: [] })
              : api
                  .get("/prs/my-items", {
                    params: { requester_uid: dbUser?.supabase_uid },
                  })
                  .catch(() => ({ data: [] })),
          ]);
        setPpmpList(Array.isArray(listRes.data) ? listRes.data : []);
        setOffices(Array.isArray(officesRes.data) ? officesRes.data : []);
        setPurchaseRequests(Array.isArray(prRes.data) ? prRes.data : []);
        setNotifications(Array.isArray(notifRes.data) ? notifRes.data : []);

        // ── Single source of truth for item status ──
        // Raw PR'd-item rows (ppmp_item_id + is_arrived). Both the
        // Procurement Progress donut and the My PR'd Items card derive from
        // this, so their numbers can never contradict each other.
        setMyPrdItems(Array.isArray(myItemsRes.data) ? myItemsRes.data : []);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dbUser, isAdmin, listParams],
  );

  useEffect(() => {
    fetchAll();
    // Poll + refresh-on-focus so charts stay current after PPMPs are
    // created/edited/deleted elsewhere in the app — same pattern Layout.tsx
    // already uses for the pending-approvals badge.
    const interval = setInterval(() => fetchAll(true), 60000);
    const onFocus = () => fetchAll(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAll]);

  // ── Derived aggregates (client-side, read-only — no business logic changed) ──
  const totalProjects = useMemo(
    () => ppmpList.reduce((sum, p) => sum + (p.projects?.length || 0), 0),
    [ppmpList],
  );
  const totalEntries = useMemo(
    () => ppmpList.reduce((sum, p) => sum + ppmpItemCount(p), 0),
    [ppmpList],
  );

  const officeMap = useMemo(
    () => new Map(offices.map((o) => [String(o.id), o])),
    [offices],
  );

  const officeSummary = useMemo(() => {
    const map = new Map<
      string,
      { office?: OfficeOption; ppmps: number; projects: number; budget: number }
    >();
    ppmpList.forEach((p) => {
      const key = String(p.office_id ?? "unknown");
      const entry = map.get(key) || {
        office: officeMap.get(key),
        ppmps: 0,
        projects: 0,
        budget: 0,
      };
      entry.ppmps += 1;
      entry.projects += p.projects?.length || 0;
      entry.budget += ppmpBudget(p);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.budget - a.budget);
  }, [ppmpList, officeMap]);

  const categoryDistribution = useMemo(() => {
    const map = new Map<string, number>();
    ppmpList.forEach((p) =>
      (p.projects || []).forEach((proj) =>
        (proj.entries || []).forEach((entry) => {
          const key = entry.category_description || "Uncategorized";
          map.set(key, (map.get(key) || 0) + 1);
        }),
      ),
    );
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [ppmpList]);

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

  const fyPPMPsAdmin = useMemo(
    () => ppmpList.filter((p) => p.year === currentFY),
    [ppmpList, currentFY],
  );
  const fySummary = {
    ppmps: fyPPMPsAdmin.length,
    projects: fyPPMPsAdmin.reduce((s, p) => s + (p.projects?.length || 0), 0),
    entries: fyPPMPsAdmin.reduce((s, p) => s + ppmpItemCount(p), 0),
    budget: fyPPMPsAdmin.reduce((s, p) => s + ppmpBudget(p), 0),
  };

  // ── End-user: fiscal years available + the FY currently in focus ────────
  const fiscalYears = useMemo(() => {
    const years = new Set<number>(
      ppmpList.map((p) => p.year).filter((y): y is number => !!y),
    );
    years.add(currentFY);
    return Array.from(years).sort((a, b) => b - a);
  }, [ppmpList, currentFY]);

  // Default the selector to the most recent FY the user actually has data
  // in, but only before they've made a manual choice.
  useEffect(() => {
    if (fySelectedByUser || isAdmin) return;
    if (ppmpList.length === 0) return;
    const mostRecent = Math.max(...ppmpList.map((p) => p.year || 0));
    if (mostRecent > 0) setSelectedFY(mostRecent);
  }, [ppmpList, fySelectedByUser, isAdmin]);

  // Distinct offices this end-user actually has PPMPs under. Length <= 1
  // means the office selector has nothing useful to offer, so it's hidden.
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

  const myOffice = useMemo(() => {
    if (selectedOfficeId !== "all") return officeMap.get(selectedOfficeId);
    const byUser = officeMap.get(String((dbUser as any)?.office_id));
    if (byUser) return byUser;
    const fromPPMP = ppmpList.find((p) => p.office_id);
    return fromPPMP ? officeMap.get(String(fromPPMP.office_id)) : undefined;
  }, [officeMap, dbUser, ppmpList, selectedOfficeId]);

  // allocated_budget lives directly on each PPMP (per-PPMP, per the backend
  // model) — summing it across this fiscal year's PPMPs is correct as long
  // as the backend is really storing a per-PPMP figure and not repeating an
  // office-wide total on every record. If this still looks too large,
  // check what value is actually being POSTed as allocated_budget when a
  // PPMP is created.
  const myAllocated = useMemo(
    () => fyPPMPs.reduce((s, p) => s + (p.allocated_budget || 0), 0),
    [fyPPMPs],
  );
  const myProcurementBudget = useMemo(
    () => fyPPMPs.reduce((s, p) => s + ppmpBudget(p), 0),
    [fyPPMPs],
  );
  const myDraftCount = useMemo(
    () => fyPPMPs.filter((p) => p.status === "draft").length,
    [fyPPMPs],
  );
  const myFinalCount = fyPPMPs.length - myDraftCount;

  const prItemIds = useMemo(() => {
    const set = new Set<string>();
    purchaseRequests.forEach((pr) =>
      (pr.items || []).forEach((it) => {
        if (it.ppmp_item_id !== undefined) set.add(String(it.ppmp_item_id));
      }),
    );
    return set;
  }, [purchaseRequests]);

  // ── Item status sets — derived from the SAME /prs/my-items rows that
  // feed the My PR'd Items card, so the donut and the card can never
  // disagree. prdItemIds ⊇ arrivedItemIds.
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

  // 1 physical/procurement item = 1 count. Classifies a list of PPMP items
  // into exactly one bucket each: arrived / PR'd-but-not-arrived / not PR'd.
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

  // Procurement Progress — ITEMS ONLY. No projects / PPMPs / PRs are
  // counted; every individual item in the selected FY's PPMPs is counted
  // exactly once. The donut center is the % of items that arrived.
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

  // My PR'd Items summary — derived from the same classifyItems() the donut
  // uses, scoped to the selected FY, so the card can never contradict the
  // donut. Total = PR'd items (arrived + PR'd-but-not-arrived).
  const myPrdCounts = useMemo<MyPrdCounts>(() => {
    return {
      total: procurementProgress.prd + procurementProgress.arrived,
      arrived: procurementProgress.arrived,
      notArrived: procurementProgress.prd,
    };
  }, [procurementProgress]);

  // The 3 most recently submitted PPMPs in the current FY + office scope,
  // each carrying its own allocated/procurement/remaining figures AND its
  // own item-level Procurement Progress donut — shown individually in
  // Budget Overview instead of one office-wide aggregate, so it's clear at
  // a glance which PPMP a given ₱ amount / item count belongs to.
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
            // Each PPMP's own office/end-user unit and fiscal year — the
            // card displays both from these, never a dashboard-global value.
            office_id: p.office_id,
            year: p.year,
            allocated,
            spent,
            remaining: allocated - spent,
            utilizationPct: allocated > 0 ? (spent / allocated) * 100 : 0,
            // Per-PPMP item status — counts ONLY the items of THIS PPMP.
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

  const itemsWaitingForPR = useMemo(() => {
    const rows: {
      id: string;
      description: string;
      category: string;
      budget: number;
    }[] = [];
    fyPPMPs.forEach((p) =>
      (p.projects || []).forEach((proj) =>
        (proj.entries || []).forEach((entry, eIdx) =>
          (entry.items || []).forEach((item, idx) => {
            const itemId = item.id !== undefined ? String(item.id) : undefined;
            const alreadyHandled = itemId ? prItemIds.has(itemId) : false;
            if (!alreadyHandled) {
              rows.push({
                id: itemId || `${p.id}-${eIdx}-${idx}`,
                description: item.item_name || "Untitled item",
                category:
                  item.category ||
                  entry.category_description ||
                  "Uncategorized",
                budget:
                  item.total_cost ??
                  (item.quantity || 0) * (item.unit_price || 0),
              });
            }
          }),
        ),
      ),
    );
    return rows.slice(0, 8);
  }, [fyPPMPs, prItemIds]);

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

  const recentDrafts = useMemo(
    () =>
      [...ppmpList]
        .filter((p) => p.status === "draft")
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at || 0).getTime() -
            new Date(a.updated_at || a.created_at || 0).getTime(),
        )
        .slice(0, 5),
    [ppmpList],
  );

  const combinedNotifications = useMemo(() => {
    const list = [...notifications];
    const overBudget = myAllocated > 0 && myProcurementBudget > myAllocated;
    if (overBudget && !list.some((n) => n.type === "budget_exceeded")) {
      list.unshift({
        id: `budget-exceeded-${selectedFY}`,
        type: "budget_exceeded",
        message: `Your FY ${selectedFY} procurement cost has exceeded the allocated budget.`,
        created_at: new Date().toISOString(),
      });
    }
    return list
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      )
      .slice(0, 6);
  }, [notifications, myAllocated, myProcurementBudget, selectedFY]);

  return (
    <div style={{ fontFamily: FONT_STACK }}>
      {/* Welcome header */}
      <div
        className="rounded-3xl p-7 text-white mb-6 relative overflow-hidden"
        style={{
          background: HEADER_GRADIENT,
          boxShadow: "0 8px 24px rgba(2,132,199,0.25)",
        }}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full blur-[60px]"
          style={{ background: "rgba(255,255,255,0.15)" }}
        />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p
              className="text-white/70 text-[11px] uppercase tracking-[0.15em]"
              style={{ fontWeight: 600 }}
            >
              {isAdmin ? "Administrator" : "End-User"}
            </p>
            <h1
              className="text-[26px] tracking-tight mt-2"
              style={{ fontWeight: 700 }}
            >
              Welcome back, {dbUser?.full_name?.split(" ")[0]}
            </h1>
            <p className="text-white/80 text-[13px] mt-1">
              {isAdmin
                ? "North Eastern Mindanao State University — EPPS"
                : `${officeScopeLabel(selectedOfficeId, myOfficeOptions, officeMap, myOffice?.name || "North Eastern Mindanao State University")} · FY ${selectedFY}`}
            </p>
          </div>
          <button
            onClick={() => fetchAll(true)}
            className="flex items-center gap-1.5 text-[11px] text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
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
      ) : isAdmin ? (
        <AdminDashboard
          navigate={navigate}
          ppmpStats={ppmpStats}
          adminStats={adminStats}
          totalProjects={totalProjects}
          totalEntries={totalEntries}
          officeSummary={officeSummary}
          categoryDistribution={categoryDistribution}
          recentPPMPs={recentPPMPs}
          officeMap={officeMap}
          fySummary={fySummary}
          currentFY={currentFY}
        />
      ) : (
        <EndUserDashboard
          navigate={navigate}
          selectedFY={selectedFY}
          setSelectedFY={(fy: number) => {
            setFySelectedByUser(true);
            setSelectedFY(fy);
          }}
          fiscalYears={fiscalYears}
          myOfficeOptions={myOfficeOptions}
          selectedOfficeId={selectedOfficeId}
          setSelectedOfficeId={setSelectedOfficeId}
          fyPPMPCount={fyPPMPs.length}
          myDraftCount={myDraftCount}
          myFinalCount={myFinalCount}
          myAllocated={myAllocated}
          ppmpStats={ppmpStats}
          itemsWaitingForPR={itemsWaitingForPR}
          latestPPMPs={latestPPMPs}
          recentPPMPs={recentPPMPs}
          recentDrafts={recentDrafts}
          activityFeed={activityFeed}
          notifications={combinedNotifications}
          officeMap={officeMap}
          myPrdCounts={myPrdCounts}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Shared building blocks
// ══════════════════════════════════════════════════════════════════════════

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

// Horizontal budget-utilization bar. Green under 80%, amber 80–100%, red past 100%.
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

function FYRow({
  label,
  value,
  emphasize,
  negative,
}: {
  label: string;
  value: string | number;
  emphasize?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={emphasize ? "text-base" : "text-sm"}
        style={{
          color: negative ? DANGER : emphasize ? HEADING : TEXT,
          fontWeight: emphasize ? 700 : 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Admin dashboard — unchanged (already relied on ppmpBudget/ppmpItemCount,
// which are now fixed above, so this section needed no direct edits)
// ══════════════════════════════════════════════════════════════════════════

function AdminDashboard({
  navigate,
  ppmpStats,
  adminStats,
  totalProjects,
  totalEntries,
  officeSummary,
  categoryDistribution,
  recentPPMPs,
  officeMap,
  fySummary,
  currentFY,
}: any) {
  return (
    <>
      {/* Summary metrics — 6 cards, no wasted empty space */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Total PPMPs"
          value={ppmpStats?.total_ppmps ?? 0}
          icon={<ClipboardList className="w-[18px] h-[18px]" />}
          onClick={() => navigate("/ppmps")}
        />
        <StatCard
          label="Total Projects"
          value={totalProjects}
          icon={<Layers className="w-[18px] h-[18px]" />}
        />
        <StatCard
          label="Procurement Entries"
          value={totalEntries}
          icon={<ListChecks className="w-[18px] h-[18px]" />}
        />
        <StatCard
          label="Total Budget"
          value={fmtCompact(ppmpStats?.total_budget || 0)}
          icon={<Banknote className="w-[18px] h-[18px]" />}
        />
        <StatCard
          label="Total Offices"
          value={adminStats?.total_offices ?? 0}
          icon={<Building2 className="w-[18px] h-[18px]" />}
          onClick={() => navigate("/admin/offices")}
        />
        <StatCard
          label="Items in Catalog"
          value={adminStats?.total_items ?? 0}
          icon={<Package className="w-[18px] h-[18px]" />}
          onClick={() => navigate("/admin/items")}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardTitle>Budget Distribution by Office</CardTitle>
          {officeSummary.length === 0 ? (
            <EmptyState text="No PPMP budget data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={officeSummary.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis
                  dataKey={(d: any) => d.office?.code || "—"}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis
                  tickFormatter={(v) => fmtCompact(v)}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => [
                    `₱${fmt(Number(value ?? 0))}`,
                    "Budget",
                  ]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.office?.name || ""
                  }
                />
                <Bar dataKey="budget" fill={PRIMARY} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardTitle>Fiscal Year {currentFY} Overview</CardTitle>
          <div className="space-y-3">
            <FYRow label="PPMPs" value={fySummary.ppmps} />
            <FYRow label="Projects" value={fySummary.projects} />
            <FYRow label="Procurement Entries" value={fySummary.entries} />
            <FYRow
              label="Total Budget"
              value={`₱${fmt(fySummary.budget)}`}
              emphasize
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardTitle>Office Budget Summary</CardTitle>
          {officeSummary.length === 0 ? (
            <EmptyState text="No office data yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="text-left text-slate-400 border-b"
                    style={{ borderColor: BORDER }}
                  >
                    <th className="py-2 font-medium">Office</th>
                    <th className="py-2 font-medium text-right">PPMPs</th>
                    <th className="py-2 font-medium text-right">Projects</th>
                    <th className="py-2 font-medium text-right">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: BORDER }}>
                  {officeSummary.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2" style={{ color: TEXT }}>
                        {row.office?.name || "Unknown office"}{" "}
                        {row.office?.code && (
                          <span className="text-slate-400">
                            ({row.office.code})
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">{row.ppmps}</td>
                      <td className="py-2 text-right">{row.projects}</td>
                      <td
                        className="py-2 text-right font-semibold"
                        style={{ color: HEADING }}
                      >
                        ₱{fmt(row.budget)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Procurement Categories</CardTitle>
          {categoryDistribution.length === 0 ? (
            <EmptyState text="No categorized projects yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {categoryDistribution.map((_: any, i: number) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          {categoryDistribution.length > 0 && (
            <div className="mt-2 space-y-1">
              {categoryDistribution.slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-slate-500 truncate flex-1">
                    {c.name}
                  </span>
                  <span style={{ color: TEXT, fontWeight: 600 }}>
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <CardTitle>Recent PPMPs</CardTitle>
        {recentPPMPs.length === 0 ? (
          <EmptyState text="No PPMPs created yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr
                  className="text-left text-slate-400 border-b"
                  style={{ borderColor: BORDER }}
                >
                  <th className="py-2 font-medium">PPMP No.</th>
                  <th className="py-2 font-medium">Office</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Budget</th>
                  <th className="py-2 font-medium text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: BORDER }}>
                {recentPPMPs.map((p: PPMPListItem) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer hover:bg-[#F0F9FF]"
                    onClick={() => navigate(`/ppmps/${p.id}`)}
                  >
                    <td
                      className="py-2"
                      style={{ color: TEXT, fontWeight: 600 }}
                    >
                      {p.ppmp_no || "—"}
                    </td>
                    <td className="py-2 text-slate-500">
                      {p.office_name || officeMap.get(String(p.office_id))?.name || "—"}
                    </td>
                    <td className="py-2">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="py-2 text-right">₱{fmt(ppmpBudget(p))}</td>
                    <td className="py-2 text-right text-slate-400">
                      {fmtDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Quick Actions</CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickAction
            icon={<Plus className="w-5 h-5" />}
            label="Create PPMP"
            desc="Start a new plan"
            onClick={() => navigate("/ppmps/create")}
          />
          <QuickAction
            icon={<FolderKanban className="w-5 h-5" />}
            label="View PPMPs"
            desc="All PPMPs"
            onClick={() => navigate("/ppmps")}
          />
          <QuickAction
            icon={<Building2 className="w-5 h-5" />}
            label="Manage Offices"
            desc="Offices"
            onClick={() => navigate("/admin/offices")}
          />
          <QuickAction
            icon={<Package className="w-5 h-5" />}
            label="Manage Items"
            desc="Item catalog"
            onClick={() => navigate("/admin/items")}
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
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// End-user dashboard — redesigned around "manage my office's plans", not
// "look at every statistic". Everything budget-related is scoped to
// `selectedFY`; only Recent Activities and Notifications intentionally span
// all years, since those are about what just happened, not a fiscal period.
// ══════════════════════════════════════════════════════════════════════════

function EndUserDashboard({
  navigate,
  selectedFY,
  setSelectedFY,
  fiscalYears,
  myOfficeOptions,
  selectedOfficeId,
  setSelectedOfficeId,
  fyPPMPCount,
  myDraftCount,
  myAllocated,
  ppmpStats,
  latestPPMPs,
  recentPPMPs,
  activityFeed,
  officeMap,
  myPrdCounts,
}: any) {
  // Budget Overview PPMP-card filter. Default is "all" — every PPMP stays
  // visible, including ones whose items are all purchased (kept reachable
  // for future reference instead of auto-hidden). The user can narrow the
  // cards to only PPMPs that still need procurement, or to fully-purchased
  // ones.
  const [ppmpFilter, setPpmpFilter] = useState<"all" | "active" | "purchased">(
    "all",
  );
  const filteredLatestPPMPs = useMemo(() => {
    if (ppmpFilter === "all") return latestPPMPs;
    return latestPPMPs.filter((p: any) => {
      const s = p.itemStatus;
      if (ppmpFilter === "purchased") return s.total > 0 && s.notPrd === 0;
      return s.notPrd > 0;
    });
  }, [latestPPMPs, ppmpFilter]);

  return (
    <>
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
        {/* Budget Overview — one card per PPMP (3 most recent), so it's
            always clear which plan a figure belongs to, plus an FY and
            (when relevant) office selector to scope the whole dashboard. */}
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
                      {myOfficeOptions.map((o: OfficeOption) => (
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
                    onChange={(e) => setSelectedFY(Number(e.target.value))}
                    className="appearance-none text-xs pl-3 pr-7 py-1.5 rounded-lg bg-white cursor-pointer"
                    style={{ border: `1px solid ${BORDER}`, color: TEXT }}
                  >
                    {fiscalYears.map((y: number) => (
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
              {filteredLatestPPMPs.map((p: any) => (
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
                      {/* Each PPMP's own End-User / Unit and Fiscal Year,
                          resolved from THIS PPMP's office_id / year — never
                          a dashboard-global value. */}
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: "#EEF2FF",
                          color: "#4338CA",
                        }}
                      >
                        {p.office_name || officeMap.get(String(p.office_id))?.name || "—"}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: "#F1F5F9",
                          color: "#475569",
                        }}
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

                  {/* Per-PPMP item progress — counts THIS PPMP's items only.
                      Clicking this section opens /my-prd-items filtered to
                      this exact PPMP (stopPropagation keeps the card's own
                      edit/view click from firing). */}
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
          never contradict each other. Answers "which of MY PR'd items have
          arrived?" */}
      <Card className="mb-4">
        <CardTitle
          action={
            <button
              onClick={() => navigate("/my-prd-items")}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full transition-colors"
              style={{
                background: ACTIVE_BG,
                color: HEADING,
                fontWeight: 600,
              }}
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
        {/* Recent PPMPs */}
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
                {recentPPMPs.slice(0, 5).map((p: PPMPListItem) => {
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
                            <PenLine className="w-3 h-3" />
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
        {/* Recent Activities */}
        <CardTitle>Recent Activities</CardTitle>
        {activityFeed.length === 0 ? (
          <EmptyState text="No recent activity." />
        ) : (
          <div className="space-y-0">
            {activityFeed.map((a: any, i: number) => {
              const iconMap: Record<string, React.ReactNode> = {
                create: <Plus className="w-3 h-3" />,
                update: <FileEdit className="w-3 h-3" />,
                pr: <FileText className="w-3 h-3" />,
                submit: <Send className="w-3 h-3" />,
                approve: <CheckCircle2 className="w-3 h-3" />,
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
                      <CalendarClock className="w-3 h-3" />
                      {fmtDate(a.date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
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
    </>
  );
}
