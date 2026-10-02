import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getAdminDashboardStats,
  getProducts,
  getLocations,
  resetInventoryToZero,
  markDamageReplaced
} from "../services/api";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import ImageLightbox from "../components/ImageLightbox";
import StockEntryModal from "../components/StockEntryModal";
import AnimatedNumber from "../components/AnimatedNumber";
import LiveEmployeeMapWidget from "../components/LiveEmployeeMapWidget";
import { CardSkeleton, TableSkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import {
  Users,
  MapPin,
  Luggage,
  Layers,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Eye,
  ArrowRight,
  ShieldCheck,
  BarChart2,
  Navigation,
  Search,
  Tag,
  PackagePlus,
  Edit3,
  RotateCcw,
  CheckCircle2
} from "lucide-react";

const AdminDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalLocations: 0,
    totalProducts: 0,
    totalStock: 0,
    piecesSoldToday: 0,
    piecesSoldThisMonth: 0,
    piecesSoldThisYear: 0,
    totalDamaged: 0,
    recentDamages: []
  });
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Stock Entry Modal State
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockProductToEdit, setStockProductToEdit] = useState(null);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const handleMarkReplaced = async (damageId) => {
    try {
      const res = await markDamageReplaced(damageId);
      addToast(res.message || `Damage report #${damageId} marked as replaced.`, "success");
      fetchStats();
    } catch (err) {
      console.error("Failed to mark damage as replaced:", err);
      addToast(err.message || "Failed to mark damage as replaced", "error");
    }
  };

  const fetchStats = async () => {
    try {
      const [statsData, productsData, locationsData] = await Promise.all([
        getAdminDashboardStats(),
        getProducts(),
        getLocations()
      ]);
      setStats(statsData);
      setProducts(productsData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error("Failed to fetch admin stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleOpenPhoto = (damageRecord, photo) => {
    setSelectedReport(damageRecord);
    setSelectedPhoto(photo);
    setLightboxOpen(true);
  };

  return (
    <Layout
      title="Fleet Executive Dashboard"
      subtitle="Real-time verified operations telemetry across retail nodes and fulfillment hubs"
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setStockProductToEdit(null);
              setStockModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl shadow-sm transition"
          >
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            <span>Enter Stock Pieces</span>
          </button>
          <Link
            to="/admin/live-locations"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl shadow-sm transition"
          >
            <Navigation className="w-4 h-4" />
            <span>Live Employee Map</span>
          </Link>
          <Link
            to="/admin/damages"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Review Damage Claims</span>
          </Link>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Primary Operations Metrics */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Fleet Network Status
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Active Staff</span>
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    <AnimatedNumber value={stats.totalEmployees} />
                  </span>
                  <span className="text-xs text-slate-400 ml-2">verified</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Retail Locations</span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    <AnimatedNumber value={stats.totalLocations} />
                  </span>
                  <span className="text-xs text-slate-400 ml-2">stores/outlets</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Safari CSD SKUs</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Luggage className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    <AnimatedNumber value={products.length || stats.totalProducts} />
                  </span>
                  <span className="text-xs text-slate-400 ml-2">CSD Index SKUs</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Warehouse Stock</span>
                  <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    <AnimatedNumber value={stats.totalStock} />
                  </span>
                  <span className="text-xs text-slate-400 ml-2">units in inventory</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sales & Defect Telemetry */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Sales Volume & Defect Metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Sold Today</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    <AnimatedNumber value={stats.piecesSoldToday} />
                  </span>
                  <span className="text-xs text-slate-500">PCS</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Sold This Month</span>
                  <Calendar className="w-4 h-4 text-sky-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    <AnimatedNumber value={stats.piecesSoldThisMonth} />
                  </span>
                  <span className="text-xs text-slate-500">PCS</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Sold This Year</span>
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    <AnimatedNumber value={stats.piecesSoldThisYear} />
                  </span>
                  <span className="text-xs text-slate-500">PCS</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-rose-200/80 shadow-sm bg-rose-50/20">
                <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
                  <span>Total Damaged</span>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-rose-600 font-mono">
                    <AnimatedNumber value={stats.totalDamaged} />
                  </span>
                  <span className="text-xs text-rose-500 font-medium">PCS logged</span>
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Live Activity & Defect Velocity Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    7-Day Sales & Defect Velocity
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live database records aggregated per day across the fleet network
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
                  <span className="text-slate-600 font-medium">Sales Volume</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span>
                  <span className="text-slate-600 font-medium">Damaged Units</span>
                </div>
              </div>
            </div>

            {stats.dailyTrends && stats.dailyTrends.length > 0 ? (
              <div className="grid grid-cols-7 gap-3 pt-4 border-t border-slate-100">
                {stats.dailyTrends.map((day) => {
                  const maxVal = Math.max(
                    ...stats.dailyTrends.map((d) => Math.max(d.sales, d.damages)),
                    1
                  );
                  const salesHeight = Math.max(Math.round((day.sales / maxVal) * 100), 4);
                  const damagesHeight = Math.max(Math.round((day.damages / maxVal) * 100), 4);

                  return (
                    <div key={day.fullDate} className="flex flex-col items-center group">
                      <div className="h-32 w-full flex items-end justify-center gap-1.5 pb-2 relative">
                        {/* Sales Bar */}
                        <div
                          style={{ height: `${day.sales > 0 ? salesHeight : 4}%` }}
                          className={`w-3.5 rounded-t transition-all duration-500 ${
                            day.sales > 0 ? "bg-emerald-500 group-hover:bg-emerald-600" : "bg-slate-100"
                          }`}
                          title={`Sales: ${day.sales} PCS`}
                        />
                        {/* Damages Bar */}
                        <div
                          style={{ height: `${day.damages > 0 ? damagesHeight : 4}%` }}
                          className={`w-3.5 rounded-t transition-all duration-500 ${
                            day.damages > 0 ? "bg-rose-500 group-hover:bg-rose-600" : "bg-slate-100"
                          }`}
                          title={`Damages: ${day.damages} PCS`}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 mt-1">
                        {day.date}
                      </span>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="text-emerald-600 font-bold">{day.sales}</span>
                        <span>/</span>
                        <span className="text-rose-600 font-bold">{day.damages}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No telemetry recorded for the past 7 days.
              </div>
            )}
          </div>

          {/* Live Field Telemetry & Employee Map Section */}
          <LiveEmployeeMapWidget />

          {/* Safari CSD Catalog & Rates Directory */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                  <Luggage className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Safari CSD Luggage Catalog & Official Rates
                  </h3>
                  <p className="text-xs text-slate-500">
                    {products.length} products imported with official CSD Index Numbers and Canteen Selling Rates
                  </p>
                </div>
              </div>

              {/* Search by Index No or Item Name */}
              <div className="w-full sm:w-72 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search Index No. (e.g. 36812) or item..."
                  className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-6 py-3 font-semibold">CSD Index No.</th>
                    <th className="px-6 py-3 font-semibold">Luggage Item / Model</th>
                    <th className="px-6 py-3 font-semibold">Base Rate / PC</th>
                    <th className="px-6 py-3 font-semibold">Canteen Selling Rate</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Inventory Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products
                    .filter((p) => {
                      if (!productSearch.trim()) return true;
                      const term = productSearch.toLowerCase().trim();
                      const indexMatch = p.index_no && String(p.index_no).toLowerCase().includes(term);
                      const nameMatch = p.name && p.name.toLowerCase().includes(term);
                      return indexMatch || nameMatch;
                    })
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-3 font-mono">
                          {p.index_no ? (
                            <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-100 text-indigo-800 text-[11px]">
                              #{p.index_no}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-medium text-slate-900">
                          {p.name}
                        </td>
                        <td className="px-6 py-3 text-slate-600 font-mono">
                          {p.rate_per_pc ? `₹${p.rate_per_pc.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-6 py-3 font-semibold text-emerald-700 font-mono">
                          {p.selling_rate ? `₹${p.selling_rate.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-6 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setStockProductToEdit(p);
                              setStockModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
                            title="Enter or adjust inventory pieces for this item"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>Enter Pieces</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 9 Requirement: Recent Damage Reports */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Recent Damage Reports
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live database records reported by retail and warehouse personnel
                  </p>
                </div>
              </div>
              <Link
                to="/admin/damages"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
              >
                <span>View Full Gallery</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {stats.recentDamages && stats.recentDamages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Employee</th>
                      <th className="px-6 py-3 font-semibold">Location</th>
                      <th className="px-6 py-3 font-semibold">Damage</th>
                      <th className="px-6 py-3 font-semibold">Photo</th>
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.recentDamages.map((damage) => {
                      const photo = damage.photos && damage.photos.length > 0 ? damage.photos[0] : null;

                      return (
                        <tr key={damage.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {damage.employee_name}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {damage.location_name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              {damage.total_quantity} PCS
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {photo ? (
                              <button
                                type="button"
                                onClick={() => handleOpenPhoto(damage, photo)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition"
                              >
                                <Eye className="w-3 h-3" />
                                <span>[View]</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                No photo attached.
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {damage.report_date ? new Date(damage.report_date).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleMarkReplaced(damage.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 shadow-sm transition"
                              title="Mark this item as replaced and remove it from active damages"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Replaced</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-sm font-medium text-slate-500">
                  No damage reports available.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Only actual damage records reported by employees will be displayed here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <ImageLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photo={selectedPhoto}
        reportMetadata={selectedReport}
      />

      {/* Dynamic Stock Entry Modal for Admin */}
      <StockEntryModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        onSuccess={fetchStats}
        products={products}
        locations={locations}
        isAdmin={true}
        initialProduct={stockProductToEdit}
      />
    </Layout>
  );
};

export default AdminDashboard;