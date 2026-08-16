import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { ArrowLeft, Plus, X, Check } from "lucide-react";
import { useToast } from "../components/feedback/ToastProvider";
import { useUnsavedChangesGuard } from "../components/feedback/useUnsavedChangesGuard";
import { useConfirmState } from "../components/feedback/useConfirm";
import { ConfirmDialog } from "../components/feedback/ConfirmDialog";
import { LoadingButton } from "../components/feedback/LoadingButton";
import PageHeader from "../components/layout/PageHeader";

/**
 * Edits AppMeta — the APP-only settings that have no home on the PPMP:
 * - version_type: indicative | final | updated (+ version_no when updated)
 * - signatories: dynamic list, same pattern as the PPMP's own signatories,
 *   but stored separately (an APP's sign-off roles are typically BAC-related
 *   — Chairperson, Head of the Procuring Entity — not the PPMP's own
 *   Prepared/Submitted By).
 *
 * APPPage.tsx (view/print/export) only ever reads what's saved here; this
 * is the only page that writes to AppMeta.
 */

const SIGN_OFF_ROLES = [
  "Prepared By",
  "Checked & Reviewed by",
  "Recommending Approval",
  "Approved By",
  "Others",
] as const;

const REQUIRED_MSG = "This field is required.";

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

const makeId = () =>
  `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptySignatory = (): SignatoryForm => ({
  id: makeId(),
  sign_off: "Checked & Reviewed by",
  custom_sign_off: "",
  name: "",
  position: "",
});

const resolvedSignOffTitle = (s: SignatoryForm) =>
  s.sign_off === "Others" ? s.custom_sign_off.trim() || "Others" : s.sign_off;

const inputClass = (hasError?: boolean) =>
  `w-full border rounded-lg px-3 py-2.5 text-[15px] text-[#1E293B] placeholder:text-[#94A3B8] bg-white focus:outline-none focus:ring-2 transition ${
    hasError
      ? "border-red-400 focus:ring-red-200"
      : "border-[#E2E8F0] focus:ring-[#0EA5E9]/30 focus:border-[#0284C7]"
  }`;

type VersionType = "indicative" | "final" | "updated";

function VersionOption({
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

export default function EditAppMetaPage() {
  const { ppmpId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const [versionType, setVersionType] = useState<VersionType>("indicative");
  const [versionNo, setVersionNo] = useState("");
  const [signatories, setSignatories] = useState<SignatoryForm[]>([
    emptySignatory(),
  ]);

  const isDirty = versionType !== "indicative" || versionNo !== "" || signatories.length > 1;
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmState();
  const { guardNavigation } = useUnsavedChangesGuard(isDirty, confirm);

  const [versionNoError, setVersionNoError] = useState("");
  const [signatoryErrors, setSignatoryErrors] = useState<
    Record<string, SignatoryErrors>
  >({});
  const [generalError, setGeneralError] = useState("");

  // Context header — PPMP No / year, just for orientation on this page.
  const [ppmpLabel, setPpmpLabel] = useState("");

  useEffect(() => {
    if (!ppmpId) return;
    Promise.all([
      api.get(`/app/meta/${ppmpId}`),
      api.get(`/ppmps/${ppmpId}`).catch(() => null),
      api.get("/settings/signatories/app").catch(() => null),
    ])
      .then(([metaRes, ppmpRes, appSettingsRes]) => {
        const meta = metaRes.data;
        setVersionType(
          ["indicative", "final", "updated"].includes(meta.version_type)
            ? meta.version_type
            : "indicative",
        );
        setVersionNo(meta.version_no || "");
        
        // If AppMeta has complete signatories, use them; otherwise build from PPMP + Admin settings
        const metaSignatories = Array.isArray(meta.signatories) ? meta.signatories : [];
        const hasPreparedBy = metaSignatories.some((s: any) => s.sign_off?.toLowerCase() === "prepared by");
        const isComplete = metaSignatories.length >= 2 && hasPreparedBy;
        
        if (isComplete) {
          setSignatories(
            metaSignatories
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
          );
        } else if (ppmpRes?.data) {
          // Build signatories from PPMP Prepared By + Admin APP settings
          const newSignatories: SignatoryForm[] = [];
          
          // 1. Get Prepared By from PPMP's signatories
          const ppmpSignatories = ppmpRes.data.signatories || [];
          const preparedBy = ppmpSignatories.find(
            (s: any) => s.sign_off?.toLowerCase() === "prepared by"
          );
          if (preparedBy) {
            newSignatories.push({
              id: makeId(),
              sign_off: "Prepared By" as const,
              custom_sign_off: "",
              name: preparedBy.name || "",
              position: preparedBy.position || "Fund Coordinator",
            });
          }
          
          // 2. Get admin-configured APP signatories (excluding Prepared By)
          if (appSettingsRes?.data?.signatories) {
            const adminSignatories = appSettingsRes.data.signatories
              .filter((s: any) => s.enabled !== false && s.sign_off?.toLowerCase() !== "prepared by")
              .sort((a: any, b: any) => (a.order_no || 0) - (b.order_no || 0));
            
            adminSignatories.forEach((s: any) => {
              newSignatories.push({
                id: makeId(),
                sign_off: s.sign_off || "Others",
                custom_sign_off: "",
                name: s.name || "",
                position: s.position || "",
              });
            });
          }
          
          if (newSignatories.length > 0) {
            setSignatories(newSignatories);
          } else {
            setSignatories([emptySignatory()]);
          }
        } else {
          setSignatories([emptySignatory()]);
        }
        
        if (ppmpRes?.data) {
          setPpmpLabel(
            `FY ${ppmpRes.data.year} — PPMP No. ${ppmpRes.data.ppmp_no || ""}`,
          );
        }
      })
      .catch(() => setLoadError("Failed to load APP settings."))
      .finally(() => setLoading(false));
  }, [ppmpId]);

  const addSignatory = () => {
    // APP allows multiple signatories with the same sign-off type
    // (e.g., two "Recommending Approval" entries with different positions).
    // Always add with the last used role, or "Checked & Reviewed by" if none.
    // Note: "Prepared By" should NOT be added manually - it comes from the PPMP.
    const lastRole = signatories.length > 0
      ? signatories[signatories.length - 1].sign_off
      : "Checked & Reviewed by";
    setSignatories((prev) => [
      ...prev,
      { ...emptySignatory(), sign_off: lastRole as SignatoryForm["sign_off"] },
    ]);
  };

  const removeSignatory = (id: string) => {
    setSignatories((prev) => prev.filter((s) => s.id !== id));
    setSignatoryErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
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

  const validate = (): boolean => {
    let ok = true;
    setGeneralError("");
    setVersionNoError("");

    if (versionType === "updated" && !versionNo.trim()) {
      setVersionNoError("Please enter a version number.");
      ok = false;
    }

    if (signatories.length === 0) {
      setGeneralError("Add at least one signatory.");
      ok = false;
    }

    // APP allows multiple signatories with the same sign-off type
    // (e.g., two "Recommending Approval" entries with different positions).
    // We only check that each sign-off + position combination is unique.
    const signOffPositionPairs = new Set<string>();
    signatories.forEach((s) => {
      if (s.sign_off !== "Others") {
        const key = `${s.sign_off}|${s.position}`;
        signOffPositionPairs.add(key);
      }
    });

    const errors: Record<string, SignatoryErrors> = {};
    signatories.forEach((s) => {
      const rowErrs: SignatoryErrors = {};
      if (!s.sign_off) rowErrs.sign_off = REQUIRED_MSG;
      else if (s.sign_off === "Others" && !s.custom_sign_off.trim())
        rowErrs.sign_off = "Please specify the sign-off title.";
      if (!s.name.trim()) rowErrs.name = REQUIRED_MSG;
      if (!s.position.trim()) rowErrs.position = REQUIRED_MSG;
      if (Object.keys(rowErrs).length > 0) {
        errors[s.id] = rowErrs;
        ok = false;
      }
    });
    setSignatoryErrors(errors);

    return ok;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await api.put(`/app/meta/${ppmpId}`, {
        version_type: versionType,
        version_no: versionType === "updated" ? versionNo.trim() : null,
        signatories: signatories.map((s, i) => ({
          sign_off: resolvedSignOffTitle(s),
          name: s.name.trim().toUpperCase(),
          position: s.position.trim(),
          order_no: i + 1,
        })),
      });
      setSaved(true);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : "Failed to save APP settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748B] text-sm">Loading APP settings...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-600 text-sm">{loadError}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm rounded-lg border border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        title="APP Settings"
        subtitle={ppmpLabel || "Version and signatories for the generated APP."}
        onBack={() => navigate(-1)}
      />

      {generalError && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-700">
          {generalError}
        </div>
      )}
      {saveError && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {saved && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" strokeWidth={2} />
          APP settings saved.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 mb-5">
        <h2 className="text-base font-semibold text-[#0F172A] mb-4">Version</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <VersionOption
            label="Indicative"
            selected={versionType === "indicative"}
            onClick={() => setVersionType("indicative")}
          />
          <VersionOption
            label="Final"
            selected={versionType === "final"}
            onClick={() => setVersionType("final")}
          />
          <VersionOption
            label="Updated"
            selected={versionType === "updated"}
            onClick={() => setVersionType("updated")}
          />
        </div>
        {versionType === "updated" && (
          <div className="w-full sm:max-w-xs">
            <label className="text-sm text-[#334155] mb-1.5 block font-medium">
              Version No. <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass(!!versionNoError)}
              value={versionNo}
              onChange={(e) => {
                setVersionNo(e.target.value);
                if (e.target.value.trim()) setVersionNoError("");
              }}
              placeholder="e.g. 2"
            />
            {versionNoError && (
              <p className="text-sm text-red-600 mt-1">{versionNoError}</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[#0F172A] mb-1">
          Signatories
        </h2>
        <p className="text-sm text-[#64748B] mb-4">
          Everyone who signs off on this APP, in the order they appear on the
          printed document. Separate from the PPMP's own signatories.
        </p>

        <div className="space-y-3">
          {signatories.map((s, idx) => {
            const errs = signatoryErrors[s.id] || {};
            const canRemove = signatories.length > 1;
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
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => removeSignatory(s.id)}
                      className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="w-56">
                    <label className="text-sm text-[#334155] mb-1.5 block font-medium">
                      Sign-Off <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={inputClass(!!errs.sign_off)}
                      value={s.sign_off}
                      onChange={(e) => {
                        const val = e.target.value as SignatoryForm["sign_off"];
                        updateSignatory(s.id, "sign_off", val);
                        clearSignatoryError(s.id, "sign_off", val !== "Others");
                      }}
                    >
                      {SIGN_OFF_ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    {s.sign_off === "Others" && (
                      <input
                        className={`${inputClass(!!errs.sign_off)} mt-2`}
                        value={s.custom_sign_off}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateSignatory(s.id, "custom_sign_off", val);
                          clearSignatoryError(
                            s.id,
                            "sign_off",
                            val.trim().length > 0,
                          );
                        }}
                        placeholder="Specify sign-off title"
                      />
                    )}
                    {errs.sign_off && (
                      <p className="text-sm text-red-600 mt-1">
                        {errs.sign_off}
                      </p>
                    )}
                  </div>
                  <div className="w-60 max-w-full">
                    <label className="text-sm text-[#334155] mb-1.5 block font-medium">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`${inputClass(!!errs.name)} uppercase`}
                      value={s.name}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        updateSignatory(s.id, "name", val);
                        clearSignatoryError(
                          s.id,
                          "name",
                          val.trim().length > 0,
                        );
                      }}
                      placeholder="e.g. JUAN DELA CRUZ"
                    />
                    {errs.name && (
                      <p className="text-sm text-red-600 mt-1">{errs.name}</p>
                    )}
                  </div>
                  <div className="w-56 max-w-full">
                    <label className="text-sm text-[#334155] mb-1.5 block font-medium">
                      Position/Designation{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={inputClass(!!errs.position)}
                      value={s.position}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateSignatory(s.id, "position", val);
                        clearSignatoryError(
                          s.id,
                          "position",
                          val.trim().length > 0,
                        );
                      }}
                      placeholder="e.g. BAC Chairperson"
                    />
                    {errs.position && (
                      <p className="text-sm text-red-600 mt-1">
                        {errs.position}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addSignatory}
          className="w-full mt-3 inline-flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-[#7DD3FC] text-[#0284C7] text-sm font-medium rounded-xl hover:bg-[#E0F2FE] hover:border-[#0284C7] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Signatory
        </button>
      </div>

      <div className="flex justify-end mt-6">
        <LoadingButton
          onClick={handleSave}
          disabled={saving}
          busy={saving}
          busyLabel="Saving..."
          className="px-6 py-2.5 text-[15px] rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-medium transition shadow-sm disabled:opacity-50"
        >
          Save APP Settings
        </LoadingButton>
      </div>
      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
