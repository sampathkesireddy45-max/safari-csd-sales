import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import {
  getEmployeeSalesDashboard,
  updateEmployeeOpeningStock,
} from "../services/api";
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
  Edit3,
  Calendar,
  Building2,
  RefreshCw,
  CheckCircle2,
  Layers,
  ChevronRight,
  Receipt,
  X,
  ArrowUpDown,
  Tag
} from "lucide-react";

const EmployeeSalesDashboard = () => {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    employee: {},
    summary: {
      total_pieces_sold: 0,
      total_revenue: 0,
      sales_count: 0,
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

  // Edit Opening Stock Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [newOpeningStock, setNewOpeningStock] = useState("");
  const [savingStock, setSavingStock] = useState(false);

  const loadDashboardData = async (params = {}) => {
    setLoading(true);
    try {
      if (refreshUser) {
        refreshUser();
      }
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
      if (stockStatusFilter === "SOLD") return item.pieces_sold > 0;
      if (stockStatusFilter === "LOW") return item.status === "low_stock";
      if (stockStatusFilter === "OUT") return item.status === "out_of_stock";
      if (stockStatusFilter === "OVERFLOW") return item.status === "overflow";
      if (stockStatusFilter === "HEALTHY") return item.status === "healthy";
      return true;
    });
  }, [data.items, searchTerm, stockStatusFilter]);

  // Open Edit Opening Stock Modal
  const handleOpenEditOpeningModal = (item) => {
    setEditingItem(item);
    setNewOpeningStock(String(item.opening_stock));
  };

  const handleCloseEditOpeningModal = () => {
    setEditingItem(null);
    setNewOpeningStock("");
  };

  const handleSaveOpeningStock = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const openingVal = parseInt(newOpeningStock, 10);
    if (isNaN(openingVal) || openingVal < 0) {
      addToast("Opening stock must be a non-negative number", "error");
      return;
    }

    if (openingVal < editingItem.pieces_sold) {
      addToast(
        `Opening stock cannot be less than ${editingItem.pieces_sold} PCS already sold in this period!`,
        "error"
      );
      return;
    }

    setSavingStock(true);
    try {
      const payload = {
        product_id: editingItem.product_id,
        opening_stock: openingVal,
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
      };

      const res = await updateEmployeeOpeningStock(payload);
      addToast(res.message || "Opening stock updated successfully!", "success");
      handleCloseEditOpeningModal();

      // Refresh current dashboard data
      const currentParams = {};
      if (dateFrom) currentParams.date_from = dateFrom;
      if (dateTo) currentParams.date_to = dateTo;
      await loadDashboardData(currentParams);
    } catch (err) {
      console.error("Failed to update opening stock:", err);
      addToast(err.message || "Failed to update opening stock", "error");
    } finally {
      setSavingStock(false);
    }
  };

  const { summary, employee } = data;
  const storeName = employee.assigned_location_name || user?.assigned_location_name || "Unassigned Store";
  const hasStore = !!(employee.assigned_location_id || user?.assigned_location_id);

  return (
    <Layout
      title="Staff Retail Sales & Stock Counter"
      subtitle="Track your individual sales, analyze opening vs closing store stock, and manage opening stock"
      action={
        <button
          onClick={() => {
            const params = {};
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            loadDashboardData(params);
          }}
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
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${hasStore ? "text-indigo-300" : "text-amber-800"}`}>
                  Assigned Store Counter
                </span>
                {hasStore ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Live Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <AlertTriangle className="w-3 h-3" /> Unassigned
                  </span>
                )}
              </div>
              <h2 className={`text-xl font-extrabold tracking-tight ${hasStore ? "text-white" : "text-slate-900"}`}>
                {storeName}
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

        {/* Unassigned Warning Banner */}
        {!hasStore && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">No Retail Location Assigned:</span> You are not currently assigned to a retail node. Opening & closing stock reflects your assigned store inventory. Please ask an administrator to assign your store location in the Admin Portal.
            </div>
          </div>
        )}

        {/* 7 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* 1. My Pieces Sold */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                My Sold
              </span>
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {summary.total_pieces_sold.toLocaleString()} <span className="text-xs font-semibold text-slate-400">PCS</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {summary.sales_count} Transactions
            </div>
          </div>

          {/* 2. My Revenue */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Revenue
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-700 font-mono">
              ₹{summary.total_revenue.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Individual Total
            </div>
          </div>

          {/* 3. Opening Stock */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Opening Stock
              </span>
              <Boxes className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold text-blue-900">
              {summary.total_opening_stock.toLocaleString()} <span className="text-xs font-semibold text-slate-400">PCS</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Editable Stock
            </div>
          </div>

          {/* 4. Closing Stock */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Closing Stock
              </span>
              <Package className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl font-extrabold text-indigo-900">
              {summary.total_closing_stock.toLocaleString()} <span className="text-xs font-semibold text-slate-400">PCS</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Current Live Store Stock
            </div>
          </div>

          {/* 5. Low Stock */}
          <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/80 shadow-sm">
            <div className="flex items-center justify-between text-amber-600 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Low Stock
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-amber-900">
              {summary.low_stock_count} <span className="text-xs font-semibold text-amber-700">Items</span>
            </div>
            <div className="text-[11px] text-amber-700 mt-1">
              1 – 4 PCS remaining
            </div>
          </div>

          {/* 6. Out of Stock */}
          <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-200/80 shadow-sm">
            <div className="flex items-center justify-between text-rose-600 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                Out of Stock
              </span>
              <AlertOctagon className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl font-extrabold text-rose-900">
              {summary.out_of_stock_count} <span className="text-xs font-semibold text-rose-700">Items</span>
            </div>
            <div className="text-[11px] text-rose-700 mt-1">
              0 PCS available
            </div>
          </div>

          {/* 7. Overflow */}
          <div className="bg-purple-50/60 rounded-2xl p-4 border border-purple-200/80 shadow-sm">
            <div className="flex items-center justify-between text-purple-600 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                Overflow
              </span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-extrabold text-purple-900">
              {summary.overflow_stock_count} <span className="text-xs font-semibold text-purple-700">Items</span>
            </div>
            <div className="text-[11px] text-purple-700 mt-1">
              &gt; 10 PCS excess
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
              <span>Catalog Stock & Opening Stock ({filteredItems.length})</span>
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
            <span>Opening stock is editable directly in the stock table below</span>
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
                  { id: "SOLD", label: "My Sold Items" },
                  { id: "LOW", label: `Low Stock (${summary.low_stock_count})` },
                  { id: "OUT", label: `Out of Stock (${summary.out_of_stock_count})` },
                  { id: "OVERFLOW", label: `Overflow (${summary.overflow_stock_count})` },
                  { id: "HEALTHY", label: `Healthy (${summary.healthy_stock_count})` },
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
                <TableSkeleton rows={8} cols={7} />
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
                        <th className="px-5 py-3.5 font-semibold">Index No.</th>
                        <th className="px-5 py-3.5 font-semibold">Product Name & Specifications</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Selling Rate</th>
                        <th className="px-5 py-3.5 font-semibold text-center">My Pieces Sold</th>
                        <th className="px-5 py-3.5 font-semibold text-center bg-indigo-50/60 text-indigo-900">
                          Opening Stock
                          <span className="block text-[9px] font-normal text-indigo-700 lowercase">(editable)</span>
                        </th>
                        <th className="px-5 py-3.5 font-semibold text-center bg-slate-50">
                          Closing Stock
                          <span className="block text-[9px] font-normal text-slate-500 lowercase">(live store stock)</span>
                        </th>
                        <th className="px-5 py-3.5 font-semibold text-center">Stock Status</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => {
                        const isOut = item.closing_stock === 0;
                        const isLow = item.closing_stock > 0 && item.closing_stock < 5;
                        const isOverflow = item.closing_stock > 10;
                        const isHealthy = item.closing_stock >= 5 && item.closing_stock <= 10;

                        return (
                          <tr
                            key={item.product_id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              item.has_sales ? "bg-indigo-50/20" : ""
                            }`}
                          >
                            {/* Index No */}
                            <td className="px-5 py-3.5 font-mono text-xs font-extrabold text-indigo-700">
                              {item.index_no}
                            </td>

                            {/* Product Info */}
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900">{item.name}</div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">{item.brand}</span>
                                {item.colour && <span>Color: {item.colour}</span>}
                                <span>Pack: {item.case_pack} pcs/case</span>
                              </div>
                            </td>

                            {/* Price */}
                            <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-800">
                              ₹{item.selling_rate.toLocaleString("en-IN")}
                            </td>

                            {/* My Pieces Sold */}
                            <td className="px-5 py-3.5 text-center">
                              {item.pieces_sold > 0 ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-extrabold text-emerald-700 text-sm">
                                    {viewUnit === "pieces"
                                      ? `${item.pieces_sold} PCS`
                                      : `${item.cases_sold} Cases`}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ₹{item.revenue.toLocaleString("en-IN")}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-mono text-xs">0</span>
                              )}
                            </td>

                            {/* Opening Stock (Editable!) */}
                            <td className="px-5 py-3.5 text-center bg-indigo-50/30">
                              <div className="inline-flex items-center gap-2 font-bold text-slate-800 text-sm">
                                <span>
                                  {viewUnit === "pieces"
                                    ? `${item.opening_stock} PCS`
                                    : `${(item.opening_stock / item.case_pack).toFixed(2)} Cases`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditOpeningModal(item)}
                                  className="p-1 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 transition"
                                  title="Edit Opening Stock"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* Closing Stock */}
                            <td className="px-5 py-3.5 text-center font-bold">
                              <div className="inline-flex flex-col items-center">
                                <span className={`text-sm ${
                                  isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                                }`}>
                                  {viewUnit === "pieces"
                                    ? `${item.closing_stock} PCS`
                                    : `${(item.closing_stock / item.case_pack).toFixed(2)} Cases`}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {item.closing_cases} cs + {item.closing_remainder} pcs
                                </span>
                              </div>
                            </td>

                            {/* Stock Status Badge */}
                            <td className="px-5 py-3.5 text-center">
                              {isOut && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertOctagon className="w-3.5 h-3.5" />
                                  <span>Out of Stock</span>
                                </span>
                              )}
                              {isLow && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Low Stock (&lt;5)</span>
                                </span>
                              )}
                              {isOverflow && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>Overflow (&gt;10)</span>
                                </span>
                              )}
                              {isHealthy && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Healthy</span>
                                </span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenEditOpeningModal(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition border border-indigo-200"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Opening</span>
                              </button>
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

      {/* EDIT OPENING STOCK MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl text-white">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Edit Opening Stock</h3>
                  <p className="text-xs text-indigo-200">Adjust stock baseline for this item</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditOpeningModal}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveOpeningStock} className="p-6 space-y-5">
              {/* Product Info Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-indigo-700 text-xs">
                    Index #{editingItem.index_no}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {editingItem.brand}
                  </span>
                </div>
                <div className="font-bold text-slate-900 text-sm">{editingItem.name}</div>
                <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                  <span>Store: <strong className="text-slate-800">{storeName}</strong></span>
                  <span>Rate: <strong className="text-emerald-700 font-mono">₹{editingItem.selling_rate}</strong></span>
                </div>
              </div>

              {/* Current Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Already Sold
                  </span>
                  <span className="text-lg font-extrabold text-emerald-800">
                    {editingItem.pieces_sold} PCS
                  </span>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Current Closing Stock
                  </span>
                  <span className="text-lg font-extrabold text-slate-800">
                    {editingItem.closing_stock} PCS
                  </span>
                </div>
              </div>

              {/* Input for Target Opening Stock */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  New Opening Stock (Pieces) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={editingItem.pieces_sold}
                  value={newOpeningStock}
                  onChange={(e) => setNewOpeningStock(e.target.value)}
                  className="w-full text-lg font-bold px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Must be at least <strong>{editingItem.pieces_sold} PCS</strong> (volume already sold in this period).
                </p>
              </div>

              {/* Resulting Closing Stock Preview */}
              {(() => {
                const entered = parseInt(newOpeningStock, 10);
                if (!isNaN(entered)) {
                  const resultingClosing = entered - editingItem.pieces_sold;
                  return (
                    <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      resultingClosing >= 0
                        ? "bg-indigo-50/70 border-indigo-200 text-indigo-950"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    }`}>
                      <span className="font-semibold">Calculated New Closing Stock:</span>
                      <span className="font-extrabold font-mono text-sm">
                        {resultingClosing >= 0 ? `${resultingClosing} PCS` : "Invalid (< 0)"}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEditOpeningModal}
                  disabled={savingStock}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStock}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-indigo-600/30 transition flex items-center gap-2"
                >
                  {savingStock ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Opening Stock</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default EmployeeSalesDashboard;
