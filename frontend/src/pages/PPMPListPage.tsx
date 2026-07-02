import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { PPMP } from "../types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

interface Office {
  id: number;
  name: string;
  code: string;
}

export default function PPMPListPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = dbUser?.role === "admin";

  const [ppmps, setPpmps] = useState<PPMP[]>([]);
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<Office[]>([]);

  // Admin filters
  const [filterOfficeId, setFilterOfficeId] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

  useEffect(() => {
    if (isAdmin) {
      api.get("/offices/").then((res) => setOffices(res.data));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!dbUser?.id) return;
    setLoading(true);

    const params: Record<string, any> = {};
    if (isAdmin) {
      if (filterOfficeId) params.office_id = Number(filterOfficeId);
      if (filterYear) params.year = Number(filterYear);
    } else {
      params.created_by = dbUser.id;
    }

    api
      .get("/ppmps/", { params })
      .then((res) => setPpmps(res.data))
      .finally(() => setLoading(false));
  }, [dbUser, filterOfficeId, filterYear]);

  const totalBudget = (ppmp: PPMP) =>
    ppmp.projects.reduce((sum, p) => sum + (p.total_budget || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">
            {isAdmin ? "All PPMPs" : "My PPMPs"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin
              ? "View all procurement plans across all offices"
              : "Project Procurement Management Plans you've created"}
          </p>
        </div>
        {!isAdmin && (
          <button
            onClick={() => navigate("/ppmps/create")}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition"
          >
            + Create PPMP
          </button>
        )}
      </div>

      {/* Admin filters */}
      {isAdmin && (
        <div className="flex gap-3 mb-5">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterOfficeId}
            onChange={(e) => setFilterOfficeId(e.target.value)}
          >
            <option value="">All Offices</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            <option value="">All Years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                FY {y}
              </option>
            ))}
          </select>
          {(filterOfficeId || filterYear) && (
            <button
              onClick={() => {
                setFilterOfficeId("");
                setFilterYear("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              Clear filters
            </button>
          )}
          <span className="text-xs text-gray-400 self-center ml-auto">
            {ppmps.length} PPMP{ppmps.length !== 1 ? "s" : ""} found
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : ppmps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-gray-400 text-sm">
            {isAdmin
              ? "No PPMPs found for the selected filters."
              : "No PPMPs yet."}
          </p>
          {!isAdmin && (
            <button
              onClick={() => navigate("/ppmps/create")}
              className="mt-4 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition"
            >
              Create your first PPMP
            </button>
          )}
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
                <div className="bg-blue-50 text-blue-700 font-semibold text-sm px-3 py-2 rounded-lg">
                  FY {ppmp.year}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    PPMP No. {ppmp.ppmp_no} —{" "}
                    <span className="capitalize">{ppmp.ppmp_type}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ppmp.projects.length} project
                    {ppmp.projects.length !== 1 ? "s" : ""} · ₱
                    {totalBudget(ppmp).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  {isAdmin && (
                    <p className="text-xs text-blue-400 mt-0.5">
                      Office ID: {ppmp.office_id}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[ppmp.status]}`}
                >
                  {ppmp.status}
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
