import React, { useState, useEffect } from "react";
import ProductSearchSelect from "./ProductSearchSelect";
import { updateStock } from "../services/api";
import { useToast } from "./Toast";
import {
  PackagePlus,
  Layers,
  MapPin,
  X,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Tag
} from "lucide-react";

const StockEntryModal = ({
  isOpen,
  onClose,
  onSuccess,
  products = [],
  locations = [],
  defaultLocationId = null,
  isAdmin = false,
  initialProduct = null,
}) => {
  const { addToast } = useToast();

  const [selectedProductId, setSelectedProductId] = useState(
    initialProduct ? initialProduct.id : ""
  );
  const [selectedLocationId, setSelectedLocationId] = useState(
    defaultLocationId || (locations[0] ? locations[0].id : "")
  );
  const [quantity, setQuantity] = useState("");
  const [mode, setMode] = useState("set"); // "set" (override count) or "add" (add incoming)
  const [loading, setLoading] = useState(false);

  const [entryUnit, setEntryUnit] = useState("pieces"); // "pieces" or "cases"

  useEffect(() => {
    if (isOpen) {
      if (initialProduct) {
        setSelectedProductId(initialProduct.id);
      }
      if (defaultLocationId) {
        setSelectedLocationId(defaultLocationId);
      }
      setQuantity("");
      setEntryUnit("pieces");
    }
  }, [isOpen, initialProduct, defaultLocationId]);

  if (!isOpen) return null;

  const selectedProduct = products.find(
    (p) => String(p.id) === String(selectedProductId)
  );

  const selectedLocation = locations.find(
    (l) => String(l.id) === String(selectedLocationId)
  );

  const casePack = selectedProduct?.case_pack || 1;
  const numQty = parseInt(quantity, 10) || 0;
  const computedPieces = entryUnit === "cases" ? numQty * casePack : numQty;
  const computedCases = entryUnit === "pieces" ? (casePack > 0 ? (numQty / casePack).toFixed(1) : 0) : numQty;

  const handleQuickAdd = (amount) => {
    const current = parseInt(quantity, 10) || 0;
    setQuantity(String(current + amount));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProductId) {
      addToast("Please select a product using Index No. or Name", "error");
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      addToast(`Please enter a valid ${entryUnit} count (0 or greater)`, "error");
      return;
    }

    if (isAdmin && !selectedLocationId) {
      addToast("Please select a target store location", "error");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        product_id: parseInt(selectedProductId, 10),
        quantity: qty,
        unit: entryUnit,
        mode: mode,
      };

      if (isAdmin && selectedLocationId) {
        payload.location_id = parseInt(selectedLocationId, 10);
      }

      const res = await updateStock(payload);
      addToast(
        res.message || `Stock updated to ${computedPieces} PCS successfully!`,
        "success"
      );

      if (onSuccess) {
        onSuccess(res.inventory);
      }
      onClose();
    } catch (err) {
      console.error("Failed to update stock:", err);
      addToast(err.message || "Failed to update stock. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Enter Stock Pieces
              </h3>
              <p className="text-xs text-slate-500">
                Log real physical count or incoming shipment pieces
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Location Selector (Admin only or display for employee) */}
          {isAdmin ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Target Retail Location <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                >
                  <option value="">Select a store location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.city ? `(${loc.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : selectedLocation ? (
            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span>Store: {selectedLocation.name}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-800">
                Assigned
              </span>
            </div>
          ) : null}

          {/* Product Autocomplete with Index No. */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Luggage SKU (Search by Index No. or Name) <span className="text-rose-500">*</span>
            </label>
            <ProductSearchSelect
              products={products}
              selectedProductId={selectedProductId}
              onSelectProduct={(p) => setSelectedProductId(p ? p.id : "")}
              placeholder="Search Index No. (e.g. 36812) or model name..."
              required={true}
            />
          </div>

          {/* Mode Selector: Override Count vs Add Incoming */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Operation Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("set")}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
                  mode === "set"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Set Exact Piece Count</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("add")}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
                  mode === "add"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Incoming Stock</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {mode === "set"
                ? "Overrides existing quantity with the exact physical piece count."
                : "Adds new pieces to whatever quantity is already in stock."}
            </p>
          </div>

          {/* Unit Toggle & Quantity Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Entry Unit & Count <span className="text-rose-500">*</span>
              </label>
              
              {/* Unit Toggle Tabs */}
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setEntryUnit("pieces")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    entryUnit === "pieces"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Pieces (PCS)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryUnit("cases")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    entryUnit === "cases"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cases (Boxes)
                </button>
              </div>
            </div>

            {/* Live Case Pack Info Banner */}
            {selectedProduct && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Case Pack Size:</span>
                  <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-100 text-indigo-800 text-[11px]">
                    {casePack} PCS / Case
                  </span>
                </div>
                {numQty > 0 && (
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    {entryUnit === "cases" ? (
                      <span className="text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        📦 {numQty} Cases = <strong className="text-indigo-900">{computedPieces} Pieces</strong>
                      </span>
                    ) : (
                      <span className="text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        📦 {numQty} Pieces ≈ <strong className="text-indigo-900">{computedCases} Cases</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Input & Valuation */}
            <div className="relative">
              <input
                type="number"
                min="0"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={entryUnit === "cases" ? "Enter case / box count (e.g. 5)" : "Enter piece count (e.g. 20)"}
                className="w-full text-sm font-semibold px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition font-mono pr-20"
              />
              <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold uppercase tracking-wider text-indigo-600 pointer-events-none">
                {entryUnit === "cases" ? "CASES" : "PIECES"}
              </span>
            </div>

            {/* Valuation display */}
            {selectedProduct?.selling_rate && numQty > 0 && (
              <div className="flex justify-end text-[11px] text-emerald-700 font-semibold font-mono">
                Valuation: ₹{(selectedProduct.selling_rate * computedPieces).toLocaleString("en-IN")}
              </div>
            )}

            {/* Quick Increment Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 mr-1 font-semibold uppercase">
                Quick +:
              </span>
              {(entryUnit === "cases" ? [1, 2, 5, 10, 25] : [5, 10, 20, 50, 100]).map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAdd(amt)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition"
                >
                  +{amt} {entryUnit === "cases" ? "Case" : "Pcs"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuantity("0")}
                className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold transition ml-auto"
              >
                0 (Zero Stock)
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !selectedProductId || quantity === ""}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-950/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? "Updating Database..." : "Save Stock Count"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockEntryModal;
