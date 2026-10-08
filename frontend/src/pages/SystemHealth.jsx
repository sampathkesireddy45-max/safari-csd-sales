import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { getSystemHealth } from "../services/api";
import { Activity, CheckCircle2, RefreshCw, Server } from "lucide-react";

const SystemHealth = () => {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const load = async () => { try { setError(""); setHealth(await getSystemHealth()); } catch (err) { setError(err.message); } };
  useEffect(() => { load(); }, []);
  return <Layout title="System Health" subtitle="Operational status and service diagnostics" action={<button onClick={load} className="p-2 rounded-xl border border-slate-200"><RefreshCw className="w-4 h-4" /></button>}>
    <div className="grid md:grid-cols-3 gap-5">
      <div className={`rounded-2xl border p-6 ${health ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}><CheckCircle2 className="w-6 h-6 mb-4 text-emerald-600" /><p className="font-bold">{health ? "API online" : "API unavailable"}</p><p className="text-xs mt-1 text-slate-500">{health?.version || error || "Checking service..."}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6"><Server className="w-6 h-6 text-indigo-600 mb-4" /><p className="font-bold">Database</p><p className={`text-xs mt-1 ${health?.database === "ok" ? "text-emerald-600" : "text-rose-600"}`}>{health?.database || "Checking..."}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6"><Activity className="w-6 h-6 text-amber-600 mb-4" /><p className="font-bold">Telemetry</p><p className="text-xs mt-1 text-slate-500">GPS and dashboard data refresh from live endpoints</p></div>
    </div>
  </Layout>;
};
export default SystemHealth;
