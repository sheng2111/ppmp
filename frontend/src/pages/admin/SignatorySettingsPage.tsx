import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { ArrowLeft, ShieldAlert, FileText } from "lucide-react";
import { colors, font } from "./theme";
import { useToast } from "../../components/feedback/ToastProvider";
import { LoadingButton } from "../../components/feedback/LoadingButton";
import { SkeletonCard } from "../../components/feedback/Skeleton";
import { EmptyState } from "../../components/feedback/EmptyState";
import { useUnsavedChangesGuard } from "../../components/feedback/useUnsavedChangesGuard";
import { useConfirmState } from "../../components/feedback/useConfirm";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import PageHeader from "../../components/layout/PageHeader";

interface SignatorySettingsForm {
  campus_director_name: string;
  campus_director_designation: string;
  suc_president_name: string;
  suc_president_designation: string;
  bac_secretariat_chairman_name: string;
  bac_secretariat_chairman_designation: string;
  budget_officer_name: string;
  budget_officer_designation: string;
}

const EMPTY_FORM: SignatorySettingsForm = {
  campus_director_name: "",
  campus_director_designation: "",
  suc_president_name: "",
  suc_president_designation: "",
  bac_secretariat_chairman_name: "",
  bac_secretariat_chairman_designation: "",
  budget_officer_name: "",
  budget_officer_designation: "",
};

interface PPMPBudgetSignatory {
  sign_off: string;
  name: string;
  position: string;
  order_no: number;
}

interface APPSignatoryConfig {
  sign_off: string;
  name: string;
  position: string;
  order_no: number;
  enabled: boolean;
}

// PPMP sign-off roles (admin-configured only - excludes "Prepared By" which is user-controlled)
const PPMP_SIGN_OFF_ROLES = [
  "Checked & Reviewed by",
  "Noted by",
  "Approved by",
] as const;

// APP sign-off roles (admin-configured only - excludes "Prepared By" which is user-controlled)
const APP_SIGN_OFF_ROLES = [
  "Checked & Reviewed by",
  "Recommending Approval",
  "Approved by",
] as const;

// ── Shared style helpers — derived straight from the theme tokens so this
// page reads as one piece with Layout.tsx / LoginPage.tsx rather than a
// separately-styled screen ──────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  color: colors.text,
  background: "#FFFFFF",
};

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: `1px solid ${colors.border}`,
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs mb-1 block" style={{ color: colors.textMuted }}>
      {children}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs uppercase tracking-wide mb-2"
      style={{ color: colors.sectionLabel, fontWeight: 700 }}
    >
      {children}
    </p>
  );
}

function HelperText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs mb-3" style={{ color: colors.textFaint }}>
      {children}
    </p>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: colors.activeBg,
        border: `1px solid ${colors.activeBorder}`,
      }}
    >
      <p className="text-sm" style={{ color: colors.activeText }}>
        {children}
      </p>
    </div>
  );
}

