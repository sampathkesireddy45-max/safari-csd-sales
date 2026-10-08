import React, { useEffect, useState } from "react";
import { Search, X, Package, Users, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getProducts, getEmployees, getLocations } from "../services/api";

const GlobalSearch = ({ onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (query.trim().length < 2) return setResults([]);
      const term = query.toLowerCase();
      const [products, employees, locations] = await Promise.all([
        getProducts({ q: query, limit: 8 }).catch(() => []),
        getEmployees().catch(() => []),
        getLocations().catch(() => []),
      ]);
      if (!active) return;
      setResults([
        ...products.filter((item) => item.name?.toLowerCase().includes(term) || String(item.index_no || "").includes(term)).slice(0, 5).map((item) => ({ ...item, kind: "Product", icon: Package, path: "/employee/sales-entry" })),
        ...employees.filter((item) => item.name?.toLowerCase().includes(term) || item.employee_id?.toLowerCase().includes(term)).slice(0, 3).map((item) => ({ ...item, kind: "Employee", icon: Users, path: "/admin/employees" })),
        ...locations.filter((item) => item.name?.toLowerCase().includes(term)).slice(0, 3).map((item) => ({ ...item, kind: "Location", icon: MapPin, path: "/admin/locations" })),
      ]);
    };
    load();
    return () => { active = false; };
  }, [query]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm p-4 sm:p-12" onClick={onClose}>
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-indigo-500" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, staff, and stores..." className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white" />
          <button onClick={onClose} aria-label="Close search"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {query.length < 2 && <p className="p-6 text-center text-sm text-slate-400">Type at least two characters to search.</p>}
          {query.length >= 2 && results.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No matching records found.</p>}
          {results.map((result) => {
            const Icon = result.icon;
            return <button key={`${result.kind}-${result.id}`} onClick={() => { navigate(result.path); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors">
              <Icon className="w-4 h-4 text-indigo-500" />
              <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100">{result.name || result.employee_id}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{result.kind}</span>
            </button>;
          })}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
