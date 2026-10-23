import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { getEmployeeSalesDashboard } from "../services/api";
import { useToast } from "../components/Toast";
import { TableSkeleton, CardSkeleton } from "../components/LoadingSkeleton";
import {
  ShoppingBag,
  TrendingUp,
  Package,
  Boxes,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  Search,
  Filter,
  Calendar,
  Building2,
  RefreshCw,
  CheckCircle2,
  Layers,
  ChevronRight,
  Receipt,
  X,
  ArrowUpDown,
  Tag,
  Globe2,
  Store,
  ArrowDownToLine,
} from "lucide-react";

const EmployeeSalesDashboard = () => {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    employee: {},
    selected_location: { id: null, location_id: null, name: "Assigned Store", is_all_stores: false },
    locations: [],
    summary: {
      my_pieces_sold: 0,
      my_revenue: 0,
      sales_count: 0,
      store_opening_stock: 0,
      store_closing_stock: 0,
      store_pieces_sold: 0,
      store_revenue: 0,
      total_pieces_sold: 0,
      total_revenue: 0,
      total_opening_stock: 0,
      total_closing_stock: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
      overflow_stock_count: 0,
      healthy_stock_count: 0,
      total_catalog_items: 0,
    },
    items: [],
    sales: [],
  });

  // Date filters
  const [dateFilterMode, setDateFilterMode] = useState("all"); // "all" | "today" | "custom"
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Search & Filter in Stock Table
  const [searchTerm, setSearchTerm] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("ALL"); // ALL | SOLD | LOW | OUT | OVERFLOW | HEALTHY
  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "sales"
  const [viewUnit, setViewUnit] = useState("pieces"); // "pieces" | "cases"

  const loadDashboardData = async (extraParams = {}) => {
    setLoading(true);
    try {
      if (refreshUser) {
        refreshUser();
      }
      const params = {};

      const dFrom = "date_from" in extraParams ? extraParams.date_from : dateFrom;
      if (dFrom) params.date_from = dFrom;

      const dTo = "date_to" in extraParams ? extraParams.date_to : dateTo;
      if (dTo) params.date_to = dTo;

      const res = await getEmployeeSalesDashboard(params);
      setData(res);
    } catch (err) {
      console.error("Failed to load employee sales dashboard:", err);
      addToast(err.message || "Failed to load sales & stock data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleApplyDateFilter = (mode, customFrom = dateFrom, customTo = dateTo) => {
    setDateFilterMode(mode);
    const params = {};
    if (mode === "today") {
      const todayStr = new Date().toISOString().split("T")[0];
      params.date_from = todayStr;
      params.date_to = todayStr;
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (mode === "custom") {
      if (customFrom) params.date_from = customFrom;
      if (customTo) params.date_to = customTo;
    } else {
      setDateFrom("");
      setDateTo("");
      params.date_from = "";
      params.date_to = "";
    }
    loadDashboardData(params);
  };

  // Filtered Items for Catalog Stock Table
  const filteredItems = useMemo(() => {
    return data.items.filter((item) => {
      // Search matching
      const matchesSearch =
        !searchTerm.trim() ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.index_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.colour.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      if (stockStatusFilter === "ALL") return true;
      if (stockStatusFilter === "SOLD") return (item.my_pieces_sold > 0 || item.store_pieces_sold > 0);
      if (stockStatusFilter === "LOW") return item.status === "low_stock";
      if (stockStatusFilter === "OUT") return item.status === "out_of_stock";
      if (stockStatusFilter === "OVERSTOCK" || stockStatusFilter === "OVERFLOW") return (item.status === "overstock" || item.status === "overflow" || (item.store_closing_stock ?? 0) > 15);
      if (stockStatusFilter === "HEALTHY") return item.status === "healthy";
      return true;
    });
  }, [data.items, searchTerm, stockStatusFilter]);

  const { summary, employee, selected_location } = data;
  const assignedStoreName = employee.assigned_location_name || user?.assigned_location_name || "Unassigned Store";
  const hasStore = !!(employee.assigned_location_id || user?.assigned_location_id);
  const activeStoreName = selected_location?.name || assignedStoreName;
  const isAllStores = selected_location?.is_all_stores;

  return (
    <Layout
      title="Staff Retail Sales & Stock Counter"
      subtitle="Assigned Store Sales & Live Counter Stock Telemetry"
      action={
        <button
          onClick={() => loadDashboardData()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 rounded-xl shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Operating Store & Profile Banner */}
        <div className={`p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
          hasStore
            ? "bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 text-white border-indigo-800"
            : "bg-amber-500/10 border-amber-300 text-amber-950"
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              hasStore ? "bg-indigo-600/80 text-white shadow-inner" : "bg-amber-500 text-white"
            }`}>
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${hasStore ? "text-indigo-300" : "text-amber-800"}`}>
                  Assigned Store Counter
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Store className="w-3 h-3" />
                  <span>Retail Store Outlet</span>
                </span>
              </div>
              <h2 className={`text-xl font-extrabold tracking-tight mt-0.5 ${hasStore ? "text-white" : "text-slate-900"}`}>
                {assignedStoreName}
              </h2>
              <p className={`text-xs mt-0.5 ${hasStore ? "text-slate-300" : "text-slate-600"}`}>
                Staff Member: <strong className="text-white font-medium">{employee.name || user?.name}</strong> ({employee.employee_id || user?.employee_id})
              </p>
            </div>
          </div>

          {/* Date Range Selector Pill */}
          <div className="flex items-center gap-2 bg-slate-950/40 p-1.5 rounded-2xl border border-white/10 self-start md:self-auto">
            <button
              onClick={() => handleApplyDateFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                dateFilterMode === "all"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handleApplyDateFilter("today")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                dateFilterMode === "today"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Today
            </button>
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  handleApplyDateFilter("custom", e.target.value, dateTo);
                }}
                className="bg-slate-800 text-white text-xs px-2 py-1 rounded-lg border border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                title="From Date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  handleApplyDateFilter("custom", dateFrom, e.target.value);
                }}
                className="bg-slate-800 text-white text-xs px-2 py-1 rounded-lg border border-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                title="To Date"
              />
            </div>
          </div>
        </div>

        {/* ASSIGNED STORE KPI TILES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-indigo-600" />
              <span>Assigned Store Counter Telemetry: <strong>{assignedStoreName}</strong></span>
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
              Store Counter Metrics
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Store Opening Stock */}
            <div className="bg-gradient-to-br from-blue-50/80 to-white rounded-2xl p-4 border border-blue-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-blue-600 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
                  Store Opening Stock
                </span>
                <Boxes className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-950">
                {(summary.store_opening_stock ?? summary.total_opening_stock ?? 0).toLocaleString()} <span className="text-xs font-bold text-blue-500">PCS</span>
              </div>
              <div className="text-[11px] font-medium text-blue-700/80 mt-1">
                <span>Assigned store starting stock</span>
              </div>
            </div>

            {/* Store Receiving Stock */}
            <div className="bg-gradient-to-br from-teal-50/80 to-white rounded-2xl p-4 border border-teal-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-teal-600 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800">
                  Store Receiving Stock
                </span>
                <ArrowDownToLine className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-black text-teal-950">
                {(summary.store_receiving_stock ?? summary.total_receiving_stock ?? 0).toLocaleString()} <span className="text-xs font-bold text-teal-500">PCS</span>
              </div>
              <div className="text-[11px] font-medium text-teal-700/80 mt-1">
                <span>Inward received stock & transfers</span>
              </div>
            </div>

            {/* Store Closing Stock */}
            <div className="bg-gradient-to-br from-indigo-50/80 to-white rounded-2xl p-4 border border-indigo-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-indigo-600 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800">
                  Store Closing Stock
                </span>
                <Package className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-950">
                {(summary.store_closing_stock ?? summary.total_closing_stock ?? 0).toLocaleString()} <span className="text-xs font-bold text-indigo-500">PCS</span>
              </div>
              <div className="text-[11px] font-medium text-indigo-700/80 mt-1">
                <span>Current live counter balance</span>
              </div>
            </div>

            {/* Store Volume Sold */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                  Store Volume Sold
                </span>
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700">
                {(summary.store_pieces_sold ?? 0).toLocaleString()} <span className="text-xs font-bold text-emerald-500">PCS</span>
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-1 flex items-center justify-between">
                <span>Store Sales Period</span>
                <span className="font-mono font-bold text-emerald-700">₹{(summary.store_revenue ?? 0).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* My Personal Sold Counter */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                  My Personal Counter Sales
                </span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {(summary.my_pieces_sold ?? summary.total_pieces_sold ?? 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">PCS</span>
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-1 flex items-center justify-between">
                <span>{summary.sales_count ?? 0} Receipts</span>
                <span className="font-mono font-bold text-emerald-700">₹{(summary.my_revenue ?? summary.total_revenue ?? 0).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Stock Health Balance Summary */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                  Store Stock Health
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="grid grid-cols-3 gap-1 text-center py-0.5">
                <div className="bg-rose-50 rounded-lg p-1 border border-rose-100">
                  <span className="block text-xs font-black text-rose-700">{summary.out_of_stock_count ?? 0}</span>
                  <span className="block text-[9px] font-bold text-rose-500">Out (0 pcs)</span>
                </div>
                <div className="bg-amber-50 rounded-lg p-1 border border-amber-100">
                  <span className="block text-xs font-black text-amber-700">{summary.low_stock_count ?? 0}</span>
                  <span className="block text-[9px] font-bold text-amber-500">Low (≤1 Case)</span>
                </div>
                <div className="bg-emerald-50 rounded-lg p-1 border border-emerald-100">
                  <span className="block text-xs font-black text-emerald-700">{summary.healthy_stock_count ?? 0}</span>
                  <span className="block text-[9px] font-bold text-emerald-500">Healthy (&gt;2 Cs)</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 text-center mt-1">
                {data.items.length} Total SKUs in Catalog
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("stock")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "stock"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Assigned Store Stock Catalog ({filteredItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("sales")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "sales"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>My Sales History ({data.sales.length})</span>
            </button>
          </div>

          {/* Quick Info */}
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Live physical stock and sales telemetry for your assigned store counter</span>
          </div>
        </div>

        {/* TAB 1: STOCK & OPENING STOCK TABLE */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Index No. (e.g. 36812), luggage name, brand, or colour..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "ALL", label: "All Items" },
                  { id: "SOLD", label: "Sold Items" },
                  { id: "HEALTHY", label: `Healthy >2 Cs (${summary.healthy_stock_count ?? 0})` },
                  { id: "OVERSTOCK", label: `Overstock >15 (${summary.overflow_stock_count ?? 0})` },
                  { id: "LOW", label: `Low Stock ≤1 Cs (${summary.low_stock_count ?? 0})` },
                  { id: "OUT", label: `Out of Stock (${summary.out_of_stock_count ?? 0})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStockStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                      stockStatusFilter === f.id
                        ? "bg-slate-900 text-white shadow"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Unit Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end md:self-auto">
                <button
                  onClick={() => setViewUnit("pieces")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    viewUnit === "pieces" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Pieces
                </button>
                <button
                  onClick={() => setViewUnit("cases")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    viewUnit === "cases" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Cases
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              {loading ? (
                <TableSkeleton rows={8} cols={9} />
              ) : filteredItems.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Boxes className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-base font-bold text-slate-700">No catalog items match your search or filter</p>
                  <p className="text-xs text-slate-400 mt-1">Try clearing filters or search terms</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3.5 font-semibold">Index No.</th>
                        <th className="px-4 py-3.5 font-semibold">Luggage Model & Specifications</th>
                        <th className="px-4 py-3.5 font-semibold text-right">Rate</th>
                        <th className="px-4 py-3.5 font-semibold text-center">My Sold</th>
                        
                        {/* Assigned Store Columns */}
                        <th className="px-4 py-3.5 font-bold text-center bg-blue-50/70 text-blue-900 border-l border-blue-100">
                          Opening Stock
                          <span className="block text-[9px] font-normal text-blue-700 lowercase">(assigned store)</span>
                        </th>
                        <th className="px-4 py-3.5 font-bold text-center bg-teal-50/70 text-teal-900">
                          Receiving Stock
                          <span className="block text-[9px] font-normal text-teal-700 lowercase">(inward / transfers)</span>
                        </th>
                        <th className="px-4 py-3.5 font-bold text-center bg-indigo-50/70 text-indigo-900 border-r border-indigo-100">
                          Closing Stock
                          <span className="block text-[9px] font-normal text-indigo-700 lowercase">(live store counter)</span>
                        </th>

                        <th className="px-4 py-3.5 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => {
                        const storeClosing = item.store_closing_stock ?? item.closing_stock ?? 0;
                        const storeOpening = item.store_opening_stock ?? item.opening_stock ?? 0;
                        const storeReceiving = item.store_receiving_stock ?? item.receiving_stock ?? 0;
                        const overallClosing = item.overall_closing_stock ?? 0;
                        const overallOpening = item.overall_opening_stock ?? 0;
                        const mySold = item.my_pieces_sold ?? item.pieces_sold ?? 0;

                        const pack = item.case_pack || 1;
                        const isOut = storeClosing <= 0;
                        const isLow = storeClosing > 0 && storeClosing <= pack;
                        const isOverstock = storeClosing > 15;
                        const isHealthy = !isOverstock && storeClosing > 2 * pack;
                        const isModerate = !isOverstock && storeClosing > pack && storeClosing <= 2 * pack;

                        return (
                          <tr
                            key={item.product_id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              item.has_sales ? "bg-indigo-50/20" : ""
                            }`}
                          >
                            {/* Index No */}
                            <td className="px-4 py-3 font-mono text-xs font-extrabold text-indigo-700">
                              #{item.index_no}
                            </td>

                            {/* Product Info */}
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900 text-xs leading-snug">{item.name}</div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                <span className="bg-slate-100 px-1 py-0.2 rounded font-medium">{item.brand}</span>
                                {item.colour && <span>• {item.colour}</span>}
                                <span>• Pack: {item.case_pack} pcs</span>
                              </div>
                            </td>

                            {/* Price */}
                            <td className="px-4 py-3 text-right font-mono font-semibold text-xs text-slate-800">
                              ₹{item.selling_rate.toLocaleString("en-IN")}
                            </td>

                            {/* My Pieces Sold */}
                            <td className="px-4 py-3 text-center">
                              {mySold > 0 ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-extrabold text-emerald-700 text-xs">
                                    {viewUnit === "pieces"
                                      ? `${mySold} PCS`
                                      : `${(mySold / item.case_pack).toFixed(2)} Cs`}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    ₹{(item.my_revenue ?? item.revenue ?? 0).toLocaleString("en-IN")}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-mono text-xs">0</span>
                              )}
                            </td>

                            {/* Store Opening Stock (View-only for counter staff; managed by Admin) */}
                            <td className="px-3 py-3 text-center bg-blue-50/30 border-l border-blue-50 font-bold text-slate-800 text-xs">
                              <span>
                                {viewUnit === "pieces"
                                  ? `${storeOpening} PCS`
                                  : `${(storeOpening / item.case_pack).toFixed(2)} Cs`}
                              </span>
                            </td>

                            {/* Store Receiving Stock (Inward arrivals / transfers) */}
                            <td className="px-3 py-3 text-center bg-teal-50/25 font-bold text-teal-950 text-xs">
                              <span>
                                {viewUnit === "pieces"
                                  ? `${storeReceiving} PCS`
                                  : `${(storeReceiving / item.case_pack).toFixed(2)} Cs`}
                              </span>
                            </td>

                            {/* Store Closing Stock */}
                            <td className="px-4 py-3 text-center bg-indigo-50/20 border-r border-indigo-50 font-bold">
                              <div className="inline-flex flex-col items-center">
                                <span className={`text-xs font-extrabold ${
                                  isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                                }`}>
                                  {viewUnit === "pieces"
                                    ? `${storeClosing} PCS`
                                    : `${(storeClosing / item.case_pack).toFixed(2)} Cs`}
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  {item.store_closing_cases ?? Math.floor(storeClosing / item.case_pack)} cs + {item.store_closing_remainder ?? (storeClosing % item.case_pack)} pcs
                                </span>
                              </div>
                            </td>

                            {/* Stock Status Badge */}
                            <td className="px-4 py-3 text-center">
                              {isOut && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-xs">
                                  <AlertOctagon className="w-3 h-3 text-rose-600" />
                                  <span>Out of Stock (0)</span>
                                </span>
                              )}
                              {isLow && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Low Stock (≤1 Cs: {storeClosing} pcs)</span>
                                </span>
                              )}
                              {isOverstock && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 shadow-xs">
                                  <Layers className="w-3 h-3 text-purple-600" />
                                  <span>Overstock (&gt;15 pcs: {storeClosing})</span>
                                </span>
                              )}
                              {isHealthy && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Healthy (&gt;2 Cases)</span>
                                </span>
                              )}
                              {isModerate && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
                                  <span>In Stock (1–2 Cases)</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MY SALES TRANSACTIONS */}
        {activeTab === "sales" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Individual Sales Records</h3>
                <p className="text-xs text-slate-500">Every sales counter receipt registered by you</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
                {data.sales.length} Total Receipts
              </span>
            </div>

            {data.sales.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-base font-bold text-slate-700">No sales recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Sales entered via "Sales Entry" counter will show up here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.sales.map((sale) => (
                  <div key={sale.id} className="p-5 hover:bg-slate-50/70 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          #{sale.id}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              Receipt #{sale.id}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {sale.formatted_datetime || sale.formatted_date}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Counter: {sale.location_name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="block text-[11px] text-slate-400 uppercase font-semibold">Volume</span>
                          <span className="text-sm font-extrabold text-slate-900">{sale.total_pieces} PCS</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[11px] text-slate-400 uppercase font-semibold">Total</span>
                          <span className="text-sm font-extrabold text-emerald-700 font-mono">
                            ₹{sale.total_cost.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Line Items Breakdown */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Line Items Breakdown
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {sale.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-mono font-bold text-indigo-600 block text-[11px]">
                                {item.index_no}
                              </span>
                              <span className="font-semibold text-slate-800 truncate block">
                                {item.product_name}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-slate-900 block">{item.quantity} PCS</span>
                              <span className="text-[10px] text-slate-500 font-mono">₹{item.subtotal}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EmployeeSalesDashboard;
