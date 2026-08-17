import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  useSignatorySettings,
  previewSignatories,
  SIGNATORY_THRESHOLD,
} from "../../hooks/useSignatorySettings";
import {
  Search,
  Plus,
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
  assignedLot: string;
}

// Shape of an item as it comes back from GET /prs/:id.
interface ExistingPRItem {
  ppmp_entry_id: string;
  ppmp_item_id: string;
  requested_quantity: number;
  assigned_lot: string | null;
}

interface ExistingPR {
  id: string;
  ppmp_id: string;
  pr_number: string | null;
  quarter: number | null;
  fund_cluster: string | null;
  purpose?: string | null;
  end_user_name?: string | null;
  end_user_designation?: string | null;
  requested_by_name?: string | null;
  requested_by_designation?: string | null;
  approved_by_name?: string | null;
  approved_by_designation?: string | null;
  items: ExistingPRItem[];
}

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

const QUARTERS = [1, 2, 3, 4];
const DEFAULT_LOTS = [
  "No Lot",
  "Lot A",
  "Lot B",
  "Lot C",
  "Lot D",
  "Lot E",
  "Lot F",
  "Lot G",
];

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
// line of the PR form (see PRDetailPage.tsx).
const FUND_CLUSTER_OPTIONS = ["GAA", "STF"] as const;

// ── Draft persistence ────────────────────────────────────────────────────
// Scoped per PR (not just per user) so editing PR-2026-014 never collides
// with a draft for PR-2026-015, and cleared automatically the moment the
// edit is actually saved. Losing in-progress changes to an EXISTING
// record on an accidental reload is arguably worse than losing a
// brand-new draft, so this carries the same safety net Create has.
const DRAFT_STORAGE_PREFIX = "epms:edit-pr-draft:";

interface EditPRDraft {
  selectedOfficeId: string;
  selectedPpmpId: string;
  quarter: number | null;
  fundCluster: string;
  selected: Record<string, SelectedItemState>;
  lots: string[];
  activeLot: string;
  purpose: string;
  requestedByName: string;
  requestedByDesignation: string;
  step: WizardStep;
  savedAt: string;
}

