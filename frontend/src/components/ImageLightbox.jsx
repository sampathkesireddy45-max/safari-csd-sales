import React, { useState, useEffect, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Calendar, User, MapPin, AlertTriangle, FileText } from "lucide-react";
import { getDamagePhotoUrl, getDamagePhotoDownloadUrl } from "../services/api";

const ImageLightbox = ({ isOpen, onClose, photo, reportMetadata }) => {
  const [zoomLevel, setZoomLevel] = useState(1);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset zoom on open
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
    }
  }, [isOpen, photo]);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.3, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  if (!isOpen || !photo) return null;

  const storageKey = photo.storage_key || photo.photo_url?.split("/").pop();
  const imageUrl = getDamagePhotoUrl(storageKey);
  const downloadUrl = getDamagePhotoDownloadUrl(storageKey);

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Damage Photo Viewer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Lightbox Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="text-white font-semibold text-base sm:text-lg">
              Damage Evidence Photo #{photo.id || ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded transition-colors disabled:opacity-30"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-1 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                title="Reset Zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded transition-colors disabled:opacity-30"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Download Button */}
            <a
              href={downloadUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              title="Download photo"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Download</span>
            </a>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
              title="Close (Esc)"
              aria-label="Close image viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lightbox Body: Image Canvas & Metadata Sidebar */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-black/40">
          {/* Main Image Area */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto select-none relative">
            <div 
              className="transition-transform duration-150 ease-out"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={imageUrl}
                alt={`Damage evidence report #${reportMetadata?.id || photo.id}`}
                className="max-h-[65vh] max-w-full object-contain rounded shadow-lg border border-slate-800/80"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' fill='%2394a3b8' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14'%3EImage could not be loaded%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
          </div>

          {/* Metadata Sidebar */}
          {reportMetadata && (
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-900/95 p-5 overflow-y-auto space-y-4">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400 border-b border-slate-800 pb-2">
                Report Metadata
              </h4>

              <div className="space-y-3 text-sm">
                {reportMetadata.employee_name && (
                  <div className="flex items-start gap-2.5">
                    <User className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs text-slate-400">Reporter</span>
                      <span className="text-slate-200 font-medium">
                        {reportMetadata.employee_name}
                      </span>
                      {reportMetadata.employee_code && (
                        <span className="text-xs text-slate-500 ml-1">({reportMetadata.employee_code})</span>
                      )}
                    </div>
                  </div>
                )}

                {reportMetadata.location_name && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs text-slate-400">Location</span>
                      <span className="text-slate-200 font-medium">
                        {reportMetadata.location_name}
                      </span>
                    </div>
                  </div>
                )}

                {reportMetadata.report_date && (
                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs text-slate-400">Date Reported</span>
                      <span className="text-slate-200">
                        {new Date(reportMetadata.report_date).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {reportMetadata.items && reportMetadata.items.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="block text-xs text-slate-400">Damaged Items</span>
                      <div className="mt-1 space-y-1">
                        {reportMetadata.items.map((item, idx) => (
                          <div key={idx} className="bg-slate-800/80 p-2 rounded text-xs border border-slate-700/50">
                            <div className="font-semibold text-slate-200 flex justify-between">
                              <span>{item.product_name || `Product #${item.product_id}`}</span>
                              <span className="text-amber-400">{item.quantity} PCS</span>
                            </div>
                            {item.description && (
                              <p className="text-slate-400 mt-0.5 text-[11px] italic">
                                "{item.description}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {photo.file_size && (
                  <div className="flex items-start gap-2.5 pt-2 border-t border-slate-800/60">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs text-slate-400">File Details</span>
                      <span className="text-xs text-slate-300 font-mono">
                        {formatSize(photo.file_size)} • {photo.mime_type || "image/jpeg"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageLightbox;
