import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getAdminDashboardStats, getInventories, getSales, getDamageReports } from "../services/api";
import { BarChart3, Download, Printer, RefreshCw, TrendingUp, Package, AlertTriangle } from "lucide-react";

const AdminReports = () => {
  const [stats, setStats] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [damages, setDamages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7");

  const load = async () => {
    setLoading(true);
    try {
      const [dashboard, stock, saleRows, damageRows] = await Promise.all([
        getAdminDashboardStats(), getInventories(), getSales({ limit: 1000 }), getDamageReports({ status: "all", limit: 1000 }),
      ]);
      setStats(dashboard); setInventory(stock || []); setSales(saleRows || []); setDamages(damageRows || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const lowStock = useMemo(() => inventory.filter((item) => item.quantity <= 5), [inventory]);
  const exportRows = () => {
    const rows = [["Product", "Location", "Quantity"], ...inventory.map((item) => [item.product_name, item.location_name, item.quantity])];
    const blob = new Blob([rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "safari-inventory-report.csv"; link.click(); URL.revokeObjectURL(url);
  };

  return <Layout title="Reports & Analytics" subtitle="Live operational reports built from current database records" action={<div className="flex gap-2"><select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">This year</option></select><button onClick={load} className="p-2 rounded-xl border border-slate-200 text-slate-500" title="Refresh"><RefreshCw className="w-4 h-4" /></button><button onClick={() => window.print()} className="p-2 rounded-xl border border-slate-200 text-slate-500" title="Print"><Printer className="w-4 h-4" /></button></div>}>
    {loading ? <div className="p-12 text-center text-slate-400">Loading live reports...</div> : <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[["Sales volume", stats?.piecesSoldThisMonth || 0, TrendingUp, "text-emerald-600"], ["Current stock", stats?.totalStock || 0, Package, "text-indigo-600"], ["Active damage", stats?.totalDamaged || 0, AlertTriangle, "text-rose-600"]].map(([label, value, Icon, color]) => <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"><div className="flex justify-between"><span className="text-xs font-semibold text-slate-500">{label}</span><Icon className={`w-4 h-4 ${color}`} /></div><p className="text-3xl font-black mt-4">{value.toLocaleString("en-IN")}</p></div>)}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5"><div><h2 className="font-bold text-slate-900">Inventory health</h2><p className="text-xs text-slate-500">{lowStock.length} low-stock records · {sales.length} sales · {damages.length} damage reports</p></div><button onClick={exportRows} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-xl"><Download className="w-4 h-4" />Export CSV</button></div>
        {lowStock.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">All inventory records are above the reorder threshold.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-400"><th className="py-3">Product</th><th>Location</th><th>Quantity</th><th>Recommendation</th></tr></thead><tbody>{lowStock.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-3 font-medium">{item.product_name}</td><td>{item.location_name}</td><td className="font-bold text-rose-600">{item.quantity}</td><td className="text-xs text-amber-700">Reorder soon</td></tr>)}</tbody></table></div>}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"><div className="flex items-center gap-3 mb-4"><BarChart3 className="w-5 h-5 text-indigo-600" /><h2 className="font-bold">Daily activity</h2></div><div className="grid grid-cols-7 gap-3 items-end h-40">{(stats?.dailyTrends || []).map((day) => { const max = Math.max(...(stats?.dailyTrends || []).map((row) => Math.max(row.sales, row.damages)), 1); return <div key={day.fullDate} className="flex flex-col items-center h-full justify-end gap-1"><div className="w-full flex items-end justify-center gap-1 h-32"><div title={`Sales ${day.sales}`} className="w-3 bg-emerald-500 rounded-t" style={{ height: `${Math.max(day.sales / max * 100, 3)}%` }} /><div title={`Damage ${day.damages}`} className="w-3 bg-rose-400 rounded-t" style={{ height: `${Math.max(day.damages / max * 100, 3)}%` }} /></div><span className="text-[10px] text-slate-500">{day.date}</span></div>; })}</div></div>
    </div>}
  </Layout>;
};
export default AdminReports;