export default function EditPRPage() {
  const { id } = useParams();
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const { settings: signatorySettings } = useSignatorySettings();
  const toast = useToast();

  const [step, setStep] = useState<WizardStep>("ppmp");

  const [loadingPR, setLoadingPR] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const existingPRRef = useRef<ExistingPR | null>(null);
  const prefilledRef = useRef(false);
  const pendingItemRestoreRef = useRef<Record<
    string,
    SelectedItemState
  > | null>(null);

  const [prNumber, setPrNumber] = useState<string | null>(null);

  // ── Office context — same reasoning as CreatePRPage ───────────────────
  const [myOffices, setMyOffices] = useState<OfficeOption[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [loadingOffices, setLoadingOffices] = useState(true);

  // Step: select PPMP
  const [eligiblePPMPs, setEligiblePPMPs] = useState<EligiblePPMP[]>([]);
  const [ppmpSearch, setPpmpSearch] = useState("");
  const [selectedPpmpId, setSelectedPpmpId] = useState("");
  const [loadingPPMPs, setLoadingPPMPs] = useState(false);

  // Step: quarter + lots + items
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
  const [lots, setLots] = useState<string[]>(DEFAULT_LOTS);
  const [activeLot, setActiveLot] = useState("");
  const [newLotName, setNewLotName] = useState("");
  const [showNewLotInput, setShowNewLotInput] = useState(false);

  // Step: purpose
  const [purpose, setPurpose] = useState("");

  // Step: signatories
  const [requestedByName, setRequestedByName] = useState("");
  const [requestedByDesignation, setRequestedByDesignation] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isDirty = selectedPpmpId !== "" || selectedOfficeId !== "" || quarter !== null || purpose !== "" || Object.keys(selected).length > 0;
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmState();
  useUnsavedChangesGuard(isDirty, confirm);

  // ── Draft persistence state ───────────────────────────────────────────
  const draftKey = id ? `${DRAFT_STORAGE_PREFIX}${id}` : null;
  const [draftRestoreAttempted, setDraftRestoreAttempted] = useState(false);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const selectedPpmp = useMemo(
    () => eligiblePPMPs.find((p) => p.id === selectedPpmpId) || null,
    [eligiblePPMPs, selectedPpmpId],
  );
  const selectedOffice = useMemo(
    () => myOffices.find((o) => o.id === selectedOfficeId) || null,
    [myOffices, selectedOfficeId],
  );

  // ── Load the existing PR first ────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    api
      .get(`/prs/${id}`)
      .then((res) => {
        const pr: ExistingPR = res.data;
        existingPRRef.current = pr;
        setPrNumber(pr.pr_number || null);
        setPurpose(pr.purpose || "");
        setFundCluster(pr.fund_cluster || "");
        setRequestedByName(pr.end_user_name || dbUser?.full_name || "");
        setRequestedByDesignation(pr.end_user_designation || "");
        setSelectedOfficeId(""); // resolved once myOffices/eligiblePPMPs load, below
        if (pr.ppmp_id) {
          setSelectedPpmpId(pr.ppmp_id);
        } else {
          prefilledRef.current = true;
        }
        if (pr.quarter) {
          setQuarter(pr.quarter);
        } else {
          // Legacy PR saved before quarters existed — nothing to prefill,
          // the person must pick one explicitly (see the amber prompt in
          // the items step).
          prefilledRef.current = true;
        }
        // Preserve any custom lot names already used on this PR, even if
        // they aren't in the default list.
        const usedLots = Array.from(
          new Set(
            pr.items.map((i) => i.assigned_lot).filter(Boolean) as string[],
          ),
        );
        if (usedLots.length > 0) {
          setLots((prev) => Array.from(new Set([...prev, ...usedLots])));
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingPR(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Restore a saved draft for THIS PR, once the PR itself has loaded ──
  // Runs after the PR load above so a restored draft can override the
  // PR's own prefilled values (the person's in-progress edits win over
  // what's already saved) — but only once, and only before anything else
  // writes to localStorage for this key.
  useEffect(() => {
    if (!draftKey || draftRestoreAttempted || loadingPR) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft: EditPRDraft = JSON.parse(raw);
        setSelectedOfficeId(draft.selectedOfficeId || "");
        setSelectedPpmpId(draft.selectedPpmpId || "");
        setQuarter(draft.quarter ?? null);
        setFundCluster(draft.fundCluster || "");
        setLots((prev) =>
          draft.lots?.length
            ? Array.from(new Set([...prev, ...draft.lots]))
            : prev,
        );
        setActiveLot(draft.activeLot || "");
        setPurpose(draft.purpose || "");
        setRequestedByName(draft.requestedByName || "");
        setRequestedByDesignation(draft.requestedByDesignation || "");
        setStep(draft.step || "ppmp");
        if (draft.selected && Object.keys(draft.selected).length > 0) {
          pendingItemRestoreRef.current = draft.selected;
        }
        // A restored draft's item selection supersedes the PR's own
        // prefill, so mark prefill as already done.
        prefilledRef.current = true;
        setDraftSavedAt(draft.savedAt || null);
        setShowRestoredBanner(true);
      }
    } catch {
      // Corrupted draft — ignore, fall back to the PR's own saved state.
    }
    setDraftRestoreAttempted(true);
  }, [draftKey, draftRestoreAttempted, loadingPR]);

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
        // Only auto-pick when nothing's already been resolved (e.g. by a
        // restored draft) and there's exactly one office to choose from.
        setSelectedOfficeId(
          (prev) => prev || (mine.length === 1 ? mine[0].id : ""),
        );
      })
      .catch(() => setMyOffices([]))
      .finally(() => setLoadingOffices(false));
  }, [dbUser?.id]);

  // ── Load eligible PPMPs, scoped to the selected office once known ────
  useEffect(() => {
    if (myOffices.length > 0 && !selectedOfficeId) {
      setEligiblePPMPs([]);
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
  }, [selectedOfficeId, myOffices.length]);

  // ── Load quarter-scoped items whenever PPMP or quarter changes ───────
  useEffect(() => {
    if (!selectedPpmpId || !quarter) {
      setPpmpData(null);
      if (!pendingItemRestoreRef.current) setSelected({});
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
        const pr = existingPRRef.current;

        if (pending) {
          // Restoring a locally-saved draft — clamp against fresh data.
          const freshById = new Map(
            data.projects.flatMap((p) => p.items).map((i) => [i.id, i]),
          );
          const restoredSelection: Record<string, SelectedItemState> = {};
          for (const [itemId, sel] of Object.entries(pending)) {
            const fresh = freshById.get(itemId);
            if (!fresh) continue;
            // This PR's own already-saved reservation isn't excluded by
            // this endpoint, so the true ceiling is remaining + whatever
            // this PR itself already holds for that item (see the note
            // on effectiveRemaining below, applied the same way here).
            const alreadyOnThisPR =
              pr?.items.find((i) => i.ppmp_item_id === itemId)
                ?.requested_quantity || 0;
            const ceiling = fresh.remaining_quantity + alreadyOnThisPR;
            if (ceiling <= 0) continue;
            restoredSelection[itemId] = {
              ...sel,
              requestedQuantity: Math.min(sel.requestedQuantity, ceiling),
            };
          }
          setSelected(restoredSelection);
          pendingItemRestoreRef.current = null;
        } else if (
          pr &&
          !prefilledRef.current &&
          pr.ppmp_id === selectedPpmpId &&
          pr.quarter === quarter
        ) {
          // First load matching the PR's own original PPMP+quarter —
          // prefill straight from what's already saved on it.
          const nextSelected: Record<string, SelectedItemState> = {};
          for (const prItem of pr.items) {
            if (!prItem.ppmp_item_id) continue;
            nextSelected[prItem.ppmp_item_id] = {
              entryId: prItem.ppmp_entry_id,
              requestedQuantity: prItem.requested_quantity,
              assignedLot: prItem.assigned_lot || "",
            };
          }
          setSelected(nextSelected);
          prefilledRef.current = true;
        } else if (!prefilledRef.current) {
          // Switched to a different PPMP/quarter than the PR originally
          // had — treat as a fresh selection from here on.
          setSelected({});
          prefilledRef.current = true;
        } else {
          // An ordinary, later quarter/PPMP change during this edit
          // session — reset, same as CreatePRPage.
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
      })[];
    return ppmpData.projects.flatMap((p) =>
      p.items.map((i) => ({
        ...i,
        entryId: p.entry_id,
        entryLabel: p.label,
        category: p.category,
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

  // This PR's own already-saved reservation for a given item — needed
  // because get_ppmp_procurement_items' remaining_quantity does NOT
  // exclude this PR's own existing items (unlike the PUT validation,
  // which does via exclude_pr_id). Without adding this back, an item
  // this PR already fully reserved would incorrectly show as exhausted.
  const alreadyOnThisPR = (itemId: string): number =>
    existingPRRef.current?.items.find((i) => i.ppmp_item_id === itemId)
      ?.requested_quantity || 0;

  const effectiveRemaining = (item: PPMPItem): number => {
    if (selected[item.id])
      return item.remaining_quantity + selected[item.id].requestedQuantity;
    return item.remaining_quantity + alreadyOnThisPR(item.id);
  };

  const toggleItem = (entryId: string, item: PPMPItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = {
          entryId,
          requestedQuantity: effectiveRemaining(item),
          assignedLot: activeLot,
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

  const updateAssignedLot = (itemId: string, lot: string) =>
    setSelected((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], assignedLot: lot },
    }));

  const createLot = () => {
    const name = newLotName.trim();
    if (!name) return;
    if (!lots.includes(name)) setLots((prev) => [...prev, name]);
    setActiveLot(name);
    setNewLotName("");
    setShowNewLotInput(false);
  };

  const selectedItemsList = useMemo(
    () => allItems.filter((i) => selected[i.id]),
    [allItems, selected],
  );

  const selectedItemsByLot = useMemo(() => {
    const grouped: Record<string, typeof selectedItemsList> = {};
    for (const item of selectedItemsList) {
      const lot = selected[item.id].assignedLot || "No Lot";
      grouped[lot] = grouped[lot] || [];
      grouped[lot].push(item);
    }
    return grouped;
  }, [selectedItemsList, selected]);

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

  const ppmpStepValid = !!selectedPpmpId;
  const itemsStepValid =
    !!quarter &&
    selectedItemsList.length > 0 &&
    selectedItemsList.every((i) => !!selected[i.id].assignedLot);
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
  useEffect(() => {
    if (!draftKey || !draftRestoreAttempted) return;
    const draft: EditPRDraft = {
      selectedOfficeId,
      selectedPpmpId,
      quarter,
      fundCluster,
      selected,
      lots,
      activeLot,
      purpose,
      requestedByName,
      requestedByDesignation,
      step,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    draftKey,
    draftRestoreAttempted,
    selectedOfficeId,
    selectedPpmpId,
    quarter,
    fundCluster,
    selected,
    lots,
    activeLot,
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
    const pr = existingPRRef.current;
    if (!pr) return;
    setSelectedPpmpId(pr.ppmp_id || "");
    setQuarter(pr.quarter ?? null);
    setFundCluster(pr.fund_cluster || "");
    setPurpose(pr.purpose || "");
    setRequestedByName(pr.end_user_name || dbUser?.full_name || "");
    setRequestedByDesignation(pr.end_user_designation || "");
    setActiveLot("");
    prefilledRef.current = false; // let the items effect re-prefill from the PR again
    setSelected({});
    setStep("ppmp");
    setShowRestoredBanner(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (!canSubmit) {
      setError(
        belowSignatoryThreshold
          ? "Select a PPMP, a quarter, a fund cluster, at least one item with a lot, a purpose, and enter the Requested By name."
          : "Select a PPMP, a quarter, a fund cluster, at least one item with a lot, and a purpose.",
      );
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
          assigned_lot: selected[i.id].assignedLot,
        })),
      };
      await api.put(`/prs/${id}`, payload, {
        params: { updated_by: dbUser?.id },
      });
      clearDraft();
      navigate(`/prs/${id}`);
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to update Purchase Request.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingPR) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return <p className="text-gray-400">PR not found.</p>;
  }

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <PageHeader
        title="Edit Purchase Request"
        subtitle={prNumber ? `Editing ${prNumber}` : "Re-select the PPMP and items for this PR."}
        backTo={`/prs/${id}`}
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
            Restored your unsaved changes to this PR
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
              Discard & revert to saved
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
                          className={`border-b border-gray-50 ${selectedPpmpId === p.id ? "bg-[#F0F9FF]" : ""}`}
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
                                if (p.id !== selectedPpmpId) {
                                  prefilledRef.current = true;
                                  setSelected({});
                                }
                                setSelectedPpmpId(p.id);
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
                      onClick={() => {
                        if (q !== quarter) {
                          prefilledRef.current = true;
                          setSelected({});
                        }
                        setQuarter(q);
                      }}
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
                {!quarter && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    This PR predates quarter tracking — pick the quarter these
                    items should count against.
                  </p>
                )}
              </div>

              {quarter && (
                <>
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <label className="text-xs text-gray-500 mb-1.5 block">
                      Currently adding items to:
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {lots.map((lot) => (
                        <button
                          key={lot}
                          onClick={() => setActiveLot(lot)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            activeLot === lot
                              ? "border-[#009CC4] bg-[#F0F9FF] text-[#009CC4]"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {lot}
                        </button>
                      ))}
                      {showNewLotInput ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs w-28"
                            placeholder="e.g. Lot H"
                            value={newLotName}
                            onChange={(e) => setNewLotName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && createLot()}
                            autoFocus
                          />
                          <button
                            onClick={createLot}
                            className="text-xs font-medium text-white bg-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-800"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setShowNewLotInput(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowNewLotInput(true)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#009CC4] hover:opacity-70 px-2 py-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Lot
                        </button>
                      )}
                    </div>
                    {!activeLot && (
                      <p className="text-xs text-amber-600 mt-2">
                        Select a lot above before checking items below.
                      </p>
                    )}
                  </div>

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
                              const ceiling = effectiveRemaining(item);
                              const disabled =
                                ceiling <= 0 || (!activeLot && !isSelected);
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
                                        {selected[item.id].assignedLot}
                                      </span>
                                    )}
                                    {ceiling <= 0 && (
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
                                    Avail: {ceiling}
                                  </span>
                                  <span className="w-20 text-right">
                                    {isSelected ? (
                                      <input
                                        type="number"
                                        min={1}
                                        max={ceiling}
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

                  {selectedItemsList.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Selected so far ({selectedItemsList.length})
                      </p>
                      <div className="space-y-3">
                        {Object.entries(selectedItemsByLot).map(
                          ([lot, items]) => (
                            <div key={lot}>
                              <p className="text-xs font-medium text-[#009CC4] mb-1">
                                {lot}
                              </p>
                              <div className="space-y-1">
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-3 py-1.5"
                                  >
                                    <span className="text-gray-700 truncate">
                                      {item.item_name}
                                    </span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <select
                                        value={selected[item.id].assignedLot}
                                        onChange={(e) =>
                                          updateAssignedLot(
                                            item.id,
                                            e.target.value,
                                          )
                                        }
                                        className="border border-gray-200 rounded px-1.5 py-1 text-xs bg-white"
                                      >
                                        {lots.map((l) => (
                                          <option key={l} value={l}>
                                            {l}
                                          </option>
                                        ))}
                                      </select>
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
                                  </div>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
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
                placeholder="e.g. For the conduct of Extension Activity at Baraba National High School."
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
                    <p className="text-xs text-gray-400">PR Number</p>
                    <p className="font-medium text-gray-800">
                      {prNumber || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">PPMP</p>
                    <p className="font-medium text-gray-800">
                      {selectedPpmp?.ppmp_no}
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
                            · {selected[item.id].assignedLot || "no lot"}
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
              </div>
            </div>
          )}

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
                busyLabel="Saving..."
                className="bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition"
              >
                Save changes
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

        {/* ── Sidebar summary ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-6 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Summary
          </h3>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">PR Number</span>
            <span className="text-gray-700 font-medium">{prNumber || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">PPMP</span>
            <span className="text-gray-700 font-medium truncate max-w-[140px]">
              {selectedPpmp?.ppmp_no || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Office</span>
            <span className="text-gray-700 font-medium truncate max-w-[140px]">
              {selectedOffice?.name || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Quarter</span>
            <span className="text-gray-700 font-medium">
              {quarter ? `Q${quarter}` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Fund Cluster</span>
            <span className="text-gray-700 font-medium">
              {fundCluster || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Items selected</span>
            <span className="text-gray-700 font-medium">
              {selectedItemsList.length}
            </span>
          </div>
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
