import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import {
  getStockTransfers,
  createStockTransfer,
  receiveStockTransfer,
  cancelStockTransfer,
  getLocations,
  getProducts,
} from "../services/api";
import {
  ArrowLeftRight,
  Truck,
  CheckCircle2,
  XCircle,
  Plus,
  Boxes,
  Clock,
  Building2,
  Luggage,
  Search,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import ProductSearchSelect from "../components/ProductSearchSelect";
import ScrollReveal from "../components/ScrollReveal";
import { TableSkeleton } from "../components/LoadingSkeleton";

const StockTransfers = () => {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, IN_TRANSIT, RECEIVED, CANCELLED
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceStock, setSourceStock] = useState(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [transfersData, locationsData, productsData] = await Promise.all([
        getStockTransfers(),
        getLocations(),
        getProducts(),
      ]);
      setTransfers(transfersData || []);
      setLocations(locationsData || []);
      setProducts(productsData || []);

      // Default source store for staff
      if (!isAdmin && user?.assigned_location_id) {
        setFromLocationId(String(user.assigned_location_id));
      }
    } catch (err) {
      console.error("Failed to load transfers:", err);
      addToast(err.message || "Failed to load stock transfers", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // When source store or product changes, update available source stock
  useEffect(() => {
    if (fromLocationId && selectedProduct) {
      // Find quantity in selectedProduct.inventory_items
      const inv = selectedProduct.inventory_items?.find(
        (i) => String(i.location_id) === String(fromLocationId)
      );
      setSourceStock(inv ? inv.quantity : 0);
    } else {
      setSourceStock(null);
    }
  }, [fromLocationId, selectedProduct]);

  const handleOpenModal = () => {
    if (!isAdmin && user?.assigned_location_id) {
      setFromLocationId(String(user.assigned_location_id));
    } else if (locations.length > 0) {
      setFromLocationId(String(locations[0].id));
    }
    setToLocationId("");
    setSelectedProduct(null);
    setQuantity("");
    setNotes("");
    setIsModalOpen(true);
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!fromLocationId) {
      addToast("Please select a source store counter.", "error");
      return;
    }
    if (!toLocationId) {
      addToast("Please select a destination store counter.", "error");
      return;
    }
    if (fromLocationId === toLocationId) {
      addToast("Source and destination store counters cannot be the same.", "error");
      return;
    }
    if (!selectedProduct) {
      addToast("Please select a Safari SKU to transfer.", "error");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      addToast("Transfer quantity must be at least 1 piece.", "error");
      return;
    }
    if (sourceStock !== null && qty > sourceStock) {
      addToast(`Cannot transfer ${qty} pcs. Available at source: ${sourceStock} pcs.`, "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        from_location_id: parseInt(fromLocationId, 10),
        to_location_id: parseInt(toLocationId, 10),
        product_id: selectedProduct.id,
        quantity: qty,
        notes: notes.trim() || undefined,
      };
      const created = await createStockTransfer(payload);
      addToast(`Dispatched ${qty} pcs of ${created.product_name} to ${created.to_location_name}!`, "success");
      setIsModalOpen(false);
      loadData(true);
    } catch (err) {
      console.error("Failed to create transfer:", err);
      addToast(err.message || "Failed to initiate transfer", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (transfer) => {
    const confirmReceive = window.confirm(
      `Confirm receipt of ${transfer.quantity} pcs of ${transfer.product_name} at ${transfer.to_location_name}?`
    );
    if (!confirmReceive) return;

    try {
      await receiveStockTransfer(transfer.id);
      addToast(`✅ Received ${transfer.quantity} pcs at ${transfer.to_location_name}! Stock updated.`, "success");
      loadData(true);
    } catch (err) {
      console.error("Failed to receive transfer:", err);
      addToast(err.message || "Failed to confirm receipt", "error");
    }
  };

  const handleCancel = async (transfer) => {
    const confirmCancel = window.confirm(
      `Cancel transfer #${transfer.transfer_number}? ${transfer.quantity} pieces will be returned to ${transfer.from_location_name}.`
    );
    if (!confirmCancel) return;

    try {
      await cancelStockTransfer(transfer.id);
      addToast(`Transfer cancelled. ${transfer.quantity} pieces returned to source store.`, "success");
      loadData(true);
    } catch (err) {
      console.error("Failed to cancel transfer:", err);
      addToast(err.message || "Failed to cancel transfer", "error");
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = t.transfer_number?.toLowerCase().includes(q);
      const matchProd = t.product_name?.toLowerCase().includes(q);
      const matchIdx = t.product_index?.toLowerCase().includes(q);
      const matchFrom = t.from_location_name?.toLowerCase().includes(q);
      const matchTo = t.to_location_name?.toLowerCase().includes(q);
      if (!matchNo && !matchProd && !matchIdx && !matchFrom && !matchTo) return false;
    }
    return true;
  });

  const inTransitCount = transfers.filter((t) => t.status === "IN_TRANSIT").length;
  const receivedCount = transfers.filter((t) => t.status === "RECEIVED").length;
  const totalPiecesMoved = transfers
    .filter((t) => t.status === "RECEIVED")
    .reduce((sum, t) => sum + (t.quantity || 0), 0);

  return (
    <Layout
      title="Inter-Store Stock Transfers"
      subtitle="Safely move and balance inventory between CSD canteen counters with dual-ended verification"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Stock Transfer</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">In Transit On Road</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {inTransitCount}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                awaiting counter receipt
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Completed Deliveries</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {receivedCount}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                verified in stock
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Pieces Rebalanced</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {totalPiecesMoved}
              </span>
              <span className="text-xs text-slate-500">pieces successfully transferred</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: `All (${transfers.length})` },
              { id: "IN_TRANSIT", label: `In Transit (${inTransitCount})` },
              { id: "RECEIVED", label: `Received (${receivedCount})` },
              { id: "CANCELLED", label: `Cancelled` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transfer, product, store..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Transfers Table */}
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filteredTransfers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
            <ArrowLeftRight className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">No stock transfers found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {statusFilter !== "ALL"
                ? `No transfers matching status "${statusFilter}".`
                : "Transfer surplus stock between canteen counters to balance inventory."}
            </p>
            <button
              type="button"
              onClick={handleOpenModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate First Transfer</span>
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Transfer ID</th>
                    <th className="py-3.5 px-4">Route (From ➔ To)</th>
                    <th className="py-3.5 px-4">Product Details</th>
                    <th className="py-3.5 px-4 text-center">Quantity</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Timeline / Staff</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredTransfers.map((t) => {
                    const isDestinationStaff =
                      isAdmin || (user?.assigned_location_id && user.assigned_location_id === t.to_location_id);
                    const isSenderOrAdmin =
                      isAdmin || (user?.id && user.id === t.initiated_by_id);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-850 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {t.transfer_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <span>{t.from_location_name}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{t.to_location_name}</span>
                          </div>
                          {t.notes && <p className="text-[11px] text-slate-400 mt-0.5 italic">"{t.notes}"</p>}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{t.product_name}</div>
                          {t.product_index && (
                            <div className="text-[11px] text-slate-400 font-mono">Index #{t.product_index}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono font-extrabold text-sm">
                            {t.quantity} pcs
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {t.status === "IN_TRANSIT" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <Truck className="w-3 h-3" />
                              In Transit
                            </span>
                          )}
                          {t.status === "RECEIVED" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Received
                            </span>
                          )}
                          {t.status === "CANCELLED" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
                              <XCircle className="w-3 h-3" />
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-500">
                          <div>
                            Dispatched by <span className="font-semibold text-slate-700 dark:text-slate-300">{t.initiated_by_name}</span>
                          </div>
                          {t.received_by_name && (
                            <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Received by {t.received_by_name}
                            </div>
                          )}
                          <div className="text-slate-400 mt-0.5">
                            {new Date(t.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {t.status === "IN_TRANSIT" && (
                            <div className="flex items-center justify-end gap-2">
                              {isDestinationStaff && (
                                <button
                                  type="button"
                                  onClick={() => handleReceive(t)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Confirm Received</span>
                                </button>
                              )}
                              {isSenderOrAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleCancel(t)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
                                </button>
                              )}
                            </div>
                          )}
                          {t.status === "RECEIVED" && (
                            <span className="text-[11px] text-emerald-600 font-semibold">Stock Rebalanced</span>
                          )}
                          {t.status === "CANCELLED" && (
                            <span className="text-[11px] text-slate-400 italic">Pieces Returned</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Transfer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">New Inter-Store Stock Transfer</h3>
                  <p className="text-xs text-slate-500">Dispatch pieces between canteen counters</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Source Canteen */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    From Canteen (Source)
                  </label>
                  <select
                    value={fromLocationId}
                    onChange={(e) => setFromLocationId(e.target.value)}
                    disabled={!isAdmin && user?.assigned_location_id}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Canteen */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    To Canteen (Destination)
                  </label>
                  <select
                    value={toLocationId}
                    onChange={(e) => setToLocationId(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="">-- Select Destination --</option>
                    {locations
                      .filter((l) => String(l.id) !== String(fromLocationId))
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Product Search */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Safari SKU / Luggage Model
                </label>
                <ProductSearchSelect
                  products={products}
                  selectedProduct={selectedProduct}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                />
                {sourceStock !== null && (
                  <div className="mt-1.5 flex items-center justify-between text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Available at Source Store:</span>
                    <span className={`font-mono ${sourceStock > 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}`}>
                      {sourceStock} pieces
                    </span>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity to Transfer (Pieces)
                </label>
                <input
                  type="number"
                  min="1"
                  max={sourceStock !== null ? sourceStock : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 4"
                  required
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Memo / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Weekend counter restock, requisitioned by Upendra"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  <Truck className="w-4 h-4" />
                  <span>{submitting ? "Dispatching..." : "Dispatch Transfer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default StockTransfers;
