import { useState, useEffect, useMemo, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { colors, gradients, font } from "../../pages/admin/theme";
import { ToastProvider } from "../feedback/ToastProvider";
import { ConfirmDialog } from "../feedback/ConfirmDialog";
import { useConfirmState } from "../feedback/useConfirm";
import {
  Home,
  CirclePlus,
  FilePlus,
  FileText,
  Archive,
  ClipboardList,
  Receipt,
  Package,
  PackageCheck,
  Building2,
  UserRound,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  Tag,
  Landmark,
  PenLine,
  SlidersHorizontal,
} from "lucide-react";

// ── Design tokens — pulled from the shared theme so this always matches
// LoginPage.tsx and any other page in the app ───────────────────────────────
const ACTIVE_BG = colors.activeBg;
const ACTIVE_BORDER = colors.activeBorder;
const ACTIVE_TEXT = colors.activeText;
const SIDEBAR_BORDER = colors.border;
const TEXT = colors.text;
const SECTION_LABEL = colors.sectionLabel;
const HEADER_GRADIENT = gradients.header;
const FONT_STACK = font.stack;

// localStorage key used to remember which groups were expanded across refreshes
const EXPANDED_GROUPS_KEY = "epms:sidebar:expandedGroups";

type IconType = React.ComponentType<{
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}>;

interface NavLeaf {
  to: string;
  label: string;
  icon: IconType;
  end?: boolean;
  // Set to false for menu items whose route/page doesn't exist yet.
  // They stay defined here (so the design is ready) but are filtered out
  // of the rendered menu until flipped to true.
  implemented?: boolean;
}

interface NavGroupConfig {
  id: string;
  title: string;
  icon: IconType;
  items: NavLeaf[];
}

function isItemActive(pathname: string, item: NavLeaf) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function loadExpandedGroups(): string[] {
  try {
    const raw = localStorage.getItem(EXPANDED_GROUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveExpandedGroups(groups: string[]) {
  try {
    localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // localStorage can fail (private browsing, quota) — not worth surfacing to the user
  }
}

// A single nav row — used for every leaf item so active/hover styling stays
// perfectly consistent across the whole sidebar, top-level or nested.
function SidebarLink({
  item,
  sidebarOpen,
  badge,
  indented,
}: {
  item: NavLeaf;
  sidebarOpen: boolean;
  badge?: number;
  indented?: boolean;
}) {
  return (
    <div className="relative">
      <NavLink
        to={item.to}
        end={item.end}
        className="group flex items-center gap-3 rounded-xl text-sm transition-all duration-[250ms] cursor-pointer hover:bg-[#F0F9FF]"
        style={({ isActive }) => ({
          padding: indented ? "8px 12px 8px 9px" : "10px 12px 10px 9px",
          fontWeight: isActive ? 600 : 500,
          fontSize: indented ? "13.5px" : "14px",
          color: isActive ? ACTIVE_TEXT : TEXT,
          background: isActive ? ACTIVE_BG : "transparent",
          borderLeft: `3px solid ${isActive ? ACTIVE_BORDER : "transparent"}`,
        })}
      >
        {({ isActive }) => (
          <>
            <item.icon
              className={`w-[18px] h-[18px] shrink-0 transition-colors duration-[250ms] ${
                isActive ? "" : "text-slate-400 group-hover:text-sky-500"
              }`}
            />
            {sidebarOpen && <span className="truncate">{item.label}</span>}
          </>
        )}
      </NavLink>
      {typeof badge === "number" && badge > 0 && sidebarOpen && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-400 text-amber-900 text-[10px] leading-none px-1.5 py-0.5 rounded-full font-bold">
          {badge}
        </span>
      )}
      {typeof badge === "number" && badge > 0 && !sidebarOpen && (
        <span className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-amber-400" />
      )}
    </div>
  );
}

// A collapsible group: header row (icon + title + chevron) plus its
// children. Handles its own expand/collapse animation; the parent Layout
// owns *which* groups are expanded so it can persist that to localStorage.
function SidebarGroup({
  group,
  sidebarOpen,
  expanded,
  onToggle,
  pendingCount,
}: {
  group: NavGroupConfig;
  sidebarOpen: boolean;
  expanded: boolean;
  onToggle: () => void;
  pendingCount: number;
}) {
  const location = useLocation();
  const hasActiveChild = group.items.some((item) =>
    isItemActive(location.pathname, item),
  );

  // Icon-rail mode (sidebar collapsed to icons only): there's no room for a
  // header + chevron, so just show the group's items as a flat icon list
  // with a divider above, matching the old section-divider treatment.
  if (!sidebarOpen) {
    return (
      <div className="pt-2">
        <div
          className="my-2 mx-3 border-t"
          style={{ borderColor: SIDEBAR_BORDER }}
        />
        <div className="space-y-1">
          {group.items.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              sidebarOpen={sidebarOpen}
              badge={item.to === "/admin/offices" ? pendingCount : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 rounded-xl transition-colors duration-200 cursor-pointer hover:bg-[#F0F9FF]"
        style={{
          padding: "9px 12px 9px 9px",
        }}
      >
        <span className="flex items-center gap-3 min-w-0">
          <group.icon
            className="w-[18px] h-[18px] shrink-0"
            style={{ color: hasActiveChild ? ACTIVE_TEXT : SECTION_LABEL }}
          />
          <span
            className="truncate text-[12px] tracking-wide"
            style={{
              color: hasActiveChild ? ACTIVE_TEXT : SECTION_LABEL,
              fontWeight: 700,
            }}
          >
            {group.title}
          </span>
        </span>
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
          style={{
            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
            color: SECTION_LABEL,
          }}
        />
      </button>

      <div
        className="overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out"
        style={{
          maxHeight: expanded ? `${group.items.length * 44}px` : "0px",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div
          className="pl-4 ml-4 mt-1 space-y-1 border-l"
          style={{ borderColor: SIDEBAR_BORDER }}
        >
          {group.items.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              sidebarOpen={sidebarOpen}
              indented
              badge={item.to === "/admin/offices" ? pendingCount : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { dbUser, user: supabaseUser, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    loadExpandedGroups(),
  );
  const hasAutoExpandedRef = useRef(false);
  const isAdmin = dbUser?.role === "admin";
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmState();

  useEffect(() => {
    if (!isAdmin || !supabaseUser) {
      setPendingCount(0);
      return;
    }

    let cancelled = false;

    const fetchPendingCount = () => {
      api
        .get("/auth/users", {
          params: { requester_uid: supabaseUser.id, is_approved: false },
        })
        .then((res) => {
          if (!cancelled) setPendingCount(res.data.length);
        })
        .catch(() => {});
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin, supabaseUser]);

  // Auto-collapse to icon rail on small screens. Only forces the collapse
  // when the viewport *crosses into* the small-screen range — it never
  // fights a manual re-expand once the person is on a small screen.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    if (mq.matches) setSidebarOpen(false);
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const groups: NavGroupConfig[] = useMemo(() => {
    // Own-office scope — identical for every user, admins included. This is
    // "the stuff I personally work on", so it deliberately stays free of any
    // cross-office / consolidated views.
    const procurementPlanning: NavLeaf[] = [
      { to: "/ppmps/create", label: "Create PPMP", icon: CirclePlus },
      { to: "/ppmps", label: "My PPMP", icon: FileText, end: true },
      {
        to: "/reports/itemized-list",
        label: "Itemized List",
        icon: FileSpreadsheet,
      },
    ];

    const procurementRequests: NavLeaf[] = [
      {
        to: "/prs/create",
        label: "Create Purchase Request",
        icon: FilePlus,
        implemented: false, // TODO: flip once a dedicated create route exists
      },
      { to: "/prs", label: "Purchase Requests", icon: Receipt },
      { to: "/my-prd-items", label: "My PR'd Items", icon: PackageCheck },
    ];

    // Admin-only, cross-office scope — "the stuff I oversee across every
    // office", separated out from Procurement Planning above.
    const officeOversight: NavLeaf[] = [
      {
        to: "/admin/offices-ppmp",
        label: "Offices PPMP",
        icon: FileText,
      },
      {
        to: "/admin/ppmp-consolidation",
        label: "Consolidated PPMP",
        icon: Layers,
      },
      {
        to: "/admin/offices-app",
        label: "Offices APP",
        icon: ClipboardList,
        implemented: false, // TODO: flip once /admin/offices-app ships
      },
      {
        to: "/admin/app-consolidation",
        label: "Consolidated APP",
        icon: Layers,
      },
      {
        to: "/admin/offices-itemized-list",
        label: "Offices Itemized List",
        icon: FileSpreadsheet,
      },
      {
        to: "/admin/itemized-list-consolidation",
        label: "Consolidated Itemized List",
        icon: Layers,
        implemented: false, // TODO: flip once /admin/itemized-list-consolidation ships
      },
    ];

    const administration: NavLeaf[] = isAdmin
      ? [
          { to: "/admin/offices", label: "Offices", icon: Building2 },
          { to: "/admin/items", label: "Item Management", icon: Package },
          {
            to: "/admin/lot-priority",
            label: "Lot Priority",
            icon: SlidersHorizontal,
          },
          {
            to: "/admin/fee-categories",
            label: "Fee Categories",
            icon: Tag,
            implemented: false, // TODO: flip once /admin/fee-categories ships
          },
          {
            to: "/admin/source-of-funds",
            label: "Source of Funds",
            icon: Landmark,
            implemented: false, // TODO: flip once /admin/source-of-funds ships
          },
          {
            to: "/admin/users",
            label: "Users",
            icon: Users,
            implemented: false, // TODO: flip once user management ships
          },
          {
            to: "/admin/signatories",
            label: "Signatories",
            icon: PenLine,
          },
        ]
      : [];

    const records: NavLeaf[] = [
      { to: "/archived", label: "Archived PPMPs", icon: Archive },
      {
        to: "/prs/archived",
        label: "Archived Purchase Requests",
        icon: Archive,
        implemented: false, // TODO: flip once /prs/archived ships
      },
    ];

    const account: NavLeaf[] = [
      {
        to: "/profile",
        label: "Profile & Security",
        icon: UserRound,
      },
    ];

    const all: NavGroupConfig[] = [
      {
        id: "procurement-planning",
        title: "Procurement Planning",
        icon: ClipboardList,
        items: procurementPlanning,
      },
      {
        id: "procurement-requests",
        title: "Procurement Requests",
        icon: Receipt,
        items: procurementRequests,
      },
      ...(isAdmin
        ? [
            {
              id: "office-oversight",
              title: "Office Oversight",
              icon: Building2,
              items: officeOversight,
            },
          ]
        : []),
      ...(isAdmin
        ? [
            {
              id: "administration",
              title: "Administration",
              icon: ShieldCheck,
              items: administration,
            },
          ]
        : []),
      { id: "records", title: "Records", icon: Archive, items: records },
      { id: "account", title: "Account", icon: UserRound, items: account },
    ];

    // Drop not-yet-implemented leaves, then drop any group that's now empty
    return all
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.implemented !== false),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdmin]);

  // Auto-expand whichever group contains the current route, once — but
  // only if nothing was already restored from localStorage, so a
  // person's own expand/collapse choices always win on refresh.
  useEffect(() => {
    if (hasAutoExpandedRef.current || groups.length === 0) return;
    hasAutoExpandedRef.current = true;
    setExpandedGroups((prev) => {
      if (prev.length > 0) return prev;
      const activeGroup = groups.find((group) =>
        group.items.some((item) => isItemActive(location.pathname, item)),
      );
      return activeGroup ? [activeGroup.id] : groups[0] ? [groups[0].id] : [];
    });
  }, [groups, location.pathname]);

  useEffect(() => {
    saveExpandedGroups(expandedGroups);
  }, [expandedGroups]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  return (
    <ToastProvider>
      <div
        className="h-screen flex overflow-hidden print:h-auto print:overflow-visible"
        style={{ fontFamily: FONT_STACK, background: "#F1F5F9" }}
      >
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className={`print:hidden ${sidebarOpen ? "w-64" : "w-[72px]"} h-screen shrink-0 flex flex-col overflow-hidden transition-all duration-200 bg-white shadow-[2px_0_12px_rgba(15,23,42,0.04)]`}
          style={{ borderRight: `1px solid ${SIDEBAR_BORDER}` }}
        >
          {/* ── Header: blue/cyan gradient brand block ── */}
          <div
            className="shrink-0 px-3 py-4 flex items-center justify-between gap-2"
            style={{
              background: HEADER_GRADIENT,
              borderBottomLeftRadius: "20px",
              borderBottomRightRadius: "20px",
              boxShadow: "0 4px 14px rgba(2,132,199,0.25)",
            }}
          >
            <div className="flex items-center min-w-0">
              <img
                src="/nemsu-logo.png"
                alt="NEMSU Logo"
                className="w-11 h-11 rounded-full shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {sidebarOpen && (
                <div className="min-w-0 ml-2.5">
                  <p
                    className="text-white leading-tight truncate"
                    style={{ fontWeight: 600, fontSize: "13.5px" }}
                  >
                    Electronic Procurement
                  </p>
                  <p
                    className="text-white leading-tight truncate"
                    style={{ fontWeight: 600, fontSize: "13.5px" }}
                  >
                    Management System
                  </p>
                  <p className="text-white/80 text-[9px] leading-tight mt-1 truncate">
                    North Eastern Mindanao State University
                  </p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Collapse sidebar"
                className="text-white/70 hover:text-white transition-colors shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Expand sidebar"
              className="mx-auto mt-3 text-slate-300 hover:text-sky-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* ── Nav links ── */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <SidebarLink
              item={{
                to: isAdmin ? "/admin/dashboard" : "/dashboard",
                label: "Dashboard",
                icon: Home,
                end: true,
              }}
              sidebarOpen={sidebarOpen}
            />

            {groups.map((group) => (
              <SidebarGroup
                key={group.id}
                group={group}
                sidebarOpen={sidebarOpen}
                expanded={expandedGroups.includes(group.id)}
                onToggle={() => toggleGroup(group.id)}
                pendingCount={pendingCount}
              />
            ))}
          </nav>

          {/* ── Logout ── */}
          <div className="px-3 py-3 shrink-0 space-y-1">
            <div
              className="mx-1 mb-2 border-t"
              style={{ borderColor: SIDEBAR_BORDER }}
            />

            <button
              onClick={signOut}
              className="group w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-[250ms] cursor-pointer hover:bg-[#F0F9FF]"
              style={{
                padding: "10px 12px 10px 9px",
                color: TEXT,
                borderLeft: "3px solid transparent",
              }}
            >
              <LogOut className="w-[18px] h-[18px] shrink-0 text-slate-400 group-hover:text-sky-500 transition-colors duration-[250ms]" />
              {sidebarOpen && <span>Logout</span>}
            </button>

            {sidebarOpen && (
              <p className="text-[11px] text-slate-400 truncate px-3 pt-1">
                {dbUser?.email}
              </p>
            )}
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────────────────────── */}
        <main className="flex-1 h-screen overflow-y-auto p-6 print:h-auto print:overflow-visible print:p-0">
          <Outlet />
        </main>
      </div>

      {/* Global confirmation dialog */}
      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ToastProvider>
  );
}
