import React from "react";

export const CardSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 animate-pulse">
    <div className="h-4 bg-slate-200 rounded-md w-1/3 mb-3"></div>
    <div className="h-8 bg-slate-200 rounded-lg w-1/2 mb-2"></div>
    <div className="h-3 bg-slate-100 rounded w-2/3"></div>
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
      <div className="h-5 bg-slate-200 rounded w-48 animate-pulse"></div>
      <div className="h-8 bg-slate-200 rounded-lg w-32 animate-pulse"></div>
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="px-6 py-4 flex items-center gap-4 animate-pulse">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div
              key={cIdx}
              className={`h-4 bg-slate-200 rounded ${
                cIdx === 0 ? "w-24" : cIdx === 1 ? "w-36" : "flex-1"
              }`}
            ></div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const GallerySkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm animate-pulse">
        <div className="h-48 bg-slate-200 w-full"></div>
        <div className="p-4 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-3 bg-slate-100 rounded w-1/2"></div>
          <div className="h-3 bg-slate-100 rounded w-2/3"></div>
        </div>
      </div>
    ))}
  </div>
);

export default { CardSkeleton, TableSkeleton, GallerySkeleton };
