import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchApi,
  getProducts,
  uploadDamagePhoto,
  createDamageReport,
  getDamageReports,
  API_BASE_URL
} from "../services/api";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ProductSearchSelect from "../components/ProductSearchSelect";
import ImageLightbox from "../components/ImageLightbox";
import { TableSkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import {
  Camera,
  UploadCloud,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Eye,
  FileText,
  Plus,
  Trash2
} from "lucide-react";

const DamagesReport = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Form State
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  // Photo State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState("");

  // Reports History State
  const [myReports, setMyReports] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [lightboxReport, setLightboxReport] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Load products and employee's damage history
  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const loadInitialData = async () => {
      try {
        const [productsData, reportsData] = await Promise.all([
          getProducts(),
          getDamageReports({ employee_id: user.id })
        ]);
        setProducts(productsData);
        setMyReports(reportsData);
      } catch (err) {
        console.error("Failed to load initial data:", err);
        addToast("Failed to load products or reports", "error");
      } finally {
        setLoadingHistory(false);
      }
    };

    loadInitialData();
  }, [user]);

  // Clean up object URL when file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle Photo Selection & Client Validation
  const handleFileSelect = (file) => {
    setFileError("");
    if (!file) return;

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setFileError("Please upload a valid JPG, PNG, or WEBP image.");
      addToast("Please upload a valid JPG, PNG, or WEBP image.", "error");
      return;
    }

    // Max 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileError("Image size must not exceed 10MB.");
      addToast("Image size must not exceed 10MB.", "error");
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setUploadProgress(0);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Submit Damage Report
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      addToast("Please select a damaged product", "error");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      addToast("Please enter a valid quantity in PCS", "error");
      return;
    }
    if (!reason.trim()) {
      addToast("Please describe the damage reason", "error");
      return;
    }

    if (!selectedFile) {
      addToast("Photo proof is strictly mandatory! Employees cannot submit a damage report without uploading a photo.", "error");
      return;
    }

    setSubmitting(true);
    let uploadedPhotos = [];

    try {
      // 1. Upload photo if selected
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(10);

        const photoMeta = await uploadDamagePhoto(selectedFile, (progress) => {
          setUploadProgress(progress);
        });

        uploadedPhotos.push({
          photo_url: photoMeta.photo_url,
          storage_key: photoMeta.storage_key,
          original_filename: photoMeta.original_filename,
          mime_type: photoMeta.mime_type,
          file_size: photoMeta.file_size
        });

        setIsUploading(false);
      }

      // 2. Submit Damage Report payload
      const damagePayload = {
        employee_id: user.id,
        location_id: user.assigned_location_id,
        items: [
          {
            product_id: parseInt(selectedProductId, 10),
            quantity: qty,
            description: reason.trim()
          }
        ],
        photos: uploadedPhotos
      };

      const newReport = await createDamageReport(damagePayload);

      addToast("Damage report submitted successfully!", "success");

      // Reset form
      setSelectedProductId("");
      setQuantity("");
      setReason("");
      handleRemovePhoto();

      // Refresh history
      setMyReports((prev) => [newReport, ...prev]);
    } catch (err) {
      console.error("Submission failed:", err);
      addToast(err.message || "Failed to submit damage report. Please try again.", "error");
    } finally {
      setSubmitting(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenPhoto = (report, photo) => {
    setLightboxReport(report);
    setLightboxPhoto(photo);
    setLightboxOpen(true);
  };

  return (
    <Layout
      title="Report Damaged Stock"
      subtitle="Record damage claims with photographic evidence for warehouse audit"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Damage Form */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  New Incident Claim
                </h2>
                <p className="text-xs text-slate-500">
                  Enter product quantities and attach photo documentation
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                  Damaged Product <span className="text-rose-500">*</span>
                </label>
                <ProductSearchSelect
                  products={products}
                  selectedProductId={selectedProductId}
                  onSelectProduct={(p) => setSelectedProductId(p ? p.id : "")}
                  placeholder="Search by Index No. (e.g. 36812) or item name..."
                  required={true}
                />
              </div>

              {/* Quantity Damaged */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                  Damage Quantity (PCS) <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl">
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter damaged quantity (e.g. 2)"
                    className="block w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                  <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-semibold text-slate-400 pointer-events-none">
                    PCS
                  </span>
                </div>
              </div>

              {/* Reason / Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                  Damage Reason & Observations <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Broken zipper lock upon unboxing, wheel cracked during transport..."
                  className="block w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                />
              </div>

              {/* Photo Evidence Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                    <span>Photo Evidence</span>
                    <span className="text-rose-500 font-bold">* Required</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    JPG, PNG, WEBP (Max 10MB)
                  </span>
                </div>

                {!selectedFile && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Mandatory:</strong> You must attach or capture a clear photo of the damage before you can submit.
                    </span>
                  </div>
                )}

                {fileError && (
                  <p className="text-xs text-rose-600 mb-2 font-medium">
                    {fileError}
                  </p>
                )}

                {/* Hidden File Inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />

                {!selectedFile ? (
                  /* Upload Buttons Container */
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-600 transition group"
                    >
                      <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 mb-1.5 transition-colors" />
                      <span className="text-xs font-medium text-slate-700">
                        Upload Photo
                      </span>
                      <span className="text-[10px] text-slate-400">
                        From gallery / disk
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-600 transition group"
                    >
                      <Camera className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 mb-1.5 transition-colors" />
                      <span className="text-xs font-medium text-slate-700">
                        Take Photo
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Camera capture
                      </span>
                    </button>
                  </div>
                ) : (
                  /* Photo Preview Container */
                  <div className="relative border border-slate-200 rounded-2xl p-4 bg-slate-50/60">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Image Preview Thumbnail */}
                      <div className="relative w-32 h-24 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shrink-0 shadow-sm">
                        <img
                          src={previewUrl}
                          alt="Damage Evidence Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* File Details & Actions */}
                      <div className="flex-1 min-w-0 text-center sm:text-left">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || "image"}
                        </p>

                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Upload Progress Bar */}
                    {isUploading && (
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                          <span>Uploading & Compressing...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-2 transition-all duration-200 rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Submission Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={submitting || !selectedFile}
                  title={!selectedFile ? "You must attach a damage photo before submitting" : ""}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-md flex items-center justify-center gap-2 ${
                    !selectedFile || submitting
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300 shadow-none"
                      : "text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-indigo-950/20"
                  }`}
                >
                  {submitting ? (
                    "Submitting Incident Report..."
                  ) : !selectedFile ? (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Photo Required to Submit</span>
                    </>
                  ) : (
                    "Submit Damage Report"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Employee's Submitted Reports History */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              My Reported Incidents ({myReports.length})
            </h3>
            <span className="text-xs text-slate-500">
              Real database claims
            </span>
          </div>

          {loadingHistory ? (
            <TableSkeleton rows={4} cols={3} />
          ) : myReports.length === 0 ? (
            <EmptyState
              type="damages"
              title="No damage reports recorded"
              description="You have not filed any damaged stock incidents yet."
            />
          ) : (
            <div className="space-y-3">
              {myReports.map((report) => {
                const totalQty = report.items?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
                const itemSummary = report.items?.map((i) => i.product_name).join(", ") || "Luggage Item";
                const reasons = report.items?.map((i) => i.description).filter(Boolean).join("; ");
                const photo = report.photos && report.photos.length > 0 ? report.photos[0] : null;

                return (
                  <div
                    key={report.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {photo ? (
                        <div
                          onClick={() => handleOpenPhoto(report, photo)}
                          className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shrink-0 cursor-pointer group"
                        >
                          <img
                            src={`${API_BASE_URL}${photo.photo_url}`}
                            alt="Damage evidence"
                            className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition flex items-center justify-center text-white">
                            <Eye className="w-4 h-4 opacity-80 group-hover:opacity-100" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0 p-1 text-center">
                          <ImageIcon className="w-5 h-5 mb-0.5 text-slate-400" />
                          <span className="text-[9px] leading-tight">No photo</span>
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            #{report.id} • {itemSummary}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                            {totalQty} PCS
                          </span>
                        </div>
                        {reasons && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-1 italic">
                            "{reasons}"
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {report.report_date ? new Date(report.report_date).toLocaleDateString() : "Today"} • {photo ? "Photo Attached" : "No photo attached."}
                        </p>
                      </div>
                    </div>

                    {photo && (
                      <button
                        type="button"
                        onClick={() => handleOpenPhoto(report, photo)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Evidence</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      <ImageLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photo={lightboxPhoto}
        reportMetadata={lightboxReport}
      />
    </Layout>
  );
};

export default DamagesReport;