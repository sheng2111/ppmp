import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// --- Minimal Icons ---
const IconDocument = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6M9 8h1m-4 12h12a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const IconList = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6h16M4 10h16M4 14h10M4 18h10"
    />
  </svg>
);

const IconWallet = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM16 14h2"
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

const IconArrowRight = () => (
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
      d="M14 5l7 7m0 0l-7 7m7-7H3"
    />
  </svg>
);

// --- Stat Card ---
const StatCard = ({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
      </div>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md"
        style={{ background: accent }}
      >
        {icon}
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const { fullName, user } = useAuth();
  const navigate = useNavigate();

  // Replace with real data from API
  const ppmps: any[] = [];
  const totalItems = 0;
  const totalBudget = 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div
        className="rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
        }}
      >
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-white opacity-10" />
        <div className="absolute -bottom-16 -right-24 w-56 h-56 rounded-full border border-white opacity-5" />

        <div className="relative z-10">
          <p className="text-blue-200 text-xs uppercase tracking-widest font-semibold"></p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">
            Welcome, {fullName || user}!
          </h1>
          <p className="text-blue-200 text-sm mt-2">
            Here's an overview of your procurement plans.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<IconDocument />}
          label="Total PPMPs"
          value={ppmps.length}
          accent="linear-gradient(135deg, #1e3a6e, #2471c8)"
        />
        <StatCard
          icon={<IconList />}
          label="Total Items"
          value={totalItems}
          accent="linear-gradient(135deg, #1a56a0, #4a90d9)"
        />
        <StatCard
          icon={<IconWallet />}
          label="Total Budget"
          value={`₱ ${totalBudget.toFixed(2)}`}
          accent="linear-gradient(135deg, #2471c8, #5aa7ec)"
        />
      </div>

      {/* Recent PPMPs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Recent PPMPs</h2>
          <button
            onClick={() => navigate("/ppmp/new")}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all"
            style={{ background: "linear-gradient(90deg, #1e3a6e, #1a56a0)" }}
          >
            <IconPlus />
            Create New
          </button>
        </div>

        {ppmps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="text-blue-200 mb-3">
              <IconFolder />
            </div>
            <p className="text-gray-400 text-sm mb-5">
              No PPMPs yet. Start by creating your first procurement plan.
            </p>
            <button
              onClick={() => navigate("/ppmp/new")}
              className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
              style={{ background: "linear-gradient(90deg, #1e3a6e, #1a56a0)" }}
            >
              <IconPlus />
              Create Your First PPMP
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {ppmps.map((ppmp) => (
              <div
                key={ppmp.id}
                onClick={() => navigate(`/ppmp/${ppmp.id}`)}
                className="flex items-center justify-between px-6 py-4 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div>
                  <p className="font-semibold text-gray-800 text-sm">
                    {ppmp.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{ppmp.year}</p>
                </div>
                <IconArrowRight />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
