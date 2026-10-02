import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getEmployeeDashboardStats,
  updateLiveLocation,
  getProducts,
  updateStock
} from "../services/api";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StockEntryModal from "../components/StockEntryModal";
import { CardSkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import {
  MapPin,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Package,
  ArrowRight,
  ShoppingBag,
  Camera,
  Radio,
  PackagePlus,
  Search,
  Edit3
} from "lucide-react";

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    assignedLocation: "Not assigned",
    assignedLocationId: null,
    todaysSales: 0,
    monthlySales: 0,
    yearlySales: 0,
    currentStock: [],
    damages: 0,
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);

  // Stock Entry Modal State
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockProductToEdit, setStockProductToEdit] = useState(null);
  const [stockSearchTerm, setStockSearchTerm] = useState("");

  // Background Live GPS broadcast
  useEffect(() => {
    if (!navigator.geolocation) return;

    const reportLocation = (pos) => {
      const lat = parseFloat(pos.coords.latitude.toFixed(6));
      const lon = parseFloat(pos.coords.longitude.toFixed(6));
      setGpsCoords({ lat, lon });
      setGpsActive(true);
      updateLiveLocation({ latitude: lat, longitude: lon }).catch(() => {});
    };

    navigator.geolocation.getCurrentPosition(
      reportLocation,
      (err) => {
        console.log("GPS permission not granted or timeout:", err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        reportLocation,
        () => {},
        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      );
    }, 25000);

    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const [statsData, prodsData] = await Promise.all([
        getEmployeeDashboardStats(user.id),
        getProducts(),
      ]);
      setStats(statsData);
      setProducts(prodsData || []);
    } catch (error) {
      console.error("Failed to fetch employee stats:", error);
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

  const handleOpenStockModal = (product = null) => {
    setStockProductToEdit(product);
    setStockModalOpen(true);
  };

  const handleStockUpdateSuccess = () => {
    fetchStats();
  };

  // Filter current stock by Index No or product name
  const filteredStock = (stats.currentStock || []).filter((item) => {
    if (!stockSearchTerm.trim()) return true;
    const term = stockSearchTerm.toLowerCase().trim();
    const indexMatch = item.index_no && String(item.index_no).toLowerCase().includes(term);
    const nameMatch = item.product_name && item.product_name.toLowerCase().includes(term);
    return indexMatch || nameMatch;
  });

  const totalStoreStock = (stats.currentStock || []).reduce(
    (acc, curr) => acc + (curr.quantity || 0),
    0
  );

  return (
    <Layout
      title={`Hello, ${user?.name || "Team Member"}`}
      subtitle="Retail representative operational hub and dynamic inventory telemetry"
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenStockModal(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl shadow-sm transition"
          >
            <PackagePlus className="w-4 h-4 text-indigo-600" />
            <span>Enter Stock Pieces</span>
          </button>
          <Link
            to="/employee/damages"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl shadow-sm transition"
          >
            <Camera className="w-4 h-4" />
            <span>Report Damaged Stock</span>
          </Link>
          <Link
            to="/employee/sales-entry"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Record Daily Sale</span>
          </Link>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top Quick Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Assigned Retail Node</span>
                <MapPin className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-4">
                <span className="text-xl font-bold text-slate-900 block truncate">
                  {stats.assignedLocation}
                </span>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    {stats.assignedLocationId ? `Store #${stats.assignedLocationId}` : "Unassigned"}
                  </span>
                  {gpsActive ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                      Live GPS On
                    </span>
                  ) : (
                    <span className="text-slate-400">GPS Standby</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Today's Sales</span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {stats.todaysSales}
                </span>
                <span className="text-xs text-slate-500">PCS</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Store Stock</span>
                <Package className="w-4 h-4 text-violet-500" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {totalStoreStock}
                </span>
                <span className="text-xs text-slate-500">PCS in store</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-rose-200/80 shadow-sm bg-rose-50/20">
              <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
                <span>Damaged Pieces Logged</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-600 font-mono">
                  {stats.damages}
                </span>
                <span className="text-xs text-rose-500 font-medium">PCS total</span>
              </div>
            </div>
          </div>

          {/* Current Stock Inventory at Assigned Node with Dynamic Piece Entry */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Assigned Store Inventory ({stats.assignedLocation})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dynamic inventory entered by employee & admin • Total: {totalStoreStock} PCS
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={stockSearchTerm}
                    onChange={(e) => setStockSearchTerm(e.target.value)}
                    placeholder="Search Index No. or item..."
                    className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenStockModal(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition shrink-0"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Enter Stock</span>
                </button>
              </div>
            </div>

            {filteredStock && filteredStock.length > 0 ? (
              <div className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
                {filteredStock.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {item.index_no && (
                          <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-indigo-100 text-indigo-800">
                            INDEX #{item.index_no}
                          </span>
                        )}
                        <h4 className="text-sm font-semibold text-slate-900">
                          {item.product_name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>SKU #{item.product_id}</span>
                        {item.selling_rate && (
                          <span className="font-semibold text-emerald-700">
                            CSD Selling Rate: ₹{item.selling_rate.toLocaleString("en-IN")}
                          </span>
                        )}
                        {item.rate_per_pc && (
                          <span className="text-slate-400">
                            (Base: ₹{item.rate_per_pc.toLocaleString("en-IN")})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span
                        className={`text-base font-bold font-mono px-3 py-1 rounded-xl border ${
                          item.quantity > 0
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {item.quantity} PCS
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleOpenStockModal({
                            id: item.product_id,
                            name: item.product_name,
                            index_no: item.index_no,
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
                        title="Enter / update piece count for this item"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Enter Pieces</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-sm font-medium text-slate-500">
                  {stockSearchTerm
                    ? `No products found matching "${stockSearchTerm}".`
                    : `No inventory records found for ${stats.assignedLocation}.`}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Click "Enter Stock" to log how many pieces are physically present in your store.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenStockModal(null)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Enter Stock Count Now</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Entry & Piece Adjustment Modal */}
      <StockEntryModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        onSuccess={handleStockUpdateSuccess}
        products={products}
        locations={[]}
        defaultLocationId={stats.assignedLocationId}
        isAdmin={false}
        initialProduct={stockProductToEdit}
      />
    </Layout>
  );
};

export default EmployeeDashboard;