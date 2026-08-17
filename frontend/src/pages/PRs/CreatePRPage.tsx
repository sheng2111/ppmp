import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  useSignatorySettings,
  previewSignatories,
  SIGNATORY_THRESHOLD,
} from "../../hooks/useSignatorySettings";
import {
  Search,
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
} from "lucide-react";
import { useToast } from "../../components/feedback/ToastProvider";
import { useUnsavedChangesGuard } from "../../components/feedback/useUnsavedChangesGuard";
import { useConfirmState } from "../../components/feedback/useConfirm";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { LoadingButton } from "../../components/feedback/LoadingButton";
import PageHeader from "../../components/layout/PageHeader";

// ── Types ────────────────────────────────────────────────────────────────

interface EligiblePPMP {
  id: string;
  ppmp_no: string;
  ppmp_type: string;
  year: number;
  office_id: string | null;
  fee_category: string | null;
  status?: string;
  created_at?: string;
}

interface OfficeOption {
  id: string;
  name: string;
}

interface PPMPItem {
  id: string;
  item_name: string;
  unit: string;
  unit_price: number;
  quarter_quantity: number;
  remaining_quantity: number;
}

interface PPMPProjectGroup {
  entry_id: string;
  label: string;
  category: string | null;
  // NEW — the entry's PPMP Code priority (from ExpenseCategory), used to
  // sort lot groups so LOT A/B/C always come out in a predictable order.
  lot_priority: number;
  allocated_budget: number;
  item_count: number;
  items: PPMPItem[];
}

interface PPMPItemsResponse {
  ppmp_id: string;
  ppmp_no: string;
  quarter: number;
  projects: PPMPProjectGroup[];
}

interface SelectedItemState {
  entryId: string;
  requestedQuantity: number;
}

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

const QUARTERS = [1, 2, 3, 4];

// Wizard steps.
type WizardStep =
  | "ppmp"
  | "items"
  | "fund_cluster"
  | "purpose"
  | "signatories"
  | "review";
const STEP_ORDER: WizardStep[] = [
  "ppmp",
  "items",
  "fund_cluster",
  "purpose",
  "signatories",
  "review",
];
const STEP_LABELS: Record<WizardStep, string> = {
  ppmp: "Select PPMP",
  items: "Quarter, Lots & Items",
  fund_cluster: "Fund Cluster",
  purpose: "Purpose",
  signatories: "Signatories",
  review: "Review",
};

// The only two valid Fund Cluster values — printed on the "Fund Cluster"
// line of the PR form (see PRDetailPage.tsx). Required, not optional:
// there is no blank/"skip" choice once this step is reached.
const FUND_CLUSTER_OPTIONS = ["GAA", "STF"] as const;

// Lots are no longer chosen manually. Selected items are grouped by their
// PPMP Code (entry.category), the groups are sorted by lot_priority, and
// LOT A/B/C... are handed out dynamically in that order — see lotGroups
// below. This just supplies the letters.
const LOT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ── Draft persistence ────────────────────────────────────────────────────
// Saved to localStorage so a reload, accidental tab close, or navigating
// away mid-wizard doesn't lose progress. Scoped per user (different
// people on the same browser/device never see each other's drafts) and
// cleared automatically the moment a PR is actually submitted — it's a
// convenience against accidental loss, not a second copy of real data.
const DRAFT_STORAGE_PREFIX = "epms:create-pr-draft:";

interface CreatePRDraft {
  selectedOfficeId: string;
  selectedPpmpId: string;
  quarter: number | null;
  fundCluster: string;
  selected: Record<string, SelectedItemState>;
  purpose: string;
  requestedByName: string;
  requestedByDesignation: string;
  step: WizardStep;
  savedAt: string;
}