export default function SignatorySettingsPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SignatorySettingsForm>(EMPTY_FORM);
  const [originalForm, setOriginalForm] = useState<SignatorySettingsForm>(EMPTY_FORM);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"pr" | "ppmp" | "app">("pr");

  // PPMP signatory state
  const [ppmpLowBudget, setPpmpLowBudget] = useState<PPMPBudgetSignatory[]>([]);
  const [originalPpmpLowBudget, setOriginalPpmpLowBudget] = useState<PPMPBudgetSignatory[]>([]);
  const [ppmpHighBudget, setPpmpHighBudget] = useState<PPMPBudgetSignatory[]>(
    [],
  );
  const [originalPpmpHighBudget, setOriginalPpmpHighBudget] = useState<PPMPBudgetSignatory[]>(
    [],
  );
  const [savingPPMP, setSavingPPMP] = useState(false);

  // APP signatory state
  const [appSignatories, setAppSignatories] = useState<APPSignatoryConfig[]>(
    [],
  );
  const [originalAppSignatories, setOriginalAppSignatories] = useState<APPSignatoryConfig[]>(
    [],
  );
  const [savingAPP, setSavingAPP] = useState(false);

  // Dirty tracking per tab
  const prDirty = JSON.stringify(form) !== JSON.stringify(originalForm);
  const ppmpDirty =
    JSON.stringify(ppmpLowBudget) !== JSON.stringify(originalPpmpLowBudget) ||
    JSON.stringify(ppmpHighBudget) !== JSON.stringify(originalPpmpHighBudget);
  const appDirty = JSON.stringify(appSignatories) !== JSON.stringify(originalAppSignatories);

  const currentTabDirty =
    activeTab === "pr" ? prDirty : activeTab === "ppmp" ? ppmpDirty : appDirty;
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmState();
  const { guardNavigation } = useUnsavedChangesGuard(currentTabDirty, confirm);

  useEffect(() => {
    Promise.all([
      api.get("/settings/signatories"),
      api.get("/settings/signatories/ppmp"),
      api.get("/settings/signatories/app"),
    ])
      .then(([prRes, ppmpRes, appRes]) => {
        const {
          campus_director_name,
          campus_director_designation,
          suc_president_name,
          suc_president_designation,
          bac_secretariat_chairman_name,
          bac_secretariat_chairman_designation,
          budget_officer_name,
          budget_officer_designation,
          updated_at,
        } = prRes.data;
        const loadedForm = {
          campus_director_name,
          campus_director_designation,
          suc_president_name,
          suc_president_designation,
          bac_secretariat_chairman_name,
          bac_secretariat_chairman_designation,
          budget_officer_name,
          budget_officer_designation,
        };
        setForm(loadedForm);
        setOriginalForm(loadedForm);
        setUpdatedAt(updated_at || null);

        // PPMP signatories
        const loadedPpmpLow = (ppmpRes.data.low_budget || []).filter(
          (s: PPMPBudgetSignatory) =>
            s.sign_off.toLowerCase() !== "prepared by",
        );
        const loadedPpmpHigh = (ppmpRes.data.high_budget || []).filter(
          (s: PPMPBudgetSignatory) =>
            s.sign_off.toLowerCase() !== "prepared by",
        );
        setPpmpLowBudget(loadedPpmpLow);
        setOriginalPpmpLowBudget(loadedPpmpLow);
        setPpmpHighBudget(loadedPpmpHigh);
        setOriginalPpmpHighBudget(loadedPpmpHigh);

        // APP signatories
        const loadedApp = (appRes.data.signatories || []).filter(
          (s: APPSignatoryConfig) =>
            s.sign_off.toLowerCase() !== "prepared by",
        );
        setAppSignatories(loadedApp);
        setOriginalAppSignatories(loadedApp);
      })
      .catch(() => toast.error("Could not load signatory settings."))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (field: keyof SignatorySettingsForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canSave = (
    Object.keys(EMPTY_FORM) as (keyof SignatorySettingsForm)[]
  ).every((field) => form[field].trim().length > 0);

  const handleSave = async () => {
    if (!canSave) {
      toast.error("All fields are required.");
      return;
    }
    setSaving(true);
    try {
      const trimmed = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim()]),
      ) as SignatorySettingsForm;
      const res = await api.put("/settings/signatories", trimmed, {
        params: { updated_by: dbUser?.id },
      });
      setUpdatedAt(res.data.updated_at || null);
      setOriginalForm({ ...form });
      toast.success(
        "Saved. New Purchase Requests will use these names immediately — existing PRs are unaffected.",
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to save signatory settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  // PPMP signatory handlers
  const updatePPMPLowBudget = (
    index: number,
    field: keyof PPMPBudgetSignatory,
    value: string | number,
  ) => {
    setPpmpLowBudget((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const updatePPMPHighBudget = (
    index: number,
    field: keyof PPMPBudgetSignatory,
    value: string | number,
  ) => {
    setPpmpHighBudget((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const handleSavePPMP = async () => {
    setSavingPPMP(true);
    try {
      await api.put(
        "/settings/signatories/ppmp",
        {
          low_budget: ppmpLowBudget,
          high_budget: ppmpHighBudget,
        },
        { params: { updated_by: dbUser?.id } },
      );
      setOriginalPpmpLowBudget([...ppmpLowBudget]);
      setOriginalPpmpHighBudget([...ppmpHighBudget]);
      toast.success("PPMP signatory settings saved successfully.");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to save PPMP signatory settings.",
      );
    } finally {
      setSavingPPMP(false);
    }
  };

  // APP signatory handlers
  const updateAPPSignatory = (
    index: number,
    field: keyof APPSignatoryConfig,
    value: string | boolean | number,
  ) => {
    setAppSignatories((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const handleSaveAPP = async () => {
    setSavingAPP(true);
    try {
      await api.put(
        "/settings/signatories/app",
        {
          signatories: appSignatories,
        },
        { params: { updated_by: dbUser?.id } },
      );
      setOriginalAppSignatories([...appSignatories]);
      toast.success("APP signatory settings saved successfully.");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Failed to save APP signatory settings.",
      );
    } finally {
      setSavingAPP(false);
    }
  };

  if (dbUser?.role !== "admin") {
    return (
      <div
        className="max-w-lg mx-auto mt-16 text-center"
        style={{ fontFamily: font.stack }}
      >
        <ShieldAlert
          className="w-10 h-10 mx-auto mb-3"
          style={{ color: colors.textFaint }}
        />
        <h1 className="text-lg font-semibold" style={{ color: colors.text }}>
          Admins only
        </h1>
        <p className="text-sm mt-1" style={{ color: colors.textMuted }}>
          Only an admin can view or change signatory settings.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: colors.textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = colors.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24" style={{ fontFamily: font.stack }}>
      {/* ── Header — same gradient block treatment as the sidebar header ── */}
      <PageHeader
        title="Signatory Settings"
        subtitle="Manage signatory names for PR, PPMP, and APP documents."
        onBack={() => navigate(-1)}
      />

      {/* Tab Navigation */}
      <div
        className="flex mb-6"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        {(
          [
            { key: "pr", label: "Purchase Request (PR)" },
            { key: "ppmp", label: "PPMP" },
            { key: "app", label: "APP" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                // Guard against switching tabs with unsaved changes
                const currentDirty =
                  activeTab === "pr"
                    ? prDirty
                    : activeTab === "ppmp"
                      ? ppmpDirty
                      : appDirty;
                if (currentDirty && !guardNavigation()) return;
                setActiveTab(tab.key);
              }}
              className="px-6 py-3 text-sm font-medium transition-colors"
              style={{
                borderBottom: `2px solid ${isActive ? colors.activeBorder : "transparent"}`,
                color: isActive ? colors.activeText : colors.textMuted,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {/* PR Tab */}
          {activeTab === "pr" && (
            <div className="rounded-xl p-5 space-y-6" style={cardStyle}>
              <div>
                <SectionLabel>Campus Director</SectionLabel>
                <HelperText>
                  Used as "Approved By" for PRs under ₱50,000, and as "Requested
                  By" for PRs of ₱50,000 or more.
                </HelperText>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{
                        ...inputStyle,
                        ["--tw-ring-color" as any]: `${colors.primary}66`,
                      }}
                      value={form.campus_director_name}
                      onChange={(e) =>
                        updateField("campus_director_name", e.target.value)
                      }
                      placeholder="e.g. Ariston O. Ronquillo, DM"
                    />
                  </div>
                  <div>
                    <FieldLabel>Designation</FieldLabel>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{
                        ...inputStyle,
                        ["--tw-ring-color" as any]: `${colors.primary}66`,
                      }}
                      value={form.campus_director_designation}
                      onChange={(e) =>
                        updateField(
                          "campus_director_designation",
                          e.target.value,
                        )
                      }
                      placeholder="e.g. Campus Director"
                    />
                  </div>
                </div>
              </div>

              <div>
                <SectionLabel>SUC President</SectionLabel>
                <HelperText>
                  Used as "Approved By" for PRs of ₱50,000 or more.
                </HelperText>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{
                        ...inputStyle,
                        ["--tw-ring-color" as any]: `${colors.primary}66`,
                      }}
                      value={form.suc_president_name}
                      onChange={(e) =>
                        updateField("suc_president_name", e.target.value)
                      }
                      placeholder="e.g. Nemesio G. Loayon, PhD"
                    />
                  </div>
                  <div>
                    <FieldLabel>Designation</FieldLabel>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{
                        ...inputStyle,
                        ["--tw-ring-color" as any]: `${colors.primary}66`,
                      }}
                      value={form.suc_president_designation}
                      onChange={(e) =>
                        updateField("suc_president_designation", e.target.value)
                      }
                      placeholder="e.g. SUC President III"
                    />
                  </div>
                </div>
              </div>

              <div>
                <SectionLabel>BAC Secretariat Chairman</SectionLabel>
                <HelperText>
                  Always shown below every PR, regardless of amount.
                </HelperText>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{
                        ...inputStyle,
                        ["--tw-ring-color" as any]: `${colors.primary}66`,
                      }}
                      value={form.bac_secretariat_chairman_name}
                      onChange={(e) =>
                        updateField(
                          "bac_secretariat_chairman_name",
                          e.target.value,
                        )
                      }
                      placeholder="e.g. Nestle R. Amuray"
                    />
                  </div>
                  <div>
                    <FieldLabel>Designation</FieldLabel>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{
                        ...inputStyle,
                        ["--tw-ring-color" as any]: `${colors.primary}66`,
                      }}
                      value={form.bac_secretariat_chairman_designation}
                      onChange={(e) =>
                        updateField(
                          "bac_secretariat_chairman_designation",
                          e.target.value,
                        )
                      }
                      placeholder="e.g. BAC Secretariat Chairman"
                    />
                  </div>
                </div>
              </div>

              <div>
                <SectionLabel>Budget Officer</SectionLabel>
                <HelperText>
                  Shown under "Appropriation of Allotment", always on every PR.
                </HelperText>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{
                        ...inputStyle,
                        ["--tw-ring-color" as any]: `${colors.primary}66`,
                      }}
                      value={form.budget_officer_name}
                      onChange={(e) =>
                        updateField("budget_officer_name", e.target.value)
                      }
                      placeholder="e.g. Darlene Abigail T. Dabalos"
                    />
                  </div>
                  <div>
                    <FieldLabel>Designation</FieldLabel>
                    <input
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{
                        ...inputStyle,
                        ["--tw-ring-color" as any]: `${colors.primary}66`,
                      }}
                      value={form.budget_officer_designation}
                      onChange={(e) =>
                        updateField(
                          "budget_officer_designation",
                          e.target.value,
                        )
                      }
                      placeholder="e.g. Designate, Budget Officer"
                    />
                  </div>
                </div>
              </div>

              <div
                className="flex items-center justify-between pt-4"
                style={{ borderTop: `1px solid ${colors.border}` }}
              >
                <p className="text-xs" style={{ color: colors.textFaint }}>
                  {updatedAt
                    ? `Last updated ${new Date(updatedAt).toLocaleString("en-PH")}`
                    : ""}
                </p>
                <LoadingButton
                  onClick={handleSave}
                  disabled={!canSave}
                  busy={saving}
                  busyLabel="Saving..."
                >
                  Save changes
                </LoadingButton>
              </div>
            </div>
          )}

          {/* PPMP Tab */}
          {activeTab === "ppmp" && (
            <div className="space-y-6">
              <InfoBanner>
                <strong>Note:</strong> "Prepared By" is automatically populated
                from the current user's name and is always the first signatory.
                Only configure the signatories below.
              </InfoBanner>
              {/* Budget <= ₱100,000 */}
              <div className="rounded-xl p-5" style={cardStyle}>
                <div className="mb-4">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: colors.text }}
                  >
                    Budget ₱100,000 and Below
                  </h3>
                  <p
                    className="text-xs mt-1"
                    style={{ color: colors.textFaint }}
                  >
                    Signatory structure for PPMPs with total budget of ₱100,000
                    or less. (Prepared By + 2 signatories below)
                  </p>
                </div>
                {ppmpLowBudget.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="w-8 h-8" style={{ color: colors.textFaint }} />}
                    title="No low-budget signatories"
                    description="No signatory roles have been configured for low-budget PPMPs yet."
                  />
                ) : (
                  <div className="space-y-3">
                    {ppmpLowBudget.map((sig, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: colors.fieldBg }}
                      >
                        <div className="w-8 text-center">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: colors.textFaint }}
                          >
                            {sig.order_no}
                          </span>
                        </div>
                        <div className="w-48">
                          <FieldLabel>Sign-Off</FieldLabel>
                          <select
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.sign_off}
                            onChange={(e) =>
                              updatePPMPLowBudget(
                                index,
                                "sign_off",
                                e.target.value,
                              )
                            }
                          >
                            {PPMP_SIGN_OFF_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <FieldLabel>Position</FieldLabel>
                          <input
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.position}
                            onChange={(e) =>
                              updatePPMPLowBudget(
                                index,
                                "position",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. Fund Coordinator"
                          />
                        </div>
                        <div className="flex-1">
                          <FieldLabel>Name (Admin-configured)</FieldLabel>
                          <input
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.name}
                            onChange={(e) =>
                              updatePPMPLowBudget(index, "name", e.target.value)
                            }
                            placeholder="e.g. Juan Dela Cruz"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Budget >= ₱100,001 */}
              <div className="rounded-xl p-5" style={cardStyle}>
                <div className="mb-4">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: colors.text }}
                  >
                    Budget ₱100,001 and Above
                  </h3>
                  <p
                    className="text-xs mt-1"
                    style={{ color: colors.textFaint }}
                  >
                    Signatory structure for PPMPs with total budget of ₱100,001
                    or more. (Prepared By + 3 signatories below)
                  </p>
                </div>
                {ppmpHighBudget.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="w-8 h-8" style={{ color: colors.textFaint }} />}
                    title="No high-budget signatories"
                    description="No signatory roles have been configured for high-budget PPMPs yet."
                  />
                ) : (
                  <div className="space-y-3">
                    {ppmpHighBudget.map((sig, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: colors.fieldBg }}
                      >
                        <div className="w-8 text-center">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: colors.textFaint }}
                          >
                            {sig.order_no}
                          </span>
                        </div>
                        <div className="w-48">
                          <FieldLabel>Sign-Off</FieldLabel>
                          <select
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.sign_off}
                            onChange={(e) =>
                              updatePPMPHighBudget(
                                index,
                                "sign_off",
                                e.target.value,
                              )
                            }
                          >
                            {PPMP_SIGN_OFF_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <FieldLabel>Position</FieldLabel>
                          <input
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.position}
                            onChange={(e) =>
                              updatePPMPHighBudget(
                                index,
                                "position",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. Fund Coordinator"
                          />
                        </div>
                        <div className="flex-1">
                          <FieldLabel>Name (Admin-configured)</FieldLabel>
                          <input
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.name}
                            onChange={(e) =>
                              updatePPMPHighBudget(index, "name", e.target.value)
                            }
                            placeholder="e.g. Juan Dela Cruz"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <LoadingButton
                  onClick={handleSavePPMP}
                  busy={savingPPMP}
                  busyLabel="Saving..."
                >
                  Save PPMP Settings
                </LoadingButton>
              </div>
            </div>
          )}

          {/* APP Tab */}
          {activeTab === "app" && (
            <div className="space-y-6">
              <InfoBanner>
                <strong>Note:</strong> "Prepared By" is automatically populated
                from the current user's name and is always the first signatory.
                Only configure the signatories below.
              </InfoBanner>
              <div className="rounded-xl p-5" style={cardStyle}>
                <div className="mb-4">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: colors.text }}
                  >
                    APP Signatories
                  </h3>
                  <p
                    className="text-xs mt-1"
                    style={{ color: colors.textFaint }}
                  >
                    Configure signatory names for the Annual Procurement Plan.
                    (Prepared By + signatories below)
                  </p>
                </div>
                {appSignatories.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="w-8 h-8" style={{ color: colors.textFaint }} />}
                    title="No APP signatories"
                    description="No signatory roles have been configured for the APP yet."
                  />
                ) : (
                  <div className="space-y-3">
                    {appSignatories.map((sig, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{
                          background: colors.fieldBg,
                          opacity: sig.enabled ? 1 : 0.6,
                        }}
                      >
                        <div className="w-8 text-center">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: colors.textFaint }}
                          >
                            {sig.order_no}
                          </span>
                        </div>
                        <div className="w-48">
                          <FieldLabel>Sign-Off</FieldLabel>
                          <select
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.sign_off}
                            onChange={(e) =>
                              updateAPPSignatory(
                                index,
                                "sign_off",
                                e.target.value,
                              )
                            }
                          >
                            {APP_SIGN_OFF_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <FieldLabel>Position</FieldLabel>
                          <input
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.position}
                            onChange={(e) =>
                              updateAPPSignatory(
                                index,
                                "position",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. BAC Chairperson"
                          />
                        </div>
                        <div className="flex-1">
                          <FieldLabel>Name (Admin-configured)</FieldLabel>
                          <input
                            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{
                              ...inputStyle,
                              ["--tw-ring-color" as any]: `${colors.primary}66`,
                            }}
                            value={sig.name}
                            onChange={(e) =>
                              updateAPPSignatory(index, "name", e.target.value)
                            }
                            placeholder="e.g. Juan Dela Cruz"
                            disabled={sig.sign_off === "Prepared by"}
                          />
                        </div>
                        <div className="w-20">
                          <FieldLabel>Enabled</FieldLabel>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={sig.enabled}
                              onChange={(e) =>
                                updateAPPSignatory(
                                  index,
                                  "enabled",
                                  e.target.checked,
                                )
                              }
                            />
                            <div
                              className="w-9 h-5 rounded-full peer transition-colors peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"
                              style={{
                                background: sig.enabled
                                  ? colors.primary
                                  : "#E2E8F0",
                                borderColor: colors.border,
                              }}
                            ></div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <LoadingButton
                  onClick={handleSaveAPP}
                  busy={savingAPP}
                  busyLabel="Saving..."
                >
                  Save APP Settings
                </LoadingButton>
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
