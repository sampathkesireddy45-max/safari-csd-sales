import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getReconciliationHistory,
  verifyReconciliation,
  getLocations,
  exportReconciliationCsvUrl,
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
  Eye,
  X,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Filter,
  PlusCircle,
} from "lucide-react";

const AdminReconciliation = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [reconciliations, setReconciliations] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState("");
  const [shiftType, setShiftType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Review & Verify Modal
  const [reviewModalItem, setReviewModalItem] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Load locations on mount
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const data = await getLocations();
        setLocations(data || []);
      } catch (err) {
        console.error("Failed to load locations", err);
      }
    };
    loadLocations();
  }, []);

  // Fetch History
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await getReconciliationHistory({
        location_id: selectedLocation ? Number(selectedLocation) : undefined,
        shift_type: shiftType !== "all" ? shiftType : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 200,
      });
      setReconciliations(res?.reconciliations || []);
      setTotalRecords(res?.total || 0);
    } catch (err) {
      addToast(err.message || "Failed to load shift reconciliations", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedLocation, shiftType, statusFilter, dateFrom, dateTo]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let balancedCount = 0;
    let varianceCount = 0;
    let verifiedCount = 0;
    let totalVar = 0;

    reconciliations.forEach((r) => {
      if (r.status === "balanced") balancedCount += 1;
      else if (r.status === "variance_flagged") varianceCount += 1;
      else if (r.status === "verified") verifiedCount += 1;
      totalVar += r.total_variance || 0;
    });

    return {
      total: reconciliations.length,
      balancedCount,
      varianceCount,
      verifiedCount,
      netVariance: totalVar,
    };
  }, [reconciliations]);

  const handleOpenReview = (item) => {
    setReviewModalItem(item);
    setVerificationNotes(item.verification_notes || "");
  };

  const handleVerify = async (newStatus = "verified") => {
    if (!reviewModalItem) return;
    setVerifying(true);
    try {
      const updated = await verifyReconciliation(reviewModalItem.id, {
        verification_notes: verificationNotes,
        status: newStatus,
      });
      addToast(`Reconciliation #${reviewModalItem.id} updated to ${newStatus}`, "success");
      setReviewModalItem(null);
      fetchRecords();
    } catch (err) {
      addToast(err.message || "Failed to verify reconciliation", "error");
    } finally {
      setVerifying(false);
    }
  };

  const exportUrl = exportReconciliationCsvUrl({
    location_id: selectedLocation || undefined,
    shift_type: shiftType !== "all" ? shiftType : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  return (
    <Layout
      title="Store Stock Reconciliations Audit"
      subtitle="Supervise daily shift opening & closing stock handovers across all retail counters"
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/employee/reconciliation"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Counter Count</span>
          </Link>
          <a
            href={exportUrl}
            download="stock_reconciliations.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 rounded-xl shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Shift Audits
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {kpis.total}
              </span>
              <span className="text-xs text-slate-400">Audits</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Across all store counters</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Flagged Variances
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {kpis.varianceCount}
              </span>
              <span className="text-xs text-slate-400">Shifts</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Requires supervisor audit</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Balanced Shifts
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {kpis.balancedCount}
              </span>
              <span className="text-xs text-slate-400">100% Match</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Zero stock discrepancies</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Admin Verified
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {kpis.verifiedCount}
              </span>
              <span className="text-xs text-slate-400">Approved</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Formally audited by admin</p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Store Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
              >
                <option value="">All Counter Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Shift Type
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
              >
                <option value="all">All Shifts</option>
                <option value="daily">Daily Total</option>
                <option value="opening">Shift Opening</option>
                <option value="closing">Shift Closing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="variance_flagged">Flagged Variances Only</option>
                <option value="balanced">Balanced Only</option>
                <option value="verified">Verified Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Date Range
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
                  title="From Date"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
                  title="To Date"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchRecords}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Shift & Date</th>
                  <th className="py-3 px-4">Store Counter</th>
                  <th className="py-3 px-4">Submitted By</th>
                  <th className="py-3 px-3 text-center">Expected</th>
                  <th className="py-3 px-3 text-center">Physical</th>
                  <th className="py-3 px-3 text-center">Net Variance</th>
                  <th className="py-3 px-3 text-center">Discrepant SKUs</th>
                  <th className="py-3 px-3 text-center">Auto-Sync</th>
                  <th className="py-3 px-3 text-center">Audit Status</th>
                  <th className="py-3 px-4 text-center">Supervision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <span>Loading shift reconciliations...</span>
                    </td>
                  </tr>
                ) : reconciliations.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-12 text-center text-slate-500">
                      No shift reconciliations found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
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

                      <td className="py-3 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
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
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.inventory_adjusted
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              : "bg-slate-50 dark:bg-slate-900 text-slate-400"
                          }`}
                        >
                          {item.inventory_adjusted ? "Synced" : "No"}
                        </span>
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
                          onClick={() => handleOpenReview(item)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Audit & Verify</span>
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

      {/* Review & Verify Modal */}
      {reviewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <span>Audit Review: Reconciliation #{reviewModalItem.id}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reviewModalItem.reconciliation_date} ({reviewModalItem.shift_type}) • {reviewModalItem.location_name} • Counter Staff: {reviewModalItem.employee_name}
                </p>
              </div>
              <button
                onClick={() => setReviewModalItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notes if submitter provided */}
            {reviewModalItem.notes && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Staff Handover Notes: </span>
                <span className="text-slate-600 dark:text-slate-400">{reviewModalItem.notes}</span>
              </div>
            )}

            {/* SKU Table */}
            <div className="overflow-y-auto py-4 flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                    <th className="py-2.5 px-3">Product SKU</th>
                    <th className="py-2.5 px-2 text-center">Expected</th>
                    <th className="py-2.5 px-2 text-center">Physical</th>
                    <th className="py-2.5 px-2 text-center">Variance</th>
                    <th className="py-2.5 px-3">Staff Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {reviewModalItem.items?.map((item) => (
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

            {/* Verification Form */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Supervisor Verification Remarks
                </label>
                <textarea
                  rows="2"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="e.g., Variance reviewed with staff. Shortage accounted for in breakage log."
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {reviewModalItem.verified_by ? (
                    <span>
                      Previously verified by {reviewModalItem.verifier_name} on{" "}
                      {new Date(reviewModalItem.verified_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>Pending supervisor approval</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalItem(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerify("verified")}
                    disabled={verifying}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/30"
                  >
                    <Check className="w-4 h-4" />
                    <span>{verifying ? "Saving..." : "Approve & Mark Verified"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminReconciliation;
