import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Item } from "../../types";
import { font } from "../admin/theme";
import { useToast } from "../../components/feedback/ToastProvider";
import { useUnsavedChangesGuard } from "../../components/feedback/useUnsavedChangesGuard";
import { useConfirmState } from "../../components/feedback/useConfirm";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { LoadingButton } from "../../components/feedback/LoadingButton";
import {
  FileText,
  Users,
  ClipboardList,
  MessageSquare,
  Check,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  TriangleAlert,
  AlertCircle,
  Lock,
  Tag,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import React from "react";

// Simple LotAdder component used within entry cards to add lots.
function LotAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Add lot name"
      />
      <button
        type="button"
        onClick={() => {
          const name = val.trim();
          if (!name) return;
          onAdd(name);
          setVal("");
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0284C7] border border-[#BAE6FD] px-3 py-1.5 rounded-lg hover:bg-[#E0F2FE] transition"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        Add
      </button>
    </div>
  );
}

// ── Design tokens ────────────────────────────────────────────────────────────
const FONT_FAMILY = font.stack;

const T = {
  pageBg: "bg-[#F8FAFC]",
  card: "bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
};

const BTN_PRIMARY =
  "bg-[#0284C7] hover:bg-[#0369A1] text-white font-medium transition shadow-sm";
const BTN_SECONDARY =
  "border border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC] font-medium transition";

// ── Constants ────────────────────────────────────────────────────────────────

const PROJECT_TYPES = ["Goods", "Infrastructure", "Consulting Services"];

const PROCUREMENT_MODES = [
  "Competitive Public Bidding",
  "Small Value Procurement",
  "Direct Acquisition",
  "Agency-to-Agency",
  "Negotiated Procurement",
  "Adjacent or Contiguous",
  "Take-over of Contracts",
  "NGO Participation",
  "Community Participation",
  // "N/A (By Administration)",
];

const YEAR_BASED_FUND_TYPES = ["GAA", "STF"] as const;
const STATIC_FUND_TYPES = [
  "IGP",
  "Trust Fund",
  "Foreign-Assisted Fund",
] as const;

type AppropriationType = "Current" | "Continuing" | null;

interface FundSourceInfo {
  key: string;
  fund_type: string;
  appropriation_type: AppropriationType;
  appropriation_year: number | null;
  label: string;
}

function resolveFundSource(key: string, fiscalYear: number): FundSourceInfo {
  const [fundType, apprSlug] = key.split(":");
  if (apprSlug === "current" || apprSlug === "continuing") {
    const isCurrent = apprSlug === "current";
    const appropriation_year = isCurrent ? fiscalYear : fiscalYear - 1;
    const appropriation_type: AppropriationType = isCurrent
      ? "Current"
      : "Continuing";
    return {
      key,
      fund_type: fundType,
      appropriation_type,
      appropriation_year,
      label: `${fundType} ${appropriation_year} – ${appropriation_type} Appropriation`,
    };
  }
  return {
    key,
    fund_type: key,
    appropriation_type: null,
    appropriation_year: null,
    label: key,
  };
}

function buildFundSourceOptions(fiscalYear: number): FundSourceInfo[] {
  const options: FundSourceInfo[] = [];
  YEAR_BASED_FUND_TYPES.forEach((fundType) => {
    options.push(resolveFundSource(`${fundType}:current`, fiscalYear));
    options.push(resolveFundSource(`${fundType}:continuing`, fiscalYear));
  });
  STATIC_FUND_TYPES.forEach((fundType) => {
    options.push(resolveFundSource(fundType, fiscalYear));
  });
  return options;
}

const DEFAULT_SOURCE_OF_FUNDS_KEY = "GAA:current";

const COMMON_UNITS = [
  "pcs",
  "sets",
  "units",
  "reams",
  "boxes",
  "packs",
  "liters",
  "gallons",
  "kilograms",
  "grams",
  "meters",
  "rolls",
  "bottles",
  "pairs",
  "hours",
  "days",
  "months",
  "persons",
  "heads",
  "others",
];

const STEP_LABELS = [
  "PPMP Information",
  "PPMP Description",
  "Project Details & Budget Allocation",
  "Review & Submit",
];

const STEP_SUBTITLES: Record<number, string> = {
  1: "Fill in the required header information for this PPMP.",
  2: "Add a short and additional description for this PPMP.",
  3: "Select a project, then add one or more procurement entries with their own details.",
  4: "Review everything before saving.",
};

const MMYYYY_RE = /^(0[1-9]|1[0-2])\/\d{4}$/;

const ITEM_CATEGORIES = [
  "General Requirements",
  "Miscellaneous Items",
  "Common Use Supplies and Equipment (CSE)",
] as const;

const YEAR_OPTIONS = [
  2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035,
];
const DEFAULT_YEAR = YEAR_OPTIONS[0];

const REQUIRED_MSG = "This field is required.";
const BUDGET_EXCEEDED_MSG =
  "Grand Total exceeds the Allocated Budget. Reduce your procurement items or increase the allocated budget before saving.";

// PPMP sign-off roles for user selection (includes all possible roles)
const SIGN_OFF_ROLES = [
  "Prepared By",
  "Checked & Reviewed by",
  "Noted By",
  "Approved By",
  "Others",
] as const;

// ── Types ────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: string;
  description: string;
}

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

interface SignatoryForm {
  id: string;
  sign_off: (typeof SIGN_OFF_ROLES)[number];
  custom_sign_off: string;
  name: string;
  position: string;
}

interface SignatoryErrors {
  sign_off?: string;
  name?: string;
  position?: string;
}

interface LotForm {
  id: string;
  name: string;
}

interface LotItemForm {
  id: string;
  quantity: ReactNode;
  item_name: string;
  q1_qty: string;
  q2_qty: string;
  q3_qty: string;
  q4_qty: string;
  unit: string;
  custom_unit: string;
  unit_price: string;
  item_category: string;
  lot_id: string;
  // Client requirement: non-procurable items still show in the PPMP (and
  // in a PR) but must be excluded from the generated APP.
  is_procurable: boolean;
}

interface ProcurementEntryForm {
  item_name: string;
  id: string;
  project_title: string;
  description: string;
  project_type: string;
  procurement_mode: string;
  pre_proc_conference: string;
  start_activity: string;
  end_activity: string;
  delivery_period: string;
  source_of_funds: string;
  lots: LotForm[];
  items: LotItemForm[];
}

interface ProjectForm {
  remarks: string;
  // One Attached Document Title per project (like Remarks) — applies to
  // the whole project, not to individual procurement entries.
  attached_document_title: string;
  category_id: string;
  category_description: string;
  entries: ProcurementEntryForm[];
}

// ── Validation error shapes ──────────────────────────────────────────────────

interface Step1Errors {
  officeId?: string;
  ppmpNo?: string;
  allocatedBudget?: string;
}

const STEP1_FIELD_ORDER: (keyof Step1Errors)[] = [
  "officeId",
  "ppmpNo",
  "allocatedBudget",
];

interface EntryErrors {
  project_title?: string;
  description?: string;
  project_type?: string;
  items?: string;
  start_activity?: string;
  end_activity?: string;
  delivery_period?: string;
  source_of_funds?: string;
}

const ENTRY_FIELD_ORDER: (keyof EntryErrors)[] = [
  "project_title",
  "description",
  "project_type",
  "items",
  "start_activity",
  "end_activity",
  "delivery_period",
  "source_of_funds",
];

const entryKey = (pIdx: number, eIdx: number) => `${pIdx}:${eIdx}`;

