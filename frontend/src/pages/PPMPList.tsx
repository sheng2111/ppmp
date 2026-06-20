import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

interface PPMPItem {
  id: number;
  general_description: string;
  total_cost: number;
}

interface PPMP {
  id: number;
  year: string;
  header: {
    end_user_unit: string;
    charged_to: string;
    pap: string;
    date: string;
    revision: string;
  };
  items: PPMPItem[];
  created_at: string;
}

// --- Icons ---
const IconEdit = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const IconEye = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const IconDelete = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const IconPlus = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const IconFolder = () => (
  <svg
    className="w-12 h-12"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

const PPMPList: React.FC = () => {
  const navigate = useNavigate();
  const [ppmps, setPpmps] = useState<PPMP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPPMPs();
  }, []);

  const fetchPPMPs = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/ppmp");
      setPpmps(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Could not load PPMPs. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await API.delete(`/ppmp/${id}`);
      setPpmps((prev) => prev.filter((p) => p.id !== id));
      setDeleteId(null);
    } catch {
      setError("Failed to delete PPMP.");
    }
  };

  const getTotal = (ppmp: PPMP) =>
    (ppmp.items || []).reduce((sum, item) => sum + (item.total_cost || 0), 0);

  const filtered = ppmps.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.header?.end_user_unit?.toLowerCase().includes(q) ||
      p.year?.includes(q) ||
      p.header?.charged_to?.toLowerCase().includes(q) ||
      p.header?.pap?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div
        className="rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
        }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-white opacity-10 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-widest font-semibold">
              Electronic Procurement Management System
            </p>
            <h1 className="text-xl font-bold mt-1">All PPMPs</h1>
            <p className="text-blue-200 text-sm mt-1">
              {ppmps.length} procurement plan{ppmps.length !== 1 ? "s" : ""}{" "}
              found
            </p>
          </div>
          <button
            onClick={() => navigate("/ppmp/new")}
            className="flex items-center gap-2 text-xs font-bold bg-white text-blue-900 px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <IconPlus />
            Create New
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by department, year, fund source, or PAP..."
          className="w-full text-sm focus:outline-none text-gray-700 placeholder-gray-400"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-16">
          <div className="text-blue-200 mb-3">
            <IconFolder />
          </div>
          <p className="text-gray-400 text-sm mb-4">
            {search ? "No PPMPs match your search." : "No PPMPs yet."}
          </p>
          {!search && (
            <button
              onClick={() => navigate("/ppmp/new")}
              className="flex items-center gap-2 text-xs font-bold text-white px-6 py-2.5 rounded-xl"
              style={{ background: "linear-gradient(90deg, #1e3a6e, #1a56a0)" }}
            >
              <IconPlus />
              Create Your First PPMP
            </button>
          )}
        </div>
      )}

      {/* PPMP Cards */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((ppmp) => {
            const total = getTotal(ppmp);
            const itemCount = (ppmp.items || []).length;
            return (
              <div
                key={ppmp.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex items-center justify-between px-6 py-4">
                  {/* Left Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Year Badge */}
                    <div
                      className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #1e3a6e, #2471c8)",
                      }}
                    >
                      <span className="text-xs font-bold leading-none">
                        {ppmp.year?.slice(2) || "??"}
                      </span>
                      <span className="text-[9px] opacity-70 mt-0.5">FY</span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 text-sm truncate">
                        {ppmp.header?.end_user_unit || "No Unit"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-semibold border border-blue-100">
                          {ppmp.header?.charged_to || "STF"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {itemCount} item{itemCount !== 1 ? "s" : ""}
                        </span>
                        {ppmp.header?.pap && (
                          <span className="text-xs text-gray-400 truncate max-w-xs">
                            • {ppmp.header.pap}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right — Total + Actions */}
                  <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase tracking-wider">
                        Total
                      </p>
                      <p className="font-bold text-blue-800 text-sm">
                        ₱
                        {total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/ppmp/${ppmp.id}`)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition"
                        title="View"
                      >
                        <IconEye />
                      </button>
                      <button
                        onClick={() => navigate(`/ppmp/${ppmp.id}/edit`)}
                        className="p-2 text-gray-500 hover:bg-gray-50 rounded-xl transition"
                        title="Edit"
                      >
                        <IconEdit />
                      </button>
                      <button
                        onClick={() => setDeleteId(ppmp.id)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition"
                        title="Delete"
                      >
                        <IconDelete />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <IconDelete />
            </div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">
              Delete PPMP?
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              This action cannot be undone. All items in this PPMP will also be
              deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PPMPList;
