import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Home,
  ClipboardList,
  Package,
  Building2,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const getNavItems = (isAdmin: boolean) => [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  {
    to: "/ppmps",
    label: isAdmin ? "All PPMPs" : "My PPMPs",
    icon: ClipboardList,
  },
  { to: "/app", label: isAdmin ? "All APPs" : "My APPs", icon: BarChart3 },
];

const adminNavItems = [
  { to: "/admin/items", label: "Item catalog", icon: Package },
  { to: "/admin/offices", label: "Offices", icon: Building2 },
];

export default function Layout() {
  const { dbUser, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isAdmin = dbUser?.role === "admin";
  const navItems = getNavItems(isAdmin);

  return (
    <div className="h-screen flex bg-[#F7F8FC] overflow-hidden">
      {/* Sidebar is pinned to the viewport — it never scrolls with the page.
          Only the nav list (middle section) scrolls internally if it overflows. */}
      <aside
        className={`${
          sidebarOpen ? "w-56" : "w-16"
        } h-screen shrink-0 bg-white border-r border-[#E1E4F2] flex flex-col overflow-hidden transition-all duration-200`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#E1E4F2] shrink-0">
          {sidebarOpen && (
            <span className="font-semibold text-sm tracking-tight text-[#0B0A24]">
              e-PMS
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className="text-[#767A9E] hover:text-[#0B0A24] transition-colors"
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-[#E8E8FD] text-[#2F2FE4] border border-[#2F2FE4]/25"
                    : "text-[#767A9E] hover:bg-[#F7F8FC] hover:text-[#0B0A24] border border-transparent"
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              {sidebarOpen && (
                <p className="text-[#AEB1CC] text-[11px] px-3 pt-4 pb-1 uppercase tracking-[0.12em]">
                  Admin
                </p>
              )}
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                      isActive
                        ? "bg-[#E8E8FD] text-[#2F2FE4] border border-[#2F2FE4]/25"
                        : "text-[#767A9E] hover:bg-[#F7F8FC] hover:text-[#0B0A24] border border-transparent"
                    }`
                  }
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Always visible — never pushed off-screen or requires scrolling to reach. */}
        <div className="px-2 py-4 border-t border-[#E1E4F2] shrink-0">
          {sidebarOpen && (
            <p className="text-[#AEB1CC] text-[11px] px-3 mb-2 truncate">
              {dbUser?.email}
            </p>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[#767A9E] hover:bg-[#F7F8FC] hover:text-[#0B0A24] w-full transition-colors"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
