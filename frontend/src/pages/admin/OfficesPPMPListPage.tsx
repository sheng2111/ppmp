import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import api from "../../services/api";
import type { PPMP } from "../../types";
import PageHeader from "../../components/layout/PageHeader";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-amber-100 text-amber-700",
};

// Same office/fee-category tree shape used by CreatePPMPPage.tsx and
// OfficesItemizedListReportPage.tsx, fetched from the same
// /fee-categories/tree endpoint — kept in sync with those so every office
// picker in the app looks and behaves the same way.
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

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

// Office / Fee-Category picker — click-only: click a category to
// expand/collapse it, click an office (or its child) to select it
// immediately. Mirrors OfficeCategoryPicker from CreatePPMPPage.tsx /
// OfficesItemizedListReportPage.tsx, with an "All Offices" row pinned above
// the category list for this page's aggregate/no-filter state.
function OfficeCategoryPicker({
  value,
  categories,
  flatOffices,
  onChange,
  allLabel = "All Offices",
}: {
  value: string; // "" = allLabel
  categories: FeeCategoryNode[];
  flatOffices: FlatOffice[];
  onChange: (id: string) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = flatOffices.find((o) => o.id === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedMenu =
        target instanceof Element &&
        target.closest("[data-office-picker-menu]");
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        !clickedMenu
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateCoords = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 320),
    });
  };

  const openMenu = () => {
    updateCoords();
    setOpen(true);
    if (selected) {
      const cat = categories.find((c) => c.name === selected.categoryName);
      if (cat) {
        setExpandedCategoryIds((prev) => {
          if (prev.has(cat.id)) return prev;
          const next = new Set(prev);
          next.add(cat.id);
          return next;
        });
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    const reposition = () => updateCoords();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const toggleCategory = (id: string) =>
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
    setText("");
  };

  const searching = text.trim().length > 0;
  const searchMatches = searching
    ? flatOffices.filter(
        (o) =>
          o.name.toLowerCase().includes(text.toLowerCase()) ||
          o.categoryName.toLowerCase().includes(text.toLowerCase()) ||
          (o.parentName || "").toLowerCase().includes(text.toLowerCase()),
      )
    : [];

  const displayLabel =
    value === ""
      ? allLabel
      : selected
        ? selected.parentName
          ? `${selected.parentName} / ${selected.name} — ${selected.categoryName}`
          : `${selected.name} — ${selected.categoryName}`
        : "";

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        ref={inputRef}
        className={inputClass}
        value={open ? text : displayLabel}
        onChange={(e) => {
          setText(e.target.value);
          openMenu();
        }}
        onFocus={openMenu}
        placeholder="Click to select a Fee Category, then an office..."
        autoComplete="off"
      />
      {open &&
        createPortal(
          <div
            data-office-picker-menu
            style={{
              position: "absolute",
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
            className="z-50 mt-1 max-h-80 overflow-y-auto overscroll-contain bg-white border border-gray-200 rounded-xl shadow-lg py-1"
          >
            {searching ? (
              searchMatches.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">
                  No matching office.
                </p>
              ) : (
                searchMatches.map((o) => (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => select(o.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2"
                  >
                    <span className="text-gray-800 truncate">
                      {o.parentName ? `${o.parentName} / ${o.name}` : o.name}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {o.categoryName}
                    </span>
                  </button>
                ))
              )
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => select("")}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 font-medium ${
                    value === "" ? "text-blue-700 bg-blue-50" : "text-gray-800"
                  }`}
                >
                  {allLabel}
                </button>
                {categories.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    No fee categories yet.
                  </p>
                ) : (
                  categories.map((cat) => {
                    const isExpanded = expandedCategoryIds.has(cat.id);
                    return (
                      <div key={cat.id}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          <span>{cat.name}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            strokeWidth={1.8}
                          />
                        </button>
                        {isExpanded && (
                          <div className="pb-1">
                            {cat.offices.length === 0 ? (
                              <p className="px-6 py-1.5 text-xs text-gray-400">
                                No offices under this category yet.
                              </p>
                            ) : (
                              cat.offices.map((office) => (
                                <div key={office.id}>
                                  <button
                                    type="button"
                                    onClick={() => select(office.id)}
                                    className={`w-full text-left px-6 py-1.5 text-sm hover:bg-blue-50 ${
                                      value === office.id
                                        ? "text-blue-700 font-medium bg-blue-50"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {office.name}
                                  </button>
                                  {office.children.map((child) => (
                                    <button
                                      type="button"
                                      key={child.id}
                                      onClick={() => select(child.id)}
                                      className={`w-full text-left pl-10 pr-3 py-1.5 text-sm hover:bg-blue-50 flex items-center gap-1.5 ${
                                        value === child.id
                                          ? "text-blue-700 font-medium bg-blue-50"
                                          : "text-gray-500"
                                      }`}
                                    >
                                      <ChevronRight
                                        className="w-3 h-3 shrink-0"
                                        strokeWidth={2}
                                      />
                                      {child.name}
                                    </button>
                                  ))}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

// "Offices PPMP" — admin-only cross-office browser. This is the view that
// used to live inside PPMPListPage's isAdmin branch; it's been split out so
// /ppmps ("My PPMP") can stay scoped to the logged-in user everywhere,
// admins included. Mount this at /admin/offices-ppmp.
export default function OfficesPPMPListPage() {
  const navigate = useNavigate();

  const [ppmps, setPpmps] = useState<PPMP[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryTree, setCategoryTree] = useState<FeeCategoryNode[]>([]);
  const flatOffices = useMemo(() => flattenTree(categoryTree), [categoryTree]);

  const [filterOfficeId, setFilterOfficeId] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

  // Same office/fee-category tree CreatePPMPPage.tsx and
  // OfficesItemizedListReportPage.tsx already use — keeps every office
  // picker across the app backed by the same source and structure.
  useEffect(() => {
    api
      .get("/fee-categories/tree")
      .then((res) => setCategoryTree(res.data))
      .catch(() => setCategoryTree([]));
  }, []);

  const fetchPpmps = () => {
    setLoading(true);

    const params: Record<string, any> = {};
    // Office ids here are Mongo ObjectId strings, not numbers — passing
    // them through Number() (as this page used to) silently turns them
    // into NaN and breaks the filter, the same class of bug already fixed
    // elsewhere for office_id.
    if (filterOfficeId) params.office_id = filterOfficeId;
    if (filterYear) params.year = Number(filterYear);

    // The backend already excludes archived PPMPs by default, so this list
    // only ever shows active ones — archived PPMPs live on their own page.
    api
      .get("/ppmps/", { params })
      .then((res) => setPpmps(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPpmps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOfficeId, filterYear]);

  // The backend already computes total_budget per project (summed from that
  // project's entries) in _build_projects(), so we just add those up rather
  // than recomputing from entries/items on the client.
  const totalBudget = (ppmp: PPMP) =>
    ppmp.projects.reduce((sum, p) => sum + (p.total_budget || 0), 0);

  const officeLabel = (ppmp: PPMP) => {
    const office = flatOffices.find((o) => o.id === ppmp.office_id);
    if (!office) return `Office #${ppmp.office_id}`;
    return office.parentName
      ? `${office.parentName} / ${office.name}`
      : office.name;
  };

  return (
    <div>
      <PageHeader
        title="Offices PPMP"
        subtitle="View procurement plans across all offices"
      />

      <div className="flex gap-3 mb-5">
        <div className="w-72 max-w-full">
          <OfficeCategoryPicker
            value={filterOfficeId}
            categories={categoryTree}
            flatOffices={flatOffices}
            onChange={setFilterOfficeId}
          />
        </div>
        <select
          className={`${inputClass} w-40`}
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
        {(filterOfficeId || filterYear) && (
          <button
            onClick={() => {
              setFilterOfficeId("");
              setFilterYear("");
            }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 self-center"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-gray-400 self-center ml-auto">
          {ppmps.length} PPMP{ppmps.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : ppmps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm">
            No PPMPs found for the selected filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ppmps.map((ppmp) => (
            <div
              key={ppmp.id}
              onClick={() => navigate(`/ppmps/${ppmp.id}`)}
              className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 text-blue-700 font-semibold text-sm px-3 py-2 rounded-lg">
                  FY {ppmp.year}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    PPMP No. {ppmp.ppmp_no} —{" "}
                    <span className="capitalize">{ppmp.ppmp_type}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ppmp.projects.length} project
                    {ppmp.projects.length !== 1 ? "s" : ""} · ₱
                    {totalBudget(ppmp).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5 font-medium">
                    {officeLabel(ppmp)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[ppmp.status]}`}
                >
                  {ppmp.status}
                </span>
                <span className="text-gray-300">›</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
