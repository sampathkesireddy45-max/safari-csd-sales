import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import {
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import {
  exportAdminSalesXlsx,
  getAdminSalesSummary,
  getEmployees,
} from "../services/api";
import { useToast } from "../components/Toast";

const AdminSales = () => {
  const { addToast } = useToast();
  const [summary, setSummary] = useState({ overall: { sale_count: 0, total_pieces: 0, total_cost: 0 }, employees: [], sales: [] });
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadSales = async (employeeId = selectedEmployee) => {
    setLoading(true);
    try {
      const data = await getAdminSalesSummary({
        ...(employeeId ? { employee_id: employeeId } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        limit: 1000,
      });
      setSummary(data);
    } catch (error) {
      addToast(error.message || "Unable to load sales", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([getEmployees(), getAdminSalesSummary({ limit: 1000 })])
      .then(([employeeRows, salesData]) => {
        setEmployees(employeeRows || []);
        setSummary(salesData);
      })
      .catch((error) => addToast(error.message || "Unable to load sales dashboard", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleEmployeeChange = (event) => {
    const employeeId = event.target.value;
    setSelectedEmployee(employeeId);
    loadSales(employeeId);
  };

  const handleExport = async (employeeId, label) => {
    setExporting(label);
    try {
      const blob = await exportAdminSalesXlsx({
        ...(employeeId ? { employee_id: employeeId } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = employeeId ? `sales_${label.toLowerCase().replaceAll(" ", "_")}.xlsx` : "sales_overall.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      addToast(error.message || "Export failed", "error");
    } finally {
      setExporting("");
    }
  };

  const filteredSales = (summary.sales || []).filter((sale) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [sale.employee_name, sale.location_name, String(sale.id)].some((value) => value?.toLowerCase().includes(term));
  });

  return (
    <Layout
      title="Sales Dashboard"
      subtitle="Review overall sales and compare individual employee performance"
      action={
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => loadSales()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button type="button" onClick={() => handleExport("", "Overall")} disabled={exporting === "Overall"} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60">
            <Download className="w-4 h-4" /> {exporting === "Overall" ? "Exporting..." : "Export Overall"}
          </button>
          {selectedEmployee && (
            <button type="button" onClick={() => handleExport(selectedEmployee, employees.find((employee) => String(employee.id) === String(selectedEmployee))?.name || "Employee")} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60">
              <Download className="w-4 h-4" /> Export Individual
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Filter sales by date</h2>
              <p className="mt-1 text-xs text-slate-500">The end date includes the entire selected day.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-slate-600">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
              <label className="text-xs font-semibold text-slate-600">To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
              <button type="button" onClick={() => loadSales()} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700">Apply dates</button>
              <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setTimeout(() => loadSales(), 0); }} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-indigo-700">{selectedEmployee ? "Selected employee" : "Overall sales"}</span><ShoppingBag className="w-5 h-5 text-indigo-600" /></div>
            <p className="mt-4 text-4xl font-black text-indigo-950">{(summary.overall?.total_pieces || 0).toLocaleString("en-IN")} <span className="text-sm font-bold text-indigo-600">PCS</span></p>
            <p className="mt-1 text-xs text-indigo-700">{(summary.overall?.sale_count || 0).toLocaleString("en-IN")} sale transactions</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-amber-700">Overall sale value</span><span className="text-lg font-black text-amber-600">₹</span></div>
            <p className="mt-4 text-4xl font-black text-amber-950">₹{Number(summary.overall?.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            <p className="mt-1 text-xs text-amber-700">Based on product selling rates</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Employees with sales</span><Users className="w-5 h-5 text-emerald-600" /></div>
            <p className="mt-4 text-4xl font-black text-emerald-950">{summary.employees?.length || 0}</p>
            <p className="mt-1 text-xs text-emerald-700">Individual performance records</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div><h2 className="font-bold text-slate-900">Individual employee sales</h2><p className="text-xs text-slate-500 mt-1">Select an employee to view and export only their transactions.</p></div>
            <select value={selectedEmployee} onChange={handleEmployeeChange} className="rounded-xl border border-slate-200 px-3 py-2 text-xs min-w-56">
              <option value="">All employees / overall view</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.employee_id})</option>)}
            </select>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(summary.employees || []).map((employee) => (
              <button type="button" key={employee.id} onClick={() => { setSelectedEmployee(String(employee.id)); loadSales(String(employee.id)); }} className={`text-left rounded-xl border p-4 transition ${String(selectedEmployee) === String(employee.id) ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}>
                <div className="flex items-center justify-between"><div><p className="font-bold text-slate-900">{employee.name}</p><p className="text-[11px] text-slate-500">{employee.employee_id}</p></div><span className="text-lg font-black text-indigo-700">{employee.total_pieces} PCS</span></div>
                <p className="text-[11px] text-slate-500 mt-2">{employee.sale_count} transactions · ₹{Number(employee.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              </button>
            ))}
            {summary.employees?.length === 0 && <p className="lg:col-span-2 py-8 text-center text-sm text-slate-400">No employee sales are available yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><FileSpreadsheet className="w-5 h-5 text-indigo-600" /><div><h2 className="font-bold text-slate-900">Sale transactions</h2><p className="text-xs text-slate-500">Showing {filteredSales.length} records</p></div></div>
            <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sales..." className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs" /></div>
          </div>
          {loading ? <p className="p-10 text-center text-sm text-slate-400">Loading sales...</p> : filteredSales.length === 0 ? <p className="p-10 text-center text-sm text-slate-400">No sales entered yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-5 py-3">Sale ID</th><th>Date</th><th>Employee</th><th>Location</th><th>Line items</th><th>Cost</th><th className="text-right px-5">Pieces</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredSales.map((sale) => <tr key={sale.id}><td className="px-5 py-3 font-mono">#{sale.id}</td><td>{sale.sale_date ? new Date(sale.sale_date).toLocaleString() : "—"}</td><td className="font-medium">{sale.employee_name}</td><td>{sale.location_name}</td><td>{sale.item_count}</td><td>₹{Number(sale.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td className="text-right px-5 font-bold text-emerald-700">{sale.total_pieces}</td></tr>)}</tbody></table></div>}
        </div>
      </div>
    </Layout>
  );
};

export default AdminSales;
