import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/feedback/ToastProvider";
import { EmptyState } from "../../components/feedback/EmptyState";
import { SkeletonRow } from "../../components/feedback/Skeleton";
import PageHeader from "../../components/layout/PageHeader";

interface PRLotItem {
  ppmp_entry_id: string;
  ppmp_item_id: string;
  item_name: string;
  unit: string;
  unit_price: number;
  requested_quantity: number;
  assigned_lot: string;
  total_cost: number;
}

interface PRLot {
  label: string;
  items: PRLotItem[];
}

interface PR {
  id: string;
  ppmp_id: string;
  ppmp_no: string | null;
  pr_number: string;
  date: string;
  status: string;
  items: PRLotItem[];
  lots: PRLot[];
  grand_total: number;
  created_at: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

export default function PRListPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbUser?.id) return;
    setLoading(true);
    api
      .get("/prs/", { params: { created_by: dbUser.id } })
      .then((res) => setPrs(res.data))
      .catch((err) => {
        toast.error(
          err.response?.data?.detail || "Could not load purchase requests.",
        );
      })
      .finally(() => setLoading(false));
  }, [dbUser]);

  return (
    <div>
      <PageHeader
        title="Purchase Requests"
        subtitle="Purchase requests you've created"
        actions={
          <button
            onClick={() => navigate("/prs/create")}
            className="bg-white text-sky-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition shadow-sm"
          >
            + Create PR
          </button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow columns={4} />
          <SkeletonRow columns={4} />
          <SkeletonRow columns={4} />
        </div>
      ) : prs.length === 0 ? (
        <EmptyState
          title="No purchase requests yet"
          description="Create your first PR to get started."
          action={{
            label: "Create your first PR",
            onClick: () => navigate("/prs/create"),
          }}
        />
      ) : (
        <div className="space-y-3">
          {prs.map((pr) => {
            const lots = pr.lots.length;
            const items = pr.items.length;
            return (
              <div
                key={pr.id}
                onClick={() => navigate(`/prs/${pr.id}`)}
                className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 text-blue-700 font-semibold text-sm px-3 py-2 rounded-lg">
                    PR
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {pr.pr_number || `PR #${pr.id}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {lots} lot{lots !== 1 ? "s" : ""} · {items} item
                      {items !== 1 ? "s" : ""} · ₱{fmt(pr.grand_total)}
                    </p>
                    {pr.ppmp_no && (
                      <p className="text-xs text-gray-400 truncate max-w-md">
                        From {pr.ppmp_no}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                      pr.status === "draft"
                        ? "bg-gray-100 text-gray-600"
                        : pr.status === "submitted"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {pr.status}
                  </span>
                  <span className="text-gray-300">›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
