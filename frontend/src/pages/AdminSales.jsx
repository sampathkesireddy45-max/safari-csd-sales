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
  Edit3,
  Trash2,
  Plus,
  Receipt,
  X,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Store,
  PackagePlus,
  Globe2,
  ChevronDown,
  ArrowDownToLine,
} from "lucide-react";
import StockEntryModal from "../components/StockEntryModal";
import {
  exportAdminSalesXlsx,
  exportAdminSalesIndexWiseCsv,
  getAdminSalesSummary,
  getEmployees,
  getProducts,
  getLocations,
  updateSale,
  deleteSale,
  updateAdminOpeningStock,
  updateAdminReceivingStock,
  updateAdminClosingStock,
  triggerStockRollover,
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
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Main View Tab: "index_wise" (Catalog Performance) | "transactions" (Employee Sales Counter Records & Corrections)
  const [activeViewTab, setActiveViewTab] = useState("index_wise");

  // Controls for Index-wise Section
  const [indexSearch, setIndexSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all"); // 'all' or 'sold_only'
  const [viewUnit, setViewUnit] = useState("pieces"); // 'pieces' or 'cases'
  const [sortBy, setSortBy] = useState("pieces_sold"); // 'pieces_sold', 'revenue', 'index_no', 'price'
  const [sortOrder, setSortOrder] = useState("desc");

  // Controls for Transactions Section
  const [transactionSearch, setTransactionSearch] = useState("");

  // Admin Edit Opening Stock Modal State (Admin Only Permission)
  const [editingOpeningStock, setEditingOpeningStock] = useState(null);
  const [editOpeningLocationId, setEditOpeningLocationId] = useState("");
  const [newOpeningStockValue, setNewOpeningStockValue] = useState("");
  const [savingOpeningStock, setSavingOpeningStock] = useState(false);

  // Admin Edit Receiving Stock Modal State (Admin Only Permission)
  const [editingReceivingStock, setEditingReceivingStock] = useState(null);
  const [editReceivingLocationId, setEditReceivingLocationId] = useState("");
  const [newReceivingStockValue, setNewReceivingStockValue] = useState("");
  const [receivingReason, setReceivingReason] = useState("");
  const [savingReceivingStock, setSavingReceivingStock] = useState(false);

  // Admin Edit Closing Stock Modal State (Admin Only Permission)
  const [editingClosingStock, setEditingClosingStock] = useState(null);
  const [editClosingLocationId, setEditClosingLocationId] = useState("");
  const [newClosingStockValue, setNewClosingStockValue] = useState("");
  const [closingReason, setClosingReason] = useState("");
  const [savingClosingStock, setSavingClosingStock] = useState(false);
  const [rollingOver, setRollingOver] = useState(false);

  // Edit / Correct Sale Modal State
  const [editingSale, setEditingSale] = useState(null);
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editLocationId, setEditLocationId] = useState("");
  const [editItems, setEditItems] = useState([]);
  const [editReason, setEditReason] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  // Void / Delete Sale Confirmation Modal State
  const [deletingSale, setDeletingSale] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Add Stock Modal State
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState(null);

  const loadSales = async (
    employeeId = selectedEmployee,
    locationId = selectedLocation,
    extraDates = {}
  ) => {
    setLoading(true);
    try {
      const dFrom = "date_from" in extraDates ? extraDates.date_from : dateFrom;
      const dTo = "date_to" in extraDates ? extraDates.date_to : dateTo;
      const data = await getAdminSalesSummary({
        ...(employeeId ? { employee_id: employeeId } : {}),
        ...(locationId && locationId !== "all" ? { location_id: locationId } : {}),
        ...(dFrom ? { date_from: dFrom } : {}),
        ...(dTo ? { date_to: dTo } : {}),
        limit: 1000,
      });
      setSummary(data);
      if (data.locations && data.locations.length > 0) {
        setLocations(data.locations);
      }
    } catch (error) {
      addToast(error.message || "Unable to load sales", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      getEmployees(),
      getProducts(),
      getLocations(),
      getAdminSalesSummary({ limit: 1000 }),
    ])
      .then(([employeeRows, productRows, locationRows, salesData]) => {
        setEmployees(employeeRows || []);
        setProducts(productRows || []);
        setLocations(locationRows || []);
        setSummary(salesData);
      })
      .catch((error) => addToast(error.message || "Unable to load sales dashboard", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleEmployeeChange = (event) => {
    const employeeId = event.target.value;
    setSelectedEmployee(employeeId);
    loadSales(employeeId, selectedLocation);
  };

  const handleLocationChange = (locId) => {
    setSelectedLocation(locId);
    loadSales(selectedEmployee, locId);
  };

  const handleExportXlsx = async (employeeId = selectedEmployee, label = "Overall") => {
    setExporting(`xlsx_${label}`);
    try {
      const blob = await exportAdminSalesXlsx({
        ...(employeeId ? { employee_id: employeeId } : {}),
        ...(selectedLocation && selectedLocation !== "all" ? { location_id: selectedLocation } : {}),
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
        ...(selectedLocation && selectedLocation !== "all" ? { location_id: selectedLocation } : {}),
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

  // Admin Opening Stock Modal Handlers
  const handleOpenEditOpeningModal = (item) => {
    const defaultLocId =
      selectedLocation && selectedLocation !== "all"
        ? parseInt(selectedLocation, 10)
        : locations[0]?.id || 1;

    setEditingOpeningStock(item);
    setEditOpeningLocationId(defaultLocId);

    const initialOpening =
      selectedLocation && selectedLocation !== "all"
        ? item.store_opening_stock ?? item.opening_stock ?? 0
        : item.overall_opening_stock ?? item.opening_stock ?? 0;
    setNewOpeningStockValue(String(initialOpening));
  };

  const handleCloseEditOpeningModal = () => {
    setEditingOpeningStock(null);
    setEditOpeningLocationId("");
    setNewOpeningStockValue("");
  };

  const handleSaveOpeningStock = async (e) => {
    e.preventDefault();
    if (!editingOpeningStock || !editOpeningLocationId) {
      addToast("Please select a target store counter location", "error");
      return;
    }
    const val = parseInt(newOpeningStockValue, 10);
    if (isNaN(val) || val < 0) {
      addToast("Please enter a valid non-negative opening stock", "error");
      return;
    }

    const soldAtStore =
      selectedLocation && String(editOpeningLocationId) === String(selectedLocation)
        ? editingOpeningStock.store_pieces_sold ?? 0
        : 0;

    if (val < soldAtStore) {
      addToast(
        `Opening stock cannot be less than volume already sold at this store (${soldAtStore} PCS)`,
        "error"
      );
      return;
    }

    setSavingOpeningStock(true);
    try {
      const res = await updateAdminOpeningStock({
        product_id: editingOpeningStock.product_id,
        location_id: editOpeningLocationId,
        opening_stock: val,
      });
      const targetStore = locations.find((l) => l.id === editOpeningLocationId);
      addToast(
        res.message ||
          `Opening stock for Index #${editingOpeningStock.index_no} at ${targetStore?.name || "Store"} updated to ${val} PCS!`,
        "success"
      );
      handleCloseEditOpeningModal();
      await loadSales();
    } catch (err) {
      console.error("Failed to update opening stock:", err);
      addToast(err.message || "Failed to update opening stock", "error");
    } finally {
      setSavingOpeningStock(false);
    }
  };

  // Admin Receiving Stock Modal Handlers
  const handleOpenEditReceivingModal = (item) => {
    const defaultLocId =
      selectedLocation && selectedLocation !== "all"
        ? parseInt(selectedLocation, 10)
        : locations[0]?.id || 1;

    setEditingReceivingStock(item);
    setEditReceivingLocationId(defaultLocId);
    const initialReceiving =
      selectedLocation && selectedLocation !== "all"
        ? item.store_receiving_stock ?? item.receiving_stock ?? 0
        : item.overall_receiving_stock ?? item.receiving_stock ?? 0;
    setNewReceivingStockValue(String(initialReceiving));
    setReceivingReason("Inward receiving stock adjustment");
  };

  const handleCloseEditReceivingModal = () => {
    setEditingReceivingStock(null);
    setEditReceivingLocationId("");
    setNewReceivingStockValue("");
    setReceivingReason("");
  };

  const handleSaveReceivingStock = async (e) => {
    e.preventDefault();
    if (!editingReceivingStock || !editReceivingLocationId) {
      addToast("Please select a target store counter location", "error");
      return;
    }
    const val = parseInt(newReceivingStockValue, 10);
    if (isNaN(val) || val < 0) {
      addToast("Please enter a valid non-negative receiving stock", "error");
      return;
    }

    setSavingReceivingStock(true);
    try {
      const res = await updateAdminReceivingStock({
        product_id: editingReceivingStock.product_id,
        location_id: editReceivingLocationId,
        receiving_stock: val,
        reason: receivingReason || "Admin manual receiving stock adjustment",
      });
      const targetStore = locations.find((l) => l.id === editReceivingLocationId);
      addToast(
        res.message ||
          `Receiving stock for Index #${editingReceivingStock.index_no} at ${targetStore?.name || "Store"} updated to ${val} PCS!`,
        "success"
      );
      handleCloseEditReceivingModal();
      await loadSales();
    } catch (err) {
      console.error("Failed to update receiving stock:", err);
      addToast(err.message || "Failed to update receiving stock", "error");
    } finally {
      setSavingReceivingStock(false);
    }
  };

  // Admin Closing Stock Modal Handlers
  const handleOpenEditClosingModal = (item) => {
    const defaultLocId =
      selectedLocation && selectedLocation !== "all"
        ? parseInt(selectedLocation, 10)
        : locations[0]?.id || 1;

    setEditingClosingStock(item);
    setEditClosingLocationId(defaultLocId);
    const initialClosing =
      selectedLocation && selectedLocation !== "all"
        ? item.store_closing_stock ?? item.closing_stock ?? 0
        : item.overall_closing_stock ?? item.closing_stock ?? 0;
    setNewClosingStockValue(String(initialClosing));
    setClosingReason("Physical inventory count reconciliation");
  };

  const handleCloseEditClosingModal = () => {
    setEditingClosingStock(null);
    setEditClosingLocationId("");
    setNewClosingStockValue("");
    setClosingReason("");
  };

  const handleSaveClosingStock = async (e) => {
    e.preventDefault();
    if (!editingClosingStock || !editClosingLocationId) {
      addToast("Please select a target store counter location", "error");
      return;
    }
    const val = parseInt(newClosingStockValue, 10);
    if (isNaN(val) || val < 0) {
      addToast("Please enter a valid non-negative closing stock", "error");
      return;
    }

    setSavingClosingStock(true);
    try {
      const res = await updateAdminClosingStock({
        product_id: editingClosingStock.product_id,
        location_id: editClosingLocationId,
        closing_stock: val,
        reason: closingReason || "Admin manual closing stock adjustment",
      });
      const targetStore = locations.find((l) => l.id === editClosingLocationId);
      addToast(
        res.message ||
          `Closing stock for Index #${editingClosingStock.index_no} at ${targetStore?.name || "Store"} updated to ${val} PCS!`,
        "success"
      );
      handleCloseEditClosingModal();
      await loadSales();
    } catch (err) {
      console.error("Failed to update closing stock:", err);
      addToast(err.message || "Failed to update closing stock", "error");
    } finally {
      setSavingClosingStock(false);
    }
  };

  const handleTriggerRollover = async () => {
    if (!window.confirm("Perform Month-End Stock Rollover?\n\nThis will carry forward previous month's final closing stock as the new month's opening stock for all stores and SKUs. Historical records are preserved.")) {
      return;
    }
    setRollingOver(true);
    try {
      const res = await triggerStockRollover();
      addToast(res.message || "Month-end rollover completed successfully!", "success");
      await loadSales();
    } catch (err) {
      console.error("Failed to trigger rollover:", err);
      addToast(err.message || "Failed to trigger rollover", "error");
    } finally {
      setRollingOver(false);
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
        acc.store_opening += item.store_opening_stock ?? 0;
        acc.store_receiving += item.store_receiving_stock ?? 0;
        acc.store_closing += item.store_closing_stock ?? 0;
        acc.overall_opening += item.overall_opening_stock ?? item.opening_stock ?? 0;
        acc.overall_receiving += item.overall_receiving_stock ?? item.receiving_stock ?? 0;
        acc.overall_closing += item.overall_closing_stock ?? item.closing_stock ?? 0;
        acc.opening += item.opening_stock || 0;
        acc.receiving += item.receiving_stock || 0;
        acc.closing += item.closing_stock || 0;
        acc.pieces += item.total_pieces_sold;
        acc.cases += item.total_cases_sold;
        acc.revenue += item.total_revenue;
        acc.transactions += item.transactions_count;
        if (item.total_pieces_sold > 0) acc.activeCount += 1;
        return acc;
      },
      {
        store_opening: 0,
        store_receiving: 0,
        store_closing: 0,
        overall_opening: 0,
        overall_receiving: 0,
        overall_closing: 0,
        opening: 0,
        receiving: 0,
        closing: 0,
        pieces: 0,
        cases: 0,
        revenue: 0,
        transactions: 0,
        activeCount: 0,
      }
    );
  }, [filteredIndexSales]);

  // Filtered transactions for the Sales Records & Corrections Tab
  const filteredTransactions = useMemo(() => {
    let list = summary.sales || [];
    if (selectedEmployee) {
      list = list.filter((s) => String(s.employee_id) === String(selectedEmployee));
    }
    if (transactionSearch.trim()) {
      const term = transactionSearch.trim().toLowerCase();
      list = list.filter(
        (s) =>
          String(s.id).includes(term) ||
          s.employee_name?.toLowerCase().includes(term) ||
          s.employee_code?.toLowerCase().includes(term) ||
          s.location_name?.toLowerCase().includes(term) ||
          s.items?.some((it) =>
            it.index_no?.toLowerCase().includes(term) ||
            it.product_name?.toLowerCase().includes(term)
          )
      );
    }
    return list;
  }, [summary.sales, selectedEmployee, transactionSearch]);

  // Open Edit / Correct Sale Modal
  const handleOpenEditSaleModal = (sale) => {
    setEditingSale(sale);
    setEditEmployeeId(sale.employee_id || "");
    setEditLocationId(sale.location_id || "");
    setEditReason("");
    // Clone items
    const itemsCopy = (sale.items || []).map((it) => {
      const prod = products.find((p) => p.id === it.product_id);
      return {
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price ?? (prod?.selling_rate || prod?.rate_per_pc || 0),
      };
    });
    setEditItems(itemsCopy.length > 0 ? itemsCopy : [{ product_id: products[0]?.id || 1, quantity: 1, unit_price: products[0]?.selling_rate || 0 }]);
  };

  const handleCloseEditSaleModal = () => {
    setEditingSale(null);
    setEditItems([]);
    setEditReason("");
  };

  // Modify item in modal
  const handleItemProductChange = (index, newProductId) => {
    const prodId = parseInt(newProductId, 10);
    const prod = products.find((p) => p.id === prodId);
    const updated = [...editItems];
    updated[index] = {
      ...updated[index],
      product_id: prodId,
      unit_price: prod?.selling_rate ?? prod?.rate_per_pc ?? 0,
    };
    setEditItems(updated);
  };

  const handleItemQuantityChange = (index, newQuantity) => {
    const val = parseInt(newQuantity, 10);
    const updated = [...editItems];
    updated[index] = {
      ...updated[index],
      quantity: isNaN(val) ? 0 : Math.max(1, val),
    };
    setEditItems(updated);
  };

  const handleAddItem = () => {
    const defaultProd = products[0];
    setEditItems([
      ...editItems,
      {
        product_id: defaultProd ? defaultProd.id : 1,
        quantity: 1,
        unit_price: defaultProd ? (defaultProd.selling_rate || defaultProd.rate_per_pc || 0) : 0,
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (editItems.length <= 1) {
      addToast("A sale transaction must have at least one product piece. Void the sale instead if cancelling.", "error");
      return;
    }
    const updated = editItems.filter((_, idx) => idx !== index);
    setEditItems(updated);
  };

  // Save Sale Correction
  const handleSaveCorrection = async (e) => {
    e.preventDefault();
    if (!editingSale) return;

    if (editItems.length === 0) {
      addToast("Must include at least one item", "error");
      return;
    }

    for (const it of editItems) {
      if (!it.product_id || it.quantity <= 0) {
        addToast("All items must have a valid product and quantity of at least 1 piece", "error");
        return;
      }
    }

    setSavingCorrection(true);
    try {
      const payload = {
        employee_id: editEmployeeId ? parseInt(editEmployeeId, 10) : editingSale.employee_id,
        location_id: editLocationId ? parseInt(editLocationId, 10) : editingSale.location_id,
        correction_reason: editReason.trim() || "Admin corrected pieces sold / SKU models",
        items: editItems.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
        })),
      };

      const res = await updateSale(editingSale.id, payload);
      addToast(res.message || `Sale #${editingSale.id} corrected and inventory rebalanced!`, "success");
      handleCloseEditSaleModal();
      await loadSales();
    } catch (err) {
      console.error("Failed to correct sale:", err);
      addToast(err.message || "Failed to update sale", "error");
    } finally {
      setSavingCorrection(false);
    }
  };

  // Void / Delete Sale
  const handleConfirmDelete = async () => {
    if (!deletingSale) return;
    setDeletingLoading(true);
    try {
      const res = await deleteSale(deletingSale.id);
      addToast(res.message || `Sale #${deletingSale.id} voided and pieces returned to store inventory.`, "success");
      setDeletingSale(null);
      await loadSales();
    } catch (err) {
      console.error("Failed to delete sale:", err);
      addToast(err.message || "Failed to void sale", "error");
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <Layout
      title="Sales Dashboard"
      subtitle="Analyze catalog index-wise SKU performance, opening/closing stock, and correct employee sales records"
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
            onClick={() => {
              setSelectedStockProduct(null);
              setStockModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm transition"
            title="Log real physical count or incoming shipment pieces/cases to warehouse"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>+ Add Stock</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerRollover}
            disabled={rollingOver}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-60 transition shadow-sm"
            title="Roll over final closing stock from previous month as new month's opening stock"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rollingOver ? "animate-spin" : ""}`} />
            <span>{rollingOver ? "Rolling over..." : "Month Rollover"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportXlsx("", "Overall")}
            disabled={exporting.startsWith("xlsx")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm"
            title="Download Excel report with Opening Stock, Volume Sold, Closing Stock, and Revenue"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting === "xlsx_Overall" ? "Exporting..." : "Export Excel (XLSX)"}
          </button>

          <button
            type="button"
            onClick={handleExportIndexCsv}
            disabled={exporting === "index_csv"}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-sm"
            title="Export Index-Wise sales CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            {exporting === "index_csv" ? "Exporting..." : "Export CSV"}
          </button>

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
        {/* Date, Store & Staff Filter Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">Filters</h2>
                <p className="text-[11px] text-slate-500">
                  Filter by store location counter or date range in IST.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Simple Store Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500">Store:</span>
                <select
                  value={selectedLocation}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Stores</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500">From:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
                />
              </div>

              {/* Date To */}
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

              {(dateFrom || dateTo || selectedLocation !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setSelectedLocation("all");
                    setTimeout(() => loadSales(selectedEmployee, "all", { date_from: "", date_to: "" }), 0);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                {selectedLocation !== "all" ? "Store Opening Stock" : "Overall Opening Stock"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-amber-950">
              {(selectedLocation !== "all"
                ? (summary.index_summary?.store_opening_stock ?? indexViewTotals.store_opening)
                : (summary.index_summary?.overall_opening_stock ?? summary.index_summary?.total_opening_stock ?? indexViewTotals.overall_opening)
              ).toLocaleString("en-IN")}{" "}
              <span className="text-xs font-bold text-amber-600">PCS</span>
            </p>
            <div className="mt-1 flex items-center justify-between text-xs text-amber-700">
              <span>{selectedLocation !== "all" ? "Selected store start count" : "All 8 stores combined"}</span>
              {selectedLocation !== "all" && (
                <span className="font-semibold text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded text-[10px]">
                  Overall: {(summary.index_summary?.overall_opening_stock ?? indexViewTotals.overall_opening).toLocaleString()} PCS
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                {selectedLocation !== "all" ? "Store Receiving Stock" : "Overall Receiving Stock"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                <ArrowDownToLine className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-teal-950">
              {(selectedLocation !== "all"
                ? (summary.index_summary?.store_receiving_stock ?? indexViewTotals.store_receiving)
                : (summary.index_summary?.overall_receiving_stock ?? summary.index_summary?.total_receiving_stock ?? indexViewTotals.overall_receiving)
              ).toLocaleString("en-IN")}{" "}
              <span className="text-xs font-bold text-teal-600">PCS</span>
            </p>
            <div className="mt-1 flex items-center justify-between text-xs text-teal-700">
              <span>{selectedLocation !== "all" ? "Inward arrivals / transfers" : "All inward stock across stores"}</span>
              {selectedLocation !== "all" && (
                <span className="font-semibold text-teal-900 bg-teal-100/70 px-1.5 py-0.5 rounded text-[10px]">
                  Overall: {(summary.index_summary?.overall_receiving_stock ?? indexViewTotals.overall_receiving).toLocaleString()} PCS
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                {selectedLocation !== "all" ? "Store Volume Sold" : selectedEmployee ? "Selected Staff Volume" : "Overall Volume Sold"}
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
              {(summary.overall?.sale_count || 0).toLocaleString("en-IN")} retail sales
            </p>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
                {selectedLocation !== "all" ? "Store Closing Stock" : "Overall Closing Stock"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-violet-950">
              {(selectedLocation !== "all"
                ? (summary.index_summary?.store_closing_stock ?? indexViewTotals.store_closing)
                : (summary.index_summary?.overall_closing_stock ?? summary.index_summary?.total_closing_stock ?? indexViewTotals.overall_closing)
              ).toLocaleString("en-IN")}{" "}
              <span className="text-xs font-bold text-violet-600">PCS</span>
            </p>
            <div className="mt-1 flex items-center justify-between text-xs text-violet-700">
              <span>{selectedLocation !== "all" ? "Live store counter balance" : "All 8 stores live balance"}</span>
              {selectedLocation !== "all" && (
                <span className="font-semibold text-violet-900 bg-violet-100/70 px-1.5 py-0.5 rounded text-[10px]">
                  Overall: {(summary.index_summary?.overall_closing_stock ?? indexViewTotals.overall_closing).toLocaleString()} PCS
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Total Revenue
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                ₹
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-emerald-950">
              ₹{Number(summary.overall?.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              CSD Canteen Selling Value
            </p>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Index SKU's Active
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-sky-950">
              {summary.index_summary?.active_indexes_sold || 0}{" "}
              <span className="text-xs font-semibold text-sky-600">
                / {summary.index_summary?.total_indexes || 100}
              </span>
            </p>
            <p className="mt-1 text-xs text-sky-700">
              Distinct catalog index numbers sold
            </p>
          </div>
        </div>

        {/* PRIMARY VIEW NAVIGATION TABS */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveViewTab("index_wise")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeViewTab === "index_wise"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Index-Wise SKU Performance ({filteredIndexSales.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab("transactions")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeViewTab === "transactions"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Employee Sales Counter Records & Corrections ({summary.sales?.length || 0})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden md:flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Admin modifications automatically rebalance live store warehouse inventory</span>
          </div>
        </div>

        {/* ================= TAB 1: INDIVIDUAL INDEX-WISE SALES SUMMARY ================= */}
        {activeViewTab === "index_wise" && (
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
                    <CheckCircle2 className="w-3 h-3" /> Sold SKU's Only
                  </button>
                </div>
              </div>

              {/* Sort By Controls */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  <option value="pieces_sold">Pieces Sold</option>
                  <option value="revenue">Sales Revenue</option>
                  <option value="index_no">Index Number</option>
                  <option value="price">Selling Price</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                  title="Toggle Sort Direction"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Table */}
            {filteredIndexSales.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Tag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No index products matched the current filters.</p>
                <p className="text-xs text-slate-400 mt-1">Try resetting search or brand selection.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3">Index No.</th>
                      <th className="px-3 py-3">Product / Luggage Name</th>
                      <th className="px-3 py-3">Brand</th>
                      <th className="px-3 py-3">Colour</th>
                      <th className="px-3 py-3 text-center">Pack</th>

                      {/* Store Counter Stock Columns (Visible when individual store is selected) */}
                      {selectedLocation !== "all" && (
                        <>
                          <th className="px-3 py-3 text-right bg-blue-50/80 text-blue-950 border-l border-blue-200">
                            Store Opening
                            <span className="block text-[9px] font-normal text-blue-700 lowercase">(selected store)</span>
                          </th>
                          <th className="px-3 py-3 text-right bg-teal-50/80 text-teal-950">
                            Store Receiving
                            <span className="block text-[9px] font-normal text-teal-700 lowercase">(inward stock)</span>
                          </th>
                          <th className="px-3 py-3 text-right bg-indigo-50/80 text-indigo-950">
                            Store Sold
                          </th>
                          <th className="px-3 py-3 text-right bg-blue-50/80 text-blue-950 border-r border-blue-200">
                            Store Closing
                            <span className="block text-[9px] font-normal text-blue-700 lowercase">(live store stock)</span>
                          </th>
                        </>
                      )}

                      {/* Overall Network Stock Columns (Always visible for full network transparency) */}
                      <th className="px-3 py-3 text-right bg-amber-50/70 text-amber-950 border-l border-amber-200">
                        Overall Opening
                        <span className="block text-[9px] font-normal text-amber-700 lowercase">(all 8 stores)</span>
                      </th>
                      <th className="px-3 py-3 text-right bg-teal-50/70 text-teal-950">
                        Overall Receiving
                        <span className="block text-[9px] font-normal text-teal-700 lowercase">(all 8 stores)</span>
                      </th>
                      <th className="px-3 py-3 text-right bg-indigo-50/70 text-indigo-950">
                        {selectedLocation !== "all" ? "Total Sold" : "Volume Sold"}
                      </th>
                      <th className="px-3 py-3 text-right bg-violet-50/70 text-violet-950 border-r border-violet-200">
                        Overall Closing
                        <span className="block text-[9px] font-normal text-violet-700 lowercase">(all 8 stores)</span>
                      </th>

                      <th className="px-3 py-3 text-right">Selling Rate</th>
                      <th className="px-3 py-3 text-right">Total Revenue</th>
                      <th className="px-3 py-3 text-center">Admin Stock Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIndexSales.map((item) => {
                      const hasSold = item.total_pieces_sold > 0;
                      const storeClosing = item.store_closing_stock ?? item.closing_stock ?? 0;
                      const storeOpening = item.store_opening_stock ?? item.opening_stock ?? 0;
                      const storeReceiving = item.store_receiving_stock ?? item.receiving_stock ?? 0;
                      const storeSold = item.store_pieces_sold ?? item.total_pieces_sold ?? 0;
                      const overallClosing = item.overall_closing_stock ?? item.closing_stock ?? 0;
                      const overallOpening = item.overall_opening_stock ?? item.opening_stock ?? 0;
                      const overallReceiving = item.overall_receiving_stock ?? item.receiving_stock ?? 0;
                      const overallSold = item.overall_pieces_sold ?? item.total_pieces_sold ?? 0;

                      return (
                        <tr
                          key={item.product_id}
                          className={`transition ${hasSold ? "bg-indigo-50/20 font-semibold" : "hover:bg-slate-50/80"}`}
                        >
                          <td className="px-3 py-2.5 font-mono font-extrabold text-indigo-700 whitespace-nowrap">
                            #{item.index_no}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-900">
                            {item.name}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {item.brand}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 font-medium">
                            {item.colour || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-500">
                            {item.case_pack} pcs
                          </td>

                          {/* Individual Store Columns */}
                          {selectedLocation !== "all" && (
                            <>
                              <td className="px-3 py-2.5 text-right font-mono font-bold bg-blue-50/30 text-blue-950 whitespace-nowrap border-l border-blue-100">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span>
                                    {viewUnit === "cases"
                                      ? `${(storeOpening / item.case_pack).toFixed(1)} Cs`
                                      : `${storeOpening} PCS`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditOpeningModal(item)}
                                    className="p-1 rounded-md text-blue-700 hover:text-blue-900 hover:bg-blue-100 transition"
                                    title={`Edit Store Opening Stock for Index #${item.index_no}`}
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold bg-teal-50/30 text-teal-950 whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span>
                                    {viewUnit === "cases"
                                      ? `${(storeReceiving / item.case_pack).toFixed(1)} Cs`
                                      : `${storeReceiving} PCS`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditReceivingModal(item)}
                                    className="p-1 rounded-md text-teal-700 hover:text-teal-900 hover:bg-teal-100 transition"
                                    title={`Edit Store Receiving Stock for Index #${item.index_no}`}
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-black bg-indigo-50/30 whitespace-nowrap">
                                {storeSold > 0 ? (
                                  <span className="text-emerald-700">
                                    {viewUnit === "cases"
                                      ? `${(storeSold / item.case_pack).toFixed(1)} Cs`
                                      : `${storeSold} PCS`}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-normal">0</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold bg-blue-50/30 text-blue-950 whitespace-nowrap border-r border-blue-100">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span>
                                    {viewUnit === "cases"
                                      ? `${(storeClosing / item.case_pack).toFixed(1)} Cs`
                                      : `${storeClosing} PCS`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditClosingModal(item)}
                                    className="p-1 rounded-md text-blue-700 hover:text-blue-900 hover:bg-blue-100 transition"
                                    title={`Manually edit Store Closing Stock for Index #${item.index_no}`}
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}

                          {/* Overall Network Columns */}
                          <td className="px-3 py-2.5 text-right font-mono font-bold bg-amber-50/30 text-amber-950 whitespace-nowrap border-l border-amber-100">
                            <div className="flex items-center justify-end gap-1.5">
                              <span>
                                {viewUnit === "cases"
                                  ? `${(overallOpening / item.case_pack).toFixed(1)} Cs`
                                  : `${overallOpening} PCS`}
                              </span>
                              {selectedLocation === "all" && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditOpeningModal(item)}
                                  className="p-1 rounded-md text-amber-700 hover:text-amber-900 hover:bg-amber-100 transition"
                                  title={`Edit Store Opening Stock for Index #${item.index_no}`}
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold bg-teal-50/30 text-teal-950 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <span>
                                {viewUnit === "cases"
                                  ? `${(overallReceiving / item.case_pack).toFixed(1)} Cs`
                                  : `${overallReceiving} PCS`}
                              </span>
                              {selectedLocation === "all" && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditReceivingModal(item)}
                                  className="p-1 rounded-md text-teal-700 hover:text-teal-900 hover:bg-teal-100 transition"
                                  title={`Edit Store Receiving Stock for Index #${item.index_no}`}
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-black bg-indigo-50/40 whitespace-nowrap">
                            {overallSold > 0 ? (
                              <span className="text-emerald-700 text-sm">
                                {viewUnit === "cases"
                                  ? `${(overallSold / item.case_pack).toFixed(1)} Cs`
                                  : `${overallSold} PCS`}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold bg-violet-50/30 text-violet-950 whitespace-nowrap border-r border-violet-100">
                            {viewUnit === "cases"
                              ? `${(overallClosing / item.case_pack).toFixed(1)} Cs`
                              : `${overallClosing} PCS`}
                          </td>

                          <td className="px-3 py-2.5 text-right font-mono text-slate-800 whitespace-nowrap">
                            ₹{item.selling_rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-black whitespace-nowrap">
                            {hasSold ? (
                              <span className="text-emerald-700">
                                ₹{item.total_revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">₹0.00</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditOpeningModal(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition border border-indigo-200"
                                title="Adjust store opening stock baseline"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Opening</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditReceivingModal(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 transition border border-teal-200"
                                title="Adjust inward receiving stock"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Receiving</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditClosingModal(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 transition border border-violet-200"
                                title="Manually adjust closing stock (saved permanently)"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Closing</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const prod = products.find((p) => p.id === item.product_id);
                                  setSelectedStockProduct(
                                    prod || {
                                      id: item.product_id,
                                      case_pack: item.case_pack,
                                      selling_rate: item.selling_rate,
                                      name: item.name,
                                    }
                                  );
                                  setStockModalOpen(true);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                                title="Add stock entry batch"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-right uppercase tracking-wider text-xs">
                        Index Total ({filteredIndexSales.length} SKU's):
                      </td>
                      {selectedLocation !== "all" && (
                        <>
                          <td className="px-3 py-3 text-right font-black text-blue-900 whitespace-nowrap">
                            {viewUnit === "cases"
                              ? `${(indexViewTotals.store_opening / (indexViewTotals.cases || 1)).toFixed(1)} Cs`
                              : `${indexViewTotals.store_opening} PCS`}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-teal-900 whitespace-nowrap">
                            {viewUnit === "cases"
                              ? `${(indexViewTotals.store_receiving / (indexViewTotals.cases || 1)).toFixed(1)} Cs`
                              : `${indexViewTotals.store_receiving} PCS`}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-indigo-900 whitespace-nowrap">
                            {viewUnit === "cases"
                              ? `${((summary.overall?.total_pieces || 0) / 4).toFixed(1)} Cs`
                              : `${summary.overall?.total_pieces || 0} PCS`}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-blue-900 whitespace-nowrap">
                            {viewUnit === "cases"
                              ? `${(indexViewTotals.store_closing / (indexViewTotals.cases || 1)).toFixed(1)} Cs`
                              : `${indexViewTotals.store_closing} PCS`}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-3 text-right font-black text-amber-900 whitespace-nowrap">
                        {viewUnit === "cases"
                          ? `${(indexViewTotals.overall_opening / (indexViewTotals.cases || 1)).toFixed(1)} Cs`
                          : `${indexViewTotals.overall_opening} PCS`}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-teal-900 whitespace-nowrap">
                        {viewUnit === "cases"
                          ? `${(indexViewTotals.overall_receiving / (indexViewTotals.cases || 1)).toFixed(1)} Cs`
                          : `${indexViewTotals.overall_receiving} PCS`}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-indigo-900 whitespace-nowrap">
                        {viewUnit === "cases"
                          ? `${indexViewTotals.cases} Cases`
                          : `${indexViewTotals.pieces} PCS`}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-violet-900 whitespace-nowrap">
                        {viewUnit === "cases"
                          ? `${(indexViewTotals.overall_closing / (indexViewTotals.cases || 1)).toFixed(1)} Cs`
                          : `${indexViewTotals.overall_closing} PCS`}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-400 font-normal">
                        —
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-800 whitespace-nowrap">
                        ₹{indexViewTotals.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-400 font-normal">
                        —
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: EMPLOYEE SALES TRANSACTIONS & CORRECTIONS ================= */}
        {activeViewTab === "transactions" && (
          <div className="rounded-2xl border-2 border-indigo-200 bg-white shadow-sm overflow-hidden space-y-4">
            {/* Header Banner */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-wide">
                      Employee Sales Counter Transactions & Corrections
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-[10px] font-bold text-emerald-200 uppercase tracking-wider">
                      Live Editable
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/80 mt-0.5">
                    Modify the number of pieces sold, replace SKU models, or void erroneous transactions. Live store inventory adjusts automatically.
                  </p>
                </div>
              </div>

              {/* Total Receipts Badge */}
              <div className="bg-slate-800/80 px-3.5 py-2 rounded-xl border border-indigo-400/20 flex items-center gap-2.5">
                <span className="text-xs text-indigo-200">Registered Receipts:</span>
                <span className="text-base font-black text-white">{summary.sales?.length || 0}</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="p-4 bg-slate-50 border-y border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={transactionSearch}
                  onChange={(e) => setTransactionSearch(e.target.value)}
                  placeholder="Search by Receipt #ID, Employee Name, Store Canteen, or Model Name..."
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Staff Filter Dropdown */}
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedEmployee}
                  onChange={handleEmployeeChange}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="">All Employees ({employees.length})</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={String(emp.id)}>
                      {emp.name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transactions List */}
            {filteredTransactions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-base font-bold text-slate-700">No sales transactions found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Sales entered by staff at retail counters will appear here for audit and correction.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 p-2 sm:p-4 space-y-3">
                {filteredTransactions.map((sale) => (
                  <div
                    key={sale.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:border-indigo-300 transition"
                  >
                    {/* Top Row: Info & Action Buttons */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-black text-sm">
                          #{sale.id}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-sm">
                              Receipt #{sale.id}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {sale.formatted_datetime || sale.formatted_date || sale.sale_date}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span>Staff: <strong className="text-slate-800">{sale.employee_name}</strong> {sale.employee_code ? `(${sale.employee_code})` : ""}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-indigo-700 font-medium">
                              <Store className="w-3 h-3" /> {sale.location_name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <div className="text-right pr-2">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Volume</span>
                          <span className="text-base font-black text-slate-900">{sale.total_pieces} PCS</span>
                        </div>
                        <div className="text-right pr-3 border-r border-slate-200">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Amount</span>
                          <span className="text-base font-black text-emerald-700 font-mono">
                            ₹{Number(sale.total_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSaleModal(sale)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
                            title="Modify pieces sold or SKU items"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Modify / Correct</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingSale(sale)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                            title="Void sale and return pieces to inventory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Void</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Line Items Breakdown */}
                    <div className="pt-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                        Pieces & SKUs Sold in this Transaction ({sale.items?.length || 0} Line Items):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {(sale.items || []).map((it, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-mono font-extrabold text-indigo-700 block text-[11px]">
                                #{it.index_no}
                              </span>
                              <span className="font-bold text-slate-800 truncate block">
                                {it.product_name}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {it.brand} {it.colour ? `• ${it.colour}` : ""}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-black text-slate-900 block text-xs bg-indigo-100/70 text-indigo-900 px-2 py-0.5 rounded-lg">
                                {it.quantity} PCS
                              </span>
                              <span className="text-[10px] text-emerald-700 font-mono block mt-0.5 font-bold">
                                ₹{(it.quantity * (it.unit_price || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
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

        {/* ---------------- EMPLOYEE AGGREGATES CARDS ---------------- */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Individual Employee Sales Roster</h2>
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
      </div>

      {/* ================= MODAL: MODIFY / CORRECT EMPLOYEE SALE ================= */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-slate-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl text-white">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Modify Sale Receipt #{editingSale.id}</h3>
                  <p className="text-xs text-indigo-200">
                    Correct pieces sold, modify SKUs, or rebalance store counter inventory
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditSaleModal}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCorrection} className="p-6 space-y-5">
              {/* Context Banner */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-xs text-indigo-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>Automatic Inventory Rebalancing Active:</span>
                </div>
                <p className="text-indigo-800 text-[11px] leading-relaxed">
                  Decreasing pieces returns stock to the store warehouse. Increasing pieces or changing models checks store availability and deducts stock automatically.
                </p>
              </div>

              {/* Store & Staff Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Store Counter Location <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editLocationId}
                    onChange={(e) => setEditLocationId(parseInt(e.target.value, 10))}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Submitting Employee <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(parseInt(e.target.value, 10))}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List: What pieces sold and No of pieces sold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                    Line Items (Pieces & SKU Models Sold) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Piece / SKU</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {editItems.map((item, index) => {
                    const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
                    return (
                      <div
                        key={index}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                      >
                        {/* SKU Selector (What was sold) */}
                        <div className="flex-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Item #{index + 1}: Luggage Model / Index
                          </span>
                          <select
                            value={item.product_id}
                            onChange={(e) => handleItemProductChange(index, e.target.value)}
                            className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                #{p.index_no} • {p.name} ({p.brand}) — ₹{p.selling_rate || p.rate_per_pc}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity (No of pieces sold) */}
                        <div className="w-32 shrink-0">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Pieces Sold
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemQuantityChange(index, e.target.value)}
                              className="w-full text-sm font-black px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-center outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                              required
                            />
                            <span className="text-xs font-bold text-slate-500">PCS</span>
                          </div>
                        </div>

                        {/* Subtotal & Delete */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-4">
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-400 font-semibold uppercase">Subtotal</span>
                            <span className="font-mono font-black text-xs text-emerald-700">
                              ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {editItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Correction Summary Card */}
              {(() => {
                const totalPieces = editItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
                const totalCost = editItems.reduce((acc, it) => acc + (it.quantity || 0) * (it.unit_price || 0), 0);
                const originalPieces = editingSale.total_pieces || 0;
                const pcsDiff = totalPieces - originalPieces;

                return (
                  <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Corrected Volume</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black">{totalPieces} PCS</span>
                        {pcsDiff !== 0 && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            pcsDiff > 0 ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                          }`}>
                            {pcsDiff > 0 ? `+${pcsDiff} PCS (More)` : `${pcsDiff} PCS (Returned)`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Corrected Total Amount</span>
                      <span className="text-xl font-black font-mono text-emerald-400">
                        ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Correction Reason */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Reason for Correction (Optional Remark)
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Employee recorded incorrect Index #36812, corrected to #36813; Adjusted pieces from 5 to 3"
                  className="w-full text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEditSaleModal}
                  disabled={savingCorrection}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCorrection}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-indigo-600/30 transition flex items-center gap-2"
                >
                  {savingCorrection ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving & Rebalancing...</span>
                    </>
                  ) : (
                    <span>Save Corrections & Balance Inventory</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VOID / DELETE CONFIRMATION ================= */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Void Sale Receipt #{deletingSale.id}?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Submitted by <strong>{deletingSale.employee_name}</strong> at <strong>{deletingSale.location_name}</strong>.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 text-left">
                All <strong>{deletingSale.total_pieces} PCS</strong> across {deletingSale.items?.length || 0} items will be automatically returned to <strong>{deletingSale.location_name}</strong> warehouse inventory.
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingSale(null)}
                  disabled={deletingLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingLoading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-md shadow-rose-600/30 transition flex items-center gap-1.5"
                >
                  {deletingLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Voiding...</span>
                    </>
                  ) : (
                    <span>Yes, Void & Return Stock</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADMIN EDIT OPENING STOCK ================= */}
      {editingOpeningStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-white">
                  <Edit3 className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Admin Opening Stock Editor</h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Admin Only
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200">
                    Adjust opening baseline & rebalance live warehouse inventory
                  </p>
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

            {/* Form */}
            <form onSubmit={handleSaveOpeningStock} className="p-6 space-y-5">
              {/* Product Info Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-indigo-700 text-xs">
                    Index #{editingOpeningStock.index_no}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {editingOpeningStock.brand}
                  </span>
                </div>
                <div className="font-bold text-slate-900 text-sm leading-snug">
                  {editingOpeningStock.name}
                </div>
                <div className="text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                  <span>
                    Selling Rate: <strong className="text-emerald-700 font-mono">₹{editingOpeningStock.selling_rate}</strong>
                  </span>
                  <span>
                    Case Pack: <strong>{editingOpeningStock.case_pack} pcs/cs</strong>
                  </span>
                </div>
              </div>

              {/* Target Store Location Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Store Counter Location <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editOpeningLocationId || ""}
                  onChange={(e) => setEditOpeningLocationId(parseInt(e.target.value, 10))}
                  className="w-full text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Opening stock is configured specifically per individual store counter.
                </p>
              </div>

              {/* Current Metrics Grid for Selected Store */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Store Sold (Period)
                  </span>
                  <span className="text-lg font-extrabold text-emerald-800">
                    {editingOpeningStock.store_pieces_sold ?? 0} PCS
                  </span>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Overall Network Stock
                  </span>
                  <span className="text-lg font-extrabold text-slate-800">
                    {editingOpeningStock.overall_closing_stock ?? editingOpeningStock.closing_stock ?? 0} PCS
                  </span>
                </div>
              </div>

              {/* Input for Target Opening Stock */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  New Opening Stock Baseline (Pieces) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={newOpeningStockValue}
                  onChange={(e) => setNewOpeningStockValue(e.target.value)}
                  className="w-full text-lg font-bold px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Adjusting opening stock updates starting count and re-calculates closing stock as: <code>Closing = Opening - Volume Sold</code>.
                </p>
              </div>

              {/* Resulting Closing Stock Preview */}
              {(() => {
                const entered = parseInt(newOpeningStockValue, 10);
                const soldAtStore = editingOpeningStock.store_pieces_sold ?? 0;
                if (!isNaN(entered)) {
                  const resultingClosing = entered - soldAtStore;
                  return (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        resultingClosing >= 0
                          ? "bg-indigo-50/70 border-indigo-200 text-indigo-950"
                          : "bg-rose-50 border-rose-200 text-rose-900"
                      }`}
                    >
                      <span className="font-semibold">Calculated New Store Closing Stock:</span>
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
                  disabled={savingOpeningStock}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOpeningStock}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-indigo-600/30 transition flex items-center gap-2"
                >
                  {savingOpeningStock ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving & Rebalancing...</span>
                    </>
                  ) : (
                    <span>Save Store Opening Stock</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT RECEIVING STOCK (ADMIN ONLY) ================= */}
      {editingReceivingStock && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-100 text-teal-700">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Edit Store Receiving Stock (Admin)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Index #{editingReceivingStock.index_no} • Inward received stock adjustments recalculate closing stock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditReceivingModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReceivingStock} className="space-y-4">
              {/* Product Info Box */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Selected Item
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {editingReceivingStock.name}
                </p>
                <div className="text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                  <span>
                    Selling Rate: <strong className="text-emerald-700 font-mono">₹{editingReceivingStock.selling_rate}</strong>
                  </span>
                  <span>
                    Case Pack: <strong>{editingReceivingStock.case_pack} pcs/cs</strong>
                  </span>
                </div>
              </div>

              {/* Target Store Location Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Store Counter Location <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editReceivingLocationId || ""}
                  onChange={(e) => setEditReceivingLocationId(parseInt(e.target.value, 10))}
                  className="w-full text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 bg-white"
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input for Manual Receiving Stock */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Inward Receiving Stock (Pieces) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={newReceivingStockValue}
                  onChange={(e) => setNewReceivingStockValue(e.target.value)}
                  className="w-full text-lg font-bold px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Adjusting receiving stock updates live store receiving and recalculates Closing Stock = Opening + Receiving - Dispatched - Sold.
                </p>
              </div>

              {/* Audit Reason Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Audit Reason for Adjustment <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={receivingReason}
                  onChange={(e) => setReceivingReason(e.target.value)}
                  placeholder="e.g. Inward stock delivery arrival verification"
                  className="w-full text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900"
                  required
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEditReceivingModal}
                  disabled={savingReceivingStock}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReceivingStock}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl shadow-md shadow-teal-600/30 transition flex items-center gap-2"
                >
                  {savingReceivingStock ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Receiving Stock...</span>
                    </>
                  ) : (
                    <span>Save Receiving Stock</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT CLOSING STOCK (ADMIN ONLY) ================= */}
      {editingClosingStock && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-100 text-violet-700">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Edit Store Closing Stock (Admin)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Index #{editingClosingStock.index_no} • Manual overrides are preserved
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditClosingModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClosingStock} className="space-y-4">
              {/* Product Info Box */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Selected Item
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {editingClosingStock.name}
                </p>
                <div className="text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                  <span>
                    Selling Rate: <strong className="text-emerald-700 font-mono">₹{editingClosingStock.selling_rate}</strong>
                  </span>
                  <span>
                    Case Pack: <strong>{editingClosingStock.case_pack} pcs/cs</strong>
                  </span>
                </div>
              </div>

              {/* Target Store Location Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Store Counter Location <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editClosingLocationId || ""}
                  onChange={(e) => setEditClosingLocationId(parseInt(e.target.value, 10))}
                  className="w-full text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 bg-white"
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input for Manual Closing Stock */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  New Physical Closing Stock (Pieces) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={newClosingStockValue}
                  onChange={(e) => setNewClosingStockValue(e.target.value)}
                  className="w-full text-lg font-bold px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-slate-900"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Manual edits are permanently saved and will not be overwritten by automatic recalculations.
                </p>
              </div>

              {/* Audit Reason Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Audit Reason for Adjustment <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={closingReason}
                  onChange={(e) => setClosingReason(e.target.value)}
                  placeholder="e.g. Physical inventory count audit reconciliation"
                  className="w-full text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none text-slate-900"
                  required
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEditClosingModal}
                  disabled={savingClosingStock}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClosingStock}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl shadow-md shadow-violet-600/30 transition flex items-center gap-2"
                >
                  {savingClosingStock ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Audit & Overrides...</span>
                    </>
                  ) : (
                    <span>Save Store Closing Stock</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / UPDATE STOCK ================= */}
      <StockEntryModal
        isOpen={stockModalOpen}
        onClose={() => {
          setStockModalOpen(false);
          setSelectedStockProduct(null);
        }}
        onSuccess={() => {
          loadSales();
        }}
        products={products}
        locations={locations}
        isAdmin={true}
        initialProduct={selectedStockProduct}
      />
    </Layout>
  );
};

export default AdminSales;
