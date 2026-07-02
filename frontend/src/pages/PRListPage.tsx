import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

interface PR {
  id: number;
  pr_number: string | null;
  purpose: string | null;
  status: string;
  requested_date: string | null;
  created_at: string;
  items: any[];
}

export default function PRListPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbUser?.id) return;
    api
      .get("/prs/", { params: { created_by: dbUser.id } })
      .then((res) => setPrs(res.data))
      .finally(() => setLoading(false));
  }, [dbUser]);

  const grandTotal = (pr: PR) =>
    pr.items.reduce(
      (sum: number, i: any) => sum + i.quantity * i.unit_price,
      0,
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">
            Purchase Requests
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Purchase requests you've created
          </p>
        </div>
        <button
          onClick={() => navigate("/prs/create")}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition"
        >
          + Create PR
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : prs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm">No purchase requests yet.</p>
          <button
            onClick={() => navigate("/prs/create")}
            className="mt-4 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition"
          >
            Create your first PR
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {prs.map((pr) => (
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
                    {pr.items.length} item{pr.items.length !== 1 ? "s" : ""} · ₱
                    {grandTotal(pr).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  {pr.purpose && (
                    <p className="text-xs text-gray-400 truncate max-w-md">
                      {pr.purpose}
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
          ))}
        </div>
      )}
    </div>
  );
}
