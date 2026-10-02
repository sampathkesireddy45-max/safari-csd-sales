import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import { getLocations, createLocation, updateLocation, deleteLocation, getEmployees, searchRealLocations } from "../services/api";
import { TableSkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Navigation,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  Search,
  Loader2
} from "lucide-react";

const AdminLocations = () => {
  const { addToast } = useToast();
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locatingCurrent, setLocatingCurrent] = useState(false);

  // Real Place Search State
  const [realSuggestions, setRealSuggestions] = useState([]);
  const [searchingReal, setSearchingReal] = useState(false);
  const [showRealDropdown, setShowRealDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);

  const [formData, setFormData] = useState({
    location_id: "",
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    is_active: true,
  });

  const loadData = async () => {
    try {
      const [locsData, empsData] = await Promise.all([
        getLocations(),
        getEmployees(),
      ]);
      setLocations(locsData);
      setEmployees(empsData);
    } catch (err) {
      console.error("Failed to load locations:", err);
      addToast("Failed to load store locations", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({
      location_id: `LOC${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      address: "",
      latitude: "",
      longitude: "",
      is_active: true,
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (loc) => {
    setEditingLocation(loc);
    setFormData({
      location_id: loc.location_id,
      name: loc.name,
      address: loc.address || "",
      latitude: loc.latitude !== null && loc.latitude !== undefined ? loc.latitude : "",
      longitude: loc.longitude !== null && loc.longitude !== undefined ? loc.longitude : "",
      is_active: loc.is_active ?? true,
    });
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingLocation(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNameSearchChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, name: val }));

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!val || val.trim().length < 2) {
      setRealSuggestions([]);
      setShowRealDropdown(false);
      return;
    }

    setSearchingReal(true);
    setShowRealDropdown(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const places = await searchRealLocations(val);
        setRealSuggestions(places);
      } catch (err) {
        console.error("Place search error:", err);
      } finally {
        setSearchingReal(false);
      }
    }, 350);
  };

  const handleSelectRealPlace = (place) => {
    setFormData((prev) => ({
      ...prev,
      name: place.name,
      address: place.address || place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    }));
    setShowRealDropdown(false);
    addToast(`Real-world location verified: ${place.name}`, "success");
  };

  const handleGetCoordinates = () => {
    if (!navigator.geolocation) {
      addToast("Geolocation is not supported by your browser", "error");
      return;
    }
    setLocatingCurrent(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        setLocatingCurrent(false);
        addToast("Location coordinates captured from GPS!", "success");
      },
      (err) => {
        setLocatingCurrent(false);
        addToast("Failed to acquire GPS position: " + err.message, "error");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast("Please provide a store name", "error");
      return;
    }
    if (!formData.location_id.trim()) {
      addToast("Please provide a store ID/code", "error");
      return;
    }

    try {
      const payload = {
        location_id: formData.location_id.trim().toUpperCase(),
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        latitude: formData.latitude !== "" ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude !== "" ? parseFloat(formData.longitude) : null,
        is_active: formData.is_active,
      };

      // Ensure the location is real
      if (payload.latitude === null || payload.longitude === null) {
        const queryToVerify = payload.name + (payload.address ? " " + payload.address : "");
        const realMatches = await searchRealLocations(queryToVerify);
        if (realMatches && realMatches.length > 0) {
          payload.latitude = realMatches[0].latitude;
          payload.longitude = realMatches[0].longitude;
          if (!payload.address) payload.address = realMatches[0].address;
          addToast("Real geographic coordinates resolved for " + realMatches[0].name, "success");
        } else {
          addToast("Location must be a real geographic place. Please enter a valid place name or address from the map.", "error");
          return;
        }
      }

      if (showAddModal) {
        await createLocation(payload);
        addToast("Store location added successfully!", "success");
      } else if (showEditModal && editingLocation) {
        await updateLocation(editingLocation.id, payload);
        addToast("Store location updated successfully!", "success");
      }

      handleCloseModal();
      loadData();
    } catch (err) {
      console.error("Failed to save location:", err);
      addToast(err.message || "Failed to save location", "error");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove store location "${name}"?`)) {
      return;
    }
    try {
      await deleteLocation(id);
      addToast("Store location deleted successfully", "success");
      loadData();
    } catch (err) {
      console.error("Failed to delete location:", err);
      addToast(err.message || "Failed to delete store location", "error");
    }
  };

  return (
    <Layout
      title="Store & Retail Locations"
      subtitle="Configure physical store outlets, GPS dispatch hubs, and geographic boundaries"
      action={
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Store Location</span>
        </button>
      }
    >
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : locations.length === 0 ? (
        <EmptyState
          type="locations"
          title="No store locations found"
          description="You have not created any retail or warehouse store locations yet."
          actionLabel="Add Store Location"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Outlets</span>
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {locations.length}
                </span>
                <span className="text-xs text-slate-400 ml-2">stores mapped</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>GPS Geotagged</span>
                <Navigation className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {locations.filter((l) => l.latitude && l.longitude).length}
                </span>
                <span className="text-xs text-slate-400 ml-2">ready for live tracking</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Assigned Staff</span>
                <Users className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {employees.filter((e) => e.assigned_location_id).length}
                </span>
                <span className="text-xs text-slate-400 ml-2">allocated staff</span>
              </div>
            </div>
          </div>

          {/* Locations Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Store / Node</th>
                    <th className="px-6 py-4 font-semibold">Store Code</th>
                    <th className="px-6 py-4 font-semibold">Address / Territory</th>
                    <th className="px-6 py-4 font-semibold">GPS Coordinates</th>
                    <th className="px-6 py-4 font-semibold">Staff Count</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {locations.map((loc) => {
                    const staffCount = employees.filter((e) => e.assigned_location_id === loc.id).length;
                    const hasGPS = loc.latitude !== null && loc.longitude !== null && loc.latitude !== undefined && loc.longitude !== undefined;

                    return (
                      <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="block font-semibold text-slate-900">
                                {loc.name}
                              </span>
                              <span className="block text-xs text-slate-400">
                                DB ID #{loc.id}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-700">
                          {loc.location_id}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                          {loc.address || <span className="text-slate-400 italic">No address specified</span>}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {hasGPS ? (
                            <div className="flex items-center gap-1.5 font-mono text-emerald-700">
                              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
                              <a
                                href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 p-1 hover:text-indigo-600"
                                title="Open in Maps"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Not geotagged</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                            <Users className="w-3 h-3 text-slate-500" />
                            {staffCount} staff
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                              loc.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {loc.is_active ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                Inactive
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(loc)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Edit Location"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(loc.id, loc.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Location"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Location Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <span>{showAddModal ? "Add New Store Location" : "Edit Store Location"}</span>
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Store Code / Location ID *
                </label>
                <input
                  type="text"
                  required
                  name="location_id"
                  value={formData.location_id}
                  onChange={handleChange}
                  placeholder="e.g. LOC002 or STORE-HYD"
                  className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
                />
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    Store Name / Real Place *
                  </label>
                  <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>Real-world Map Verified</span>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleNameSearchChange}
                    onFocus={() => {
                      if (formData.name && formData.name.trim().length >= 2) setShowRealDropdown(true);
                    }}
                    placeholder="Type real store, mall, landmark, or street..."
                    className="w-full text-xs pl-8 pr-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    {searchingReal ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {/* Dropdown Suggestions */}
                {showRealDropdown && realSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                    {realSuggestions.map((place, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectRealPlace(place)}
                        className="w-full text-left p-2.5 hover:bg-indigo-50 transition flex items-start gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{place.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{place.address}</p>
                          <span className="text-[9px] font-mono text-emerald-600">
                            GPS: {place.latitude?.toFixed(4)}, {place.longitude?.toFixed(4)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Physical Address
                </label>
                <textarea
                  name="address"
                  rows={2}
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="e.g. Ground Floor, Terminal 3, Shamshabad International Airport"
                  className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Coordinates Section */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                    GPS Coordinates (Map Pinning)
                  </span>
                  <button
                    type="button"
                    onClick={handleGetCoordinates}
                    disabled={locatingCurrent}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-1"
                  >
                    {locatingCurrent ? "Locating..." : "Use Current GPS"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      placeholder="e.g. 17.2403"
                      className="w-full text-xs px-2.5 py-1.5 border rounded-lg border-slate-300 focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      placeholder="e.g. 78.4294"
                      className="w-full text-xs px-2.5 py-1.5 border rounded-lg border-slate-300 focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Used by the Live Location map to track employee proximity and geofencing.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="is_active" className="text-xs font-semibold text-slate-700">
                  Outlet is Active for Staff Assignment & Sales
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                >
                  {showAddModal ? "Create Store Location" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminLocations;
