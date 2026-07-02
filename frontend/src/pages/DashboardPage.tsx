import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  Package,
  ClipboardList,
  Banknote,
  Plus,
  FolderKanban,
} from "lucide-react";

interface PPMPStats {
  total_ppmps: number;
  draft: number;
  submitted: number;
  approved: number;
  total_budget: number;
}

interface AdminStats {
  total_offices: number;
  total_items: number;
}

export default function DashboardPage() {
  const { dbUser } = useAuth();
  const navigate = useNavigate();
  const [ppmpStats, setPpmpStats] = useState<PPMPStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = dbUser?.role === "admin";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const params = isAdmin ? {} : { created_by: dbUser?.id };
        const ppmpRes = await api.get("/ppmps/summary/stats", { params });
        setPpmpStats(ppmpRes.data);

        if (isAdmin) {
          const adminRes = await api.get("/offices/summary/stats");
          setAdminStats(adminRes.data);
        }
      } finally {
        setLoading(false);
      }
    };
    if (dbUser) fetchStats();
  }, [dbUser]);

  const fmt = (n: number) =>
    n.toLocaleString("en-PH", { minimumFractionDigits: 2 });

  return (
    <div className="bg-[#080616] min-h-full -m-6 p-6">
      {/* Welcome header */}
      <div
        className="rounded-3xl p-7 text-white mb-6 relative overflow-hidden border border-[#2F2FE4]/25"
        style={{
          background:
            "linear-gradient(135deg, #080616 0%, #1A1953 55%, #162E93 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full blur-[60px]"
          style={{ background: "rgba(47,47,228,0.25)" }}
        />
        <div className="relative z-10">
          <p className="text-[#8890B5] text-[11px] uppercase tracking-[0.15em] font-medium">
            {isAdmin ? "Administrator" : "End-User"}
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight mt-2">
            Welcome back, {dbUser?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-[#B4BBDA] text-[13px] mt-1">
            North Eastern Mindanao State University — e-PMS
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-[#1A1953]/40 rounded-2xl border border-[#2F2FE4]/15 p-5 animate-pulse"
            >
              <div className="h-3 bg-[#2F2FE4]/15 rounded w-20 mb-3" />
              <div className="h-8 bg-[#2F2FE4]/15 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Admin stats */}
          {isAdmin && adminStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard
                label="Total offices"
                value={adminStats.total_offices}
                icon={<Building2 className="w-[18px] h-[18px]" />}
                onClick={() => navigate("/admin/offices")}
              />
              <StatCard
                label="Items in catalog"
                value={adminStats.total_items}
                icon={<Package className="w-[18px] h-[18px]" />}
                onClick={() => navigate("/admin/items")}
              />
              <StatCard
                label="Total PPMPs"
                value={ppmpStats?.total_ppmps || 0}
                icon={<ClipboardList className="w-[18px] h-[18px]" />}
              />
              <StatCard
                label="Total budget"
                value={`₱${fmt(ppmpStats?.total_budget || 0)}`}
                icon={<Banknote className="w-[18px] h-[18px]" />}
                small
              />
            </div>
          )}

          {/* PPMP status breakdown */}
          {ppmpStats && (
            <>
              {!isAdmin && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <StatCard
                    label="Total PPMPs"
                    value={ppmpStats.total_ppmps}
                    icon={<ClipboardList className="w-[18px] h-[18px]" />}
                    onClick={() => navigate("/ppmps")}
                  />
                  <StatCard
                    label="Total budget"
                    value={`₱${fmt(ppmpStats.total_budget)}`}
                    icon={<Banknote className="w-[18px] h-[18px]" />}
                    small
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mb-6">
                <StatusCard
                  label="Draft"
                  value={ppmpStats.draft}
                  color="gray"
                />
                <StatusCard
                  label="Submitted"
                  value={ppmpStats.submitted}
                  color="blue"
                />
                <StatusCard
                  label="Approved"
                  value={ppmpStats.approved}
                  color="green"
                />
              </div>
            </>
          )}

          {/* Quick actions */}
          <div className="bg-[#1A1953]/30 rounded-2xl border border-[#2F2FE4]/15 p-5">
            <h2 className="text-[13px] font-medium text-[#B4BBDA] mb-4 tracking-wide">
              Quick actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {!isAdmin && (
                <QuickAction
                  icon={<Plus className="w-5 h-5" />}
                  label="Create PPMP"
                  desc="Start a new procurement plan"
                  onClick={() => navigate("/ppmps/create")}
                />
              )}
              <QuickAction
                icon={<FolderKanban className="w-5 h-5" />}
                label="View PPMPs"
                desc="See all your PPMPs"
                onClick={() => navigate("/ppmps")}
              />
              {isAdmin && (
                <>
                  <QuickAction
                    icon={<Package className="w-5 h-5" />}
                    label="Manage items"
                    desc="Update supplier catalog"
                    onClick={() => navigate("/admin/items")}
                  />
                  <QuickAction
                    icon={<Building2 className="w-5 h-5" />}
                    label="Manage offices"
                    desc="Add or update offices"
                    onClick={() => navigate("/admin/offices")}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  onClick,
  small,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  onClick?: () => void;
  small?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#1A1953]/40 rounded-2xl border border-[#2F2FE4]/15 p-5 ${
        onClick
          ? "cursor-pointer hover:border-[#2F2FE4]/50 hover:bg-[#1A1953]/60 transition-colors"
          : ""
      }`}
    >
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#2F2FE4]/15 border border-[#2F2FE4]/30 text-white mb-3">
        {icon}
      </div>
      <p
        className={`font-semibold text-white tracking-tight ${small ? "text-lg" : "text-2xl"}`}
      >
        {value}
      </p>
      <p className="text-[12px] text-[#8890B5] mt-0.5">{label}</p>
    </div>
  );
}

function StatusCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "gray" | "blue" | "green";
}) {
  const styles = {
    gray: {
      border: "border-l-[#8890B5]",
      bg: "bg-[#1A1953]/25",
      text: "text-[#B4BBDA]",
    },
    blue: {
      border: "border-l-[#2F2FE4]",
      bg: "bg-[#2F2FE4]/10",
      text: "text-[#7C8CFF]",
    },
    green: {
      border: "border-l-emerald-400",
      bg: "bg-emerald-400/10",
      text: "text-emerald-300",
    },
  };
  const s = styles[color];
  return (
    <div
      className={`rounded-2xl border border-[#2F2FE4]/15 border-l-4 p-4 ${s.border} ${s.bg}`}
    >
      <p className={`text-2xl font-semibold ${s.text}`}>{value}</p>
      <p className="text-[12px] text-[#8890B5] mt-0.5">{label}</p>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-2xl border border-[#2F2FE4]/15 bg-[#080616]/40 hover:border-[#2F2FE4]/50 hover:bg-[#162E93]/25 transition-colors"
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#2F2FE4]/15 border border-[#2F2FE4]/30 text-white">
        {icon}
      </span>
      <p className="text-sm font-medium text-white mt-3">{label}</p>
      <p className="text-[12px] text-[#8890B5] mt-0.5">{desc}</p>
    </button>
  );
}
