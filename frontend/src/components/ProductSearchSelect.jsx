import React, { useState, useEffect, useRef } from "react";
import { Search, Luggage, X, Check, Tag } from "lucide-react";

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
    return indexMatch || nameMatch || idMatch;
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

  return (
    <div ref={wrapperRef} className="relative w-full">
      {selectedProduct ? (
        /* Selected Product Pill */
        <div className="flex items-center justify-between p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs transition">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Luggage className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {selectedProduct.index_no && (
                  <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-indigo-200/80 text-indigo-900 text-[10px]">
                    INDEX #{selectedProduct.index_no}
                  </span>
                )}
                <span className="font-bold text-slate-900 truncate">
                  {selectedProduct.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                {selectedProduct.selling_rate && (
                  <span className="font-semibold text-emerald-700">
                    ₹{selectedProduct.selling_rate.toLocaleString("en-IN")} / PC
                  </span>
                )}
                {selectedProduct.rate_per_pc && (
                  <span className="text-slate-400">
                    (Base: ₹{selectedProduct.rate_per_pc.toLocaleString("en-IN")})
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition ml-2"
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
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 divide-y divide-slate-100 text-xs">
              <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                <span>Search Results ({filteredProducts.length} items)</span>
                <span>Type Index No. or Name</span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  <p className="font-semibold text-slate-700">No product found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No item matches Index No. "{searchTerm}"
                  </p>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = String(p.id) === String(selectedProductId);
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
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <Luggage className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {p.index_no ? (
                              <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-indigo-100 text-indigo-800">
                                #{p.index_no}
                              </span>
                            ) : null}
                            <span className="font-semibold text-slate-900 truncate">
                              {p.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {p.selling_rate ? (
                              <span className="font-semibold text-emerald-700">
                                CSD Rate: ₹{p.selling_rate.toLocaleString("en-IN")}
                              </span>
                            ) : null}
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
