import React, { useState, useEffect, useRef } from "react";
import { Search, Luggage, X, Check, Tag, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

const ProductSearchSelect = ({
  products = [],
  selectedProductId = "",
  onSelectProduct,
  placeholder = "Search by Index No. (e.g. 36812) or item name...",
  required = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedProduct = products.find(
    (p) => String(p.id) === String(selectedProductId)
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const indexMatch = p.index_no && String(p.index_no).toLowerCase().includes(term);
    const nameMatch = p.name && p.name.toLowerCase().includes(term);
    const idMatch = p.product_id && p.product_id.toLowerCase().includes(term);
    const brandMatch = p.brand && p.brand.toLowerCase().includes(term);
    const colourMatch = p.colour && p.colour.toLowerCase().includes(term);
    const catMatch = p.category && p.category.toLowerCase().includes(term);
    return indexMatch || nameMatch || idMatch || brandMatch || colourMatch || catMatch;
  });

  const handleSelect = (product) => {
    onSelectProduct(product);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelectProduct(null);
    setSearchTerm("");
    setIsOpen(false);
  };

  const getCaseRate = (p) => {
    if (!p || !p.selling_rate) return null;
    const pack = p.case_pack || 1;
    return p.selling_rate * pack;
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {selectedProduct ? (
        /* Selected Product Pill */
        <div className="flex items-center justify-between p-3 bg-indigo-50/90 border border-indigo-200 rounded-2xl text-xs transition shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Luggage className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedProduct.index_no && (
                  <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-200/80 text-indigo-900 text-[10px]">
                    INDEX #{selectedProduct.index_no}
                  </span>
                )}
                {selectedProduct.brand && (
                  <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-amber-100 text-amber-800 uppercase">
                    {selectedProduct.brand}
                  </span>
                )}
                <span className="font-bold text-slate-900 truncate">
                  {selectedProduct.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                {selectedProduct.selling_rate ? (
                  <span className="font-semibold text-emerald-700">
                    ₹{selectedProduct.selling_rate.toLocaleString("en-IN")} / PC
                  </span>
                ) : (
                  <span className="text-amber-600 font-medium">Price Not Set</span>
                )}
                <span className="text-slate-300">•</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-medium text-[10px]">
                  Pack: {selectedProduct.case_pack || 1} pcs/case
                </span>
                {getCaseRate(selectedProduct) && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-indigo-700">
                      ₹{getCaseRate(selectedProduct).toLocaleString("en-IN")} / Case
                    </span>
                  </>
                )}
                {selectedProduct.total_stock !== undefined && (
                  <>
                    <span className="text-slate-300">•</span>
                    {selectedProduct.total_stock <= 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-rose-100 text-rose-700 border border-rose-300">
                        <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                        Out of Stock (0)
                      </span>
                    ) : selectedProduct.total_stock <= (selectedProduct.case_pack || 1) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        Low Stock: {selectedProduct.total_stock} PCS (≤ 1 Case)
                      </span>
                    ) : selectedProduct.total_stock > 15 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-purple-100 text-purple-800 border border-purple-300">
                        <PackageCheck className="w-3 h-3 text-purple-600 shrink-0" />
                        Overstock: {selectedProduct.total_stock} PCS (&gt;15 pcs)
                      </span>
                    ) : selectedProduct.total_stock > 2 * (selectedProduct.case_pack || 1) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        Healthy: {selectedProduct.total_stock} PCS (&gt;2 Cases)
                      </span>
                    ) : (
                      <span className="text-blue-700 font-semibold text-[10px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        In Stock: {selectedProduct.total_stock} PCS (1–2 Cases)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition ml-2"
            title="Change Product"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Search Box */
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>

          <input
            type="text"
            required={required}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full text-xs pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 divide-y divide-slate-100 text-xs">
              <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                <span>Products ({filteredProducts.length} items)</span>
                <span>Search Index No., Model or Colour</span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  <p className="font-semibold text-slate-700">No product found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No item matches "{searchTerm}"
                  </p>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = String(p.id) === String(selectedProductId);
                  const caseRate = getCaseRate(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p)}
                      className={`w-full text-left p-3 hover:bg-indigo-50 transition flex items-center justify-between gap-3 ${
                        isSelected ? "bg-indigo-50/60" : ""
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <Luggage className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {p.index_no ? (
                              <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-indigo-100 text-indigo-800">
                                #{p.index_no}
                              </span>
                            ) : null}
                            {p.brand ? (
                              <span className="px-1.5 py-0.2 rounded font-bold text-[9px] bg-amber-50 text-amber-800 uppercase">
                                {p.brand}
                              </span>
                            ) : null}
                            <span className="font-semibold text-slate-900 truncate">
                              {p.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            {p.selling_rate ? (
                              <span className="font-semibold text-emerald-700">
                                ₹{p.selling_rate.toLocaleString("en-IN")} / PC
                              </span>
                            ) : (
                              <span className="text-amber-600 font-medium">Price Not Set</span>
                            )}
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 text-[10px]">
                              Pack: {p.case_pack || 1}
                            </span>
                            {caseRate && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-indigo-600 font-medium text-[10px]">
                                  ₹{caseRate.toLocaleString("en-IN")} / Case
                                </span>
                              </>
                            )}
                            {p.total_stock !== undefined && (
                              <>
                                <span className="text-slate-300">•</span>
                                {p.total_stock <= 0 ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    <AlertCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    Out of Stock (0)
                                  </span>
                                ) : p.total_stock <= (p.case_pack || 1) ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                    Low Stock: {p.total_stock} pcs (≤1 Cs)
                                  </span>
                                ) : p.total_stock > 15 ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    <PackageCheck className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                    Overstock: {p.total_stock} pcs
                                  </span>
                                ) : p.total_stock > 2 * (p.case_pack || 1) ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    Healthy: {p.total_stock} pcs
                                  </span>
                                ) : (
                                  <span className="text-blue-700 font-medium text-[10px]">
                                    Stock: {p.total_stock} pcs
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductSearchSelect;
