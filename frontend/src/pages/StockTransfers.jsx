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
  CheckCircle2,
  XCircle,
  Plus,
  Boxes,
  Clock,
  Search,
  RefreshCw,
  ArrowRight,
  Send,
} from "lucide-react";
import ProductSearchSelect from "../components/ProductSearchSelect";
import { TableSkeleton } from "../components/LoadingSkeleton";

const StockTransfers = () => {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | SENT | RECEIVED | CANCELLED
  const [searchQuery, setSearchQuery] = useState("");

  // Admin Transfer Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Admin Transfer Form State
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

      if (locationsData?.length > 0 && !fromLocationId) {
        setFromLocationId(String(locationsData[0].id));
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

  // Compute live source stock when store or product changes
  useEffect(() => {
    if (fromLocationId && selectedProduct) {
      const inv = selectedProduct.inventory_items?.find(
        (i) => String(i.location_id) === String(fromLocationId)
      );
      setSourceStock(inv ? inv.quantity : 0);
    } else {
      setSourceStock(null);
    }
  }, [fromLocationId, selectedProduct]);

  const handleOpenModal = () => {
    if (!isAdmin) {
      addToast("Unauthorized: Only administrators can configure inter-store transfers.", "error");
      return;
    }
    if (locations.length > 0) {
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
    if (!isAdmin) {
      addToast("Access Denied: Only Admin can order stock transfers.", "error");
      return;
    }
    if (!fromLocationId) {
      addToast("Please select the sending store counter.", "error");
      return;
    }
    if (!toLocationId) {
      addToast("Please select the receiving destination counter.", "error");
      return;
    }
    if (fromLocationId === toLocationId) {
      addToast("Sending and receiving store counters cannot be the same.", "error");
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
      addToast(`Cannot transfer ${qty} pcs. Available at sending store: ${sourceStock} pcs.`, "error");
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
      addToast(
        `Sent ${qty} pcs (${created.cases_display}) from ${created.from_location_name} to ${created.to_location_name}!`,
        "success"
      );
      setIsModalOpen(false);
      loadData(true);
    } catch (err) {
      console.error("Failed to create transfer:", err);
      addToast(err.message || "Failed to order stock transfer", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (transfer) => {
    const confirmReceive = window.confirm(
      `Confirm receipt of ${transfer.quantity} Pieces (${transfer.cases_display}) at ${transfer.to_location_name}?`
    );
    if (!confirmReceive) return;

    try {
      await receiveStockTransfer(transfer.id);
      addToast(
        `✅ Received ${transfer.quantity} Pieces (${transfer.cases_display}) at ${transfer.to_location_name}! Stock added to counter.`,
        "success"
      );
      loadData(true);
    } catch (err) {
      console.error("Failed to receive transfer:", err);
      addToast(err.message || "Failed to confirm receipt", "error");
    }
  };

  const handleCancel = async (transfer) => {
    if (!isAdmin) {
      addToast("Only administrators can cancel transfer orders.", "error");
      return;
    }
    const confirmCancel = window.confirm(
      `Cancel transfer #${transfer.transfer_number}? Pieces will be returned to ${transfer.from_location_name}.`
    );
    if (!confirmCancel) return;

    try {
      await cancelStockTransfer(transfer.id);
      addToast(`Transfer order #${transfer.transfer_number} cancelled.`, "success");
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

  const sentCount = transfers.filter((t) => t.status === "SENT").length;
  const receivedCount = transfers.filter((t) => t.status === "RECEIVED").length;
  const totalPiecesMoved = transfers
    .filter((t) => t.status === "RECEIVED")
    .reduce((sum, t) => sum + (t.quantity || 0), 0);

  // Helper for pieces-to-cases live preview in Admin modal
  const pack = selectedProduct?.case_pack || 1;
  const enteredQty = parseInt(quantity, 10) || 0;
  const previewCases = Math.floor(enteredQty / pack);
  const previewRemainder = enteredQty % pack;

  return (
    <Layout
      title={isAdmin ? "Inter-Store Stock Transfers" : "Canteen Stock Transfer Desk"}
      subtitle={
        isAdmin
          ? "Admin Executive Master: Order and adjust stock transfers between canteen counters"
          : "Counter Staff Portal: Confirm 'Received' for incoming stock sent to your counter"
      }
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          {/* STRICTLY ADMIN ONLY: Only Admin can configure / initiate a transfer */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Stock Transfer</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Role Banner for Staff */}
        {!isAdmin && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-850 dark:to-slate-800 border border-indigo-200/80 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Store Counter Transfer Desk ({user?.assigned_location?.name || `Counter #${user?.assigned_location_id}`})
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Admin orders transfers between stores. When stock arrives at your counter, click <strong className="text-emerald-600">"Click Received"</strong> to add the pieces into your live counter stock.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sent (Awaiting Receipt)</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <Send className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {sentCount}
              </span>
              <span className="text-xs text-amber-600 font-semibold">orders sent</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Received (In Stock)</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {receivedCount}
              </span>
              <span className="text-xs text-emerald-600 font-semibold">verified in stock</span>
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
              <span className="text-xs text-slate-500">pieces moved</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: `All (${transfers.length})` },
              { id: "SENT", label: `Sent (${sentCount})` },
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

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transfer #, product, store..."
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
                : isAdmin
                ? "Click 'New Stock Transfer' above to transfer stock between canteen counters."
                : "No active transfers currently assigned for your counter."}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Transfer ID</th>
                    <th className="py-3.5 px-4">Counter Route (From ➔ To)</th>
                    <th className="py-3.5 px-4">Safari SKU Details</th>
                    <th className="py-3.5 px-4 text-center">Pieces & Cases</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Timeline / Audit</th>
                    <th className="py-3.5 px-4 text-right">Click Option</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredTransfers.map((t) => {
                    const isReceiverStore =
                      isAdmin || (user?.assigned_location_id && user.assigned_location_id === t.to_location_id);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-850 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {t.transfer_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {t.from_location_name}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                              {t.to_location_name}
                            </span>
                          </div>
                          {t.notes && <p className="text-[11px] text-slate-400 mt-1 italic">"{t.notes}"</p>}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{t.product_name}</div>
                          {t.product_index && (
                            <div className="text-[11px] text-slate-400 font-mono">Index #{t.product_index} (Pack: {t.case_pack} pcs)</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-extrabold text-xs">
                              {t.quantity} Pieces
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {t.cases_display}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {t.status === "SENT" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <Send className="w-3 h-3" />
                              Sent (Awaiting Receipt)
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
                          <div>Sent by <strong className="text-slate-700 dark:text-slate-300">{t.initiated_by_name}</strong></div>
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
                          <div className="flex items-center justify-end gap-2">
                            {/* RECEIVE CLICK OPTION (For Receiving Store Staff or Admin) */}
                            {t.status === "SENT" && isReceiverStore && (
                              <button
                                type="button"
                                onClick={() => handleReceive(t)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Click Received ({t.quantity} Pcs / {t.cases_display})</span>
                              </button>
                            )}

                            {/* CANCEL (Admin Master Only) */}
                            {isAdmin && t.status === "SENT" && (
                              <button
                                type="button"
                                onClick={() => handleCancel(t)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition"
                                title="Admin Cancel"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            )}

                            {t.status === "RECEIVED" && (
                              <span className="text-[11px] text-emerald-600 font-bold">
                                Completed ✅
                              </span>
                            )}
                            {t.status === "CANCELLED" && (
                              <span className="text-[11px] text-slate-400 italic">
                                Cancelled ❌
                              </span>
                            )}
                          </div>
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

      {/* Admin Only Stock Transfer Order Modal */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Admin Stock Transfer Order</h3>
                  <p className="text-xs text-slate-500">Configure pieces and cases to be transferred between canteen counters</p>
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
                {/* Sending Store */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    From Canteen (Sending Store)
                  </label>
                  <select
                    value={fromLocationId}
                    onChange={(e) => setFromLocationId(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Receiving Store */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    To Canteen (Receiving Store)
                  </label>
                  <select
                    value={toLocationId}
                    onChange={(e) => setToLocationId(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="">-- Select Receiving Store --</option>
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

              {/* Product SKU Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Safari SKU / Model Description
                </label>
                <ProductSearchSelect
                  products={products}
                  selectedProduct={selectedProduct}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                />
                {sourceStock !== null && (
                  <div className="mt-1.5 flex items-center justify-between text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Available at Sending Store:</span>
                    <span className={`font-mono font-bold ${sourceStock > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {sourceStock} Pieces
                    </span>
                  </div>
                )}
              </div>

              {/* Quantity in Pieces and Instant Cases Preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Quantity to Transfer (Pieces)
                  </label>
                  {selectedProduct && (
                    <span className="text-[11px] text-indigo-600 font-semibold">
                      Pack Size: {selectedProduct.case_pack || 1} pcs / Case
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={sourceStock !== null ? sourceStock : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 12"
                  required
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />

                {enteredQty > 0 && selectedProduct && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span>Equivalent Breakdown:</span>
                    <span className="font-mono font-bold">
                      {previewCases > 0 && `${previewCases} Case${previewCases > 1 ? "s" : ""}`}
                      {previewRemainder > 0 && `${previewCases > 0 ? " + " : ""}${previewRemainder} Piece${previewRemainder > 1 ? "s" : ""}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Ordered by Admin for weekend rush"
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
                  <Send className="w-4 h-4" />
                  <span>{submitting ? "Sending..." : `Send Stock (${enteredQty} Pcs / ${previewCases > 0 ? previewCases + " Cases" : enteredQty + " Pcs"})`}</span>
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
