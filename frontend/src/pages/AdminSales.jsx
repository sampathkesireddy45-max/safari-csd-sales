import React, { useEffect, useState, useMemo } from "react";
import Layout from "../components/Layout";
import {
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
  Tag,
  Layers,
  Boxes,
  PackageCheck,
  FileText,
  Filter,
  ArrowUpDown,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import {
  exportAdminSalesXlsx,
  exportAdminSalesCsv,
  exportAdminSalesIndexWiseCsv,
  getAdminSalesSummary,
  getEmployees,
} from "../services/api";
import { useToast } from "../components/Toast";

const AdminSales = () => {
  const { addToast } = useToast();
  const [summary, setSummary] = useState({
    overall: { sale_count: 0, total_pieces: 0, total_cost: 0 },
    employees: [],
    sales: [],
    index_wise_sales: [],
    index_summary: {
      total_indexes: 0,
      active_indexes_sold: 0,
      total_pieces: 0,
      total_revenue: 0,
    },
  });
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Controls for Index-wise Section
  const [indexSearch, setIndexSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all"); // 'all' or 'sold_only'
  const [viewUnit, setViewUnit] = useState("pieces"); // 'pieces' or 'cases'
  const [sortBy, setSortBy] = useState("pieces_sold"); // 'pieces_sold', 'revenue', 'index_no', 'price'
  const [sortOrder, setSortOrder] = useState("desc");

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

  const handleExportXlsx = async (employeeId = selectedEmployee, label = "Overall") => {
    setExporting(`xlsx_${label}`);
    try {
      const blob = await exportAdminSalesXlsx({
        ...(employeeId ? { employee_id: employeeId } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileScope = employeeId ? `individual_${label.toLowerCase().replaceAll(" ", "_")}` : "overall";
      link.download = `sales_${fileScope}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      addToast("Excel report with Index Summary & Transactions downloaded!", "success");
    } catch (error) {
      addToast(error.message || "Export failed", "error");
    } finally {
      setExporting("");
    }
  };

  const handleExportIndexCsv = async () => {
    setExporting("index_csv");
    try {
      const blob = await exportAdminSalesIndexWiseCsv({
        ...(selectedEmployee ? { employee_id: selectedEmployee } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `index_wise_sales_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      addToast("Index-Wise sales CSV downloaded!", "success");
    } catch (error) {
      addToast(error.message || "CSV Export failed", "error");
    } finally {
      setExporting("");
    }
  };

  const handleExportTxCsv = async () => {
    setExporting("tx_csv");
    try {
      const blob = await exportAdminSalesCsv(selectedEmployee);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      addToast("Transactions CSV downloaded!", "success");
    } catch (error) {
      addToast(error.message || "CSV Export failed", "error");
    } finally {
      setExporting("");
    }
  };

  // Filter and sort for Index-wise sales
  const filteredIndexSales = useMemo(() => {
    let list = summary.index_wise_sales || [];

    if (salesFilter === "sold_only") {
      list = list.filter((item) => item.total_pieces_sold > 0);
    }

    if (selectedBrand !== "all") {
      list = list.filter((item) => (item.brand || "").toUpperCase() === selectedBrand.toUpperCase());
    }

    if (indexSearch.trim()) {
      const term = indexSearch.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.index_no?.toLowerCase().includes(term) ||
          item.name?.toLowerCase().includes(term) ||
          item.colour?.toLowerCase().includes(term) ||
          item.category?.toLowerCase().includes(term)
      );
    }

    return [...list].sort((a, b) => {
      let valA, valB;
      if (sortBy === "pieces_sold") {
        valA = a.total_pieces_sold;
        valB = b.total_pieces_sold;
      } else if (sortBy === "revenue") {
        valA = a.total_revenue;
        valB = b.total_revenue;
      } else if (sortBy === "price") {
        valA = a.selling_rate;
        valB = b.selling_rate;
      } else {
        valA = a.index_no || "";
        valB = b.index_no || "";
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });
  }, [summary.index_wise_sales, salesFilter, selectedBrand, indexSearch, sortBy, sortOrder]);

  // Overall totals for index-wise table view
  const indexViewTotals = useMemo(() => {
    return filteredIndexSales.reduce(
      (acc, item) => {
        acc.pieces += item.total_pieces_sold;
        acc.cases += item.total_cases_sold;
        acc.revenue += item.total_revenue;
        acc.transactions += item.transactions_count;
        if (item.total_pieces_sold > 0) acc.activeCount += 1;
        return acc;
      },
      { pieces: 0, cases: 0, revenue: 0, transactions: 0, activeCount: 0 }
    );
  }, [filteredIndexSales]);

  const filteredSales = (summary.sales || []).filter((sale) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [sale.employee_name, sale.location_name, String(sale.id)].some((value) =>
      value?.toLowerCase().includes(term)
    );
  });

  return (
    <Layout
      title="Sales Dashboard"
      subtitle="Analyze index-wise SKU performance, retail volume, and employee transactions"
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadSales()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>

          <button
            type="button"
            onClick={() => handleExportXlsx("", "Overall")}
            disabled={exporting.startsWith("xlsx")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm"
            title="Download multi-sheet Excel with Index-Wise Summary + Sale Transactions in correct IST"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting === "xlsx_Overall" ? "Exporting..." : "Export Excel (Multi-Sheet)"}
          </button>

          <div className="relative group inline-block">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV ▾
            </button>
            <div className="absolute right-0 mt-1 hidden group-hover:block w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
              <button
                type="button"
                onClick={handleExportIndexCsv}
                disabled={exporting === "index_csv"}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-medium flex items-center gap-2"
              >
                <Tag className="w-3.5 h-3.5 text-indigo-500" /> Index-Wise CSV
              </button>
              <button
                type="button"
                onClick={handleExportTxCsv}
                disabled={exporting === "tx_csv"}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-medium flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" /> Transactions CSV (IST)
              </button>
            </div>
          </div>

          {selectedEmployee && (
            <button
              type="button"
              onClick={() =>
                handleExportXlsx(
                  selectedEmployee,
                  employees.find((e) => String(e.id) === String(selectedEmployee))?.name || "Staff"
                )
              }
              disabled={Boolean(exporting)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export Selected Staff
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Date Filter Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">Date & Staff Filters</h2>
                <p className="text-[11px] text-slate-500">
                  Times and dates are calculated in Indian Standard Time (IST).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500">From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500">To:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => loadSales()}
                className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Apply
              </button>

              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setTimeout(() => loadSales(), 0);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                {selectedEmployee ? "Selected Staff Volume" : "Total Volume Sold"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-indigo-950">
              {(summary.overall?.total_pieces || 0).toLocaleString("en-IN")}{" "}
              <span className="text-xs font-bold text-indigo-600">PCS</span>
            </p>
            <p className="mt-1 text-xs text-indigo-700">
              {(summary.overall?.sale_count || 0).toLocaleString("en-IN")} transactions recorded
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Total Revenue
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                ₹
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-amber-950">
              ₹{Number(summary.overall?.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              CSD Canteen Selling Value
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Index SKU's Active
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-emerald-950">
              {summary.index_summary?.active_indexes_sold || 0}{" "}
              <span className="text-xs font-semibold text-emerald-600">
                / {summary.index_summary?.total_indexes || 100} SKU's
              </span>
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Distinct catalog index numbers sold
            </p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Active Staff Counter
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-sky-950">
              {summary.employees?.length || 0}
            </p>
            <p className="mt-1 text-xs text-sky-700">
              Employees with sales entries
            </p>
          </div>
        </div>

        {/* ---------------- NEW DEDICATED SECTION: INDIVIDUAL INDEX WISE SALES ---------------- */}
        <div className="rounded-2xl border-2 border-indigo-200 bg-white shadow-sm overflow-hidden">
          {/* Section Header */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">
                    Individual Index-Wise Sales Summary
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-[10px] font-bold text-indigo-200 uppercase tracking-wider">
                    Official CSD Catalog
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80 mt-0.5">
                  Complete index number breakdown showing selling price, pieces & cases sold, and revenue per SKU.
                </p>
              </div>
            </div>

            {/* View Unit Switcher */}
            <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-indigo-400/20 self-start md:self-auto">
              <span className="text-[10px] font-semibold text-indigo-200 px-2 uppercase tracking-wider">
                Display:
              </span>
              <button
                type="button"
                onClick={() => setViewUnit("pieces")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewUnit === "pieces"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <PackageCheck className="w-3.5 h-3.5" /> Pieces (PCS)
              </button>
              <button
                type="button"
                onClick={() => setViewUnit("cases")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewUnit === "cases"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Boxes className="w-3.5 h-3.5" /> Cases (Boxes)
              </button>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={indexSearch}
                  onChange={(e) => setIndexSearch(e.target.value)}
                  placeholder="Search Index No (e.g. #36812), Model, Colour..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Brand Filter */}
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Brands (SAFARI & U/J)</option>
                <option value="SAFARI">SAFARI Only</option>
                <option value="URBEN JUNGLE">URBEN JUNGLE Only</option>
              </select>

              {/* Sales Status Filter */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setSalesFilter("all")}
                  className={`px-2.5 py-1 rounded-lg ${
                    salesFilter === "all" ? "bg-slate-900 text-white font-bold" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All 100 SKU's
                </button>
                <button
                  type="button"
                  onClick={() => setSalesFilter("sold_only")}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                    salesFilter === "sold_only" ? "bg-emerald-600 text-white font-bold" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <TrendingUp className="w-3 h-3" /> Sold SKU's Only
                </button>
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="pieces_sold">Volume Sold (High to Low)</option>
                <option value="revenue">Total Revenue (High to Low)</option>
                <option value="price">Selling Price</option>
                <option value="index_no">Index Number</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                title={`Order: ${sortOrder.toUpperCase()}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Stats Pill Header */}
          <div className="px-5 py-2.5 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-slate-600">
              <span>
                Showing <strong className="text-slate-900 font-bold">{filteredIndexSales.length}</strong> Index SKU's
              </span>
              <span>·</span>
              <span>
                Sold in View: <strong className="text-indigo-700 font-black">{indexViewTotals.pieces} PCS</strong>
                {indexViewTotals.cases > 0 && (
                  <span className="text-indigo-500 font-medium ml-1">
                    (≈ {indexViewTotals.cases} Cases)
                  </span>
                )}
              </span>
              <span>·</span>
              <span>
                Value in View: <strong className="text-emerald-700 font-black">₹{indexViewTotals.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportIndexCsv}
              className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
            >
              <Download className="w-3.5 h-3.5" /> Export this Index Table (CSV)
            </button>
          </div>

          {/* Index Wise Table */}
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading Index Sales Data...</div>
          ) : filteredIndexSales.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No product indexes match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">CSD Index No.</th>
                    <th className="px-4 py-3">Model / Product Description</th>
                    <th className="px-3 py-3">Brand</th>
                    <th className="px-3 py-3">Colour / Cat</th>
                    <th className="px-3 py-3 text-right">Case Pack</th>
                    <th className="px-4 py-3 text-right">Selling Price (PC)</th>
                    <th className="px-4 py-3 text-right">Case Price</th>
                    <th className="px-4 py-3 text-right font-black text-indigo-700">Volume Sold</th>
                    <th className="px-4 py-3 text-right font-black text-emerald-700">Total Revenue</th>
                    <th className="px-4 py-3 text-center">Date Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIndexSales.map((item) => {
                    const hasSales = item.total_pieces_sold > 0;
                    return (
                      <tr
                        key={item.product_id}
                        className={`transition hover:bg-indigo-50/40 ${
                          hasSales ? "bg-white font-normal" : "bg-slate-50/40 text-slate-400"
                        }`}
                      >
                        {/* Index Number */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-bold ${
                              hasSales
                                ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                : "bg-slate-200/60 text-slate-600"
                            }`}
                          >
                            {item.index_no}
                          </span>
                        </td>

                        {/* Model Name */}
                        <td className="px-4 py-3">
                          <p className={`font-semibold ${hasSales ? "text-slate-900" : "text-slate-600"}`}>
                            {item.name}
                          </p>
                          {item.sub_category && (
                            <span className="text-[10px] text-slate-400">
                              {item.sub_category}
                            </span>
                          )}
                        </td>

                        {/* Brand */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.brand === "URBEN JUNGLE"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.brand}
                          </span>
                        </td>

                        {/* Colour & Category */}
                        <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                          {item.colour || "—"}
                          {item.category && (
                            <span className="ml-1 text-[10px] font-bold text-slate-400">
                              ({item.category})
                            </span>
                          )}
                        </td>

                        {/* Case Pack */}
                        <td className="px-3 py-3 text-right font-mono font-medium text-slate-600">
                          {item.case_pack} pcs
                        </td>

                        {/* Selling Price / PC */}
                        <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-900">
                          ₹{Number(item.selling_rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Case Price */}
                        <td className="px-4 py-3 text-right whitespace-nowrap text-slate-600">
                          ₹{Number(item.case_rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Volume Sold */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {hasSales ? (
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs">
                                {viewUnit === "cases"
                                  ? `${item.total_cases_sold} Cases`
                                  : `${item.total_pieces_sold} PCS`}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {viewUnit === "cases"
                                  ? `${item.total_pieces_sold} PCS`
                                  : `${item.total_cases_sold} Cases`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Total Revenue */}
                        <td className="px-4 py-3 text-right whitespace-nowrap font-black">
                          {hasSales ? (
                            <span className="text-emerald-700">
                              ₹{item.total_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-300">₹0.00</span>
                          )}
                        </td>

                        {/* Date Sold */}
                        <td className="px-4 py-3 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {item.date_sold || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer / Summary Row */}
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-right uppercase tracking-wider text-slate-700">
                      Index Total ({filteredIndexSales.length} SKU's):
                    </td>
                    <td className="px-4 py-3 text-right font-black text-indigo-900 whitespace-nowrap">
                      {viewUnit === "cases"
                        ? `${indexViewTotals.cases} Cases`
                        : `${indexViewTotals.pieces} PCS`}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-800 whitespace-nowrap">
                      ₹{indexViewTotals.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400">
                      —
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ---------------- EMPLOYEE SALES SECTION ---------------- */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Individual Employee Sales</h2>
              <p className="text-xs text-slate-500 mt-1">
                Select an employee to isolate their transactions and export personalized statements.
              </p>
            </div>
            <select
              value={selectedEmployee}
              onChange={handleEmployeeChange}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs min-w-56 font-semibold"
            >
              <option value="">All employees / overall view</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.employee_id})
                </option>
              ))}
            </select>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(summary.employees || []).map((employee) => (
              <button
                type="button"
                key={employee.id}
                onClick={() => {
                  setSelectedEmployee(String(employee.id));
                  loadSales(String(employee.id));
                }}
                className={`text-left rounded-xl border p-4 transition ${
                  String(selectedEmployee) === String(employee.id)
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 hover:border-indigo-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{employee.name}</p>
                    <p className="text-[11px] text-slate-500">{employee.employee_id}</p>
                  </div>
                  <span className="text-lg font-black text-indigo-700">{employee.total_pieces} PCS</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {employee.sale_count} transactions · ₹
                  {Number(employee.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </button>
            ))}
            {summary.employees?.length === 0 && (
              <p className="lg:col-span-2 py-8 text-center text-sm text-slate-400">
                No employee sales entries recorded yet.
              </p>
            )}
          </div>
        </div>

        {/* ---------------- SALE TRANSACTIONS SECTION ---------------- */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Sale Transactions (IST Log)</h2>
                <p className="text-xs text-slate-500">
                  Showing {filteredSales.length} recorded retail transactions with exact Indian Standard Time
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transaction, staff, or location..."
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>
          {loading ? (
            <p className="p-10 text-center text-sm text-slate-400">Loading transactions...</p>
          ) : filteredSales.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">No transactions entered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Sale ID</th>
                    <th>IST Date & Time</th>
                    <th>Employee</th>
                    <th>Location</th>
                    <th>Items Sold (Index & SKU)</th>
                    <th>Total Value</th>
                    <th className="text-right px-5">Total Pieces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-mono font-bold text-indigo-600">#{sale.id}</td>
                      <td>
                        <div className="font-medium text-slate-800">
                          {sale.formatted_date || (sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : "—")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {sale.formatted_time || (sale.sale_date ? new Date(sale.sale_date).toLocaleTimeString() : "")}
                        </div>
                      </td>
                      <td className="font-medium text-slate-800">{sale.employee_name}</td>
                      <td className="text-slate-600">{sale.location_name}</td>
                      <td>
                        {sale.items && sale.items.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {sale.items.map((it, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]"
                              >
                                <strong className="font-mono text-indigo-600">{it.index_no}</strong>: {it.quantity} pcs
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">{sale.item_count} items</span>
                        )}
                      </td>
                      <td className="font-bold text-emerald-700">
                        ₹{Number(sale.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right px-5 font-black text-indigo-900">
                        {sale.total_pieces} PCS
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminSales;
