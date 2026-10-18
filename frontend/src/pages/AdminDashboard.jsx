import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getAdminDashboardStats,
  getProducts,
  getLocations,
  getAdminSalesSummary,
  exportAdminSalesXlsx,
  resetInventoryToZero,
  markDamageReplaced,
  updateProduct,
  createProduct
} from "../services/api";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import ImageLightbox from "../components/ImageLightbox";
import StockEntryModal from "../components/StockEntryModal";
import AnimatedNumber from "../components/AnimatedNumber";
import LiveEmployeeMapWidget from "../components/LiveEmployeeMapWidget";
import { CardSkeleton, TableSkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import ScrollReveal from "../components/ScrollReveal";
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
  CheckCircle2,
  Download,
  FileSpreadsheet,
  User,
  Plus,
  Boxes,
  SlidersHorizontal,
  DollarSign,
  Sparkles,
  PackageCheck
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
  const [salesSummary, setSalesSummary] = useState({ overall: { sale_count: 0, total_pieces: 0 }, employees: [], sales: [] });
  const [salesLoading, setSalesLoading] = useState(true);
  const [selectedSalesEmployee, setSelectedSalesEmployee] = useState("");

  // Stock Entry Modal State
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockProductToEdit, setStockProductToEdit] = useState(null);

  // Cases vs Pieces Unit Toggle & Filters
  const [catalogUnit, setCatalogUnit] = useState("pieces"); // "pieces" or "cases"
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL"); // "ALL" | "LOW" | "OVERSTOCK"

  // Price Edit Modal State
  const [editingPriceProduct, setEditingPriceProduct] = useState(null);
  const [priceEditPieceRate, setPriceEditPieceRate] = useState("");
  const [priceEditCaseRate, setPriceEditCaseRate] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);

  // Add Product Modal State
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [addProductSaving, setAddProductSaving] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    index_no: "",
    name: "",
    brand: "SAFARI",
    colour: "",
    category: "HL",
    sub_category: "PC UPRIGHT",
    case_pack: 4,
    selling_rate: "",
  });

  const openPriceEditModal = (prod) => {
    setEditingPriceProduct(prod);
    const pieceRate = prod.selling_rate !== null && prod.selling_rate !== undefined ? String(prod.selling_rate) : "";
    setPriceEditPieceRate(pieceRate);
    const pack = prod.case_pack || 1;
    if (pieceRate && !isNaN(parseFloat(pieceRate))) {
      setPriceEditCaseRate((parseFloat(pieceRate) * pack).toFixed(2));
    } else {
      setPriceEditCaseRate("");
    }
  };

  const handlePieceRateChange = (val) => {
    setPriceEditPieceRate(val);
    const pack = editingPriceProduct?.case_pack || 1;
    if (val && !isNaN(parseFloat(val))) {
      setPriceEditCaseRate((parseFloat(val) * pack).toFixed(2));
    } else {
      setPriceEditCaseRate("");
    }
  };

  const handleCaseRateChange = (val) => {
    setPriceEditCaseRate(val);
    const pack = editingPriceProduct?.case_pack || 1;
    if (val && !isNaN(parseFloat(val)) && pack > 0) {
      setPriceEditPieceRate((parseFloat(val) / pack).toFixed(2));
    } else {
      setPriceEditPieceRate("");
    }
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!editingPriceProduct) return;
    const newPrice = parseFloat(priceEditPieceRate);
    if (isNaN(newPrice) || newPrice < 0) {
      addToast("Please enter a valid price (₹0 or greater)", "error");
      return;
    }
    setPriceSaving(true);
    try {
      const updated = await updateProduct(editingPriceProduct.id, {
        selling_rate: newPrice,
        rate_per_pc: newPrice,
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === editingPriceProduct.id ? { ...p, selling_rate: newPrice, rate_per_pc: newPrice } : p))
      );
      addToast(`Price for #${editingPriceProduct.index_no} updated to ₹${newPrice.toLocaleString("en-IN")}/pc!`, "success");
      setEditingPriceProduct(null);
    } catch (err) {
      console.error("Failed to update product price:", err);
      addToast(err.message || "Failed to update price", "error");
    } finally {
      setPriceSaving(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProductForm.name.trim()) {
      addToast("Please enter an item model name", "error");
      return;
    }
    const pack = parseInt(newProductForm.case_pack, 10) || 1;
    const rate = newProductForm.selling_rate ? parseFloat(newProductForm.selling_rate) : null;
    const prefix = newProductForm.brand.toUpperCase().includes("SAFARI") ? "SAF" : "UJ";
    const productId = newProductForm.index_no ? `${prefix}-${newProductForm.index_no.trim()}` : `PROD-${Date.now()}`;
    const fullName = newProductForm.colour.trim() ? `${newProductForm.name.trim()} (${newProductForm.colour.trim()})` : newProductForm.name.trim();

    setAddProductSaving(true);
    try {
      const payload = {
        product_id: productId,
        index_no: newProductForm.index_no.trim() || null,
        name: fullName,
        brand: newProductForm.brand.trim() || "SAFARI",
        colour: newProductForm.colour.trim() || null,
        category: newProductForm.category.trim() || "HL",
        sub_category: newProductForm.sub_category.trim() || "PC UPRIGHT",
        case_pack: pack,
        selling_rate: rate,
        rate_per_pc: rate,
        description: `${newProductForm.brand} ${newProductForm.category} - ${newProductForm.sub_category} (Pack: ${pack} pcs)`,
      };
      const created = await createProduct(payload);
      setProducts((prev) => [created, ...prev]);
      addToast(`Added new product: ${created.name} (Index #${created.index_no || "N/A"})`, "success");
      setIsAddProductModalOpen(false);
      setNewProductForm({
        index_no: "",
        name: "",
        brand: "SAFARI",
        colour: "",
        category: "HL",
        sub_category: "PC UPRIGHT",
        case_pack: 4,
        selling_rate: "",
      });
    } catch (err) {
      console.error("Failed to create product:", err);
      addToast(err.message || "Failed to add product", "error");
    } finally {
      setAddProductSaving(false);
    }
  };

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
      const [statsData, productsData, locationsData, salesData] = await Promise.all([
        getAdminDashboardStats(),
        getProducts(),
        getLocations(),
        getAdminSalesSummary()
      ]);
      setStats(statsData);
      setProducts(productsData || []);
      setLocations(locationsData || []);
      setSalesSummary(salesData || { overall: { sale_count: 0, total_pieces: 0 }, employees: [], sales: [] });
    } catch (error) {
      console.error("Failed to fetch admin stats:", error);
    } finally {
      setLoading(false);
      setSalesLoading(false);
    }
  };

  const handleSalesEmployeeChange = async (employeeId) => {
    setSelectedSalesEmployee(employeeId);
    setSalesLoading(true);
    try {
      setSalesSummary(await getAdminSalesSummary(employeeId ? { employee_id: employeeId } : {}));
    } catch (error) {
      addToast(error.message || "Failed to load sales", "error");
    } finally {
      setSalesLoading(false);
    }
  };

  const handleExportSales = async (employeeId = "") => {
    try {
      const blob = await exportAdminSalesXlsx(employeeId ? { employee_id: employeeId } : {});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = employeeId ? `sales_employee_${employeeId}.xlsx` : "sales_overall.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      addToast(error.message || "Sales export failed", "error");
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

  const hasTrendData = (stats.dailyTrends || []).some(
    (day) => Number(day.sales) > 0 || Number(day.damages) > 0
  );
  const setupSteps = [
    { label: "Add a retail location", done: locations.length > 0, path: "/admin/locations" },
    { label: "Confirm the product catalog", done: products.length > 0, path: "/admin/dashboard" },
    { label: "Create staff access", done: stats.totalEmployees > 1, path: "/admin/employees" },
    { label: "Enter physical stock", done: stats.totalStock > 0, path: "/admin/dashboard" },
  ];
  const setupComplete = setupSteps.filter((step) => step.done).length;

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
        <ScrollReveal>
        <div className="space-y-8">
          {/* Primary Operations Metrics */}
          {setupComplete < setupSteps.length && (
            <div className="bg-indigo-950 text-white rounded-2xl p-6 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div><p className="text-xs uppercase tracking-wider text-indigo-300 font-bold">Getting started</p><h2 className="text-lg font-bold mt-1">Complete your operations setup</h2><p className="text-xs text-indigo-200 mt-1">{setupComplete} of {setupSteps.length} setup steps complete</p></div>
                <div className="h-2 w-full sm:w-48 rounded-full bg-indigo-800 overflow-hidden"><div className="h-full bg-emerald-400 transition-all duration-300" style={{ width: `${setupComplete / setupSteps.length * 100}%` }} /></div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-5">
                {setupSteps.map((step) => <Link key={step.label} to={step.path} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${step.done ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-indigo-100 hover:bg-white/20"}`}><CheckCircle2 className={`w-4 h-4 ${step.done ? "text-emerald-400" : "text-indigo-300"}`} />{step.label}</Link>)}
              </div>
            </div>
          )}
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
                  <span className="text-xs font-semibold text-slate-500">Safari CSD SKU's</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Luggage className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-900 font-mono">
                    <AnimatedNumber value={products.length || stats.totalProducts} />
                  </span>
                  <span className="text-xs text-slate-400 ml-2">CSD Index SKU's</span>
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

          {/* Overall and individual sales */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Sales Register</h3>
                  <p className="text-xs text-slate-500">Overall performance and individual employee sales</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedSalesEmployee}
                  onChange={(event) => handleSalesEmployeeChange(event.target.value)}
                  className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  aria-label="Filter sales by employee"
                >
                  <option value="">Overall sales</option>
                  {salesSummary.employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.employee_id})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleExportSales("")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl"
                >
                  <Download className="w-3.5 h-3.5" /> Overall XLSX
                </button>
                <Link
                  to="/admin/sales"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> Index-Wise Sales →
                </Link>
                {selectedSalesEmployee && (
                  <button
                    type="button"
                    onClick={() => handleExportSales(selectedSalesEmployee)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl"
                  >
                    <User className="w-3.5 h-3.5" /> Individual XLSX
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-500">
                  {selectedSalesEmployee ? "Selected employee sales" : "Overall sales"}
                </p>
                <p className="text-2xl font-black text-slate-900 mt-2">
                  {salesSummary.overall.total_pieces.toLocaleString("en-IN")} <span className="text-xs font-semibold text-slate-400">PCS</span>
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <p className="text-xs font-semibold text-amber-700">Sale value</p>
                <p className="text-2xl font-black text-amber-950 mt-2">₹{Number(salesSummary.overall.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
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

            {hasTrendData ? (
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
                          className={`chart-bar ${day.sales > 0 ? "has-value" : ""} w-3.5 rounded-t ${
                            day.sales > 0 ? "bg-emerald-500 group-hover:bg-emerald-600" : "bg-slate-100"
                          }`}
                          title={`Sales: ${day.sales} PCS`}
                        />
                        {/* Damages Bar */}
                        <div
                          style={{ height: `${day.damages > 0 ? damagesHeight : 4}%` }}
                          className={`chart-bar ${day.damages > 0 ? "has-value" : ""} w-3.5 rounded-t ${
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
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Header with Title and Mode Switcher */}
            <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/60 to-white">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl border border-amber-200/60">
                  <Luggage className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Safari CSD Luggage Catalog & Rates
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {products.length} SKU's
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official CSD Index Numbers, Piece Rates, Case Packs & Box Conversions
                  </p>
                </div>
              </div>

              {/* Conversion Controls & Add SKU Action */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Cases vs Pieces Global Toggle */}
                <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setCatalogUnit("pieces")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      catalogUnit === "pieces"
                        ? "bg-white text-indigo-700 shadow-sm font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="View prices and inventory counts per piece"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Pieces (PCS)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogUnit("cases")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      catalogUnit === "cases"
                        ? "bg-indigo-600 text-white shadow-sm font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="View prices and inventory counts per case (box pack)"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Cases (Boxes)</span>
                  </button>
                </div>

                {/* Add New Product Button */}
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New SKU</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Brand & Category Chips */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Brand Filter */}
                <div className="inline-flex items-center p-0.5 bg-white border border-slate-200 rounded-xl text-[11px] shadow-sm">
                  {["ALL", "SAFARI", "URBEN JUNGLE"].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrandFilter(b)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        brandFilter === b
                          ? "bg-indigo-50 text-indigo-700 font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {b === "ALL" ? "All Brands" : b}
                    </button>
                  ))}
                </div>

                {/* Category Filter */}
                <div className="inline-flex items-center p-0.5 bg-white border border-slate-200 rounded-xl text-[11px] shadow-sm">
                  {["ALL", "HL", "SL"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryFilter(c)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        categoryFilter === c
                          ? "bg-indigo-50 text-indigo-700 font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {c === "ALL" ? "All Types" : c === "HL" ? "HL (Hard)" : "SL (Soft)"}
                    </button>
                  ))}
                </div>

                {/* Low Stock Alert Filter Button (<5 pcs) */}
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === "LOW" ? "ALL" : "LOW")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition shadow-sm ${
                    stockFilter === "LOW"
                      ? "bg-red-600 text-white border-red-600 shadow-red-200"
                      : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  }`}
                  title="Filter to show only products with less than 5 pieces in stock"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Low Stock (&lt;5 pcs): {products.filter((p) => (p.total_stock ?? 0) < 5).length}</span>
                </button>

                {/* Overstock Filter Button (>10 pcs) */}
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === "OVERSTOCK" ? "ALL" : "OVERSTOCK")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition shadow-sm ${
                    stockFilter === "OVERSTOCK"
                      ? "bg-amber-600 text-white border-amber-600 shadow-amber-200"
                      : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  }`}
                  title="Filter to show only products with greater than 10 pieces in stock (Overstock)"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Overstock (&gt;10 pcs): {products.filter((p) => (p.total_stock ?? 0) > 10).length}</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="w-full md:w-80 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search Index No., model, colour..."
                  className="w-full text-xs pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition shadow-sm"
                />
              </div>
            </div>

            {/* Catalog Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 z-10 font-bold shadow-sm">
                  <tr>
                    <th className="px-6 py-3.5">CSD Index</th>
                    <th className="px-6 py-3.5">Model & Specifications</th>
                    <th className="px-4 py-3.5">Brand / Category</th>
                    <th className="px-4 py-3.5 text-center">Case Pack</th>
                    <th className="px-5 py-3.5 text-center">Current Stock</th>
                    <th className="px-5 py-3.5 text-center">Stock Status</th>
                    <th className="px-6 py-3.5">
                      {catalogUnit === "cases" ? "Rate Per Case (Box)" : "Official Rate / PC"}
                    </th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products
                    .filter((p) => {
                      if (stockFilter === "LOW" && (p.total_stock ?? 0) >= 5) return false;
                      if (stockFilter === "OVERSTOCK" && (p.total_stock ?? 0) <= 10) return false;
                      if (brandFilter !== "ALL" && p.brand?.toUpperCase() !== brandFilter) return false;
                      if (categoryFilter !== "ALL" && p.category?.toUpperCase() !== categoryFilter) return false;
                      if (!productSearch.trim()) return true;
                      const term = productSearch.toLowerCase().trim();
                      const indexMatch = p.index_no && String(p.index_no).toLowerCase().includes(term);
                      const nameMatch = p.name && p.name.toLowerCase().includes(term);
                      const colourMatch = p.colour && p.colour.toLowerCase().includes(term);
                      const subCatMatch = p.sub_category && p.sub_category.toLowerCase().includes(term);
                      return indexMatch || nameMatch || colourMatch || subCatMatch;
                    })
                    .map((p) => {
                      const pack = p.case_pack || 1;
                      const pieceRate = p.selling_rate;
                      const caseRate = pieceRate !== null && pieceRate !== undefined ? pieceRate * pack : null;

                      return (
                        <tr
                          key={p.id}
                          className={`transition group ${
                            (p.total_stock ?? 0) < 5
                              ? "bg-red-50/40 hover:bg-red-50/70 border-l-4 border-l-red-500"
                              : (p.total_stock ?? 0) > 10
                              ? "bg-amber-50/30 hover:bg-amber-50/60 border-l-4 border-l-amber-500"
                              : "hover:bg-slate-50/90"
                          }`}
                        >
                          {/* Index No */}
                          <td className="px-6 py-3 font-mono">
                            {p.index_no ? (
                              <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80 text-[11px] shadow-sm">
                                #{p.index_no}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>

                          {/* Model & Specifications */}
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition">
                                {p.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              {p.colour && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium">
                                  {p.colour}
                                </span>
                              )}
                              {p.sub_category && <span>• {p.sub_category}</span>}
                            </div>
                          </td>

                          {/* Brand & Category */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-[10px] text-slate-800 uppercase tracking-wider">
                                {p.brand || "SAFARI"}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {p.category === "HL" ? "Hard Luggage" : p.category === "SL" ? "Soft Luggage" : p.category || "—"}
                              </span>
                            </div>
                          </td>

                          {/* Case Pack */}
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              {pack} PCS / Case
                            </span>
                          </td>

                          {/* Current Stock (Clean Count & Conversion) */}
                          <td className="px-5 py-3 text-center font-mono">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200">
                                {p.total_stock ?? 0} PCS
                              </span>
                              {pack > 1 && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ≈ {Math.floor((p.total_stock ?? 0) / pack)} Cases ({(p.total_stock ?? 0) % pack} pcs)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Stock Status (Separate Column: Low Stock <5 / Overstock >10 / Normal 5-10) */}
                          <td className="px-5 py-3 text-center font-mono whitespace-nowrap">
                            {(p.total_stock ?? 0) < 5 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] bg-red-100 text-red-700 border border-red-300 shadow-xs">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                  <span>{(p.total_stock ?? 0) === 0 ? "Out of Stock (0)" : "Low Stock (<5)"}</span>
                                </span>
                                <span className="text-[10px] text-red-600 font-bold">
                                  {(p.total_stock ?? 0) === 0 ? "Needs Restocking" : `Only ${p.total_stock} pcs left`}
                                </span>
                              </div>
                            ) : (p.total_stock ?? 0) > 10 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                                  <PackageCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                  <span>Overstock (&gt;10)</span>
                                </span>
                                <span className="text-[10px] text-amber-700 font-medium">
                                  High Inventory ({p.total_stock} pcs)
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Normal (5–10)</span>
                                </span>
                                <span className="text-[10px] text-emerald-700 font-normal">
                                  Optimal Stock
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Rate Per Piece / Case */}
                          <td className="px-6 py-3 font-mono">
                            {catalogUnit === "cases" ? (
                              <div>
                                {caseRate !== null ? (
                                  <>
                                    <div className="font-bold text-sm text-indigo-700">
                                      ₹{caseRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      <span className="text-[10px] font-normal text-slate-400 ml-1">/ Case</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      (₹{pieceRate?.toLocaleString("en-IN", { minimumFractionDigits: 2 })} / pc)
                                    </div>
                                  </>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold text-[10px] border border-amber-200">
                                    Price Not Set
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div>
                                {pieceRate !== null ? (
                                  <>
                                    <div className="font-bold text-sm text-emerald-700">
                                      ₹{pieceRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      <span className="text-[10px] font-normal text-slate-400 ml-1">/ PC</span>
                                    </div>
                                    {caseRate !== null && (
                                      <div className="text-[10px] text-slate-400">
                                        (₹{caseRate.toLocaleString("en-IN", { minimumFractionDigits: 2 })} / Case of {pack})
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold text-[10px] border border-amber-200">
                                    Price Not Set
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions: Edit Price & Enter Stock */}
                          <td className="px-6 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {/* Edit Price Button */}
                              <button
                                type="button"
                                onClick={() => openPriceEditModal(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition"
                                title="Update or set price (auto-calculates piece & case)"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Price</span>
                              </button>

                              {/* Enter Stock Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setStockProductToEdit(p);
                                  setStockModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
                                title="Enter pieces or cases into inventory"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                <span>Stock</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
        </ScrollReveal>
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

      {/* Synchronized Price Edit Modal (Piece & Case) */}
      {editingPriceProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Update CSD Selling Rate
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automatic live conversion between Piece and Case prices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPriceProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="p-6 space-y-4">
              {/* Product Info Summary */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-900 bg-indigo-200/80 px-2 py-0.5 rounded-md text-[10px]">
                    INDEX #{editingPriceProduct.index_no || "N/A"}
                  </span>
                  <span className="font-mono font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                    Pack: {editingPriceProduct.case_pack || 1} pcs/case
                  </span>
                </div>
                <div className="font-bold text-slate-900 text-sm pt-0.5">
                  {editingPriceProduct.name}
                </div>
                <div className="text-slate-500 text-[11px]">
                  {editingPriceProduct.brand} • {editingPriceProduct.category} • {editingPriceProduct.sub_category}
                </div>
              </div>

              {/* Synchronized Pricing Inputs */}
              <div className="space-y-3 pt-1">
                {/* Rate per Piece */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Rate Per Piece (PCS) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={priceEditPieceRate}
                      onChange={(e) => handlePieceRateChange(e.target.value)}
                      placeholder="e.g. 2693.85"
                      className="w-full text-sm font-semibold pl-8 pr-16 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition font-mono"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] font-bold text-slate-400 pointer-events-none">
                      / PC
                    </span>
                  </div>
                </div>

                {/* Rate per Case (Box) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Rate Per Case ({editingPriceProduct.case_pack || 1} Pcs/Box)
                    </label>
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded">
                      Auto-syncs
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={priceEditCaseRate}
                      onChange={(e) => handleCaseRateChange(e.target.value)}
                      placeholder="e.g. 10775.40"
                      className="w-full text-sm font-semibold pl-8 pr-16 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition font-mono"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] font-bold text-indigo-600 pointer-events-none">
                      / CASE
                    </span>
                  </div>
                </div>
              </div>

              {/* Conversion Preview Tag */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600">
                1 Case = {editingPriceProduct.case_pack || 1} Pieces × ₹{parseFloat(priceEditPieceRate || 0).toFixed(2)} ={" "}
                <strong className="text-indigo-700">₹{parseFloat(priceEditCaseRate || 0).toFixed(2)}</strong>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPriceProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={priceSaving || !priceEditPieceRate}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {priceSaving ? "Saving Price..." : "Save Product Price"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New SKU Modal */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add New Luggage SKU
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add new product with official CSD details and case pack
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Row 1: Index No & Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    CSD Index No.
                  </label>
                  <input
                    type="text"
                    value={newProductForm.index_no}
                    onChange={(e) => setNewProductForm({ ...newProductForm, index_no: e.target.value })}
                    placeholder="e.g. 38815"
                    className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Brand
                  </label>
                  <select
                    value={newProductForm.brand}
                    onChange={(e) => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  >
                    <option value="SAFARI">SAFARI</option>
                    <option value="URBEN JUNGLE">URBEN JUNGLE</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Item Name & Colour */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Model / Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    placeholder="e.g. SENTINEL 79 4W"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Colour
                  </label>
                  <input
                    type="text"
                    value={newProductForm.colour}
                    onChange={(e) => setNewProductForm({ ...newProductForm, colour: e.target.value })}
                    placeholder="e.g. MIDNIGHT BLUE"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Row 3: Category & Sub-Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  >
                    <option value="HL">HL (Hard Luggage)</option>
                    <option value="SL">SL (Soft Luggage)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Sub-Category
                  </label>
                  <select
                    value={newProductForm.sub_category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, sub_category: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  >
                    <option value="PC UPRIGHT">PC UPRIGHT</option>
                    <option value="PP UPRIGHT">PP UPRIGHT</option>
                    <option value="SL UPRIGHT">SL UPRIGHT</option>
                    <option value="U/J PC UPRIGHT">U/J PC UPRIGHT</option>
                    <option value="BACKPACK">BACKPACK</option>
                    <option value="RDFL">RDFL</option>
                    <option value="SCHOOL BAG">SCHOOL BAG</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Case Pack & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Case Pack (PCS/Box) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newProductForm.case_pack}
                    onChange={(e) => setNewProductForm({ ...newProductForm, case_pack: e.target.value })}
                    className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Rate Per Piece (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProductForm.selling_rate}
                    onChange={(e) => setNewProductForm({ ...newProductForm, selling_rate: e.target.value })}
                    placeholder="e.g. 2693.85"
                    className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Live Calculated Case Rate Banner */}
              {newProductForm.selling_rate && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs flex items-center justify-between">
                  <span className="text-indigo-900 font-semibold">Equivalent Case Rate:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    ₹{(parseFloat(newProductForm.selling_rate || 0) * (parseInt(newProductForm.case_pack, 10) || 1)).toFixed(2)} / Case (Box)
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addProductSaving}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {addProductSaving ? "Creating SKU..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminDashboard;