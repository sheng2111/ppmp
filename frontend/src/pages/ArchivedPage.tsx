import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/feedback/ToastProvider";
import { useConfirmState } from "../components/feedback/useConfirm";
import { ConfirmDialog } from "../components/feedback/ConfirmDialog";
import { SkeletonRow } from "../components/feedback/Skeleton";
import PageHeader from "../components/layout/PageHeader";
import type { PPMP } from "../types";

export default function ArchivedPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmState();

  const [ppmps, setPpmps] = useState<PPMP[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArchived = () => {
    if (!dbUser?.id) return;
    setLoading(true);
    api
      .get("/ppmps/", {
        params: {
          created_by: dbUser.id,
          is_archived: true,
        },
      })
      .then((res) => setPpmps(res.data || []))
      .catch((err) => {
        console.error("Failed to fetch archived PPMPs:", err);
        setPpmps([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchArchived();
  }, [dbUser]);

  // Defensive: some older/legacy PPMP documents may be missing `projects`
  // or individual `lots` arrays. Guard against both so a single malformed
  // record can't crash the whole list.
  const projectCount = (ppmp: PPMP) => (ppmp.projects || []).length;

  const totalBudget = (ppmp: PPMP) =>
    (ppmp.projects || []).reduce(
      (sum, p) =>
        sum + (p.lots || []).reduce((s, l) => s + (l.estimated_budget || 0), 0),
      0,
    );

  const handleRestore = async (
    e: React.MouseEvent,
    ppmpId: number | string,
  ) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Restore PPMP",
      description: "This PPMP will be moved back to your active list.",
      confirmLabel: "Restore",
      tone: "warning",
    });
    if (!confirmed) return;
    try {
      await api.put(`/ppmps/${ppmpId}/unarchive`);
      toast.success("PPMP restored successfully.");
      fetchArchived();
    } catch (err) {
      console.error("Failed to restore PPMP:", err);
      toast.error("Failed to restore PPMP. Please try again.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Archived PPMPs"
        subtitle="PPMPs you've archived. Restore any of these if you need to work on them again."
      />

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <SkeletonRow key={i} columns={3} />
          ))}
        </div>
      ) : ppmps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm">
            No archived PPMPs yet. Archived PPMPs will show up here.
          </p>
          <button
            onClick={() => navigate("/ppmps")}
            className="mt-4 text-sm text-blue-700 hover:underline"
          >
            ← Back to My PPMPs
          </button>
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
                <div className="bg-amber-50 text-amber-700 font-semibold text-sm px-3 py-2 rounded-lg">
                  FY {ppmp.year}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    PPMP No. {ppmp.ppmp_no} —{" "}
                    <span className="capitalize">{ppmp.ppmp_type}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {projectCount(ppmp)} project
                    {projectCount(ppmp) !== 1 ? "s" : ""} · ₱
                    {totalBudget(ppmp).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                  archived
                </span>
                <button
                  onClick={(e) => handleRestore(e, ppmp.id)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Restore
                </button>
                <span className="text-gray-300">›</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