const makeId = () =>
  `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyItem = (): LotItemForm => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  item_name: "",
  q1_qty: "",
  q2_qty: "",
  q3_qty: "",
  q4_qty: "",
  unit: "pcs",
  custom_unit: "",
  unit_price: "",
  item_category: "",
  lot_id: "",
  quantity: undefined,
  is_procurable: true,
});

const emptyLot = (): LotForm => ({
  id: makeId(),
  name: "",
});

const emptyEntry = (): ProcurementEntryForm => ({
  id: makeId(),
  project_title: "",
  description: "",
  project_type: "Goods",
  procurement_mode: "Direct Acquisition",
  pre_proc_conference: "No",
  start_activity: "",
  end_activity: "",
  delivery_period: "",
  source_of_funds: DEFAULT_SOURCE_OF_FUNDS_KEY,
  lots: [],
  items: [emptyItem()],
  item_name: "",
});

const emptyProject = (): ProjectForm => ({
  remarks: "",
  attached_document_title: "",
  category_id: "",
  category_description: "",
  entries: [emptyEntry()],
});

const emptySignatory = (): SignatoryForm => ({
  id: makeId(),
  sign_off: "Prepared By",
  custom_sign_off: "",
  name: "",
  position: "",
});

const resolvedSignOffTitle = (s: SignatoryForm) =>
  s.sign_off === "Others" ? s.custom_sign_off.trim() || "Others" : s.sign_off;

// ── Unsaved-changes recovery (auto-save to localStorage) ───────────────────
// Unlike Create, Edit previously had NO local draft at all — a refresh or
// closed tab silently discarded whatever hadn't been explicitly Saved.
// This mirrors CreatePPMPPage's debounced localStorage draft pattern, but
// keyed per-PPMP-id so editing two different PPMPs (e.g. in two tabs)
// never collides, and so it only ever offers to restore edits that belong
// to the specific record currently open.
const EDIT_DRAFT_SAVE_DEBOUNCE_MS = 400;
const editDraftStorageKey = (id?: string) => `ppmp_edit_draft_v1_${id || ""}`;

interface PersistedEditDraft {
  year: number;
  ppmpNo: string;
  ppmpType: "indicative" | "final";
  signatories: SignatoryForm[];
  allocatedBudget: string;
  shortDescription: string;
  additionalDescription: string;
  projects: ProjectForm[];
  activeProject: number;
  wizardStep: number;
  maxStepReached: number;
  savedAt: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const resolvedUnit = (item: LotItemForm) =>
  item.unit === "others" ? item.custom_unit : item.unit;

// Maps a plain unit string coming back from the server (e.g. "box") onto
// this form's {unit, custom_unit} shape — same matching rule used when
// picking an item from the catalog autocomplete.
const matchUnitToOption = (
  unit: string,
): { unit: string; custom_unit: string } => {
  const matched = COMMON_UNITS.find(
    (u) => u.toLowerCase() === (unit || "").toLowerCase(),
  );
  return matched
    ? { unit: matched, custom_unit: "" }
    : { unit: "others", custom_unit: unit || "" };
};

const itemTotalQuantity = (item: LotItemForm) =>
  (parseFloat(item.q1_qty) || 0) +
  (parseFloat(item.q2_qty) || 0) +
  (parseFloat(item.q3_qty) || 0) +
  (parseFloat(item.q4_qty) || 0);

const itemTotal = (item: LotItemForm) =>
  itemTotalQuantity(item) * (parseFloat(item.unit_price) || 0);

const entryTotal = (entry: ProcurementEntryForm) =>
  entry.items.reduce((sum, i) => sum + itemTotal(i), 0);

const projectTotal = (p: ProjectForm) =>
  p.entries.reduce((sum, e) => sum + entryTotal(e), 0);

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

const hasValidCode = (p: ProjectForm) =>
  !!(p.category_id || p.category_description.trim());

const projectPrimaryCategory = (p: ProjectForm) =>
  p.category_description?.trim() || "No category selected";

const inputClass = (hasError?: boolean) =>
  `w-full border rounded-lg px-3 py-2.5 text-[15px] text-[#1E293B] placeholder:text-[#94A3B8] bg-white focus:outline-none focus:ring-2 transition ${
    hasError
      ? "border-red-400 focus:ring-red-200"
      : "border-[#E2E8F0] focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
  }`;

const formatBudgetInput = (raw: string) => {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  const intPart = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
  const decPart =
    firstDot === -1
      ? ""
      : "." +
        cleaned
          .slice(firstDot + 1)
          .replace(/\./g, "")
          .slice(0, 2);
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return withCommas + decPart;
};

const parseBudget = (val: string) => parseFloat(val.replace(/,/g, ""));

const focusField = (id: string) => {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = el.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    focusable?.focus();
  });
};

// ── Small section header used inside cards (icon + title + subtitle) ────────

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="w-9 h-9 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div>
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
        {subtitle && (
          <p className="text-sm text-[#64748B] mt-0.5 leading-snug">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
      <TriangleAlert className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
      {message}
    </p>
  );
}

function FormField({
  id,
  label,
  required,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className={className}>
      <label className="text-sm text-[#334155] mb-1.5 block font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function OptionCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[15px] font-medium transition
        ${
          selected
            ? "border-[#0284C7] bg-[#E0F2FE] text-[#0369A1]"
            : "border-[#E2E8F0] text-[#334155] hover:border-[#94A3B8]"
        }`}
    >
      <span
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
          ${selected ? "border-[#0284C7]" : "border-[#E2E8F0]"}`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-[#0284C7]" />}
      </span>
      {label}
    </button>
  );
}

function SegmentedYesNo({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: "Yes" | "No") => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`inline-flex rounded-lg border border-[#E2E8F0] p-1 bg-[#F8FAFC] ${disabled ? "opacity-60" : ""}`}
    >
      {(["No", "Yes"] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`px-5 py-2 text-[15px] font-medium rounded-md transition
              ${
                active
                  ? "bg-[#0EA5E9] text-white shadow-sm"
                  : "text-[#334155] hover:text-[#0F172A]"
              }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 bg-[#E0F2FE] border border-[#BAE6FD] rounded-xl px-4 py-3">
      <TriangleAlert
        className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5"
        strokeWidth={2}
      />
      <p className="text-sm text-[#0C4A6E] leading-relaxed">{children}</p>
    </div>
  );
}

function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3.5 flex items-start gap-2.5">
      <TriangleAlert
        className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
        strokeWidth={2}
      />
      <p className="text-sm text-red-700 leading-relaxed font-medium">
        {children}
      </p>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <ChevronDown
      className={`w-5 h-5 shrink-0 text-[#64748B] transition-transform ${open ? "rotate-180" : ""}`}
      strokeWidth={1.8}
    />
  );
}

function ItemAutocomplete({
  value,
  items,
  onChangeText,
  onSelectItem,
  disabled,
}: {
  value: string;
  items: Item[];
  onChangeText: (text: string) => void;
  onSelectItem: (item: Item) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedMenu =
        target instanceof Element &&
        target.closest("[data-item-autocomplete-menu]");
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
      width: Math.max(rect.width, 260),
    });
  };

  const openMenu = () => {
    updateCoords();
    setOpen(true);
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

  const matches =
    value.trim().length === 0
      ? items.slice(0, 8)
      : items
          .filter((it) => it.name.toLowerCase().includes(value.toLowerCase()))
          .slice(0, 8);

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        ref={inputRef}
        disabled={disabled}
        className="w-full border border-[#E2E8F0] rounded-lg px-2.5 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          openMenu();
        }}
        onFocus={openMenu}
        placeholder="e.g. Bond Paper (A4, 80gsm)"
        autoComplete="off"
      />
      {open &&
        items.length > 0 &&
        createPortal(
          <div
            data-item-autocomplete-menu
            style={{
              position: "absolute",
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
            className="z-50 mt-1 max-h-56 overflow-y-auto bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1"
          >
            {matches.length > 0 &&
              matches.map((it) => (
                <button
                  type="button"
                  key={it.id}
                  onClick={() => {
                    onSelectItem(it);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#E0F2FE] flex items-center justify-between gap-2"
                >
                  <span className="text-[#1E293B] truncate">{it.name}</span>
                  <span className="text-[#64748B] shrink-0">
                    {it.unit} · ₱
                    {it.unit_price.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </button>
              ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function CategoryAutocomplete({
  value,
  categories,
  onChangeText,
  onSelectCategory,
  onUseCustomCode,
  hasError,
  disabled,
}: {
  value: string;
  categories: ExpenseCategory[];
  onChangeText: (text: string) => void;
  onSelectCategory: (category: ExpenseCategory) => void;
  onUseCustomCode?: (customDescription: string) => void;
  hasError?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedMenu =
        target instanceof Element &&
        target.closest("[data-category-autocomplete-menu]");
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
      width: rect.width,
    });
  };

  const openMenu = () => {
    updateCoords();
    setOpen(true);
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

  const matches =
    value.trim().length === 0
      ? categories
      : categories.filter((c) =>
          c.description.toLowerCase().includes(value.toLowerCase()),
        );

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        ref={inputRef}
        disabled={disabled}
        className={inputClass(hasError)}
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          openMenu();
        }}
        onFocus={openMenu}
        placeholder="Search expense category (e.g. Office Supplies)"
        autoComplete="off"
      />
      {open &&
        categories.length > 0 &&
        createPortal(
          <div
            data-category-autocomplete-menu
            style={{
              position: "absolute",
              top: coords.top,
              left: coords.left,
              width: Math.max(coords.width, 260),
            }}
            className="z-50 mt-1 max-h-80 overflow-y-auto overscroll-contain bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1"
          >
            {matches.length === 0 ? (
              <div>
                <p className="px-3 py-2 text-sm text-[#64748B]">
                  No matching category found.
                </p>
                {value.trim().length > 0 && onUseCustomCode && (
                  <button
                    type="button"
                    onClick={() => {
                      onUseCustomCode(value.trim());
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#E0F2FE] text-[#0284C7] font-medium border-t border-[#E2E8F0]"
                  >
                    Use custom code: "{value.trim()}"
                  </button>
                )}
              </div>
            ) : (
              matches.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    onSelectCategory(c);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#E0F2FE] text-[#1E293B]"
                >
                  {c.description}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

// Office / Fee-Category picker.
// Click-only interaction: click a category to expand/collapse it, click an
// office (or its child) to select it immediately. No hover is required to
// expand a category or to select — this matches ordinary <select> UX.
function OfficeCategoryPicker({
  value,
  categories,
  flatOffices,
  onChange,
  hasError,
  disabled,
}: {
  value: string;
  categories: FeeCategoryNode[];
  flatOffices: FlatOffice[];
  onChange: (id: string) => void;
  hasError?: boolean;
  // Read-only mode: the backend has no way to reassign an existing PPMP's
  // office (PPMPUpdate has no office_id field), so Edit PPMP shows the
  // office as a locked, non-interactive display instead of a picker.
  disabled?: boolean;
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

  if (disabled) {
    const label = selected
      ? selected.parentName
        ? `${selected.parentName} / ${selected.name} — ${selected.categoryName}`
        : `${selected.name} — ${selected.categoryName}`
      : "—";
    return (
      <div className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-[15px] text-[#64748B] bg-[#F8FAFC] cursor-not-allowed">
        {label}
      </div>
    );
  }

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
    // If the current selection belongs to a category, expand it so the
    // user immediately sees their choice highlighted when reopening.
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

  // Click-to-select: pick the office immediately, close the menu, and
  // clear the search text so the selected label displays right away.
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

  const displayLabel = selected
    ? selected.parentName
      ? `${selected.parentName} / ${selected.name} — ${selected.categoryName}`
      : selected.name === selected.categoryName
        ? selected.name
        : `${selected.name} — ${selected.categoryName}`
    : "";

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        ref={inputRef}
        className={inputClass(hasError)}
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
            className="z-50 mt-1 max-h-80 overflow-y-auto overscroll-contain bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1"
          >
            {searching ? (
              searchMatches.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[#64748B]">
                  No matching office.
                </p>
              ) : (
                searchMatches.map((o) => (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => select(o.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#E0F2FE] flex items-center justify-between gap-2"
                  >
                    <span className="text-[#1E293B] truncate">
                      {o.parentName ? `${o.parentName} / ${o.name}` : o.name}
                    </span>
                    <span className="text-xs text-[#64748B] shrink-0">
                      {o.categoryName}
                    </span>
                  </button>
                ))
              )
            ) : categories.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[#64748B]">
                No fee categories yet.
              </p>
            ) : (
              categories.map((cat) => {
                const isExpanded = expandedCategoryIds.has(cat.id);
                const isDirectSelect =
                  cat.offices.length === 1 && cat.offices[0].name === cat.name;
                return (
                  <div key={cat.id}>
                    <button
                      type="button"
                      onClick={() =>
                        isDirectSelect
                          ? select(cat.offices[0].id)
                          : toggleCategory(cat.id)
                      }
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold hover:bg-[#F8FAFC] ${
                        isDirectSelect
                          ? value === cat.offices[0].id
                            ? "text-[#0369A1] bg-[#E0F2FE]"
                            : "text-[#0F172A]"
                          : "text-[#0F172A]"
                      }`}
                    >
                      <span>{cat.name}</span>
                      {!isDirectSelect && (
                        <ChevronDown
                          className={`w-4 h-4 text-[#64748B] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          strokeWidth={1.8}
                        />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="pb-1">
                        {cat.offices.length === 0 ? (
                          <p className="px-6 py-1.5 text-xs text-[#94A3B8]">
                            No offices under this category yet.
                          </p>
                        ) : (
                          cat.offices.map((office) => (
                            <div key={office.id}>
                              <button
                                type="button"
                                onClick={() => select(office.id)}
                                className={`w-full text-left px-6 py-1.5 text-sm hover:bg-[#E0F2FE] ${
                                  value === office.id
                                    ? "text-[#0369A1] font-medium bg-[#E0F2FE]"
                                    : "text-[#334155]"
                                }`}
                              >
                                {office.name}
                              </button>
                              {office.children.map((child) => (
                                <button
                                  type="button"
                                  key={child.id}
                                  onClick={() => select(child.id)}
                                  className={`w-full text-left pl-10 pr-3 py-1.5 text-sm hover:bg-[#E0F2FE] flex items-center gap-1.5 ${
                                    value === child.id
                                      ? "text-[#0369A1] font-medium bg-[#E0F2FE]"
                                      : "text-[#64748B]"
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
          </div>,
          document.body,
        )}
    </div>
  );
}

function StepIndicator({
  step,
  maxStepReached,
  onJump,
}: {
  step: number;
  maxStepReached: number;
  onJump: (s: number) => void;
}) {
  return (
    <div className="flex items-center w-full">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        const clickable = n <= maxStepReached;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(n)}
              className={`flex flex-col items-center gap-2 ${clickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition border-2
                  ${
                    active
                      ? "bg-[#0284C7] border-[#0284C7] text-white ring-4 ring-[#E0F2FE]"
                      : done
                        ? "bg-[#0EA5E9] border-[#0EA5E9] text-white"
                        : "bg-white border-[#E2E8F0] text-[#64748B]"
                  }`}
              >
                {done ? <Check className="w-4 h-4" strokeWidth={2.4} /> : n}
              </span>
              <span
                className={`text-sm font-medium whitespace-nowrap hidden sm:inline
                  ${active ? "text-[#0F172A]" : done ? "text-[#1E293B]" : "text-[#94A3B8]"}`}
              >
                {label}
              </span>
            </button>
            {n < STEP_LABELS.length && (
              <div
                className={`flex-1 h-1 mx-2 rounded-full -mt-6 ${n < step ? "bg-[#0EA5E9]" : "bg-[#E2E8F0]"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

type StatTone = "neutral" | "healthy" | "warning" | "over";

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatTone;
}) {
  const toneStyles: Record<
    StatTone,
    { bg: string; border: string; text: string; label: string }
  > = {
    neutral: {
      bg: "bg-white",
      border: "border-[#E2E8F0]",
      text: "text-[#0F172A]",
      label: "text-[#64748B]",
    },
    healthy: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      label: "text-emerald-600",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      label: "text-amber-600",
    },
    over: {
      bg: "bg-red-50",
      border: "border-red-300",
      text: "text-red-700",
      label: "text-red-600",
    },
  };
  const s = toneStyles[tone];
  return (
    <div className={`rounded-2xl border-2 ${s.border} ${s.bg} p-4`}>
      <p className={`text-sm font-medium ${s.label}`}>{label}</p>
      <p className={`text-xl font-semibold mt-1 ${s.text}`}>{value}</p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EditPPMPPage() {
  const { dbUser, user } = useAuth();
  const navigate = useNavigate();
  const { ppmpId } = useParams();
  const toast = useToast();

  const [pageLoading, setPageLoading] = useState(true);
  const [pageLoadError, setPageLoadError] = useState("");
  const [ppmpStatus, setPpmpStatus] = useState("draft");
  const [lockedItemIds, setLockedItemIds] = useState<Set<string>>(new Set());
  const [lockedEntryIds, setLockedEntryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (document.getElementById("ppmp-inter-font")) return;
    const link = document.createElement("link");
    link.id = "ppmp-inter-font";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  const [officeId, setOfficeId] = useState<string>("");
  const [categoryTree, setCategoryTree] = useState<FeeCategoryNode[]>([]);
  const flatOffices = React.useMemo(
    () => flattenTree(categoryTree),
    [categoryTree],
  );

  const [year, setYear] = useState(DEFAULT_YEAR);
  const fundSourceOptions = React.useMemo(
    () => buildFundSourceOptions(year),
    [year],
  );
  const [ppmpNo, setPpmpNo] = useState("1");
  const [ppmpType, setPpmpType] = useState<"indicative" | "final">(
    "indicative",
  );
  const [signatories, setSignatories] = useState<SignatoryForm[]>(() => [
    { ...emptySignatory(), sign_off: "Prepared By" },
  ]);
  const [allocatedBudget, setAllocatedBudget] = useState("");

  const [shortDescription, setShortDescription] = useState("");
  const [additionalDescription, setAdditionalDescription] = useState("");

  const [projects, setProjects] = useState<ProjectForm[]>([emptyProject()]);
  const [activeProject, setActiveProject] = useState(0);

  const [expandedEntries, setExpandedEntries] = useState<
    Record<string, boolean>
  >({ [projects[0].entries[0].id]: true });

  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

  const [wizardStep, setWizardStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Unsaved-changes recovery state ──────────────────────────────────────
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const isRestoringEditDraftRef = useRef(false);
  const editDraftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hasHydratedFromServerRef = useRef(false);
  // Snapshot taken right after the server load (before any local draft is
  // applied on top) — this is the "clean" baseline the beforeunload guard
  // compares against. If a recovered draft differs from it, or the user
  // makes further edits, the browser will warn before a refresh/close.
  const initialSnapshotRef = useRef<string | null>(null);
  // Kept in sync every render so the beforeunload handler (registered once)
  // can read the latest form values without re-registering itself on every
  // keystroke.
  const trackedStateRef = useRef<Omit<PersistedEditDraft, "savedAt"> | null>(
    null,
  );

  const isDirty =
    officeId !== "" ||
    ppmpNo !== "1" ||
    allocatedBudget !== "" ||
    shortDescription !== "" ||
    additionalDescription !== "" ||
    projects.length > 1 ||
    projects[0].entries[0].item_name !== "" ||
    signatories.length > 1;
  const { confirmState, confirm, handleConfirm, handleCancel } =
    useConfirmState();
  useUnsavedChangesGuard(isDirty, confirm);

  // Keep the latest tracked form values available to the beforeunload
  // handler below without re-registering that listener on every keystroke.
  useEffect(() => {
    trackedStateRef.current = {
      year,
      ppmpNo,
      ppmpType,
      signatories,
      allocatedBudget,
      shortDescription,
      additionalDescription,
      projects,
      activeProject,
      wizardStep,
      maxStepReached,
    };
  });

  // Native browser guard for refresh/close-tab — a React Router navigation
  // guard (like useUnsavedChangesGuard above) cannot intercept these, only
  // a real `beforeunload` listener can. Registered once; reads the latest
  // values from trackedStateRef at fire-time and compares against the
  // snapshot taken right after the PPMP finished loading from the server.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasHydratedFromServerRef.current) return;
      if (initialSnapshotRef.current === null) return;
      if (!trackedStateRef.current) return;
      const current = JSON.stringify(trackedStateRef.current);
      if (current !== initialSnapshotRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Debounced local draft save — mirrors CreatePPMPPage's pattern. Gated on
  // hasHydratedFromServerRef so it never fires before the server data (and
  // any restored draft on top of it) has finished loading, and skipped
  // while a draft is actively being applied to state (isRestoringEditDraftRef)
  // to avoid immediately re-saving the exact thing that was just restored.
  useEffect(() => {
    if (!hasHydratedFromServerRef.current) return;
    if (isRestoringEditDraftRef.current) return;
    if (!ppmpId) return;
    if (editDraftSaveTimeoutRef.current)
      clearTimeout(editDraftSaveTimeoutRef.current);
    editDraftSaveTimeoutRef.current = setTimeout(() => {
      try {
        const payload: PersistedEditDraft = {
          year,
          ppmpNo,
          ppmpType,
          signatories,
          allocatedBudget,
          shortDescription,
          additionalDescription,
          projects,
          activeProject,
          wizardStep,
          maxStepReached,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(
          editDraftStorageKey(ppmpId),
          JSON.stringify(payload),
        );
      } catch {
        // Storage unavailable/full — fail silently, don't block the form.
      }
    }, EDIT_DRAFT_SAVE_DEBOUNCE_MS);

    return () => {
      if (editDraftSaveTimeoutRef.current)
        clearTimeout(editDraftSaveTimeoutRef.current);
    };
  }, [
    ppmpId,
    year,
    ppmpNo,
    ppmpType,
    signatories,
    allocatedBudget,
    shortDescription,
    additionalDescription,
    projects,
    activeProject,
    wizardStep,
    maxStepReached,
  ]);

  const discardEditDraft = () => {
    try {
      window.localStorage.removeItem(editDraftStorageKey(ppmpId));
    } catch {
      // ignore
    }
    setDraftRestored(false);
    setDraftRestoredAt(null);
    // Reload the page's own data fetch to snap back to the server's
    // version rather than leaving the just-restored draft values in place.
    window.location.reload();
  };

  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(
    [],
  );

  const [step1Errors, setStep1Errors] = useState<Step1Errors>({});
  const [projectErrors, setProjectErrors] = useState<
    Record<string, EntryErrors>
  >({});
  const [signatoryErrors, setSignatoryErrors] = useState<
    Record<string, SignatoryErrors>
  >({});
  const [signatoriesGeneralError, setSignatoriesGeneralError] = useState("");
  const [projectRemarksErrors, setProjectRemarksErrors] = useState<
    Record<number, string>
  >({});
  const [projectAttachedDocErrors, setProjectAttachedDocErrors] = useState<
    Record<number, string>
  >({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  // PPMP signatory settings from admin
  const [ppmpSignatorySettings, setPpmpSignatorySettings] = useState<{
    low_budget: Array<{
      sign_off: string;
      name: string;
      position: string;
      order_no: number;
    }>;
    high_budget: Array<{
      sign_off: string;
      name: string;
      position: string;
      order_no: number;
    }>;
  } | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    const t = setTimeout(() => {
      focusField(pendingFocusId);
      setPendingFocusId(null);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocusId, wizardStep, activeProject]);

  // Fetch PPMP signatory settings on mount
  useEffect(() => {
    api
      .get("/settings/signatories/ppmp")
      .then((res) => setPpmpSignatorySettings(res.data))
      .catch(() => {});
  }, []);

  // Auto-populate signatories based on budget when settings are loaded or budget changes
  const prevBudgetRef = useRef<string>("");
  useEffect(() => {
    if (!ppmpSignatorySettings) return;
    const currentBudget = parseBudget(allocatedBudget) || 0;
    // Only update if budget actually changed or this is the first load
    if (
      prevBudgetRef.current === allocatedBudget &&
      prevBudgetRef.current !== ""
    )
      return;
    prevBudgetRef.current = allocatedBudget;

    // Get the appropriate admin-configured signatories based on budget
    // DEFENSIVE: Filter out any "Prepared By" records from admin signatories
    // to prevent duplicates when we add the user-controlled Prepared By
    const rawAdminSignatories =
      currentBudget > 100000
        ? ppmpSignatorySettings.high_budget
        : ppmpSignatorySettings.low_budget;
    const adminSignatories = (rawAdminSignatories || []).filter(
      (sig) => sig.sign_off.toLowerCase() !== "prepared by",
    );

    if (adminSignatories.length === 0) return;

    // Build the complete signatory list:
    // 1. "Prepared By" (user-controlled, always first)
    // 2. Admin-configured signatories (Checked & Reviewed by, Noted by, Approved by)
    setSignatories((prev) => {
      // Find existing Prepared By entry to preserve user edits
      const existingPreparedBy = prev.find((s) => s.sign_off === "Prepared By");

      const newSignatories: SignatoryForm[] = [
        {
          id: existingPreparedBy?.id || makeId(),
          sign_off: "Prepared By" as const,
          custom_sign_off: "",
          name:
            existingPreparedBy?.name || dbUser?.full_name?.toUpperCase() || "",
          position: "Fund Coordinator",
        },
        ...adminSignatories.map((sig) => ({
          id: makeId(),
          sign_off: sig.sign_off as SignatoryForm["sign_off"],
          custom_sign_off: "",
          name: sig.name,
          position: sig.position,
        })),
      ];

      return newSignatories;
    });
  }, [ppmpSignatorySettings, allocatedBudget, dbUser?.full_name]);

  const clearIfValid = <T extends Record<string, any>>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    key: keyof T,
    isValid: boolean,
  ) => {
    if (!isValid) return;
    setter((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearEntryError = (
    pIdx: number,
    eIdx: number,
    field: keyof EntryErrors,
    isValid: boolean,
  ) => {
    if (!isValid) return;
    const key = entryKey(pIdx, eIdx);
    setProjectErrors((prev) => {
      if (!prev[key]?.[field]) return prev;
      const updated = { ...prev[key] };
      delete updated[field];
      const next = { ...prev };
      if (Object.keys(updated).length === 0) delete next[key];
      else next[key] = updated;
      return next;
    });
  };

  const clearSignatoryError = (
    id: string,
    field: keyof SignatoryErrors,
    isValid: boolean,
  ) => {
    if (!isValid) return;
    setSignatoryErrors((prev) => {
      if (!prev[id]?.[field]) return prev;
      const updated = { ...prev[id] };
      delete updated[field];
      const next = { ...prev };
      if (Object.keys(updated).length === 0) delete next[id];
      else next[id] = updated;
      return next;
    });
  };

  const computeStep1Errors = (): Step1Errors => {
    const errs: Step1Errors = {};
    if (!officeId) errs.officeId = "Please select an End-User / Unit.";
    if (!ppmpNo.trim()) errs.ppmpNo = "PPMP No. is required.";
    if (!allocatedBudget.trim())
      errs.allocatedBudget = "Allocated Budget is required.";
    else if (parseBudget(allocatedBudget) <= 0)
      errs.allocatedBudget = "Enter an amount greater than 0.";
    return errs;
  };

  const computeSignatoryErrors = (
    list: SignatoryForm[],
  ): { errors: Record<string, SignatoryErrors>; general?: string } => {
    const errors: Record<string, SignatoryErrors> = {};

    const roleCounts: Record<string, number> = {};
    list.forEach((s) => {
      if (s.sign_off === "Others") return;
      roleCounts[s.sign_off] = (roleCounts[s.sign_off] || 0) + 1;
    });

    list.forEach((s) => {
      const rowErrs: SignatoryErrors = {};
      if (!s.sign_off) rowErrs.sign_off = REQUIRED_MSG;
      else if (s.sign_off === "Others" && !s.custom_sign_off.trim())
        rowErrs.sign_off = "Please specify the sign-off title.";
      else if (s.sign_off !== "Others" && roleCounts[s.sign_off] > 1)
        rowErrs.sign_off =
          "This role is already used — pick a different role or select 'Others'.";
      if (!s.name.trim()) rowErrs.name = "Name is required.";
      if (!s.position.trim())
        rowErrs.position = "Position/Designation is required.";
      if (Object.keys(rowErrs).length > 0) errors[s.id] = rowErrs;
    });

    const general =
      list.length === 0
        ? "Add at least one signatory (e.g. Prepared By)."
        : undefined;

    return { errors, general };
  };

  const computeEntryErrors = (e: ProcurementEntryForm): EntryErrors => {
    const errs: EntryErrors = {};
    if (!e.project_title.trim())
      errs.project_title = "Project Title is required.";
    if (!e.description.trim())
      errs.description = "General Description is required.";
    if (!e.project_type)
      errs.project_type = "Type of Project to be Procured is required.";

    const namedItems = e.items.filter((it) => it.item_name.trim());
    if (namedItems.length === 0) {
      errs.items =
        "Add at least one procurement item with a name, quantity, and unit cost.";
    } else {
      const noQuantity = namedItems.some((it) => itemTotalQuantity(it) <= 0);
      const noUnitCost = namedItems.some(
        (it) => !((parseFloat(it.unit_price) || 0) > 0),
      );
      const missingCategory = namedItems.some((it) => !it.item_category);
      if (noQuantity)
        errs.items = "Quarter Quantity is required for every item.";
      else if (noUnitCost) errs.items = "Unit Cost is required for every item.";
      else if (missingCategory)
        errs.items = "Category is required for every item.";
    }

    if (!e.start_activity.trim())
      errs.start_activity = "Start of Procurement Activity is required.";
    else if (!MMYYYY_RE.test(e.start_activity))
      errs.start_activity = "Use MM/YYYY format (e.g. 01/2027).";

    if (!e.end_activity.trim())
      errs.end_activity = "End of Procurement Activity is required.";
    else if (!MMYYYY_RE.test(e.end_activity))
      errs.end_activity = "Use MM/YYYY format (e.g. 12/2027).";

    if (!e.delivery_period.trim())
      errs.delivery_period = "Expected Delivery / Implementation is required.";
    else if (!MMYYYY_RE.test(e.delivery_period))
      errs.delivery_period = "Use MM/YYYY format (e.g. 12/2027).";

    if (!e.source_of_funds)
      errs.source_of_funds = "Source of Fund is required.";

    return errs;
  };

  const computeAllEntryErrors = (): Record<string, EntryErrors> => {
    const map: Record<string, EntryErrors> = {};
    projects.forEach((p, pIdx) => {
      p.entries.forEach((e, eIdx) => {
        const errs = computeEntryErrors(e);
        if (Object.keys(errs).length > 0) map[entryKey(pIdx, eIdx)] = errs;
      });
    });
    return map;
  };

  const computeAllRemarksErrors = (): Record<number, string> => {
    const map: Record<number, string> = {};
    projects.forEach((p, pIdx) => {
      if (!p.remarks.trim()) map[pIdx] = "Remarks is required.";
    });
    return map;
  };

  const computeAllAttachedDocErrors = (): Record<number, string> => {
    const map: Record<number, string> = {};
    projects.forEach((p, pIdx) => {
      if (!p.attached_document_title.trim())
        map[pIdx] = "Attached Document Title is required.";
    });
    return map;
  };

  const expandEntryByIndex = (pIdx: number, eIdx: number) => {
    const entry = projects[pIdx]?.entries[eIdx];
    if (!entry) return;
    setExpandedEntries((prev) => ({ ...prev, [entry.id]: true }));
  };

  useEffect(() => {
    setProjectErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      projects.forEach((p, pIdx) => {
        p.entries.forEach((e, eIdx) => {
          const key = entryKey(pIdx, eIdx);
          if (next[key]?.items) {
            const namedItems = e.items.filter((it) => it.item_name.trim());
            const stillValid =
              namedItems.length > 0 &&
              namedItems.every(
                (it) =>
                  itemTotalQuantity(it) > 0 &&
                  (parseFloat(it.unit_price) || 0) > 0 &&
                  !!it.item_category,
              );
            if (stillValid) {
              const updated = { ...next[key] };
              delete updated.items;
              changed = true;
              if (Object.keys(updated).length === 0) delete next[key];
              else next[key] = updated;
            }
          }
        });
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  useEffect(() => {
    setSignatoryErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const roleCounts: Record<string, number> = {};
      signatories.forEach((s) => {
        if (s.sign_off === "Others") return;
        roleCounts[s.sign_off] = (roleCounts[s.sign_off] || 0) + 1;
      });
      let changed = false;
      const next = { ...prev };
      signatories.forEach((s) => {
        const isDuplicateNow =
          s.sign_off !== "Others" && roleCounts[s.sign_off] > 1;
        if (
          next[s.id]?.sign_off &&
          s.sign_off !== "Others" &&
          !isDuplicateNow
        ) {
          const updated = { ...next[s.id] };
          delete updated.sign_off;
          changed = true;
          if (Object.keys(updated).length === 0) delete next[s.id];
          else next[s.id] = updated;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatories]);

  // ── Hydrate this page from the existing PPMP (Edit mode) ──────────────────
  // The server is always the baseline. A local unsaved-changes draft (see
  // editDraftStorageKey below) is checked and applied on top of it after
  // loading, so a refresh/closed-tab doesn't silently discard in-progress
  // edits the way it used to.
  useEffect(() => {
    if (!ppmpId) {
      setPageLoadError("Missing PPMP id.");
      setPageLoading(false);
      return;
    }
    api
      .get(`/ppmps/${ppmpId}`, { params: { requester_uid: user?.id } })
      .then(async (res) => {
        const data = res.data;
        const fetchedYear = YEAR_OPTIONS.includes(data.year)
          ? data.year
          : DEFAULT_YEAR;
        // Built directly from the fetched year rather than the memoized
        // fundSourceOptions above, since `year` state hasn't updated yet
        // at the moment this callback runs.
        const entrySourceOptions = buildFundSourceOptions(fetchedYear);

        setOfficeId(data.office_id ?? "");
        setYear(fetchedYear);
        setPpmpNo(data.ppmp_no ?? "1");
        setPpmpType(data.ppmp_type === "final" ? "final" : "indicative");
        setPpmpStatus(data.status || "draft");

        const hydratedSignatories: SignatoryForm[] =
          Array.isArray(data.signatories) && data.signatories.length > 0
            ? data.signatories
                .slice()
                .sort((a: any, b: any) => (a.order_no || 0) - (b.order_no || 0))
                .map((s: any) => {
                  const isPredefined = (
                    SIGN_OFF_ROLES as readonly string[]
                  ).includes(s.sign_off);
                  return {
                    id: makeId(),
                    sign_off: isPredefined ? s.sign_off : "Others",
                    custom_sign_off: isPredefined ? "" : s.sign_off || "",
                    name: s.name || "",
                    position: s.position || "",
                  };
                })
            : [{ ...emptySignatory(), sign_off: "Prepared By" }];
        setSignatories(hydratedSignatories);

        const hydratedAllocatedBudget = data.allocated_budget
          ? formatBudgetInput(String(data.allocated_budget))
          : "";
        const hydratedShortDescription = data.description || "";
        const hydratedAdditionalDescription = data.additional_description || "";
        setAllocatedBudget(hydratedAllocatedBudget);
        setShortDescription(hydratedShortDescription);
        setAdditionalDescription(hydratedAdditionalDescription);

        const hydratedProjects: ProjectForm[] =
          Array.isArray(data.projects) && data.projects.length > 0
            ? data.projects.map((p: any) => {
                const firstEntry =
                  Array.isArray(p.entries) && p.entries.length > 0
                    ? p.entries[0]
                    : null;
                return {
                  remarks: p.remarks || "",
                  attached_document_title: p.attached_document_title || "",
                  category_id: p.category_id || firstEntry?.category_id || "",
                  category_description:
                    p.category_description ||
                    firstEntry?.category_description ||
                    "",
                  entries:
                    Array.isArray(p.entries) && p.entries.length > 0
                      ? p.entries.map((e: any) => {
                          const sourceKey =
                            entrySourceOptions.find(
                              (o) => o.label === e.source_of_funds,
                            )?.key || DEFAULT_SOURCE_OF_FUNDS_KEY;
                          return {
                            id: e.id || makeId(),
                            project_title: e.project_title || "",
                            description: e.description || "",
                            project_type: e.project_type || "Goods",
                            procurement_mode:
                              e.procurement_mode || "Direct Acquisition",
                            pre_proc_conference: e.pre_proc_conference || "No",
                            start_activity: e.start_activity || "",
                            end_activity: e.end_activity || "",
                            delivery_period: e.delivery_period || "",
                            source_of_funds: sourceKey,
                            // Lots are not persisted by the backend today —
                            // every item comes back unassigned to a lot.
                            lots: [],
                            items:
                              Array.isArray(e.items) && e.items.length > 0
                                ? e.items.map((it: any) => {
                                    const { unit, custom_unit } =
                                      matchUnitToOption(it.unit);
                                    return {
                                      id:
                                        it.id ||
                                        `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                      item_name: it.item_name || "",
                                      q1_qty: it.q1_qty
                                        ? String(it.q1_qty)
                                        : "",
                                      q2_qty: it.q2_qty
                                        ? String(it.q2_qty)
                                        : "",
                                      q3_qty: it.q3_qty
                                        ? String(it.q3_qty)
                                        : "",
                                      q4_qty: it.q4_qty
                                        ? String(it.q4_qty)
                                        : "",
                                      unit,
                                      custom_unit,
                                      unit_price: it.unit_price
                                        ? String(it.unit_price)
                                        : "",
                                      item_category: it.category || "",
                                      lot_id: "",
                                      quantity: undefined,
                                      is_procurable: it.is_procurable !== false,
                                    } as LotItemForm;
                                  })
                                : [emptyItem()],
                          } as unknown as ProcurementEntryForm;
                        })
                      : [emptyEntry()],
                };
              })
            : [emptyProject()];
        setProjects(hydratedProjects);

        const expanded: Record<string, boolean> = {};
        hydratedProjects.forEach((p) => {
          p.entries.forEach((e) => {
            expanded[e.id] = Object.keys(computeEntryErrors(e)).length > 0;
          });
        });
        setExpandedEntries(expanded);
        setActiveProject(0);

        // Baseline snapshot for the beforeunload guard — taken from what
        // the server returned, BEFORE any local draft is applied on top.
        // This makes sure that if a draft IS restored below, the page is
        // correctly treated as having unsaved changes (so the guard stays
        // active) rather than looking identical to a fresh load.
        const serverBaseline: Omit<PersistedEditDraft, "savedAt"> = {
          year: fetchedYear,
          ppmpNo: data.ppmp_no ?? "1",
          ppmpType: data.ppmp_type === "final" ? "final" : "indicative",
          signatories: hydratedSignatories,
          allocatedBudget: hydratedAllocatedBudget,
          shortDescription: hydratedShortDescription,
          additionalDescription: hydratedAdditionalDescription,
          projects: hydratedProjects,
          activeProject: 0,
          wizardStep: 1,
          maxStepReached: 1,
        };
        initialSnapshotRef.current = JSON.stringify(serverBaseline);

        // Check for a local unsaved-changes draft belonging to this exact
        // PPMP. If found, restore it on top of the server baseline instead
        // of leaving a refresh/closed-tab to silently discard it.
        try {
          const raw = window.localStorage.getItem(editDraftStorageKey(ppmpId));
          if (raw) {
            const draft: PersistedEditDraft = JSON.parse(raw);
            isRestoringEditDraftRef.current = true;
            setYear(
              YEAR_OPTIONS.includes(draft.year) ? draft.year : fetchedYear,
            );
            setPpmpNo(draft.ppmpNo ?? serverBaseline.ppmpNo);
            setPpmpType(draft.ppmpType ?? serverBaseline.ppmpType);
            setSignatories(
              Array.isArray(draft.signatories) && draft.signatories.length > 0
                ? draft.signatories
                : hydratedSignatories,
            );
            setAllocatedBudget(
              draft.allocatedBudget ?? hydratedAllocatedBudget,
            );
            setShortDescription(
              draft.shortDescription ?? hydratedShortDescription,
            );
            setAdditionalDescription(
              draft.additionalDescription ?? hydratedAdditionalDescription,
            );
            setProjects(
              Array.isArray(draft.projects) && draft.projects.length > 0
                ? draft.projects
                : hydratedProjects,
            );
            setActiveProject(draft.activeProject ?? 0);
            setWizardStep(draft.wizardStep ?? 1);
            setMaxStepReached(draft.maxStepReached ?? 1);
            setDraftRestored(true);
            setDraftRestoredAt(draft.savedAt ?? null);
            setTimeout(() => {
              isRestoringEditDraftRef.current = false;
            }, 0);
          }
        } catch {
          // Corrupted/unavailable draft — ignore and keep the server data.
        }
        hasHydratedFromServerRef.current = true;

        const allItemIds = hydratedProjects.flatMap((p) =>
          p.entries.flatMap((e) => e.items.map((it) => it.id)),
        );
        console.log("[PPMP Lock] frontend item IDs:", allItemIds);

        api
          .get(`/ppmps/${ppmpId}/pr-item-ids`)
          .then((prRes) => {
            const ids = prRes.data.locked_item_ids || [];
            const entryIds = prRes.data.locked_entry_ids || [];
            const quarters = prRes.data.locked_quarters || {};
            console.log("[PPMP Lock] item IDs:", ids);
            console.log("[PPMP Lock] entry IDs:", entryIds);
            console.log("[PPMP Lock] quarters:", quarters);
            setLockedItemIds(new Set(ids));
            setLockedEntryIds(new Set(entryIds));
          })
          .catch((err) => {
            console.error("[PPMP Lock] FAILED:", err);
          });
      })
      .catch(() => {
        setPageLoadError("Failed to load this PPMP. It may have been deleted.");
      })
      .finally(() => setPageLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppmpId, user]);

  const hasAutofilledPreparedByRef = useRef(false);
  useEffect(() => {
    if (hasAutofilledPreparedByRef.current) return;
    if (!dbUser?.full_name) return;
    setSignatories((prev) => {
      const idx = prev.findIndex(
        (s) => s.sign_off === "Prepared By" && !s.name.trim(),
      );
      if (idx === -1) return prev;
      hasAutofilledPreparedByRef.current = true;
      const next = [...prev];
      next[idx] = { ...next[idx], name: dbUser.full_name.toUpperCase() };
      return next;
    });
  }, [dbUser]);

  useEffect(() => {
    api
      .get("/fee-categories/tree")
      .then((res) => setCategoryTree(res.data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    api
      .get("/items/")
      .then((res) => setCatalogItems(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get("/api/expense-categories/")
      .then((res) => setExpenseCategories(res.data))
      .catch(() => {});
  }, []);

  const updateProject = (idx: number, field: keyof ProjectForm, value: any) =>
    setProjects((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );

  const handleSelectCategory = (pIdx: number, category: ExpenseCategory) =>
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : {
              ...p,
              category_id: category.id,
              category_description: category.description,
            },
      ),
    );

  const addProject = () => {
    setProjects((prev) => {
      const newProject = emptyProject();
      const updated = [...prev, newProject];
      setActiveProject(updated.length - 1);
      setExpandedEntries((exp) => ({
        ...exp,
        [newProject.entries[0].id]: true,
      }));
      return updated;
    });
  };

  const removeProject = (idx: number) => {
    setProjects((prev) => prev.filter((_, i) => i !== idx));
    setActiveProject((prevActive) => {
      if (idx < prevActive) return prevActive - 1;
      if (idx === prevActive) return Math.max(0, idx - 1);
      return prevActive;
    });
    setProjectErrors((prev) => {
      const next: Record<string, EntryErrors> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const [pStr, eStr] = key.split(":");
        const pp = Number(pStr);
        if (pp === idx) return;
        const newP = pp < idx ? pp : pp - 1;
        next[entryKey(newP, Number(eStr))] = val;
      });
      return next;
    });
  };

  const updateSignatory = (
    id: string,
    field: keyof SignatoryForm,
    value: string,
  ) =>
    setSignatories((prev) =>
      prev.map((s) => (s.id !== id ? s : { ...s, [field]: value })),
    );

  const addEntry = (pIdx: number) => {
    const newEntry = emptyEntry();
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx ? p : { ...p, entries: [...p.entries, newEntry] },
      ),
    );
    setExpandedEntries((prev) => {
      const next: Record<string, boolean> = { ...prev };
      projects[pIdx]?.entries.forEach((e) => {
        next[e.id] = false;
      });
      next[newEntry.id] = true;
      return next;
    });
  };

  const removeEntry = (pIdx: number, eIdx: number) => {
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : { ...p, entries: p.entries.filter((_, j) => j !== eIdx) },
      ),
    );
    setProjectErrors((prev) => {
      const next: Record<string, EntryErrors> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const [pStr, eStr] = key.split(":");
        const pp = Number(pStr);
        const ee = Number(eStr);
        if (pp !== pIdx) {
          next[key] = val;
          return;
        }
        if (ee < eIdx) next[entryKey(pp, ee)] = val;
        else if (ee > eIdx) next[entryKey(pp, ee - 1)] = val;
      });
      return next;
    });
  };

  const toggleEntry = (entryId: string) =>
    setExpandedEntries((prev) => ({ ...prev, [entryId]: !prev[entryId] }));

  const updateEntry = (
    pIdx: number,
    eIdx: number,
    field: keyof ProcurementEntryForm,
    value: any,
  ) =>
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : {
              ...p,
              entries: p.entries.map((e, j) =>
                j !== eIdx ? e : { ...e, [field]: value },
              ),
            },
      ),
    );

  const addItem = (pIdx: number, eIdx: number, lotId: string = "") => {
    const newItems = projects[pIdx].entries[eIdx].items;
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      newItems.forEach((_: LotItemForm, idx: number) => {
        next.add(`${pIdx}-${eIdx}-${idx}`);
      });
      return next;
    });
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : {
              ...p,
              entries: p.entries.map((e, j) =>
                j !== eIdx
                  ? e
                  : {
                      ...e,
                      items: [...e.items, { ...emptyItem(), lot_id: lotId }],
                    },
              ),
            },
      ),
    );
  };

  const removeItem = (pIdx: number, eIdx: number, iIdx: number) =>
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : {
              ...p,
              entries: p.entries.map((e, j) =>
                j !== eIdx
                  ? e
                  : { ...e, items: e.items.filter((_, k) => k !== iIdx) },
              ),
            },
      ),
    );

  const updateItem = (
    pIdx: number,
    eIdx: number,
    iIdx: number,
    field: keyof LotItemForm,
    value: string | boolean,
  ) =>
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : {
              ...p,
              entries: p.entries.map((e, j) =>
                j !== eIdx
                  ? e
                  : {
                      ...e,
                      items: e.items.map((it, k) =>
                        k !== iIdx ? it : { ...it, [field]: value },
                      ),
                    },
              ),
            },
      ),
    );

  const updateItemFields = (
    pIdx: number,
    eIdx: number,
    iIdx: number,
    fields: Partial<LotItemForm>,
  ) =>
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : {
              ...p,
              entries: p.entries.map((e, j) =>
                j !== eIdx
                  ? e
                  : {
                      ...e,
                      items: e.items.map((it, k) =>
                        k !== iIdx ? it : { ...it, ...fields },
                      ),
                    },
              ),
            },
      ),
    );

  const handleSelectCatalogItem = (
    pIdx: number,
    eIdx: number,
    iIdx: number,
    item: Item,
  ) => {
    const matchedUnit = COMMON_UNITS.find(
      (u) => u.toLowerCase() === item.unit.toLowerCase(),
    );
    updateItemFields(pIdx, eIdx, iIdx, {
      item_name: item.name,
      unit_price: String(item.unit_price),
      unit: matchedUnit || "others",
      custom_unit: matchedUnit ? "" : item.unit,
    });
  };

  const addLot = (pIdx: number, eIdx: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newLot = { ...emptyLot(), name: trimmed };
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : {
              ...p,
              entries: p.entries.map((e, j) =>
                j !== eIdx ? e : { ...e, lots: [...e.lots, newLot] },
              ),
            },
      ),
    );
  };

  const removeLot = (pIdx: number, eIdx: number, lotId: string) =>
    setProjects((prev) =>
      prev.map((p, i) =>
        i !== pIdx
          ? p
          : {
              ...p,
              entries: p.entries.map((e, j) =>
                j !== eIdx
                  ? e
                  : {
                      ...e,
                      lots: e.lots.filter((l) => l.id !== lotId),
                      items: e.items.map((it) =>
                        it.lot_id === lotId ? { ...it, lot_id: "" } : it,
                      ),
                    },
              ),
            },
      ),
    );

  const goNext = () => {
    if (wizardStep === 1) {
      const errs = computeStep1Errors();
      setStep1Errors(errs);
      const firstKey = STEP1_FIELD_ORDER.find((k) => errs[k]);
      if (firstKey) {
        setError("Please fix the highlighted fields before continuing.");
        setPendingFocusId(`field-${firstKey}`);
        return;
      }

      const sigResult = computeSignatoryErrors(signatories);
      setSignatoryErrors(sigResult.errors);
      setSignatoriesGeneralError(sigResult.general || "");
      const firstBadSignatory = signatories.find((s) => sigResult.errors[s.id]);
      if (sigResult.general) {
        setError(sigResult.general);
        setPendingFocusId("field-signatories-section");
        return;
      }
      if (firstBadSignatory) {
        const rowErrs = sigResult.errors[firstBadSignatory.id];
        const field = (["sign_off", "name", "position"] as const).find(
          (k) => rowErrs[k],
        );
        setError("Please fix the highlighted fields before continuing.");
        if (field)
          setPendingFocusId(`field-signatory-${firstBadSignatory.id}-${field}`);
        return;
      }
    }

    if (wizardStep === 3) {
      const allErrs = computeAllEntryErrors();
      setProjectErrors(allErrs);
      const remarksErrs = computeAllRemarksErrors();
      setProjectRemarksErrors(remarksErrs);
      const erroredKeys = Object.keys(allErrs)
        .map((key) => {
          const [pStr, eStr] = key.split(":");
          return { p: Number(pStr), e: Number(eStr), key };
        })
        .sort((a, b) => a.p - b.p || a.e - b.e);

      if (erroredKeys.length > 0) {
        const first = erroredKeys[0];
        const erroredProjectCount = new Set(erroredKeys.map((k) => k.p)).size;
        const firstField = ENTRY_FIELD_ORDER.find((k) => allErrs[first.key][k]);
        setActiveProject(first.p);
        expandEntryByIndex(first.p, first.e);
        setError(
          erroredProjectCount > 1
            ? `Please fix the highlighted fields in Project ${first.p + 1} (and ${erroredProjectCount - 1} other project${erroredProjectCount - 1 > 1 ? "s" : ""}) before continuing.`
            : `Please fix the highlighted fields in Project ${first.p + 1} before continuing.`,
        );
        if (firstField)
          setPendingFocusId(
            `field-project-${first.p}-entry-${first.e}-${firstField}`,
          );
        return;
      }

      const attachedDocErrs = computeAllAttachedDocErrors();
      setProjectAttachedDocErrors(attachedDocErrs);

      const badProjectIndices = Array.from(
        new Set([
          ...Object.keys(remarksErrs).map(Number),
          ...Object.keys(attachedDocErrs).map(Number),
        ]),
      ).sort((a, b) => a - b);

      if (badProjectIndices.length > 0) {
        const idx = badProjectIndices[0];
        const missingRemarks = !!remarksErrs[idx];
        const missingDoc = !!attachedDocErrs[idx];
        setActiveProject(idx);
        setError(
          missingRemarks && missingDoc
            ? `Please add Remarks and an Attached Document Title for Project ${idx + 1} before continuing.`
            : missingDoc
              ? `Please add an Attached Document Title for Project ${idx + 1} before continuing.`
              : `Please add Remarks for Project ${idx + 1} before continuing.`,
        );
        setPendingFocusId(
          missingDoc
            ? `field-project-${idx}-attached_document_title`
            : `field-project-${idx}-remarks`,
        );
        return;
      }
    }

    setError("");
    const next = Math.min(4, wizardStep + 1);
    setWizardStep(next);
    setMaxStepReached((m) => Math.max(m, next));
  };

  const goPrev = () => {
    setError("");
    setWizardStep((s) => Math.max(1, s - 1));
  };

  const jumpTo = (step: number) => {
    setError("");
    setWizardStep(step);
  };

  const buildPayload = () => ({
    year,
    ppmp_no: ppmpNo,
    ppmp_type: ppmpType,
    // status is intentionally NOT sent here — this is an update, and
    // sending "draft" every time would silently reset a submitted/approved
    // PPMP back to draft on every save. Status changes go through the
    // dedicated archive/unarchive (and any status-change) endpoints.
    allocated_budget: parseBudget(allocatedBudget) || 0,

    description: shortDescription.trim() || null,
    additional_description: additionalDescription.trim() || null,

    signatories: signatories.map((s, i) => ({
      sign_off: resolvedSignOffTitle(s),
      name: s.name.trim().toUpperCase(),
      position: s.position.trim(),
      order_no: i + 1,
    })),
    projects: projects.map((p, i) => ({
      remarks: p.remarks.trim(),
      attached_document_title: p.attached_document_title.trim(),
      category_id: p.category_id || null,
      category_description: p.category_description || null,
      order_no: i + 1,
      entries: p.entries.map((e, j) => {
        const fund = resolveFundSource(e.source_of_funds, year);
        return {
          // Persisted so AppEntryDetail (Early Procurement Activity /
          // Procurement Strategy, answered later on the APP page) can key
          // against a stable entry id rather than an array index that
          // shifts on reorder/add/remove.
          id: e.id,
          // Fix: Code/Category is selected once per project in the UI,
          // but the backend persists it per ENTRY (PPMPEntry.category_id /
          // category_description) — PPMPProjectCreate has no such fields,
          // so sending it only on the project object was silently dropped
          // by the backend, leaving every entry's Code blank on PPMP
          // Details / print. Propagate the project-level selection onto
          // every entry that belongs to it.
          category_id: p.category_id || null,
          category_description: p.category_description || null,
          // Feeds Column 1 (Project Title) when the APP is generated.
          project_title: e.project_title.trim(),
          description: e.description,
          project_type: e.project_type,
          procurement_mode: e.procurement_mode,
          pre_proc_conference: e.pre_proc_conference,
          start_activity: e.start_activity,
          end_activity: e.end_activity,
          delivery_period: e.delivery_period,
          fund_type: fund.fund_type,
          appropriation_type: fund.appropriation_type,
          appropriation_year: fund.appropriation_year,
          source_of_funds: fund.label,
          order_no: j + 1,
          lots: e.lots.map((l) => ({ id: l.id, name: l.name.trim() })),
          items: e.items
            .filter((it) => it.item_name.trim())
            .map((it) => {
              const q1 = parseFloat(it.q1_qty) || 0;
              const q2 = parseFloat(it.q2_qty) || 0;
              const q3 = parseFloat(it.q3_qty) || 0;
              const q4 = parseFloat(it.q4_qty) || 0;
              return {
                item_name: it.item_name,
                quantity: q1 + q2 + q3 + q4,
                q1_qty: q1,
                q2_qty: q2,
                q3_qty: q3,
                q4_qty: q4,
                unit: resolvedUnit(it) || "pcs",
                unit_price: parseFloat(it.unit_price) || 0,
                category: it.item_category,
                lot_id: it.lot_id || null,
                is_procurable: it.is_procurable,
              };
            }),
        };
      }),
    })),
  });

  const handleSubmit = async (action: "save" | "submit" = "save") => {
    const step1Errs = computeStep1Errors();
    const sigResult = computeSignatoryErrors(signatories);
    const allEntryErrs = computeAllEntryErrors();
    const remarksErrs = computeAllRemarksErrors();
    const attachedDocErrs = computeAllAttachedDocErrors();
    const hasStep1Errors = Object.keys(step1Errs).length > 0;
    const hasSignatoryErrors =
      Object.keys(sigResult.errors).length > 0 || !!sigResult.general;
    const hasEntryErrors = Object.keys(allEntryErrs).length > 0;
    const hasRemarksErrors = Object.keys(remarksErrs).length > 0;
    const hasAttachedDocErrors = Object.keys(attachedDocErrs).length > 0;

    if (
      hasStep1Errors ||
      hasSignatoryErrors ||
      hasEntryErrors ||
      hasRemarksErrors ||
      hasAttachedDocErrors
    ) {
      setStep1Errors(step1Errs);
      setSignatoryErrors(sigResult.errors);
      setSignatoriesGeneralError(sigResult.general || "");
      setProjectErrors(allEntryErrs);
      setProjectRemarksErrors(remarksErrs);
      setProjectAttachedDocErrors(attachedDocErrs);
      setError("Please fix the highlighted fields before saving.");

      if (hasStep1Errors || hasSignatoryErrors) {
        setWizardStep(1);
        setMaxStepReached((m) => Math.max(m, 1));
        const firstKey = STEP1_FIELD_ORDER.find((k) => step1Errs[k]);
        if (firstKey) {
          setPendingFocusId(`field-${firstKey}`);
        } else if (sigResult.general) {
          setPendingFocusId("field-signatories-section");
        } else {
          const firstBadSignatory = signatories.find(
            (s) => sigResult.errors[s.id],
          );
          if (firstBadSignatory) {
            const rowErrs = sigResult.errors[firstBadSignatory.id];
            const field = (["sign_off", "name", "position"] as const).find(
              (k) => rowErrs[k],
            );
            if (field)
              setPendingFocusId(
                `field-signatory-${firstBadSignatory.id}-${field}`,
              );
          }
        }
      } else {
        setWizardStep(3);
        if (hasEntryErrors) {
          const erroredKeys = Object.keys(allEntryErrs)
            .map((key) => {
              const [pStr, eStr] = key.split(":");
              return { p: Number(pStr), e: Number(eStr), key };
            })
            .sort((a, b) => a.p - b.p || a.e - b.e);
          const first = erroredKeys[0];
          setActiveProject(first.p);
          expandEntryByIndex(first.p, first.e);
          const firstField = ENTRY_FIELD_ORDER.find(
            (k) => allEntryErrs[first.key][k],
          );
          if (firstField)
            setPendingFocusId(
              `field-project-${first.p}-entry-${first.e}-${firstField}`,
            );
        } else if (hasRemarksErrors || hasAttachedDocErrors) {
          const badProjectIndices = Array.from(
            new Set([
              ...Object.keys(remarksErrs).map(Number),
              ...Object.keys(attachedDocErrs).map(Number),
            ]),
          ).sort((a, b) => a - b);
          const idx = badProjectIndices[0];
          setActiveProject(idx);
          setPendingFocusId(
            attachedDocErrs[idx]
              ? `field-project-${idx}-attached_document_title`
              : `field-project-${idx}-remarks`,
          );
        }
      }
      return;
    }

    if (!officeId) {
      setError("Please select an office.");
      setWizardStep(1);
      return;
    }

    // Hard budget gate: the system must never save a PPMP whose Grand Total
    // exceeds its Allocated Budget.
    const grandTotalNow = projects.reduce((sum, p) => sum + projectTotal(p), 0);
    const allocatedNow = parseBudget(allocatedBudget) || 0;
    if (allocatedNow > 0 && grandTotalNow > allocatedNow + 0.001) {
      setError(
        `${BUDGET_EXCEEDED_MSG} Grand Total is ₱${fmt(grandTotalNow)} against an Allocated Budget of ₱${fmt(allocatedNow)}.`,
      );
      setWizardStep(4);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      const finalPayload =
        action === "submit" ? { ...payload, status: "submitted" } : payload;
      // Edit mode updates the existing PPMP — office_id/created_by aren't
      // part of PPMPUpdate (the office can't be reassigned after creation),
      // so unlike Create this call takes no query params.
      const res = await api.put(`/ppmps/${ppmpId}`, finalPayload);
      const responseData = res.data;

      // ── PPMP Versioning detection ────────────────────────────────────
      // If the backend created a new PPMP (because ppmp_no changed), the
      // returned ID will differ from the original ppmpId. Navigate to the
      // new PPMP's edit page instead of the PPMP list.
      const newPpmpId = responseData?.id;
      const versionCreated = newPpmpId && newPpmpId !== ppmpId;

      // Successful save — the local recovery draft would otherwise
      // resurrect these now-saved edits (or older ones) on the next visit.
      try {
        window.localStorage.removeItem(editDraftStorageKey(ppmpId));
      } catch {
        // ignore
      }

      if (versionCreated) {
        toast.success(
          `New PPMP No. ${payload.ppmp_no} created. The original PPMP has been preserved.`,
        );
        // Navigate to the newly created PPMP's edit page
        navigate(`/ppmps/${newPpmpId}/edit`, { replace: true });
      } else {
        navigate("/ppmps");
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      let message =
        action === "submit" ? "Failed to submit PPMP." : "Failed to save PPMP.";
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail
          .map((d: any) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`)
          .join(" | ");
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const proj = projects[activeProject];
  const grandTotal = projects.reduce((sum, p) => sum + projectTotal(p), 0);
  const allocatedNum = parseBudget(allocatedBudget) || 0;
  const remainingBudget = allocatedNum - grandTotal;
  const selectedOffice = flatOffices.find((o) => o.id === officeId);

  // Over-budget is the single source of truth used to color the summary,
  // block the Save button, and gate final submission.
  const isOverBudget = allocatedNum > 0 && remainingBudget < -0.001;

  const budgetTone: StatTone =
    allocatedNum <= 0
      ? "neutral"
      : isOverBudget
        ? "over"
        : remainingBudget < allocatedNum * 0.1
          ? "warning"
          : "healthy";

  const renderProjectSidebar = () => (
    <div className="w-full lg:w-64 lg:shrink-0">
      <div className={`${T.card} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <p className="text-sm font-semibold text-[#334155] uppercase tracking-wide">
            Projects
          </p>
        </div>
        <div className="divide-y divide-[#E2E8F0] max-h-72 lg:max-h-none overflow-y-auto">
          {projects.map((p, i) => {
            const hasError = Object.keys(projectErrors).some((k) =>
              k.startsWith(`${i}:`),
            );
            const isActive = activeProject === i;
            const canDelete = projects.length > 1;
            return (
              <div
                key={i}
                onClick={() => setActiveProject(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setActiveProject(i);
                }}
                className={`w-full text-left px-4 py-3 text-sm transition relative cursor-pointer ${
                  isActive ? "bg-[#E0F2FE]" : "hover:bg-[#F8FAFC]"
                } ${hasError ? "ring-1 ring-inset ring-red-300" : ""}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#0EA5E9]" />
                )}
                <p
                  className={`font-semibold flex items-center gap-1.5 ${isActive ? "text-[#0369A1]" : "text-[#0F172A]"}`}
                >
                  Project {i + 1}
                  {hasError && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold shrink-0">
                      !
                    </span>
                  )}
                </p>
                <p className="text-[#64748B] truncate mt-0.5">
                  {projectPrimaryCategory(p)}
                </p>
                <p className="text-[#0284C7] font-medium mt-1">
                  ₱{fmt(projectTotal(p))}
                </p>
                {hasError && (
                  <p className="text-red-600 mt-0.5 text-xs font-medium">
                    Needs attention
                  </p>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProject(i);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                    Delete Project
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-2 border-t border-[#E2E8F0]">
          <button
            onClick={addProject}
            className="w-full inline-flex items-center justify-center gap-1.5 text-sm text-[#0284C7] hover:text-[#0369A1] font-medium py-2 rounded-lg hover:bg-[#E0F2FE] transition"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Add Project
          </button>
        </div>
      </div>

      <div
        className={`${T.card} p-4 mt-3 space-y-2.5 ${isOverBudget ? "border-red-300 ring-1 ring-red-200" : ""}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#64748B]">Grand Total</span>
          <span
            className={`text-sm font-semibold ${isOverBudget ? "text-red-600" : "text-[#0F172A]"}`}
          >
            ₱{fmt(grandTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#64748B]">Allocated Budget</span>
          <span className="text-sm font-semibold text-[#0F172A]">
            ₱{fmt(allocatedNum)}
          </span>
        </div>
        <div className="h-px bg-[#E2E8F0]" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#334155]">
            Remaining Budget
          </span>
          <span
            className={`text-sm font-semibold ${
              budgetTone === "over"
                ? "text-red-600"
                : budgetTone === "warning"
                  ? "text-amber-600"
                  : "text-[#0F172A]"
            }`}
          >
            ₱{fmt(remainingBudget)}
          </span>
        </div>
        {isOverBudget && (
          <p className="text-xs text-red-600 font-medium">
            Exceeds allocated budget — reduce items or increase the budget to
            save.
          </p>
        )}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className={`${T.card} p-5 sm:p-6 w-full`}>
      <SectionHeader
        icon={<FileText className="w-[18px] h-[18px]" strokeWidth={1.8} />}
        title="PPMP Information"
        subtitle="Fill in the required header information for this PPMP."
      />

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="w-32">
          <label className="text-sm text-[#334155] mb-1.5 block font-medium">
            Fiscal Year <span className="text-red-500">*</span>
          </label>
          <select
            className={inputClass(false)}
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
        <FormField
          id="field-ppmpNo"
          label="PPMP No."
          required
          error={step1Errors.ppmpNo}
          className="w-28"
        >
          <input
            className={inputClass(!!step1Errors.ppmpNo)}
            value={ppmpNo}
            onChange={(e) => {
              const val = e.target.value;
              setPpmpNo(val);
              clearIfValid(setStep1Errors, "ppmpNo", val.trim().length > 0);
            }}
            placeholder="1"
          />
        </FormField>
        <FormField
          id="field-officeId"
          label="End-User / Unit"
          required
          error={step1Errors.officeId}
          className="w-72 max-w-full"
        >
          <OfficeCategoryPicker
            value={officeId}
            categories={categoryTree}
            flatOffices={flatOffices}
            onChange={(id) => {
              setOfficeId(id);
              clearIfValid(setStep1Errors, "officeId", !!id);
            }}
            hasError={!!step1Errors.officeId}
            disabled
          />
          <p className="text-xs text-[#94A3B8] mt-1.5">
            The office cannot be changed after a PPMP is created.
          </p>
        </FormField>

        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div>
            <label className="text-sm text-[#334155] mb-1.5 block font-medium">
              Type of PPMP <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <OptionCard
                label="Indicative"
                selected={ppmpType === "indicative"}
                onClick={() => setPpmpType("indicative")}
              />
              <OptionCard
                label="Final"
                selected={ppmpType === "final"}
                onClick={() => setPpmpType("final")}
              />
            </div>
          </div>
          <FormField
            id="field-allocatedBudget"
            label="Allocated Budget"
            required
            error={step1Errors.allocatedBudget}
            className="w-56"
          >
            <input
              type="text"
              inputMode="decimal"
              className={inputClass(!!step1Errors.allocatedBudget)}
              value={allocatedBudget}
              onChange={(e) => {
                const val = formatBudgetInput(e.target.value);
                setAllocatedBudget(val);
                clearIfValid(
                  setStep1Errors,
                  "allocatedBudget",
                  val.trim().length > 0 && parseBudget(val) > 0,
                );
              }}
              placeholder="e.g. 1,500,000.00"
            />
          </FormField>
        </div>
      </div>

      <div id="field-signatories-section" className="mb-2">
        <SectionHeader
          icon={<Users className="w-[18px] h-[18px]" strokeWidth={1.8} />}
          title="Signatories"
          subtitle="Signatories are automatically populated based on the allocated budget. Only the Prepared By name and position can be edited."
        />
        <FieldError message={signatoriesGeneralError} />

        <div className="space-y-3">
          {signatories.map((s, idx) => {
            const errs = signatoryErrors[s.id] || {};
            const isPreparedBy = s.sign_off === "Prepared By";
            return (
              <div
                key={s.id}
                className={`rounded-xl border p-4 bg-[#F8FAFC] ${
                  Object.keys(errs).length > 0
                    ? "border-red-300"
                    : "border-[#E2E8F0]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                    Signatory {idx + 1}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <FormField
                    id={`field-signatory-${s.id}-sign_off`}
                    label="Sign-Off"
                    required
                    error={errs.sign_off}
                    className="w-56"
                  >
                    <input
                      className={`${inputClass(!!errs.sign_off)} bg-gray-100 cursor-not-allowed`}
                      value={s.sign_off}
                      readOnly
                      disabled
                    />
                  </FormField>
                  <FormField
                    id={`field-signatory-${s.id}-name`}
                    label="Name"
                    required
                    error={errs.name}
                    className="w-60 max-w-full"
                  >
                    <input
                      className={`${inputClass(!!errs.name)} uppercase ${
                        !isPreparedBy ? "bg-gray-100 cursor-not-allowed" : ""
                      }`}
                      value={s.name}
                      readOnly={!isPreparedBy}
                      disabled={!isPreparedBy}
                      onChange={
                        isPreparedBy
                          ? (e) => {
                              const val = e.target.value.toUpperCase();
                              updateSignatory(s.id, "name", val);
                              clearSignatoryError(
                                s.id,
                                "name",
                                val.trim().length > 0,
                              );
                            }
                          : undefined
                      }
                      placeholder={
                        isPreparedBy
                          ? "e.g. JUAN DELA CRUZ"
                          : "From admin settings"
                      }
                    />
                  </FormField>
                  <FormField
                    id={`field-signatory-${s.id}-position`}
                    label="Position/Designation"
                    required
                    error={errs.position}
                    className="w-56 max-w-full"
                  >
                    <input
                      className={`${inputClass(!!errs.position)} ${
                        !isPreparedBy ? "bg-gray-100 cursor-not-allowed" : ""
                      }`}
                      value={s.position}
                      readOnly={!isPreparedBy}
                      disabled={!isPreparedBy}
                      onChange={
                        isPreparedBy
                          ? (e) => {
                              updateSignatory(s.id, "position", e.target.value);
                              clearSignatoryError(
                                s.id,
                                "position",
                                e.target.value.trim().length > 0,
                              );
                            }
                          : undefined
                      }
                      placeholder={
                        isPreparedBy
                          ? "e.g. Campus Director"
                          : "From admin settings"
                      }
                    />
                  </FormField>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <NoteBox>
        Please ensure all information is correct before proceeding to the next
        step.
      </NoteBox>
    </div>
  );

  const renderStep2 = () => (
    <div className={`${T.card} p-5 sm:p-6 w-full`}>
      <SectionHeader
        icon={<ClipboardList className="w-[18px] h-[18px]" strokeWidth={1.8} />}
        title="PPMP Description"
        subtitle="Add a short and additional description for this PPMP."
      />

      <div className="mb-4">
        <label className="text-sm text-[#334155] mb-1.5 block font-medium">
          Short Description
        </label>
        <input
          className={`${inputClass(false)} w-full`}
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          placeholder="Optional short label for this PPMP"
        />
      </div>

      <div>
        <label className="text-sm text-[#334155] mb-1.5 block font-medium">
          Additional Description
        </label>
        <textarea
          rows={4}
          className={`${inputClass(false)} w-full resize-none`}
          value={additionalDescription}
          onChange={(e) => setAdditionalDescription(e.target.value)}
          placeholder="Optional additional context"
        />
      </div>

      <NoteBox>
        These two fields are optional and apply to the whole PPMP — not to
        individual projects. Procurement entries, items, and budget allocation
        are covered in the next step.
      </NoteBox>
    </div>
  );

  const renderItemRow = (
    item: LotItemForm,
    iIdx: number,
    pIdx: number,
    eIdx: number,
    canRemove: boolean,
  ) => {
    const isLocked = lockedItemIds.has(item.id);

    const issues: string[] = [];
    if (!item.item_name.trim()) issues.push("Item name");
    if (itemTotalQuantity(item) === 0) issues.push("Quantity");
    if (!item.unit || (item.unit === "others" && !item.custom_unit.trim()))
      issues.push("Unit");
    if (!item.unit_price || parseFloat(String(item.unit_price)) <= 0)
      issues.push("Unit cost");
    if (!item.item_category) issues.push("Category");

    const itemKey = `${pIdx}-${eIdx}-${iIdx}`;
    const isCollapsed = collapsedItems.has(itemKey);

    const toggleCollapse = () => {
      setCollapsedItems((prev) => {
        const next = new Set(prev);
        if (next.has(itemKey)) next.delete(itemKey);
        else next.add(itemKey);
        return next;
      });
    };

    if (isCollapsed) {
      return (
        <div
          key={iIdx}
          className={`rounded-xl bg-[#F8FAFC] border px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-[#F1F5F9] transition ${issues.length > 0 ? "border-amber-300" : "border-[#E2E8F0]"}`}
          onClick={toggleCollapse}
        >
          <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
          <span className="text-sm font-medium text-[#334155] truncate flex-1 min-w-0">
            {item.item_name || "Untitled item"}
          </span>
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
              <Lock className="w-3 h-3" />
              PR
            </span>
          )}
          <span className="text-xs text-[#64748B] shrink-0">
            {itemTotalQuantity(item) > 0
              ? `${itemTotalQuantity(item)} ${item.unit === "others" ? item.custom_unit : item.unit}`
              : "—"}
          </span>
          <span className="text-xs font-semibold text-[#0369A1] shrink-0">
            ₱{fmt(itemTotal(item))}
          </span>
          {issues.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 shrink-0">
              <AlertCircle className="w-2.5 h-2.5" />
              {issues.length}
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        key={iIdx}
        className={`rounded-xl bg-[#F8FAFC] border p-3 ${issues.length > 0 ? "border-amber-300" : "border-[#E2E8F0]"}`}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={toggleCollapse}
            className="mt-2 text-[#94A3B8] hover:text-[#64748B] transition"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="flex-1">
            {issues.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {issues.map((q) => (
                  <span
                    key={q}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {q}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-start gap-2">
              {isLocked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
                  <Lock className="w-3 h-3" />
                  PR-linked
                </span>
              )}
              <div className="flex-1 min-w-[220px]">
                {isLocked ? (
                  <div className="px-2 py-1.5 text-sm font-medium text-[#334155] bg-gray-50 border border-[#E2E8F0] rounded-lg">
                    {item.item_name || "Untitled item"}
                  </div>
                ) : (
                  <ItemAutocomplete
                    value={item.item_name}
                    items={catalogItems}
                    onChangeText={(text) =>
                      updateItem(pIdx, eIdx, iIdx, "item_name", text)
                    }
                    onSelectItem={(catalogItem) =>
                      handleSelectCatalogItem(pIdx, eIdx, iIdx, catalogItem)
                    }
                  />
                )}
              </div>
              {canRemove && !isLocked && (
                <button
                  onClick={() => removeItem(pIdx, eIdx, iIdx)}
                  className="text-red-400 hover:text-red-600 mt-2"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2 mt-2.5">
              {(["q1_qty", "q2_qty", "q3_qty", "q4_qty"] as const).map(
                (qField, qi) => {
                  const qLabel = `Q${qi + 1}`;
                  const quarterHasValue =
                    item[qField] !== "" && Number(item[qField]) > 0;
                  const isQuarterLocked = isLocked && quarterHasValue;
                  return (
                    <div key={qField} className="w-16">
                      <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1">
                        {qLabel}
                      </label>
                      {isQuarterLocked ? (
                        <div className="border border-amber-200 bg-amber-50 rounded-lg px-2 py-1.5 text-sm text-right font-medium text-[#334155]">
                          {item[qField] || 0}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm text-right bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
                          value={item[qField]}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw !== "" && parseFloat(raw) < 0) return;
                            updateItem(pIdx, eIdx, iIdx, qField, raw);
                          }}
                          placeholder="0"
                        />
                      )}
                    </div>
                  );
                },
              )}
              <div className="w-20">
                <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1">
                  Total Qty
                </label>
                <div className="border border-transparent rounded-lg px-2 py-1.5 text-sm text-right font-semibold text-[#0F172A]">
                  {itemTotalQuantity(item)}
                </div>
              </div>
              <div className="w-32">
                <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1">
                  Unit
                </label>
                {isLocked ? (
                  <div className="px-2 py-1.5 text-sm text-[#334155] bg-gray-50 border border-[#E2E8F0] rounded-lg">
                    {item.unit === "others" ? item.custom_unit : item.unit}
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1">
                      <select
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(pIdx, eIdx, iIdx, "unit", e.target.value)
                        }
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    {item.unit === "others" && (
                      <input
                        className="w-full mt-1 border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
                        value={item.custom_unit}
                        onChange={(e) =>
                          updateItem(
                            pIdx,
                            eIdx,
                            iIdx,
                            "custom_unit",
                            e.target.value,
                          )
                        }
                        placeholder="specify"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="w-28">
                <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1">
                  Unit Cost (₱)
                </label>
                {isLocked ? (
                  <div className="px-2 py-1.5 text-sm text-right font-medium text-[#334155] bg-gray-50 border border-[#E2E8F0] rounded-lg">
                    ₱{fmt(parseFloat(String(item.unit_price)) || 0)}
                  </div>
                ) : (
                  <input
                    type="number"
                    className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm text-right bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(pIdx, eIdx, iIdx, "unit_price", e.target.value)
                    }
                    placeholder="0.00"
                  />
                )}
              </div>
              <div className="w-28">
                <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1">
                  Amount (₱)
                </label>
                <div className="px-2 py-1.5 text-sm text-right font-semibold text-[#0369A1]">
                  ₱{fmt(itemTotal(item))}
                </div>
              </div>
              <div className="min-w-[180px]">
                <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                {isLocked ? (
                  <div className="px-2 py-1.5 text-sm text-[#334155] bg-gray-50 border border-[#E2E8F0] rounded-lg">
                    {item.item_category || "—"}
                  </div>
                ) : (
                  <select
                    className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
                    value={item.item_category}
                    onChange={(e) =>
                      updateItem(
                        pIdx,
                        eIdx,
                        iIdx,
                        "item_category",
                        e.target.value,
                      )
                    }
                  >
                    <option value="">Select category…</option>
                    {ITEM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="min-w-[160px]">
                <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide block mb-1">
                  Procurement
                </label>
                {isLocked ? (
                  <div className="px-2 py-1.5 text-sm text-[#334155] bg-gray-50 border border-[#E2E8F0] rounded-lg">
                    {item.is_procurable ? "Procurable" : "Non-procurable"}
                  </div>
                ) : (
                  <select
                    className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
                    value={item.is_procurable ? "yes" : "no"}
                    onChange={(e) =>
                      updateItem(
                        pIdx,
                        eIdx,
                        iIdx,
                        "is_procurable",
                        e.target.value === "yes",
                      )
                    }
                  >
                    <option value="yes">Procurable</option>
                    <option value="no">Non-procurable</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEntryCard = (
    entry: ProcurementEntryForm,
    eIdx: number,
    pIdx: number,
  ) => {
    const errs = projectErrors[entryKey(pIdx, eIdx)] || {};
    const isOpen = !!expandedEntries[entry.id];
    const canRemove = projects[pIdx].entries.length > 1;
    const total = entryTotal(entry);
    const itemCount = entry.items.filter((it) => it.item_name.trim()).length;

    const lotIds = new Set(entry.lots.map((l) => l.id));
    const itemsByLot: Record<string, { item: LotItemForm; idx: number }[]> = {};
    const unassigned: { item: LotItemForm; idx: number }[] = [];
    entry.items.forEach((item, idx) => {
      if (item.lot_id && lotIds.has(item.lot_id)) {
        (itemsByLot[item.lot_id] ||= []).push({ item, idx });
      } else {
        unassigned.push({ item, idx });
      }
    });

    return (
      <div
        key={entry.id}
        className={`${T.card} overflow-hidden ${Object.keys(errs).length > 0 ? "ring-1 ring-red-300" : ""}`}
      >
        <button
          type="button"
          onClick={() => toggleEntry(entry.id)}
          className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-[#F8FAFC] transition"
        >
          <div className="flex items-start gap-3 min-w-0">
            <ChevronIcon open={isOpen} />
            <div className="min-w-0">
              <p className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
                Procurement Entry {eIdx + 1}
                {Object.keys(errs).length > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold shrink-0">
                    !
                  </span>
                )}
              </p>
              {!isOpen && (
                <p className="text-sm text-[#64748B] truncate mt-0.5">
                  {entry.project_title || "No title yet"}
                  {entry.description ? ` · ${entry.description}` : ""}
                  {itemCount > 0
                    ? ` · ${itemCount} item${itemCount !== 1 ? "s" : ""}`
                    : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[15px] font-semibold text-[#0369A1]">
              ₱{fmt(total)}
            </span>
            {canRemove && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removeEntry(pIdx, eIdx);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    removeEntry(pIdx, eIdx);
                  }
                }}
                className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
                Remove
              </span>
            )}
          </div>
        </button>

        {isOpen && (
          <div className="px-5 pb-5 border-t border-[#E2E8F0] pt-4">
            <div className="mt-0">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1 min-w-[220px]">
                  <FormField
                    id={`field-project-${pIdx}-entry-${eIdx}-project_title`}
                    label="Project Title"
                    required
                    error={errs.project_title}
                  >
                    <input
                      className={`${inputClass(!!errs.project_title)}
`}
                      value={entry.project_title}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateEntry(pIdx, eIdx, "project_title", val);
                        clearEntryError(
                          pIdx,
                          eIdx,
                          "project_title",
                          val.trim().length > 0,
                        );
                      }}
                      placeholder="e.g. Supply and Delivery of Office Supplies for Academic and Administrative Operations"
                    />
                  </FormField>
                </div>
                <div className="flex-1 min-w-[260px]">
                  <FormField
                    id={`field-project-${pIdx}-entry-${eIdx}-description`}
                    label="General Description"
                    required
                    error={errs.description}
                  >
                    <textarea
                      rows={2}
                      className={`${inputClass(!!errs.description)} resize-none
`}
                      value={entry.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateEntry(pIdx, eIdx, "description", val);
                        clearEntryError(
                          pIdx,
                          eIdx,
                          "description",
                          val.trim().length > 0,
                        );
                      }}
                      placeholder="e.g. Procurement of various office supplies including bond paper, ballpens, staplers, printer ink, and folders..."
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-start">
                <FormField
                  id={`field-project-${pIdx}-entry-${eIdx}-project_type`}
                  label="Type of Project to be Procured"
                  required
                  error={errs.project_type}
                  className="w-60"
                >
                  <select
                    className={`${inputClass(!!errs.project_type)}
`}
                    value={entry.project_type}
                    onChange={(e) => {
                      updateEntry(pIdx, eIdx, "project_type", e.target.value);
                      clearEntryError(pIdx, eIdx, "project_type", true);
                    }}
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </FormField>
                <div className="w-72">
                  <label className="text-sm text-[#334155] mb-1.5 block font-medium">
                    Recommended Mode of Procurement
                  </label>
                  <select
                    className={`${inputClass(false)}
`}
                    value={entry.procurement_mode}
                    onChange={(e) =>
                      updateEntry(
                        pIdx,
                        eIdx,
                        "procurement_mode",
                        e.target.value,
                      )
                    }
                  >
                    {PROCUREMENT_MODES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-[#334155] mb-1.5 block font-medium">
                    Pre-Procurement Conference
                  </label>
                  <SegmentedYesNo
                    value={entry.pre_proc_conference}
                    onChange={(v) =>
                      updateEntry(pIdx, eIdx, "pre_proc_conference", v)
                    }
                  />
                </div>
              </div>
            </div>

            <div
              id={`field-project-${pIdx}-entry-${eIdx}-items`}
              className="mt-6"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                  Procurement Items
                </p>
                <span className="text-sm font-semibold text-[#0369A1]">
                  Entry Total: ₱{fmt(total)}
                </span>
              </div>
              <FieldError message={errs.items} />

              <div className="space-y-4 mt-3">
                {(entry.lots.length === 0 || unassigned.length > 0) && (
                  <div
                    className={
                      entry.lots.length > 0
                        ? "rounded-2xl border border-[#E2E8F0] p-3"
                        : ""
                    }
                  >
                    {entry.lots.length > 0 && (
                      <p className="text-sm font-semibold text-[#64748B] mb-2 px-1">
                        Unassigned Items
                      </p>
                    )}
                    <div className="space-y-2">
                      {unassigned.map(({ item, idx }) =>
                        renderItemRow(
                          item,
                          idx,
                          pIdx,
                          eIdx,
                          entry.items.length > 1,
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => addItem(pIdx, eIdx)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0284C7] border border-[#BAE6FD] px-3 py-1.5 rounded-lg hover:bg-[#E0F2FE] transition mt-2"
                    >
                      <Plus className="w-4 h-4" strokeWidth={2} />
                      Add Item
                    </button>
                  </div>
                )}

                {entry.lots.map((lot) => {
                  const lotItems = itemsByLot[lot.id] || [];
                  return (
                    <div
                      key={lot.id}
                      className="rounded-2xl border border-[#BAE6FD] bg-[#F0F9FF] p-3"
                    >
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-sm font-semibold text-[#0369A1]">
                          {lot.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeLot(pIdx, eIdx, lot.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2} />
                          Remove Lot
                        </button>
                      </div>
                      <div className="space-y-2">
                        {lotItems.length === 0 ? (
                          <p className="text-xs text-[#94A3B8] px-1 pb-1">
                            No items in this lot yet.
                          </p>
                        ) : (
                          lotItems.map(({ item, idx }) =>
                            renderItemRow(
                              item,
                              idx,
                              pIdx,
                              eIdx,
                              entry.items.length > 1,
                            ),
                          )
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => addItem(pIdx, eIdx, lot.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0284C7] border border-[#BAE6FD] bg-white px-3 py-1.5 rounded-lg hover:bg-[#E0F2FE] transition mt-2"
                      >
                        <Plus className="w-4 h-4" strokeWidth={2} />
                        Add Item to {lot.name}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-dashed border-[#E2E8F0]">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                  Lots (Optional)
                </p>
                <LotAdder onAdd={(name) => addLot(pIdx, eIdx, name)} />
                <p className="text-xs text-[#94A3B8] mt-1.5">
                  Add a lot to group items under it — leave this empty if this
                  entry doesn't need lots.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                Timeline & Funding
              </p>
              <div className="flex flex-wrap gap-4 mb-4">
                <FormField
                  id={`field-project-${pIdx}-entry-${eIdx}-start_activity`}
                  label="Start of Procurement Activity"
                  required
                  error={errs.start_activity}
                  className="w-48"
                >
                  <input
                    className={`${inputClass(!!errs.start_activity)}
`}
                    value={entry.start_activity}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateEntry(pIdx, eIdx, "start_activity", val);
                      clearEntryError(
                        pIdx,
                        eIdx,
                        "start_activity",
                        MMYYYY_RE.test(val),
                      );
                    }}
                    placeholder="MM/YYYY, e.g. 01/2027"
                  />
                </FormField>
                <FormField
                  id={`field-project-${pIdx}-entry-${eIdx}-end_activity`}
                  label="End of Procurement Activity"
                  required
                  error={errs.end_activity}
                  className="w-48"
                >
                  <input
                    className={`${inputClass(!!errs.end_activity)}
`}
                    value={entry.end_activity}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateEntry(pIdx, eIdx, "end_activity", val);
                      clearEntryError(
                        pIdx,
                        eIdx,
                        "end_activity",
                        MMYYYY_RE.test(val),
                      );
                    }}
                    placeholder="MM/YYYY, e.g. 12/2027"
                  />
                </FormField>
                <FormField
                  id={`field-project-${pIdx}-entry-${eIdx}-delivery_period`}
                  label="Expected Delivery / Implementation"
                  required
                  error={errs.delivery_period}
                  className="w-48"
                >
                  <input
                    className={`${inputClass(!!errs.delivery_period)}
`}
                    value={entry.delivery_period}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateEntry(pIdx, eIdx, "delivery_period", val);
                      clearEntryError(
                        pIdx,
                        eIdx,
                        "delivery_period",
                        MMYYYY_RE.test(val),
                      );
                    }}
                    placeholder="MM/YYYY, e.g. 12/2027"
                  />
                </FormField>
                <FormField
                  id={`field-project-${pIdx}-entry-${eIdx}-source_of_funds`}
                  label="Source of Fund"
                  required
                  error={errs.source_of_funds}
                  className="w-72 max-w-full"
                >
                  <select
                    className={`${inputClass(!!errs.source_of_funds)}
`}
                    value={entry.source_of_funds}
                    onChange={(e) => {
                      updateEntry(
                        pIdx,
                        eIdx,
                        "source_of_funds",
                        e.target.value,
                      );
                      clearEntryError(pIdx, eIdx, "source_of_funds", true);
                    }}
                  >
                    {fundSourceOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => toggleEntry(entry.id)}
                className="text-sm font-medium text-[#334155] hover:text-[#0F172A] border border-[#E2E8F0] rounded-lg px-3 py-1.5 hover:bg-[#F8FAFC] transition"
              >
                Collapse entry
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="flex flex-col lg:flex-row gap-5">
      {renderProjectSidebar()}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              Project {activeProject + 1} — Procurement Entries
            </h2>
            <p className="text-sm text-[#64748B] mt-0.5">
              Set the Code for this project, then add procurement entries below.
            </p>
          </div>
        </div>

        {/* ── Code (project-level, required before adding entries) ── */}
        <div className={`${T.card} p-5 sm:p-6`}>
          <SectionHeader
            icon={<Tag className="w-[18px] h-[18px]" strokeWidth={1.8} />}
            title="Code"
            subtitle="Select the expense category code for this project. All entries under this project will use this code."
          />
          <div className="w-full sm:max-w-md">
            <FormField
              id={`field-project-${activeProject}-category`}
              label="Code"
              required
            >
              <CategoryAutocomplete
                value={proj.category_description}
                categories={expenseCategories}
                onChangeText={(text) => {
                  updateProject(activeProject, "category_description", text);
                }}
                onSelectCategory={(category) => {
                  handleSelectCategory(activeProject, category);
                }}
                onUseCustomCode={(customDesc) => {
                  updateProject(activeProject, "category_id", "");
                  updateProject(activeProject, "category_description", customDesc);
                }}
              />
            </FormField>
          </div>
        </div>

        {isOverBudget && <WarningBanner>{BUDGET_EXCEEDED_MSG}</WarningBanner>}

        {hasValidCode(proj) ? (
          <>
            {proj.entries.map((entry, eIdx) =>
              renderEntryCard(entry, eIdx, activeProject),
            )}

            <button
              onClick={() => addEntry(activeProject)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-[#7DD3FC] text-[#0284C7] text-sm font-medium rounded-2xl hover:bg-[#E0F2FE] hover:border-[#0284C7] transition"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add Procurement Entry
            </button>
          </>
        ) : (
          <div className={`${T.card} p-8 text-center`}>
            <Tag
              className="w-8 h-8 mx-auto mb-3 text-[#94A3B8]"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium text-[#64748B]">
              Select a Code above to start adding procurement entries.
            </p>
          </div>
        )}

        <div className={`${T.card} p-5 sm:p-6`}>
          <SectionHeader
            icon={
              <MessageSquare className="w-[18px] h-[18px]" strokeWidth={1.8} />
            }
            title="Remarks & Attached Document"
            subtitle={`Project ${activeProject + 1} — required notes and supporting document for the whole project.`}
          />
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 min-w-[220px]">
              <FormField
                id={`field-project-${activeProject}-attached_document_title`}
                label="Attached Document Title"
                required
                error={projectAttachedDocErrors[activeProject]}
              >
                <input
                  className={inputClass(
                    !!projectAttachedDocErrors[activeProject],
                  )}
                  value={proj.attached_document_title}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateProject(
                      activeProject,
                      "attached_document_title",
                      val,
                    );
                    if (val.trim())
                      setProjectAttachedDocErrors((prev) => {
                        if (!prev[activeProject]) return prev;
                        const next = { ...prev };
                        delete next[activeProject];
                        return next;
                      });
                  }}
                  placeholder="e.g. Purchase Request, BAC Resolution, Canvass, Letter Request"
                />
              </FormField>
            </div>
            <div className="flex-1 min-w-[220px]">
              <FormField
                id={`field-project-${activeProject}-remarks`}
                label="Remarks"
                required
                error={projectRemarksErrors[activeProject]}
              >
                <input
                  className={inputClass(!!projectRemarksErrors[activeProject])}
                  value={proj.remarks}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateProject(activeProject, "remarks", val);
                    if (val.trim())
                      setProjectRemarksErrors((prev) => {
                        if (!prev[activeProject]) return prev;
                        const next = { ...prev };
                        delete next[activeProject];
                        return next;
                      });
                  }}
                  placeholder="e.g. For regular office operations"
                />
              </FormField>
            </div>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 flex justify-between items-center ${
            isOverBudget
              ? "border-red-300 bg-red-50"
              : "border-[#BAE6FD] bg-[#E0F2FE]"
          }`}
        >
          <span
            className={`text-sm font-medium ${isOverBudget ? "text-red-700" : "text-[#0369A1]"}`}
          >
            Project {activeProject + 1} Subtotal
          </span>
          <span
            className={`text-lg font-semibold ${isOverBudget ? "text-red-700" : "text-[#0F172A]"}`}
          >
            ₱{fmt(projectTotal(proj))}
          </span>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-5 w-full">
      {isOverBudget && <WarningBanner>{BUDGET_EXCEEDED_MSG}</WarningBanner>}

      <div className={`${T.card} p-5 sm:p-6`}>
        <SectionHeader
          icon={<Check className="w-[18px] h-[18px]" strokeWidth={2} />}
          title="Review & Submit"
          subtitle="Review everything before saving."
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[15px]">
          <div>
            <span className="text-[#64748B] text-sm block">PPMP No.</span>
            <span className="text-[#1E293B] font-medium">{ppmpNo}</span>
          </div>
          <div>
            <span className="text-[#64748B] text-sm block">Type</span>
            <span className="text-[#1E293B] font-medium">
              {ppmpType === "indicative" ? "Indicative" : "Final"}
            </span>
          </div>
          <div>
            <span className="text-[#64748B] text-sm block">Fiscal Year</span>
            <span className="text-[#1E293B] font-medium">{year}</span>
          </div>
          <div className="sm:col-span-3">
            <span className="text-[#64748B] text-sm block">
              End-User / Unit
            </span>
            <span className="text-[#1E293B] font-medium">
              {selectedOffice
                ? selectedOffice.parentName
                  ? `${selectedOffice.parentName} / ${selectedOffice.name} — ${selectedOffice.categoryName}`
                  : `${selectedOffice.name} — ${selectedOffice.categoryName}`
                : "—"}
            </span>
          </div>
          <div className="sm:col-span-3">
            <span className="text-[#64748B] text-sm block mb-1">
              Signatories
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {signatories.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-2"
                >
                  <span className="text-xs text-[#64748B] block">
                    {resolvedSignOffTitle(s)}
                  </span>
                  <span className="text-[#1E293B] font-medium">
                    {s.name || "—"}
                    {s.position ? ` — ${s.position}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {shortDescription && (
            <div className="sm:col-span-3">
              <span className="text-[#64748B] text-sm block">
                Short Description
              </span>
              <span className="text-[#1E293B] font-medium">
                {shortDescription}
              </span>
            </div>
          )}
          {additionalDescription && (
            <div className="sm:col-span-3">
              <span className="text-[#64748B] text-sm block">
                Additional Description
              </span>
              <span className="text-[#1E293B] font-medium">
                {additionalDescription}
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <StatCard
            label="Allocated Budget"
            value={`₱${fmt(allocatedNum)}`}
            tone="neutral"
          />
          <StatCard
            label="Remaining Budget"
            value={`₱${fmt(remainingBudget)}`}
            tone={budgetTone}
          />
          <StatCard
            label="Total Procurement Cost"
            value={`₱${fmt(grandTotal)}`}
            tone={isOverBudget ? "over" : "neutral"}
          />
        </div>
      </div>

      {projects.map((p, i) => (
        <div key={i} className={`${T.card} p-5 sm:p-6`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-[#0F172A]">
              Project {i + 1}
            </h2>
            <span className="text-[15px] font-semibold text-[#0369A1]">
              ₱{fmt(projectTotal(p))}
            </span>
          </div>
          {p.category_description && (
            <div className="mb-3">
              <span className="text-[#64748B] text-sm block">Code</span>
              <span className="text-[#1E293B] text-sm font-medium">
                {p.category_description}
              </span>
            </div>
          )}

          <div className="space-y-4">
            {p.entries.map((e, k) => {
              const lotIds = new Set(e.lots.map((l) => l.id));
              const lotName = (item: LotItemForm) =>
                item.lot_id && lotIds.has(item.lot_id)
                  ? e.lots.find((l) => l.id === item.lot_id)?.name
                  : null;
              const fundLabel = resolveFundSource(
                e.source_of_funds,
                year,
              ).label;
              return (
                <div
                  key={e.id}
                  className="rounded-xl border border-[#E2E8F0] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#0F172A]">
                      Procurement Entry {k + 1}
                    </h3>
                    <span className="text-sm font-semibold text-[#0369A1]">
                      ₱{fmt(entryTotal(e))}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-[#64748B] block">
                        Type of Project
                      </span>
                      <span className="text-[#1E293B]">{e.project_type}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-[#64748B] block">
                        Project Title
                      </span>
                      <span className="text-[#1E293B]">
                        {e.project_title || "—"}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-[#64748B] block">
                        General Description
                      </span>
                      <span className="text-[#1E293B]">{e.description}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <table className="w-full text-sm mb-3 min-w-[560px] border-separate border-spacing-y-1.5">
                      <thead>
                        <tr>
                          <th className="text-left px-2 py-1.5 text-[#334155] font-semibold text-xs uppercase tracking-wide">
                            Item
                          </th>
                          <th className="text-left px-2 py-1.5 text-[#334155] font-semibold text-xs uppercase tracking-wide">
                            Lot
                          </th>
                          <th className="text-left px-2 py-1.5 text-[#334155] font-semibold text-xs uppercase tracking-wide">
                            Category
                          </th>
                          <th className="text-right px-2 py-1.5 text-[#334155] font-semibold text-xs uppercase tracking-wide">
                            Qty
                          </th>
                          <th className="text-left px-2 py-1.5 text-[#334155] font-semibold text-xs uppercase tracking-wide">
                            Unit
                          </th>
                          <th className="text-right px-2 py-1.5 text-[#334155] font-semibold text-xs uppercase tracking-wide">
                            Unit Cost (₱)
                          </th>
                          <th className="text-right px-2 py-1.5 text-[#334155] font-semibold text-xs uppercase tracking-wide">
                            Amount (₱)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.items
                          .filter((it) => it.item_name.trim())
                          .map((it, idx2) => (
                            <tr key={idx2} className="bg-[#F8FAFC]">
                              <td className="px-2 py-1.5 rounded-l-lg text-[#1E293B]">
                                {it.item_name}
                              </td>
                              <td className="px-2 py-1.5 text-[#64748B]">
                                {lotName(it) || "—"}
                              </td>
                              <td className="px-2 py-1.5 text-[#64748B]">
                                {it.item_category || "—"}
                              </td>
                              <td className="px-2 py-1.5 text-right text-[#1E293B]">
                                {itemTotalQuantity(it)}
                              </td>
                              <td className="px-2 py-1.5 text-[#1E293B]">
                                {resolvedUnit(it)}
                              </td>
                              <td className="px-2 py-1.5 text-right text-[#1E293B]">
                                {fmt(parseFloat(it.unit_price) || 0)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium rounded-r-lg text-[#0F172A]">
                                {fmt(itemTotal(it))}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-[#64748B] block">
                        Mode of Procurement
                      </span>
                      <span className="text-[#1E293B]">
                        {e.procurement_mode}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">
                        Pre-Procurement Conference
                      </span>
                      <span className="text-[#1E293B]">
                        {e.pre_proc_conference}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">
                        Start of Activity
                      </span>
                      <span className="text-[#1E293B]">{e.start_activity}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">
                        End of Activity
                      </span>
                      <span className="text-[#1E293B]">{e.end_activity}</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">
                        Expected Delivery
                      </span>
                      <span className="text-[#1E293B]">
                        {e.delivery_period}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">
                        Source of Funds
                      </span>
                      <span className="text-[#1E293B]">{fundLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[#64748B] text-sm block">
                Attached Document
              </span>
              <span className="text-[#1E293B]">
                {p.attached_document_title || "—"}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] text-sm block">Remarks</span>
              <span className="text-[#1E293B]">{p.remarks || "—"}</span>
            </div>
          </div>
        </div>
      ))}

      <div
        className={`rounded-2xl border-2 p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-1 ${
          isOverBudget
            ? "border-red-300 bg-red-50"
            : "border-[#BAE6FD] bg-[#E0F2FE]"
        }`}
      >
        <span
          className={`text-[15px] font-medium ${isOverBudget ? "text-red-700" : "text-[#0369A1]"}`}
        >
          Grand Total (All Projects)
        </span>
        <span
          className={`text-xl font-semibold ${isOverBudget ? "text-red-700" : "text-[#0F172A]"}`}
        >
          ₱{fmt(grandTotal)}
        </span>
      </div>
    </div>
  );

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748B] text-sm">Loading PPMP...</p>
      </div>
    );
  }

  if (pageLoadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-600 text-sm">{pageLoadError}</p>
        <button
          onClick={() => navigate("/ppmps")}
          className="px-4 py-2 text-sm rounded-lg border border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]"
        >
          Back to PPMPs
        </button>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-full min-h-full ${T.pageBg} px-4 sm:px-6 lg:px-8 py-6 overflow-x-hidden`}
      style={{ fontFamily: FONT_FAMILY }}
    >
      <PageHeader
        title="Edit PPMP"
        subtitle={`${STEP_SUBTITLES[wizardStep]} — FY ${year} — PPMP No. ${ppmpNo || "—"} — Status: ${ppmpStatus}`}
        backTo="/ppmps"
      />

      {draftRestored && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 w-full">
          <p className="text-sm text-amber-800 leading-relaxed">
            We restored your unsaved edits from{" "}
            {draftRestoredAt
              ? new Date(draftRestoredAt).toLocaleString()
              : "your last session"}
            . Review them below, then Save to keep them.
          </p>
          <button
            type="button"
            onClick={discardEditDraft}
            className="text-sm font-medium text-amber-800 underline shrink-0 whitespace-nowrap self-start sm:self-auto"
          >
            Discard & reload saved version
          </button>
        </div>
      )}

      <div className={`${T.card} p-5 mb-6`}>
        <StepIndicator
          step={wizardStep}
          maxStepReached={maxStepReached}
          onJump={jumpTo}
        />
      </div>

      {(lockedItemIds.size > 0 || lockedEntryIds.size > 0) && (
        <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium px-4 py-3 rounded-xl flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
          {lockedItemIds.size > 0 && (
            <span>
              {lockedItemIds.size} item
              {lockedItemIds.size !== 1 ? "s are" : " is"} linked to a Purchase
              Request — existing quarter values are locked.
            </span>
          )}
          {lockedItemIds.size === 0 && lockedEntryIds.size > 0 && (
            <span>Some entries are linked to Purchase Requests.</span>
          )}{" "}
          You can still add new items and edit empty quarters.
        </div>
      )}

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-[15px] text-red-700 w-full flex items-start gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      {wizardStep === 1 && renderStep1()}
      {wizardStep === 2 && renderStep2()}
      {wizardStep === 3 && renderStep3()}
      {wizardStep === 4 && renderStep4()}

      <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-6 w-full">
        <div>
          {wizardStep > 1 && (
            <button
              onClick={goPrev}
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-[15px] rounded-lg ${BTN_SECONDARY}`}
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              Previous
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {wizardStep === 4 && isOverBudget && (
            <span className="text-sm text-red-600 font-medium">
              Grand Total exceeds Allocated Budget.
            </span>
          )}
          {wizardStep < 4 && (
            <button
              onClick={goNext}
              className={`inline-flex items-center gap-1.5 px-6 py-2.5 text-[15px] rounded-lg ${BTN_PRIMARY}`}
            >
              Next
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
          {wizardStep === 4 && ppmpStatus === "draft" && (
            <>
              <LoadingButton
                onClick={() => handleSubmit("save")}
                disabled={saving || isOverBudget}
                busy={saving}
                busyLabel="Saving..."
                className={`px-6 py-2.5 text-[15px] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${BTN_SECONDARY}`}
              >
                Save as Draft
              </LoadingButton>
              <LoadingButton
                onClick={() => handleSubmit("submit")}
                disabled={saving || isOverBudget}
                busy={saving}
                busyLabel="Submitting..."
                className={`px-6 py-2.5 text-[15px] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${BTN_PRIMARY}`}
              >
                Submit
              </LoadingButton>
            </>
          )}
          {wizardStep === 4 && ppmpStatus !== "draft" && (
            <LoadingButton
              onClick={() => handleSubmit("save")}
              disabled={saving || isOverBudget}
              busy={saving}
              busyLabel="Saving..."
              aria-label={
                isOverBudget
                  ? "Grand Total exceeds Allocated Budget — reduce items or increase the budget to save."
                  : undefined
              }
              className={`px-6 py-2.5 text-[15px] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${BTN_PRIMARY}`}
            >
              Save Changes
            </LoadingButton>
          )}
        </div>
      </div>
      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
