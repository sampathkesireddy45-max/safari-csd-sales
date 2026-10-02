import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getProducts, getInventories, createSale } from "../services/api";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ProductSearchSelect from "../components/ProductSearchSelect";
import { TableSkeleton } from "../components/LoadingSkeleton";
import { useToast } from "../components/Toast";
import {
  ShoppingBag,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Search,
  Tag
} from "lucide-react";

const SalesEntry = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [saleItems, setSaleItems] = useState([{ productId: "", quantity: "" }]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const loadData = async () => {
      try {
        const [productsData, inventoriesData] = await Promise.all([
          getProducts(),
          getInventories(),
        ]);
        setProducts(productsData || []);
        setInventories(inventoriesData || []);
      } catch (err) {
        console.error("Failed to load products or inventories:", err);
        addToast("Failed to load catalog inventory", "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleAddItem = () => {
    setSaleItems([...saleItems, { productId: "", quantity: "" }]);
  };

  const handleRemoveItem = (index) => {
    if (saleItems.length <= 1) return;
    const newItems = [...saleItems];
    newItems.splice(index, 1);
    setSaleItems(newItems);
  };

  const handleProductChange = (index, productId) => {
    const newItems = [...saleItems];
    newItems[index].productId = productId || "";
    setSaleItems(newItems);
  };

  const handleQuantityChange = (index, value) => {
    const newItems = [...saleItems];
    newItems[index].quantity = value;
    setSaleItems(newItems);
  };

  // Helper calculations
  const getItemPrice = (productId) => {
    if (!productId) return 0;
    const prod = products.find((p) => String(p.id) === String(productId));
    if (!prod) return 0;
    return prod.selling_rate || prod.rate_per_pc || prod.unit_price || 0;
  };

  const getItemSubtotal = (item) => {
    const qty = parseInt(item.quantity, 10);
    if (!item.productId || isNaN(qty) || qty <= 0) return 0;
    return getItemPrice(item.productId) * qty;
  };

  const totalPieces = saleItems.reduce((acc, item) => {
    const qty = parseInt(item.quantity, 10);
    return acc + (isNaN(qty) || qty <= 0 ? 0 : qty);
  }, 0);

  const grandTotalAmount = saleItems.reduce(
    (acc, item) => acc + getItemSubtotal(item),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validItems = saleItems.filter(
      (item) => item.productId && item.quantity && parseInt(item.quantity, 10) > 0
    );

    if (validItems.length === 0) {
      addToast("Please select at least one product and enter a valid quantity.", "error");
      return;
    }

    setSubmitting(true);

    const saleData = {
      employee_id: user.id,
      location_id: user.assigned_location_id,
      items: validItems.map((item) => ({
        product_id: parseInt(item.productId, 10),
        quantity: parseInt(item.quantity, 10),
      })),
    };

    try {
      await createSale(saleData);
      addToast(
        `Recorded ${totalPieces} PCS sale (₹${grandTotalAmount.toLocaleString("en-IN")}) successfully!`,
        "success"
      );
      setSaleItems([{ productId: "", quantity: "" }]);
      // Refresh inventory
      const updatedInv = await getInventories();
      setInventories(updatedInv || []);
    } catch (err) {
      console.error("Failed to create sale:", err);
      addToast(err.message || "Failed to record sale. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Daily Retail Sales Counter"
      subtitle="Input customer sales transactions to decrement live warehouse stock"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Register Customer Purchase
                </h2>
                <p className="text-xs text-slate-500">
                  Instant search by <span className="font-semibold text-indigo-600">Index No.</span> (e.g. 36812) or Luggage Name
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="text-slate-400">Total Items:</span>{" "}
                <span className="font-bold text-slate-800">{totalPieces} PCS</span>
              </div>
              <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                <span className="text-emerald-700">Total Value:</span>{" "}
                <span className="font-extrabold text-emerald-800 font-mono">
                  ₹{grandTotalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {saleItems.map((item, index) => {
                const subtotal = getItemSubtotal(item);
                const unitPrice = getItemPrice(item.productId);

                return (
                  <div
                    key={index}
                    className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Item #{index + 1}
                      </span>
                      {saleItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remove Line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      {/* Product Autocomplete with Index No. */}
                      <div className="sm:col-span-8">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                          Product (Search by Index No. or Name)
                        </label>
                        <ProductSearchSelect
                          products={products}
                          selectedProductId={item.productId}
                          onSelectProduct={(p) => handleProductChange(index, p ? p.id : "")}
                          placeholder="Type Index No. (e.g. 36812) or item name..."
                          required={true}
                        />
                      </div>

                      {/* Quantity Input */}
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                          Quantity
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            placeholder="Qty"
                            className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                          />
                          <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[11px] font-semibold text-slate-400 pointer-events-none">
                            PCS
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Line Subtotal Footer */}
                    {item.productId && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <div className="text-slate-500">
                          {unitPrice > 0 ? (
                            <span>
                              CSD Unit Rate: <span className="font-semibold text-slate-700">₹{unitPrice.toLocaleString("en-IN")}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Unit rate not specified</span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-800">
                          Line Total:{" "}
                          <span className="text-emerald-700 font-bold font-mono">
                            ₹{subtotal.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Product Line</span>
              </button>

              <div className="w-full sm:w-auto flex items-center justify-end gap-4">
                <div className="text-right hidden sm:block">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">
                    Grand Total
                  </span>
                  <span className="text-lg font-extrabold text-slate-900 font-mono">
                    ₹{grandTotalAmount.toLocaleString("en-IN")}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || totalPieces === 0}
                  className="w-full sm:w-auto px-7 py-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-950/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  <span>
                    {submitting ? "Recording Transaction..." : `Confirm & Save Sale (${totalPieces} PCS)`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default SalesEntry;
