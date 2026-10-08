import React from "react";
import Sidebar from "./Sidebar";
import { useState } from "react";
import { Moon, Search, Sun } from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import { useTheme } from "../context/ThemeContext";

const Layout = ({ children, title, subtitle, action }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  return (
    <>
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {(title || subtitle || action) && (
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-8 py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                {title && (
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {subtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSearchOpen(true)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600" title="Global search"><Search className="w-4 h-4" /></button>
                <button onClick={toggleTheme} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600" title="Toggle theme">{theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
              {action && (
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {action}
                </div>
              )}
              </div>
            </div>
          </header>
        )}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          {children}
        </main>
      </div>
    </div>
    {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
};

export default Layout;
