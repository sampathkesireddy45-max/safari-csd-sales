import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getReconciliationWorksheet,
  submitReconciliation,
  getReconciliationHistory,
  getLocations,
} from "../services/api";
import Layout from "../components/Layout";
import { useToast } from "../components/Toast";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  Clock,
  Check,
  Plus,
  Minus,
  Eye,
  X,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const ShiftReconciliation = () => {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("reconcile"); // "reconcile" | "history"

  // Reconciliation Worksheet Form State
  const todayStr = new Date().toISOString().split("T")[0];
  const [reconciliationDate, setReconciliationDate] = useState(todayStr);
  const [shiftType, setShiftType] = useState("daily"); // "daily" | "opening" | "closing"
  const [selectedLocationId, setSelectedLocationId] = useState(user?.assigned_location_id || "");
  const [locations, setLocations] = useState([]);

  // Worksheet Data
  const [worksheet, setWorksheet] = useState(null);
  const [counts, setCounts] = useState({}); // { [productId]: { physical_pieces: number, notes: string } }
  const [autoAdjust, setAutoAdjust] = useState(true);
  const [shiftNotes, setShiftNotes] = useState("");
  const [loadingWorksheet, setLoadingWorksheet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Search & Filters in Worksheet
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "discrepancies" | "matched"
  const [categoryFilter, setCategoryFilter] = useState("all");

  // History State
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Load locations on mount
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const locs = await getLocations();
        setLocations(locs || []);
        if (isAdmin && locs?.length && !selectedLocationId) {
          setSelectedLocationId(locs[0].id);
        } else if (!isAdmin && user?.assigned_location_id) {
          setSelectedLocationId(user.assigned_location_id);
        }
      } catch (err) {
        console.error("Failed to load locations", err);
      }
    };
    loadLocations();
  }, [isAdmin, user]);

  // Load worksheet whenever location, date, or shift changes
  const fetchWorksheet = async () => {
    const locId = selectedLocationId || user?.assigned_location_id;
    if (!locId) return;

    setLoadingWorksheet(true);
    try {
      const data = await getReconciliationWorksheet({
        location_id: locId,
        reconciliation_date: reconciliationDate,
        shift_type: shiftType,
      });
      setWorksheet(data);

      // Initialize physical count state with expected count by default
      const initialCounts = {};
      (data?.items || []).forEach((item) => {
        initialCounts[item.product_id] = {
          physical_pieces: item.expected_pieces,
          notes: "",
        };
      });
      setCounts(initialCounts);
    } catch (err) {
      addToast(err.message || "Failed to load reconciliation worksheet", "error");
    } finally {
      setLoadingWorksheet(false);
    }
  };

  useEffect(() => {
    if (selectedLocationId && activeTab === "reconcile") {
      fetchWorksheet();
    }
  }, [selectedLocationId, reconciliationDate, shiftType]);

  // Load history
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getReconciliationHistory({
        location_id: isAdmin ? selectedLocationId : undefined,
      });
      setHistory(res?.reconciliations || []);
    } catch (err) {
      addToast(err.message || "Failed to load past reconciliations", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, selectedLocationId]);

  // Quick Action: Pre-fill all with expected
  const handleMatchAll = () => {
    if (!worksheet?.items) return;
    const newCounts = { ...counts };
    worksheet.items.forEach((item) => {
      newCounts[item.product_id] = {
        ...newCounts[item.product_id],
        physical_pieces: item.expected_pieces,
      };
    });
    setCounts(newCounts);
    addToast("All physical counts matched with expected stock", "success");
  };

  // Quick Action: Reset physical to 0
  const handleResetToZero = () => {
    if (!worksheet?.items) return;
    const newCounts = { ...counts };
    worksheet.items.forEach((item) => {
      newCounts[item.product_id] = {
        ...newCounts[item.product_id],
        physical_pieces: 0,
      };
    });
    setCounts(newCounts);
  };

  const handlePhysicalCountChange = (productId, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setCounts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        physical_pieces: num,
      },
    }));
  };

  const handleNoteChange = (productId, val) => {
    setCounts((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        notes: val,
      },
    }));
  };

  // Calculations for Summary
  const summary = useMemo(() => {
    if (!worksheet?.items) return { expected: 0, physical: 0, variance: 0, discrepancies: 0 };
    let expected = 0;
    let physical = 0;
    let discrepancies = 0;

    worksheet.items.forEach((item) => {
      const exp = item.expected_pieces || 0;
      const phys = counts[item.product_id]?.physical_pieces ?? exp;
      expected += exp;
      physical += phys;
      if (phys !== exp) discrepancies += 1;
    });

    return {
      expected,
      physical,
      variance: physical - expected,
      discrepancies,
    };
  }, [worksheet, counts]);

  // Filter items in worksheet
  const filteredItems = useMemo(() => {
    if (!worksheet?.items) return [];
    return worksheet.items.filter((item) => {
      const p = counts[item.product_id];
      const phys = p?.physical_pieces ?? item.expected_pieces;
      const variance = phys - item.expected_pieces;

      if (statusFilter === "discrepancies" && variance === 0) return false;
      if (statusFilter === "matched" && variance !== 0) return false;

      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.product_name?.toLowerCase().includes(q);
        const matchesIndex = item.index_no?.toLowerCase().includes(q);
        const matchesColour = item.colour?.toLowerCase().includes(q);
        const matchesBrand = item.brand?.toLowerCase().includes(q);
        if (!matchesName && !matchesIndex && !matchesColour && !matchesBrand) return false;
      }

      return true;
    });
  }, [worksheet, counts, statusFilter, categoryFilter, searchQuery]);

  const uniqueCategories = useMemo(() => {
    if (!worksheet?.items) return [];
    const cats = new Set(worksheet.items.map((i) => i.category).filter(Boolean));
    return Array.from(cats);
  }, [worksheet]);

  // Submit Handler
  const handleConfirmSubmit = async () => {
    if (!worksheet?.items) return;

    setSubmitting(true);
    try {
      const itemsPayload = worksheet.items.map((item) => {
        const c = counts[item.product_id] || {};
        const phys = c.physical_pieces ?? item.expected_pieces;
        return {
          product_id: item.product_id,
          opening_pieces: item.current_stock,
          received_pieces: 0,
          sold_pieces: item.sold_today,
          damaged_pieces: item.damaged_today,
          expected_pieces: item.expected_pieces,
          physical_pieces: phys,
          notes: c.notes || null,
        };
      });

      const payload = {
        reconciliation_date: reconciliationDate,
        shift_type: shiftType,
        location_id: selectedLocationId,
        auto_adjust_inventory: autoAdjust,
        notes: shiftNotes || null,
        items: itemsPayload,
      };

      await submitReconciliation(payload);
      addToast(
        `Shift reconciliation submitted successfully! ${
          summary.discrepancies === 0 ? "Inventory balanced perfectly." : `${summary.discrepancies} variance items logged.`
        }`,
        "success"
      );
      setShowConfirmModal(false);
      setShiftNotes("");
      // Refresh worksheet to display updated state
      fetchWorksheet();
    } catch (err) {
      addToast(err.message || "Failed to submit reconciliation", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Daily Shift Stock Reconciliation"
      subtitle="Shift opening & closing physical piece count verification with instant variance detection"
      action={
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("reconcile")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "reconcile"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Reconcile Shift
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "history"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Past Reconciliations
            </button>
          </div>
        </div>
      }
    >
      {activeTab === "reconcile" ? (
        <div className="space-y-6">
          {/* Controls Bar: Location, Date, Shift Type */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {isAdmin ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Store Location / Counter
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Assigned Counter
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span>{worksheet?.location_name || user?.assigned_location_name || "Counter"}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Audit Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={reconciliationDate}
                    onChange={(e) => setReconciliationDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Shift Timing
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <select
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                  >
                    <option value="daily">Daily Total Reconciliation</option>
                    <option value="opening">Shift Opening (Handover Start)</option>
                    <option value="closing">Shift Closing (Handover End)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchWorksheet}
                  disabled={loadingWorksheet}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingWorksheet ? "animate-spin" : ""}`} />
                  <span>Reload Sheet</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Expected Stock
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {summary.expected}
                </span>
                <span className="text-xs text-slate-400">PCS</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">System recorded stock</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Physical Counted
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {summary.physical}
                </span>
                <span className="text-xs text-slate-400">PCS</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Physical stock at counter</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Net Variance
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    summary.variance === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : summary.variance > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {summary.variance > 0 ? `+${summary.variance}` : summary.variance}
                </span>
                <span className="text-xs text-slate-400">PCS</span>
              </div>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                  summary.variance === 0
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : summary.variance > 0
                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                    : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                }`}
              >
                {summary.variance === 0 ? "Perfect Balance" : summary.variance > 0 ? "Net Surplus" : "Net Shortage"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Discrepancies
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    summary.discrepancies === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {summary.discrepancies}
                </span>
                <span className="text-xs text-slate-400">SKUs</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {summary.discrepancies === 0 ? "All items matched" : "Items requiring audit"}
              </p>
            </div>
          </div>

          {/* Quick Actions & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter product by name, index, colour..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                />
              </div>

              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === "all"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  All ({worksheet?.items?.length || 0})
                </button>
                <button
                  onClick={() => setStatusFilter("discrepancies")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === "discrepancies"
                      ? "bg-rose-500 text-white shadow-sm"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  Discrepancies ({summary.discrepancies})
                </button>
                <button
                  onClick={() => setStatusFilter("matched")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === "matched"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  Matched ({(worksheet?.items?.length || 0) - summary.discrepancies})
                </button>
              </div>

              {uniqueCategories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none dark:text-white"
                >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleMatchAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-all"
                title="Set all physical counts to match expected stock"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Pre-fill Expected</span>
              </button>
              <button
                onClick={handleResetToZero}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
                title="Clear all physical counts to 0"
              >
                <span>Zero All</span>
              </button>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-3 text-center">System Stock</th>
                    <th className="py-3 px-3 text-center">Sales Today</th>
                    <th className="py-3 px-3 text-center">Damages Today</th>
                    <th className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                      Expected Pcs
                    </th>
                    <th className="py-3 px-4 text-center font-bold text-indigo-600 dark:text-indigo-400 w-48">
                      Physical Count
                    </th>
                    <th className="py-3 px-3 text-center">Live Variance</th>
                    <th className="py-3 px-4">Counter Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loadingWorksheet ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Loading store inventory & live sales telemetry...</span>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-500">
                        No products match your search or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const p = counts[item.product_id] || { physical_pieces: item.expected_pieces, notes: "" };
                      const phys = p.physical_pieces ?? item.expected_pieces;
                      const variance = phys - item.expected_pieces;
                      const hasDiscrepancy = variance !== 0;

                      return (
                        <tr
                          key={item.product_id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            hasDiscrepancy
                              ? variance > 0
                                ? "bg-amber-50/30 dark:bg-amber-950/10"
                                : "bg-rose-50/30 dark:bg-rose-950/10"
                              : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {item.product_name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                              {item.index_no && (
                                <span className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded">
                                  {item.index_no}
                                </span>
                              )}
                              <span>{item.brand}</span>
                              {item.colour && <span>• {item.colour}</span>}
                              {item.category && <span>• {item.category}</span>}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-300 font-mono">
                            {item.current_stock}
                          </td>

                          <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-300 font-mono">
                            {item.sold_today > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                -{item.sold_today}
                              </span>
                            ) : (
                              "0"
                            )}
                          </td>

                          <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-300 font-mono">
                            {item.damaged_today > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                -{item.damaged_today}
                              </span>
                            ) : (
                              "0"
                            )}
                          </td>

                          <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-white font-mono text-sm">
                            {item.expected_pieces}
                          </td>

                          {/* Physical Count with Stepper */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handlePhysicalCountChange(item.product_id, phys - 1)
                                }
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={phys}
                                onChange={(e) =>
                                  handlePhysicalCountChange(item.product_id, e.target.value)
                                }
                                className={`w-16 text-center py-1 font-bold text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${
                                  hasDiscrepancy
                                    ? variance > 0
                                      ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 text-amber-900 dark:text-amber-200"
                                      : "bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-900 dark:text-rose-200"
                                    : "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-900 dark:text-emerald-200"
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handlePhysicalCountChange(item.product_id, phys + 1)
                                }
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Live Variance Badge */}
                          <td className="py-3 px-3 text-center">
                            {variance === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                <Check className="w-3 h-3" />
                                <span>0 (Match)</span>
                              </span>
                            ) : variance > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="w-3 h-3" />
                                <span>+{variance} (Surplus)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                                <AlertCircle className="w-3 h-3" />
                                <span>{variance} (Shortage)</span>
                              </span>
                            )}
                          </td>

                          {/* Item Note */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder={hasDiscrepancy ? "Reason for variance..." : "Optional remark"}
                              value={p.notes || ""}
                              onChange={(e) => handleNoteChange(item.product_id, e.target.value)}
                              className="w-full text-xs py-1 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submission Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-500" />
              <span>Finalize & Submit Shift Reconciliation</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Overall Shift Notes / Handover Remarks
                </label>
                <textarea
                  rows="2"
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="e.g., Opening shift balance confirmed. Cash box and physical luggage verified."
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                />
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAdjust}
                    onChange={(e) => setAutoAdjust(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Auto-synchronize store stock to physical counts
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Updates the live inventory to match verified physical pieces and generates an official audit trail transaction.
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    disabled={submitting || loadingWorksheet || !worksheet?.items?.length}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Submit & Reconcile Shift</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                <span>Shift Reconciliation Audit Log</span>
              </h3>
              <button
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
                <span>Refresh Log</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Date & Shift</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Submitted By</th>
                    <th className="py-3 px-3 text-center">Expected</th>
                    <th className="py-3 px-3 text-center">Physical</th>
                    <th className="py-3 px-3 text-center">Net Variance</th>
                    <th className="py-3 px-3 text-center">Discrepant SKUs</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Loading audit records...</span>
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500">
                        No shift reconciliations found yet for this location.
                      </td>
                    </tr>
                  ) : (
                    history.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.reconciliation_date}
                          </div>
                          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 capitalize">
                            {item.shift_type} shift
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {item.location_name}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          {item.employee_name}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-medium">
                          {item.total_expected_pieces}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-medium text-indigo-600 dark:text-indigo-400">
                          {item.total_physical_pieces}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span
                            className={
                              item.total_variance === 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : item.total_variance > 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
                            {item.total_variance > 0 ? `+${item.total_variance}` : item.total_variance}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {item.discrepancy_items_count > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                              {item.discrepancy_items_count} items
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              0
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                              item.status === "verified"
                                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                                : item.status === "balanced"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {item.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedHistoryItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Breakdown</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-600" />
                <span>Confirm Shift Submission</span>
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Shift:</span>
                <span className="font-semibold text-slate-900 dark:text-white capitalize">
                  {reconciliationDate} ({shiftType})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Counter:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {worksheet?.location_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expected Total:</span>
                <span className="font-semibold">{summary.expected} PCS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Physical Counted:</span>
                <span className="font-semibold text-indigo-600">{summary.physical} PCS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Net Variance:</span>
                <span
                  className={`font-bold ${
                    summary.variance === 0
                      ? "text-emerald-600"
                      : summary.variance > 0
                      ? "text-amber-600"
                      : "text-rose-600"
                  }`}
                >
                  {summary.variance > 0 ? `+${summary.variance}` : summary.variance} PCS
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Discrepant SKUs:</span>
                <span className="font-bold">{summary.discrepancies}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Auto Sync Stock:</span>
                <span className="font-semibold text-indigo-600">
                  {autoAdjust ? "Enabled (Live Stock Sync)" : "Disabled (Record Only)"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/30"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? "Submitting..." : "Confirm & Save"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Detail Breakdown Modal */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  <span>Reconciliation Audit #{selectedHistoryItem.id}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedHistoryItem.reconciliation_date} • {selectedHistoryItem.location_name} • Submitted by {selectedHistoryItem.employee_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto py-4 flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                    <th className="py-2.5 px-3">Product SKU</th>
                    <th className="py-2.5 px-2 text-center">Expected</th>
                    <th className="py-2.5 px-2 text-center">Physical</th>
                    <th className="py-2.5 px-2 text-center">Variance</th>
                    <th className="py-2.5 px-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {selectedHistoryItem.items?.map((item) => (
                    <tr
                      key={item.id}
                      className={
                        item.variance !== 0
                          ? item.variance > 0
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : "bg-rose-50/40 dark:bg-rose-950/20"
                          : ""
                      }
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.product_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.index_no} • {item.colour || item.category}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">{item.expected_pieces}</td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {item.physical_pieces}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold">
                        <span
                          className={
                            item.variance === 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : item.variance > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {item.variance > 0 ? `+${item.variance}` : item.variance}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 italic">{item.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ShiftReconciliation;
