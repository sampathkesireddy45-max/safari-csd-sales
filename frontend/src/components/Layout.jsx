import React from "react";
import Sidebar from "./Sidebar";

const Layout = ({ children, title, subtitle, action }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {(title || subtitle || action) && (
          <header className="bg-white border-b border-slate-200/80 px-6 sm:px-8 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {title && (
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-slate-500">
                    {subtitle}
                  </p>
                )}
              </div>
              {action && (
                <div className="flex items-center gap-3">
                  {action}
                </div>
              )}
            </div>
          </header>
        )}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
