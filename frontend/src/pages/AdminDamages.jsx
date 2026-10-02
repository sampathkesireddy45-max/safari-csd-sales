import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getDamageReports,
  getEmployees,
  getLocations,
  deleteDamagePhoto,
  getDamageAuditLogs,
  exportDamagesCsvUrl,
  markDamageReplaced,
  API_BASE_URL
} from "../services/api";
import Layout from "../components/Layout";
import ImageLightbox from "../components/ImageLightbox";
import { TableSkeleton, GallerySkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import {
  AlertOctagon,
  Eye,
  Trash2,
  Filter,
  Download,
  LayoutGrid,
  List,
  Calendar,
  User,
  MapPin,
  Camera,
  CameraOff,
  History,
  X,
  RefreshCw,
  CheckCircle2
} from "lucide-react";

const AdminDamages = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [statusFilter, setStatusFilter] = useState("active"); // "active", "replaced", "all"
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [photoFilter, setPhotoFilter] = useState("all"); // "all", "with_photo", "without_photo"
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // View Mode: 'gallery' or 'table'
  const [viewMode, setViewMode] = useState("gallery");

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState(null);
  const [activeReport, setActiveReport] = useState(null);

  // Audit Logs Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Load Filters & Reports
  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (selectedEmployee) params.employee_id = selectedEmployee;
      if (selectedLocation) params.location_id = selectedLocation;
      if (photoFilter && photoFilter !== "all") params.has_photo = photoFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await getDamageReports(params);
      setReports(data || []);
    } catch (err) {
      console.error("Failed to load damage reports:", err);
      addToast("Failed to load damage records", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReplaced = async (damageReportId) => {
    try {
      const res = await markDamageReplaced(damageReportId);
      addToast(
        res.message || `Damage claim #${damageReportId} marked as replaced and removed from active damages.`,
        "success"
      );
      fetchReports();
    } catch (err) {
      console.error("Failed to mark damage as replaced:", err);
      addToast(err.message || "Failed to mark damage as replaced", "error");
    }
  };

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [empData, locData] = await Promise.all([
          getEmployees(),
          getLocations()
        ]);
        setEmployees(empData);
        setLocations(locData);
      } catch (err) {
        console.error("Failed to load filter metadata:", err);
      }
    };

    loadMetadata();
    fetchReports();
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    fetchReports();
  }, [statusFilter, selectedEmployee, selectedLocation, photoFilter, dateFrom, dateTo]);

  // Open Lightbox
  const handleViewPhoto = (report, photo) => {
    setActiveReport(report);
    setActivePhoto(photo);
    setLightboxOpen(true);
  };

  // Remove Photo (with Audit Trail)
  const handleDeletePhoto = async (reportId, photoId) => {
    if (!window.confirm("Are you sure you want to remove this evidence photo? This action will be permanently recorded in the audit log.")) {
      return;
    }

    try {
      await deleteDamagePhoto(reportId, photoId);
      addToast("Photo removed and recorded in audit log", "success");
      fetchReports();
    } catch (err) {
      console.error("Failed to remove photo:", err);
      addToast(err.message || "Failed to remove photo", "error");
    }
  };

  // Open Audit Log Modal
  const handleOpenAudit = async () => {
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const logs = await getDamageAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      addToast("Failed to load audit trail", "error");
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedEmployee("");
    setSelectedLocation("");
    setPhotoFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Layout
      title="Damaged Stock & Evidence Gallery"
      subtitle="Examine defect incidents, audit high-resolution photo evidence, and export claims"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAudit}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Audit Trail</span>
          </button>

          <a
            href={exportDamagesCsvUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
        </div>
      }
    >
      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 mb-6 space-y-4">
        {/* Status Mode Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                statusFilter === "active"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active Damages
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("replaced")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                statusFilter === "replaced"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Replaced Pieces
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                statusFilter === "all"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Records
            </button>
          </div>

          <span className="text-xs text-slate-400">
            Showing <strong className="text-slate-700">{reports.length}</strong> {statusFilter === "active" ? "active unreplaced" : statusFilter === "replaced" ? "replaced" : "total"} incident claims
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            {/* Employee Filter */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Employee
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo Availability */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Photo Evidence
              </label>
              <select
                value={photoFilter}
                onChange={(e) => setPhotoFilter(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              >
                <option value="all">All Records</option>
                <option value="with_photo">With Photo Only</option>
                <option value="without_photo">Without Photo Only</option>
              </select>
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          {/* View Mode & Reset Controls */}
          <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              Reset Filters
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === "gallery"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Visual Gallery View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === "table"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Data Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Display */}
      {loading ? (
        viewMode === "gallery" ? <GallerySkeleton count={6} /> : <TableSkeleton rows={6} cols={6} />
      ) : reports.length === 0 ? (
        <EmptyState
          type="damages"
          title="No damage reports available"
          description="There are currently no recorded product damages matching the selected criteria in the database."
        />
      ) : viewMode === "gallery" ? (
        /* Visual Photo Gallery UI (Requirement 34) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => {
            const photo = report.photos && report.photos.length > 0 ? report.photos[0] : null;
            const totalQty = report.items?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
            const reasons = report.items?.map((i) => i.description).filter(Boolean).join("; ");
            const productsList = report.items?.map((i) => i.product_name).join(", ");

            return (
              <div
                key={report.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow group"
              >
                {/* Visual Header / Photo Preview */}
                <div className="relative h-48 bg-slate-900 overflow-hidden flex items-center justify-center">
                  {photo ? (
                    <>
                      <img
                        src={`${API_BASE_URL}${photo.photo_url}`}
                        alt={`Evidence for damage #${report.id}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                        <button
                          type="button"
                          onClick={() => handleViewPhoto(report, photo)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-900 text-xs font-semibold backdrop-blur shadow transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>View Large Photo</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                      <CameraOff className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-xs font-medium text-slate-400">
                        No photo attached.
                      </span>
                    </div>
                  )}

                  {/* Quantity Badge */}
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-md">
                    {totalQty} PCS
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 line-clamp-1">
                        {productsList || "Luggage Claim"}
                      </span>
                      {reasons && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 italic">
                          "{reasons}"
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">
                          {report.employee_name} ({report.employee_code || "Staff"})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">
                          {report.location_name || "Unassigned"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {report.report_date ? new Date(report.report_date).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {report.status === "replaced" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Replaced</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkReplaced(report.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 shadow-sm transition"
                          title="Mark this item as replaced and remove it from active damages"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Replaced</span>
                        </button>
                      )}
                    </div>

                    {photo && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">#{photo.id}</span>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(report.id, photo.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                          title="Delete photo and record audit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Data Table View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Incident #</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Location</th>
                  <th className="px-6 py-4 font-semibold">Quantity</th>
                  <th className="px-6 py-4 font-semibold">Reason / Description</th>
                  <th className="px-6 py-4 font-semibold">Evidence Photo</th>
                  <th className="px-6 py-4 font-semibold text-right">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => {
                  const photo = report.photos && report.photos.length > 0 ? report.photos[0] : null;
                  const totalQty = report.items?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
                  const reasons = report.items?.map((i) => i.description).filter(Boolean).join("; ");

                  return (
                    <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        #{report.id}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {report.report_date ? new Date(report.report_date).toLocaleDateString() : ""}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                        {report.employee_name}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                        {report.location_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                          {totalQty} PCS
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                        {reasons || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {photo ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewPhoto(report, photo)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Photo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(report.id, photo.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                              title="Delete photo (audited)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            No photo attached.
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {report.status === "replaced" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Replaced</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkReplaced(report.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 shadow-sm transition"
                            title="Mark this item as replaced and remove it from active damages"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Replaced</span>
                          </button>
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

      {/* Lightbox Modal */}
      <ImageLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photo={activePhoto}
        reportMetadata={activeReport}
      />

      {/* Audit Log Modal (Requirement 12) */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Damage Photo Audit Trail
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingAudit ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading audit history...</div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">
                  No audit log entries recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-900">
                          {log.user_name}
                        </span>
                        <span className="text-slate-500 ml-1">
                          {log.action} photo for damage #{log.damage_report_id}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminDamages;
