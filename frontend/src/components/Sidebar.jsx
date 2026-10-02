import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  AlertOctagon,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  Luggage,
  ShieldCheck,
  UserCheck,
  Building2,
  Navigation,
  Key
} from "lucide-react";

const Sidebar = () => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminLinks = [
    { label: "Overview", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Live Employee Map", path: "/admin/live-locations", icon: Navigation },
    { label: "Store Locations", path: "/admin/locations", icon: Building2 },
    { label: "Staff Credentials & Pass", path: "/admin/credentials", icon: Key },
    { label: "Damage Reports & Photos", path: "/admin/damages", icon: AlertOctagon },
    { label: "Employee Directory", path: "/admin/employees", icon: Users },
  ];

  const employeeLinks = [
    { label: "My Dashboard", path: "/employee/dashboard", icon: LayoutDashboard },
    { label: "Report Damage & Photo", path: "/employee/damages", icon: AlertOctagon },
    { label: "Sales Entry", path: "/employee/sales-entry", icon: ShoppingBag },
  ];

  const links = isAdmin ? adminLinks : employeeLinks;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => {
    if (path === "/employee/damages" && (location.pathname === "/employee/damages" || location.pathname === "/employee/damages-report")) {
      return true;
    }
    return location.pathname === path;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-200">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/80">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 shadow-md shadow-indigo-950/40 text-white">
          <Luggage className="w-5 h-5" />
        </div>
        <div>
          <span className="block text-base font-bold tracking-tight text-white font-sans">
            SAFARI
          </span>
          <span className="block text-[11px] font-medium tracking-wider text-slate-400 uppercase">
            Sales & Stock System
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {isAdmin ? "Admin Portal" : "Staff Operations"}
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? "text-white" : "text-slate-400"}`} />
              <span>{link.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Card */}
      {user && (
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="w-9 h-9 rounded-full bg-indigo-900/60 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-semibold text-sm">
              {isAdmin ? <ShieldCheck className="w-4 h-4 text-amber-400" /> : <UserCheck className="w-4 h-4 text-emerald-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar with Hamburger */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center text-white">
            <Luggage className="w-4 h-4" />
          </div>
          <span className="font-bold tracking-tight text-sm">SAFARI SALES</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Backdrop & Drawer */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        >
          <div 
            className="w-72 h-full bg-slate-900 shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
