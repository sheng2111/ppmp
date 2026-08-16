import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileSpreadsheet,
  Archive as ArchiveIcon,
  RotateCcw,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/feedback/ToastProvider";
import { useConfirmState } from "../../components/feedback/useConfirm";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { EmptyState } from "../../components/feedback/EmptyState";
import { SkeletonRow } from "../../components/feedback/Skeleton";
import type { PPMP } from "../../types";
// NOTE: assumed path — same folder depth as AdminDashboardPage.tsx, which
// imports theme.ts from ./theme while sitting in src/pages/admin/. If this
// file doesn't actually live in a sibling folder to admin/, update this
// import accordingly.
import { colors, gradients, font } from "../admin/theme";
import PageHeader from "../../components/layout/PageHeader";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-amber-100 text-amber-700",
};

// "My PPMP" — always scoped to the logged-in user's own submissions,
// regardless of role. Admins get the cross-office view on a separate page
// (OfficesPPMPListPage, mounted at /admin/offices-ppmp) instead of here.
export default function PPMPListPage() {
  const { dbUser, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } =
    useConfirmState();
  const [archiving, setArchiving] = useState(false);
  const [unsubmitting, setUnsubmitting] = useState(false);

  const [ppmps, setPpmps] = useState<PPMP[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPpmps = () => {
    if (!dbUser?.id) return;
    setLoading(true);

    // The backend already excludes archived PPMPs by default, so this list
    // only ever shows active ones — archived PPMPs live on their own page.
    //
    // requester_uid (the Supabase auth id, NOT dbUser.id) is required
    // alongside created_by: the backend's draft-visibility rule
    // (_can_view_ppmp in app/routers/ppmps.py) only shows a draft PPMP to
    // its own creator or an admin, and it resolves "who's asking" from
    // requester_uid, not from created_by. Without it, my_id never
    // resolves and every draft PPMP — including ones this user just
    // created — gets filtered out of their own list, even though
    // created_by correctly scoped the query to them.
    api
      .get("/ppmps/", {
        params: { created_by: dbUser.id, requester_uid: user?.id },
      })
      .then((res) => setPpmps(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPpmps();
  }, [dbUser, user]);

  // The backend already computes total_budget per project (summed from that
  // project's entries) in _build_projects(), so we just add those up rather
  // than recomputing from entries/items on the client. This used to read
  // `p.lots`, which no longer exists now that lots were renamed to entries
  // on the backend.
  const totalBudget = (ppmp: PPMP) =>
    ppmp.projects.reduce((sum, p) => sum + (p.total_budget || 0), 0);

  const handleArchive = async (e: React.MouseEvent, ppmpId: string) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Archive PPMP",
      description:
        "Archive this PPMP? You can restore it later from the Archived page.",
      confirmLabel: "Archive",
      tone: "danger",
    });
    if (!confirmed) return;
    setArchiving(true);
    try {
      await api.put(`/ppmps/${ppmpId}/archive`);
      toast.success("PPMP archived successfully.");
      fetchPpmps();
    } catch {
      toast.error("Failed to archive PPMP. Please try again.");
    } finally {
      setArchiving(false);
    }
  };

  const handleUnsubmit = async (e: React.MouseEvent, ppmp: PPMP) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Revert to Draft",
      description:
        "Reverting this PPMP to draft will remove it from the consolidated PPMP and APP views. Are you sure?",
      confirmLabel: "Revert to Draft",
      tone: "danger",
    });
    if (!confirmed) return;
    setUnsubmitting(true);
    try {
      await api.put(`/ppmps/${ppmp.id}/unsubmit`, null, {
        params: { requester_uid: user?.id },
      });
      toast.success("PPMP reverted to draft.");
      fetchPpmps();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        "Failed to revert PPMP. Please try again.";
      toast.error(msg);
    } finally {
      setUnsubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: font.stack }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="My PPMPs"
        subtitle="Project Procurement Management Plans you've created"
        actions={
          <button
            onClick={() => navigate("/ppmps/create")}
            className="inline-flex items-center gap-1.5 bg-white text-sky-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-50 transition shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create PPMP
          </button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonRow key={i} columns={4} />
          ))}
        </div>
      ) : ppmps.length === 0 ? (
        <EmptyState
          title="No PPMPs yet"
          description="Create your first Project Procurement Management Plan to get started."
          action={{
            label: "Create your first PPMP",
            onClick: () => navigate("/ppmps/create"),
          }}
        />
      ) : (
        <div className="space-y-3">
          {ppmps.map((ppmp) => (
            <div
              key={ppmp.id}
              onClick={() => navigate(`/ppmps/${ppmp.id}`)}
              className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between cursor-pointer hover:border-sky-300 hover:shadow-sm transition"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="font-semibold text-sm px-3 py-2 rounded-lg"
                  style={{ background: colors.activeBg, color: colors.heading }}
                >
                  FY {ppmp.year}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    PPMP No. {ppmp.ppmp_no} —{" "}
                    <span className="capitalize">{ppmp.ppmp_type}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(ppmp as any).office_name || "Unknown Office"} · {(ppmp as any).fee_category || "No Fee Category"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[ppmp.status]}`}
                >
                  {ppmp.status}
                </span>
                {ppmp.status === "submitted" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/app?ppmpId=${ppmp.id}`);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-colors"
                    style={{
                      background: colors.activeBg,
                      color: colors.heading,
                    }}
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    Generate APP
                  </button>
                )}
                <button
                  onClick={(e) => handleArchive(e, ppmp.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-colors"
                  style={{
                    background: colors.warningBg,
                    color: colors.warning,
                  }}
                >
                  <ArchiveIcon className="w-3 h-3" />
                  Archive
                </button>
                {ppmp.status === "submitted" && (
                  <button
                    onClick={(e) => handleUnsubmit(e, ppmp)}
                    disabled={unsubmitting}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-40"
                    style={{ background: "#F1F5F9", color: "#475569" }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Revert to Draft
                  </button>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        processing={archiving || unsubmitting}
      />
    </div>
  );
}