export default function CreatePRPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const { settings: signatorySettings } = useSignatorySettings();
  const toast = useToast();

  const [step, setStep] = useState<WizardStep>("ppmp");

  // ── Office context ─────────────────────────────────────────────────
  // Reuses the EXISTING /ppmps/offices-by-user endpoint (built for the
  // dashboard) rather than assuming a fixed office_id field on the user
  // record, since a user's office is derived from which PPMPs they've
  // created, not stored statically. If they've only ever worked in one
  // office, that office is auto-selected; multiple, they choose; none
  // yet, the PPMP list below just shows everything (graceful fallback).
  const [myOffices, setMyOffices] = useState<OfficeOption[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("");
  const [loadingOffices, setLoadingOffices] = useState(true);

  // Step 1 — select PPMP
  const [eligiblePPMPs, setEligiblePPMPs] = useState<EligiblePPMP[]>([]);
  const [ppmpSearch, setPpmpSearch] = useState("");
  const [selectedPpmpId, setSelectedPpmpId] = useState("");
  // Starts true (not false) — this closes the gap between mount and the
  // eligible-PPMPs effect actually being allowed to fire (see below),
  // so the UI shows "Loading PPMPs..." instead of a blank/empty table
  // during that window.
  const [loadingPPMPs, setLoadingPPMPs] = useState(true);

  // Step 2 — quarter + items
  const [quarter, setQuarter] = useState<number | null>(null);
  const [fundCluster, setFundCluster] = useState<string>("");
  const [ppmpData, setPpmpData] = useState<PPMPItemsResponse | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const [selected, setSelected] = useState<Record<string, SelectedItemState>>(
    {},
  );

  // Step 4 — purpose
  const [purpose, setPurpose] = useState("");

  // Step 5 — signatories (Requested By editable only under threshold —
  // same rule as before, unchanged)
  const [requestedByName, setRequestedByName] = useState("");
  const [requestedByDesignation, setRequestedByDesignation] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isDirty = selectedPpmpId !== "" || selectedOfficeId !== "" || quarter !== null || purpose !== "" || Object.keys(selected).length > 0;
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmState();
  useUnsavedChangesGuard(isDirty, confirm);

  // ── Draft persistence state ───────────────────────────────────────────
  const draftKey = dbUser?.id ? `${DRAFT_STORAGE_PREFIX}${dbUser.id}` : null;
  const [draftRestoreAttempted, setDraftRestoreAttempted] = useState(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  // Holds a restored item selection until the matching quarter-scoped
  // items response arrives (item availability must come from the server,
  // never from what was cached at save time) — applied once, then
  // cleared, so it never interferes with a later, ordinary quarter change.
  const pendingItemRestoreRef = useRef<Record<
    string,
    SelectedItemState
  > | null>(null);

  const selectedPpmp = useMemo(
    () => eligiblePPMPs.find((p) => p.id === selectedPpmpId) || null,
    [eligiblePPMPs, selectedPpmpId],
  );
  const selectedOffice = useMemo(
    () => myOffices.find((o) => o.id === selectedOfficeId) || null,
    [myOffices, selectedOfficeId],
  );

  // ── Restore a saved draft, once, as soon as we know who the user is ───
  // Runs before anything else touches localStorage for this page, so the
  // save-effect below (gated on draftRestoreAttempted) never overwrites a
  // stored draft with the initial blank state.
  useEffect(() => {
    if (!draftKey || draftRestoreAttempted) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft: CreatePRDraft = JSON.parse(raw);
        setSelectedOfficeId(draft.selectedOfficeId || "");
        setSelectedPpmpId(draft.selectedPpmpId || "");
        setQuarter(draft.quarter ?? null);
        setFundCluster(draft.fundCluster || "");
        setPurpose(draft.purpose || "");
        setRequestedByName(draft.requestedByName || "");
        setRequestedByDesignation(draft.requestedByDesignation || "");
        setStep(draft.step || "ppmp");
        if (draft.selected && Object.keys(draft.selected).length > 0) {
          pendingItemRestoreRef.current = draft.selected;
        }
        setDraftSavedAt(draft.savedAt || null);
        setShowRestoredBanner(true);
      }
    } catch {
      // Corrupted or unreadable draft — ignore it and start fresh rather
      // than blocking the page.
    }
    setDraftRestoreAttempted(true);
  }, [draftKey, draftRestoreAttempted]);

  // ── Load the offices this user has created PPMPs for ─────────────────
  useEffect(() => {
    if (!dbUser?.id) {
      setLoadingOffices(false);
      return;
    }
    api
      .get("/ppmps/offices-by-user", { params: { requester_uid: dbUser.id } })
      .then((res) => {
        const byUser: Record<string, OfficeOption[]> = res.data || {};
        const mine = byUser[dbUser.id] || [];
        setMyOffices(mine);
        if (mine.length === 1) setSelectedOfficeId(mine[0].id);
      })
      .catch(() => setMyOffices([]))
      .finally(() => setLoadingOffices(false));
  }, [dbUser?.id]);

  // ── Load eligible PPMPs, scoped to the selected office once known ────
  useEffect(() => {
    // Wait until BOTH: (1) the offices-by-user fetch has settled, and
    // (2) any saved draft has had its chance to set selectedOfficeId.
    // Firing before that means this effect runs against the default
    // blank state (myOffices.length === 0, selectedOfficeId === "") and
    // falls through to an UNSCOPED request (no office_id param at all),
    // which briefly returns eligible PPMPs across every office before
    // getting replaced once office context resolves. Gating here closes
    // that window entirely.
    if (loadingOffices || !draftRestoreAttempted) return;

    // If this user has offices on record, wait for one to be chosen
    // before loading — otherwise load everything (fallback for users
    // with no office history yet, so the page never dead-ends).
    if (myOffices.length > 0 && !selectedOfficeId) {
      setEligiblePPMPs([]);
      setLoadingPPMPs(false);
      return;
    }
    setLoadingPPMPs(true);
    api
      .get("/ppmps/eligible-for-pr", {
        params: selectedOfficeId
          ? { office_id: selectedOfficeId, requester_uid: dbUser?.supabase_uid }
          : { requester_uid: dbUser?.supabase_uid },
      })
      .then((res) => setEligiblePPMPs(res.data))
      .catch(() => setError("Could not load PPMPs."))
      .finally(() => setLoadingPPMPs(false));
  }, [
    selectedOfficeId,
    myOffices.length,
    loadingOffices,
    draftRestoreAttempted,
  ]);

  // ── Guard against a stale / no-longer-eligible PPMP selection ────────
  // A restored draft (or, in principle, any other path that sets
  // selectedPpmpId) can point at a PPMP that no longer belongs to the
  // eligible list — most commonly because it was archived, but also if
  // it moved offices, was deleted, or its status changed. Simply having
  // a non-empty selectedPpmpId used to be treated as "PPMP step done,"
  // which meant a stale id alone was enough to let the wizard proceed
  // all the way to submission with effectively no valid PPMP behind it.
  // As soon as we have a settled eligible list, drop any selection that
  // isn't actually in it and send the user back to the PPMP step with an
  // explanation, instead of silently letting a bad id ride through.
  useEffect(() => {
    if (loadingPPMPs || !selectedPpmpId) return;
    const stillEligible = eligiblePPMPs.some((p) => p.id === selectedPpmpId);
    if (!stillEligible) {
      setSelectedPpmpId("");
      setQuarter(null);
      setPpmpData(null);
      setSelected({});
      setError(
        "The previously selected PPMP is no longer available — it may have been archived or is no longer eligible. Please choose another PPMP.",
      );
      setStep("ppmp");
    }
    // eligiblePPMPs is intentionally the trigger here (not just
    // selectedPpmpId), so this re-checks whenever the eligible list is
    // refreshed, not only on first selection.
  }, [loadingPPMPs, eligiblePPMPs, selectedPpmpId]);

  // ── Load quarter-scoped items whenever PPMP or quarter changes ───────
  useEffect(() => {
    if (!selectedPpmpId || !quarter) {
      setPpmpData(null);
      setSelected({});
      return;
    }
    setLoadingItems(true);
    setError("");
    api
      .get(`/ppmps/${selectedPpmpId}/procurement-items`, {
        params: { quarter },
      })
      .then((res) => {
        const data: PPMPItemsResponse = res.data;
        setPpmpData(data);

        const pending = pendingItemRestoreRef.current;
        if (pending) {
          // Re-apply a restored draft's selection, but only against items
          // that still exist for this quarter, and clamp each quantity to
          // whatever's ACTUALLY remaining now — availability may have
          // changed since the draft was saved (someone else's PR, etc.).
          const freshItems = data.projects.flatMap((p) => p.items);
          const freshById = new Map(freshItems.map((i) => [i.id, i]));
          const restoredSelection: Record<string, SelectedItemState> = {};
          for (const [itemId, sel] of Object.entries(pending)) {
            const fresh = freshById.get(itemId);
            if (!fresh || fresh.remaining_quantity <= 0) continue;
            restoredSelection[itemId] = {
              ...sel,
              requestedQuantity: Math.min(
                sel.requestedQuantity,
                fresh.remaining_quantity,
              ),
            };
          }
          setSelected(restoredSelection);
          pendingItemRestoreRef.current = null;
        } else {
          // Selection resets on an ORDINARY quarter/PPMP change — a Q1
          // selection isn't meaningful once you've switched to Q2
          // (different balances). Draft restoration is the one exception,
          // handled above.
          setSelected({});
        }
      })
      .catch(() => setError("Could not load items for this PPMP/quarter."))
      .finally(() => setLoadingItems(false));
  }, [selectedPpmpId, quarter]);

  const filteredPPMPs = useMemo(() => {
    if (!ppmpSearch.trim()) return eligiblePPMPs;
    const q = ppmpSearch.toLowerCase();
    return eligiblePPMPs.filter(
      (p) =>
        p.ppmp_no?.toLowerCase().includes(q) ||
        p.ppmp_type.toLowerCase().includes(q),
    );
  }, [eligiblePPMPs, ppmpSearch]);

  const allItems = useMemo(() => {
    if (!ppmpData)
      return [] as (PPMPItem & {
        entryId: string;
        entryLabel: string;
        category: string | null;
        lotPriority: number;
      })[];
    return ppmpData.projects.flatMap((p) =>
      p.items.map((i) => ({
        ...i,
        entryId: p.entry_id,
        entryLabel: p.label,
        category: p.category,
        lotPriority: p.lot_priority,
      })),
    );
  }, [ppmpData]);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(allItems.map((i) => i.category).filter(Boolean)),
      ) as string[],
    [allItems],
  );
  const projectOptions = useMemo(
    () =>
      Array.from(new Set(allItems.map((i) => i.entryLabel).filter(Boolean))),
    [allItems],
  );

  const visibleProjects = useMemo(() => {
    if (!ppmpData) return [];
    const q = itemSearch.trim().toLowerCase();
    const matched = ppmpData.projects
      .filter((p) => !projectFilter || p.label === projectFilter)
      .filter((p) => !categoryFilter || p.category === categoryFilter)
      .flatMap((p) =>
        p.items
          .filter((i) => !q || i.item_name.toLowerCase().includes(q))
          .map((i) => ({
            ...i,
            entryId: p.entry_id,
            category: p.category,
          })),
      );
    // One section per Code: every item assigned to that Code is listed
    // together, even when the items belong to different procurement
    // entries.
    const groups = new Map<string, typeof matched>();
    for (const item of matched) {
      const key = item.category || "Uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([code, items]) => ({
      code,
      items,
    }));
  }, [ppmpData, itemSearch, projectFilter, categoryFilter]);

  const toggleItem = (entryId: string, item: PPMPItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = {
          entryId,
          requestedQuantity: item.remaining_quantity,
        };
      }
      return next;
    });
  };

  const updateRequestedQuantity = (itemId: string, qty: number) =>
    setSelected((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], requestedQuantity: qty },
    }));

  const selectedItemsList = useMemo(
    () => allItems.filter((i) => selected[i.id]),
    [allItems, selected],
  );

  // Group selected items by PPMP Code (category), sort the groups by
  // their predefined Lot Priority, then hand out LOT A, LOT B, LOT C...
  // in that order. Recomputed on every selection change — always starts
  // at LOT A and never skips a letter for a category that wasn't picked
  // this time.
  const lotGroups = useMemo(() => {
    const byCategory = new Map<
      string,
      { category: string; priority: number; items: typeof selectedItemsList }
    >();
    for (const item of selectedItemsList) {
      const key = item.category || "Uncategorized";
      if (!byCategory.has(key)) {
        byCategory.set(key, {
          category: key,
          priority: item.lotPriority ?? Number.MAX_SAFE_INTEGER,
          items: [],
        });
      }
      byCategory.get(key)!.items.push(item);
    }
    return Array.from(byCategory.values())
      .sort((a, b) => a.priority - b.priority)
      .map((group, idx) => ({
        ...group,
        lotLabel: `LOT ${LOT_LETTERS[idx] || idx + 1}`,
      }));
  }, [selectedItemsList]);

  // Quick lookup: item id -> its computed lot label, for rendering and
  // for the submit payload.
  const lotLabelByItemId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const group of lotGroups) {
      for (const item of group.items) map[item.id] = group.lotLabel;
    }
    return map;
  }, [lotGroups]);

  const selectedTotal = useMemo(
    () =>
      selectedItemsList.reduce(
        (sum, i) => sum + selected[i.id].requestedQuantity * i.unit_price,
        0,
      ),
    [selectedItemsList, selected],
  );

  const belowSignatoryThreshold = selectedTotal < SIGNATORY_THRESHOLD;
  const signatoryPreview = useMemo(
    () =>
      previewSignatories(
        selectedTotal,
        signatorySettings,
        requestedByName,
        requestedByDesignation,
      ),
    [selectedTotal, signatorySettings, requestedByName, requestedByDesignation],
  );

  // ── Per-step validation (spec: block progress until each is satisfied) ──
  // Requires more than a non-empty id — the id must still resolve to a
  // PPMP in the currently loaded eligible list. A restored draft can
  // point at a PPMP that has since been archived (or otherwise dropped
  // out of eligibility) between when the draft was saved and now; without
  // this check, that stale id alone used to be enough to satisfy this
  // step and let the wizard proceed all the way to submission.
  const ppmpStepValid = !!selectedPpmpId && !!selectedPpmp;
  // Lot assignment is now fully automatic (computed from each item's
  // PPMP Code — see lotGroups), so there's nothing left to validate here
  // beyond having a quarter and at least one item selected.
  const itemsStepValid = !!quarter && selectedItemsList.length > 0;
  const fundClusterStepValid = fundCluster === "GAA" || fundCluster === "STF";
  const purposeStepValid = purpose.trim().length > 0;
  const signatoriesStepValid =
    !belowSignatoryThreshold || requestedByName.trim().length > 0;

  const canSubmit =
    ppmpStepValid &&
    itemsStepValid &&
    fundClusterStepValid &&
    purposeStepValid &&
    signatoriesStepValid;

  const stepIndex = STEP_ORDER.indexOf(step);
  const canAdvanceFrom: Record<WizardStep, boolean> = {
    ppmp: ppmpStepValid,
    items: itemsStepValid,
    fund_cluster: fundClusterStepValid,
    purpose: purposeStepValid,
    signatories: signatoriesStepValid,
    review: true,
  };
  const goNext = () => {
    if (!canAdvanceFrom[step]) return;
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  };

  // ── Persist the draft on every meaningful change ──────────────────────
  // Gated on draftRestoreAttempted so this never fires with the initial
  // blank state and overwrites a not-yet-restored draft on first render.
  useEffect(() => {
    if (!draftKey || !draftRestoreAttempted) return;
    const draft: CreatePRDraft = {
      selectedOfficeId,
      selectedPpmpId,
      quarter,
      fundCluster,
      selected,
      purpose,
      requestedByName,
      requestedByDesignation,
      step,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Storage full or unavailable (private browsing, quota) — not
      // worth surfacing to the user; the wizard still works, it just
      // won't survive a reload this time.
    }
  }, [
    draftKey,
    draftRestoreAttempted,
    selectedOfficeId,
    selectedPpmpId,
    quarter,
    fundCluster,
    selected,
    purpose,
    requestedByName,
    requestedByDesignation,
    step,
  ]);

  const clearDraft = () => {
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
  };

  const startOver = () => {
    clearDraft();
    setSelectedOfficeId(myOffices.length === 1 ? myOffices[0].id : "");
    setSelectedPpmpId("");
    setQuarter(null);
    setFundCluster("");
    setSelected({});
    setPurpose("");
    setRequestedByName("");
    setRequestedByDesignation("");
    setStep("ppmp");
    setShowRestoredBanner(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (!canSubmit) {
      setError("Please complete every step before submitting.");
      return;
    }
    // Defense in depth: canSubmit already covers this via ppmpStepValid,
    // but a direct check here means an accidental relaxation of
    // ppmpStepValid in the future can't silently reopen this hole for
    // the actual submit call.
    if (!selectedPpmp) {
      setError(
        "The selected PPMP is no longer available. Please choose another PPMP.",
      );
      setStep("ppmp");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ppmp_id: selectedPpmpId,
        quarter,
        fund_cluster: fundCluster,
        purpose: purpose.trim() || null,
        end_user_name: requestedByName.trim() || null,
        end_user_designation: requestedByDesignation.trim() || null,
        items: selectedItemsList.map((i) => ({
          ppmp_entry_id: selected[i.id].entryId,
          ppmp_item_id: i.id,
          requested_quantity: selected[i.id].requestedQuantity,
          assigned_lot: lotLabelByItemId[i.id],
        })),
      };
      const res = await api.post(`/prs`, payload, {
        params: { created_by: dbUser?.id },
      });
      // PR successfully created — the draft's job is done. Clearing it
      // here (not just relying on a future overwrite) means a stale
      // "restored" banner never reappears on the NEXT new PR.
      clearDraft();
      navigate(`/prs/${res.data.id}`);
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to create Purchase Request.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <PageHeader
        title="Create Purchase Request"
        subtitle="Generated from an existing PPMP — select it, then choose items by quarter."
        backTo="/prs"
      />

      {/* ── Step indicator ── */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {STEP_ORDER.map((s, i) => {
          const isCurrent = s === step;
          const isDone = i < stepIndex;
          return (
            <button
              key={s}
              onClick={() =>
                (i <= stepIndex || canAdvanceFrom[step]) && setStep(s)
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                isCurrent
                  ? "bg-blue-700 text-white"
                  : isDone
                    ? "bg-[#F0F9FF] text-[#009CC4]"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {isDone ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
              {STEP_LABELS[s]}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {showRestoredBanner && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800 mb-4">
          <span>
            Restored your unsaved draft
            {draftSavedAt
              ? ` from ${new Date(draftSavedAt).toLocaleString("en-PH", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : ""}
            .
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={startOver}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard & start over
            </button>
            <button
              onClick={() => setShowRestoredBanner(false)}
              className="text-amber-600 hover:text-amber-800"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* ── Main step content ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 min-h-[420px]">
          {step === "ppmp" && (
            <div>
              <h2 className="text-sm font-semibold text-blue-900 mb-3">
                Select PPMP
              </h2>

              {myOffices.length > 1 && (
                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-1.5 block">
                    Office
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {myOffices.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setSelectedOfficeId(o.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                          selectedOfficeId === o.id
                            ? "border-[#009CC4] bg-[#F0F9FF] text-[#009CC4]"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {o.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative max-w-md mb-4">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40"
                  placeholder="Search PPMP number or type..."
                  value={ppmpSearch}
                  onChange={(e) => setPpmpSearch(e.target.value)}
                />
              </div>

              {loadingOffices || loadingPPMPs ? (
                <p className="text-sm text-gray-400">Loading PPMPs...</p>
              ) : myOffices.length > 0 && !selectedOfficeId ? (
                <p className="text-sm text-gray-400">
                  Select an office above to see its PPMPs.
                </p>
              ) : filteredPPMPs.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No approved PPMPs available yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="py-2 pr-3 font-medium">PPMP No.</th>
                        <th className="py-2 pr-3 font-medium">Fiscal Year</th>
                        <th className="py-2 pr-3 font-medium">Type</th>
                        <th className="py-2 pr-3 font-medium">Fee Category</th>
                        <th className="py-2 pr-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPPMPs.map((p) => (
                        <tr
                          key={p.id}
                          className={`border-b border-gray-50 ${
                            selectedPpmpId === p.id ? "bg-[#F0F9FF]" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-3 font-medium text-gray-800">
                            {p.ppmp_no}
                          </td>
                          <td className="py-2.5 pr-3 text-gray-600">
                            {p.year}
                          </td>
                          <td className="py-2.5 pr-3 text-gray-600 capitalize">
                            {p.ppmp_type}
                          </td>
                          <td className="py-2.5 pr-3 text-gray-600">
                            {p.fee_category || "—"}
                          </td>
                          <td className="py-2.5 pr-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedPpmpId(p.id);
                                setQuarter(null);
                              }}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                                selectedPpmpId === p.id
                                  ? "bg-blue-700 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {selectedPpmpId === p.id ? "Selected" : "Select"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === "items" && (
            <div>
              <h2 className="text-sm font-semibold text-blue-900 mb-3">
                Quarter, Lots & Items
              </h2>

              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1.5 block">
                  Quarter
                </label>
                <div className="flex gap-2">
                  {QUARTERS.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuarter(q)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                        quarter === q
                          ? "border-[#009CC4] bg-[#F0F9FF] text-[#009CC4]"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      Quarter {q}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Determines which quantities are available — a separate PR is
                  needed for each quarter.
                </p>
              </div>

              {quarter && (
                <>
                  {/* Lots are no longer chosen manually — every item
                      already belongs to a PPMP Code, so its lot (LOT A,
                      LOT B...) is computed automatically the moment it's
                      selected below. See lotGroups. */}

                  <div className="flex flex-wrap gap-2 mb-4">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40"
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                      />
                    </div>
                    {projectOptions.length > 1 && (
                      <select
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white"
                      >
                        <option value="">All projects</option>
                        {projectOptions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    )}
                    {categoryOptions.length > 1 && (
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white"
                      >
                        <option value="">All categories</option>
                        {categoryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {loadingItems ? (
                    <p className="text-sm text-gray-400">Loading items...</p>
                  ) : visibleProjects.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      No items with quantity for Quarter {quarter} match your
                      filters.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {visibleProjects.map((group) => (
                        <div
                          key={group.code}
                          className="rounded-lg border border-gray-200 overflow-hidden"
                        >
                          <div className="px-4 py-2.5 bg-gray-50 text-sm font-medium text-gray-800">
                            {group.code}
                          </div>
                          <div className="divide-y divide-gray-100">
                            {group.items.map((item) => {
                              const isSelected = !!selected[item.id];
                              const disabled = item.remaining_quantity <= 0;
                              return (
                                <div
                                  key={item.id}
                                  className={`flex items-center gap-4 px-4 py-3 text-sm ${disabled ? "opacity-40" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={disabled}
                                    onChange={() =>
                                      toggleItem(item.entryId, item)
                                    }
                                    className="w-4 h-4"
                                  />
                                  <span className="flex-1 text-gray-800">
                                    {item.item_name}
                                    {isSelected && (
                                      <span className="text-xs text-[#009CC4] ml-2">
                                        {lotLabelByItemId[item.id]}
                                      </span>
                                    )}
                                    {item.remaining_quantity <= 0 && (
                                      <span className="text-xs text-red-400 ml-2">
                                        Fully requested for Q{quarter}
                                      </span>
                                    )}
                                  </span>
                                  <span className="w-14 text-gray-500 text-xs">
                                    {item.unit}
                                  </span>
                                  <span className="w-20 text-right text-gray-500 text-xs">
                                    Q{quarter}: {item.quarter_quantity}
                                  </span>
                                  <span className="w-24 text-right text-gray-600 text-xs">
                                    Avail: {item.remaining_quantity}
                                  </span>
                                  <span className="w-20 text-right">
                                    {isSelected ? (
                                      <input
                                        type="number"
                                        min={1}
                                        max={item.remaining_quantity}
                                        value={
                                          selected[item.id].requestedQuantity
                                        }
                                        onChange={(e) =>
                                          updateRequestedQuantity(
                                            item.id,
                                            Number(e.target.value),
                                          )
                                        }
                                        className="w-16 border border-gray-200 rounded px-1.5 py-1 text-right text-xs"
                                      />
                                    ) : (
                                      <span className="text-gray-400 text-xs">
                                        —
                                      </span>
                                    )}
                                  </span>
                                  <span className="w-24 text-right text-gray-600 text-xs">
                                    ₱{fmt(item.unit_price)}
                                  </span>
                                  <span className="w-28 text-right font-medium text-gray-800 text-xs">
                                    ₱
                                    {fmt(
                                      (isSelected
                                        ? selected[item.id].requestedQuantity
                                        : 0) * item.unit_price,
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Selected so far, grouped by the lot each item was
                      automatically assigned to (by PPMP Code + Lot
                      Priority) — read-only grouping, remove an item with
                      the X. ── */}
                  {selectedItemsList.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Selected so far ({selectedItemsList.length})
                      </p>
                      <div className="space-y-3">
                        {lotGroups.map((group) => (
                          <div key={group.category}>
                            <p className="text-xs font-medium text-[#009CC4] mb-1">
                              {group.lotLabel} — {group.category}
                            </p>
                            <div className="space-y-1">
                              {group.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-3 py-1.5"
                                >
                                  <span className="text-gray-700 truncate">
                                    {item.item_name}
                                  </span>
                                  <button
                                    onClick={() =>
                                      toggleItem(item.entryId, item)
                                    }
                                    className="text-gray-400 hover:text-red-500"
                                    aria-label="Remove item"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === "fund_cluster" && (
            <div>
              <h2 className="text-sm font-semibold text-blue-900 mb-1">
                Fund Cluster
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                Prints on the PR's "Fund Cluster" line — required.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                {FUND_CLUSTER_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => setFundCluster(option)}
                    className={`text-left px-4 py-3 rounded-lg border text-sm transition ${
                      fundCluster === option
                        ? "border-[#009CC4] bg-[#F0F9FF]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-semibold text-gray-800">{option}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {option === "GAA"
                        ? "General Appropriations Act"
                        : "Special Trust Fund"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "purpose" && (
            <div>
              <h2 className="text-sm font-semibold text-blue-900 mb-1">
                Purpose
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Why this PR is being made — required.
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40 resize-none"
                rows={4}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Office Operations, Laboratory Activities, OJT Requirements, Administrative Supplies"
              />
            </div>
          )}

          {step === "signatories" && (
            <div>
              <h2 className="text-sm font-semibold text-blue-900 mb-1">
                Signatories
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                {belowSignatoryThreshold
                  ? `Below ₱${fmt(SIGNATORY_THRESHOLD)} — enter who's requesting this PR. Approved By is fixed.`
                  : `₱${fmt(SIGNATORY_THRESHOLD)} or more — signatories are fixed and can't be edited.`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Requested by
                  </p>
                  {belowSignatoryThreshold ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Name
                        </label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40"
                          value={requestedByName}
                          onChange={(e) => setRequestedByName(e.target.value)}
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Designation
                        </label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009CC4]/40"
                          value={requestedByDesignation}
                          onChange={(e) =>
                            setRequestedByDesignation(e.target.value)
                          }
                          placeholder="e.g. End User"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">
                        {signatoryPreview.requestedByName}
                      </p>
                      <p className="text-xs text-gray-500 italic">
                        {signatoryPreview.requestedByDesignation}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Approved by
                  </p>
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">
                      {signatoryPreview.approvedByName}
                    </p>
                    <p className="text-xs text-gray-500 italic">
                      {signatoryPreview.approvedByDesignation}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "review" && (
            <div>
              <h2 className="text-sm font-semibold text-blue-900 mb-3">
                Review
              </h2>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">PPMP</p>
                    <p className="font-medium text-gray-800">
                      {selectedPpmp?.ppmp_no}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Office</p>
                    <p className="font-medium text-gray-800">
                      {selectedOffice?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Fiscal Year</p>
                    <p className="font-medium text-gray-800">
                      {selectedPpmp?.year}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Quarter</p>
                    <p className="font-medium text-gray-800">Q{quarter}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Fund Cluster</p>
                    <p className="font-medium text-gray-800">
                      {fundCluster || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Purpose</p>
                    <p className="font-medium text-gray-800">
                      {purpose || "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1.5">
                    Items ({selectedItemsList.length})
                  </p>
                  <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                    {selectedItemsList.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <span className="text-gray-700">
                          {item.item_name}
                          <span className="text-gray-400">
                            {" "}
                            · {lotLabelByItemId[item.id]}
                          </span>
                        </span>
                        <span className="text-gray-600">
                          {selected[item.id].requestedQuantity} × ₱
                          {fmt(item.unit_price)} = ₱
                          {fmt(
                            selected[item.id].requestedQuantity *
                              item.unit_price,
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400">Requested By</p>
                    <p className="font-medium text-gray-800">
                      {signatoryPreview.requestedByName}
                    </p>
                    <p className="text-xs text-gray-500 italic">
                      {signatoryPreview.requestedByDesignation}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400">Approved By</p>
                    <p className="font-medium text-gray-800">
                      {signatoryPreview.approvedByName}
                    </p>
                    <p className="text-xs text-gray-500 italic">
                      {signatoryPreview.approvedByDesignation}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  PR Number and each item's Stock/Property Number are generated
                  automatically once submitted.
                </p>
              </div>
            </div>
          )}

          {/* ── Step nav ── */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
            <button
              onClick={goBack}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            {step === "review" ? (
              <LoadingButton
                onClick={handleSubmit}
                disabled={!canSubmit || saving}
                busy={saving}
                busyLabel="Creating..."
                className="bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition"
              >
                Create Purchase Request
              </LoadingButton>
            ) : (
              <button
                onClick={goNext}
                disabled={!canAdvanceFrom[step]}
                className="inline-flex items-center gap-1.5 bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Sidebar summary — sticky, updates live ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-6 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Summary
          </h3>
          <SummaryRow label="PPMP" value={selectedPpmp?.ppmp_no || "—"} />
          <SummaryRow label="Office" value={selectedOffice?.name || "—"} />
          <SummaryRow
            label="Fiscal Year"
            value={selectedPpmp?.year ? String(selectedPpmp.year) : "—"}
          />
          <SummaryRow label="Quarter" value={quarter ? `Q${quarter}` : "—"} />
          <SummaryRow label="Fund Cluster" value={fundCluster || "—"} />
          <SummaryRow
            label="Items selected"
            value={String(selectedItemsList.length)}
          />
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">Grand Total</p>
            <p className="text-lg font-semibold text-blue-900">
              ₱{fmt(selectedTotal)}
            </p>
          </div>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium truncate max-w-[140px]">
        {value}
      </span>
    </div>
  );
}
