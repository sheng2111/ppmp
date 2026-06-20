import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

// --- Icons ---
const IconHome = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12l2-2m0 0l7-7 7 7m-14 0v8a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-8m-14 0h14"
    />
  </svg>
);

const IconPlus = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const IconClipboard = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

const IconLogout = () => (
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
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const navItems = [
  { path: "/", label: "Dashboard", icon: <IconHome /> },
  { path: "/ppmp/new", label: "New PPMP", icon: <IconPlus /> },
  { path: "/ppmp", label: "All PPMPs", icon: <IconClipboard /> },
];

const Sidebar = () => {
  const location = useLocation();
  const { user, fullName, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/ppmp") return location.pathname === "/ppmp";
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className="w-64 h-screen sticky top-0 text-white flex flex-col shadow-xl overflow-hidden print:hidden"
      style={{
        background:
          "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)",
      }}
    >
      {/* Decorative circles — same as login/dashboard */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-white opacity-5 pointer-events-none" />
      <div className="absolute bottom-32 -left-10 w-32 h-32 rounded-full border border-white opacity-5 pointer-events-none" />

      {/* Header — Logo + System Name (side by side) — fixed at top */}
      <div className="p-5 border-b border-white/10 relative z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/nemsu-logo.png"
            alt="NEMSU Logo"
            className="w-12 h-12 object-contain drop-shadow-lg flex-shrink-0"
          />
          <div>
            <p className="text-[10px] text-blue-200 mt-0.5 uppercase tracking-widest leading-tight font-bold">
              Electronic Procurement
              <br />
              Management System
            </p>
          </div>
        </div>
      </div>

      {/* Nav — scrolls internally only if needed, takes remaining space */}
      <nav className="flex-1 p-4 space-y-1.5 relative z-10 overflow-y-auto">
        {navItems.map(({ path, label, icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive(path)
                ? "bg-white text-blue-900 font-semibold shadow-md"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className={isActive(path) ? "text-blue-700" : ""}>
              {icon}
            </span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer — User + Logout — fixed at bottom, always visible */}
      <div className="p-4 border-t border-white/10 relative z-10 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar circle */}
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {(fullName || user || "U")[0].toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] text-blue-200 uppercase tracking-widest">
              Logged in as
            </p>
            <p className="text-sm font-semibold truncate">{fullName || user}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white py-2.5 px-3 rounded-xl transition-all"
        >
          <IconLogout />
          Logout
        </button>
      </div>
    </aside>
  );
};
const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen overflow-hidden bg-gray-50">
    <Sidebar />
    <main className="flex-1 overflow-y-auto print:w-full">
      <div className="p-6">{children}</div>
    </main>
  </div>
);

export default Layout;
