import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import { getLiveLocations, getLocations, updateLiveLocation } from "../services/api";
import { TableSkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Users,
  Navigation,
  RefreshCw,
  Building2,
  Activity,
  CheckCircle2,
  Clock,
  Radio,
  Eye,
  ExternalLink,
  ShieldAlert,
  LocateFixed
} from "lucide-react";

// Fix default Leaflet icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Haversine formula to compute distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const AdminLiveTracking = () => {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterMode, setFilterMode] = useState("all"); // 'all', 'online', 'with_gps'
  const [syncingGps, setSyncingGps] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const employeeMarkerMapRef = useRef({});

  const handleSyncMyLocation = (isSilent = false) => {
    if (!navigator.geolocation) {
      if (!isSilent) addToast("Geolocation is not supported by your browser", "error");
      return;
    }
    setSyncingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        try {
          await updateLiveLocation({ latitude: lat, longitude: lon });
          if (!isSilent) addToast(`Admin location updated to real GPS: (${lat}, ${lon})`, "success");
          fetchData(false);
        } catch (err) {
          if (!isSilent) addToast("Failed to update admin GPS location", "error");
        } finally {
          setSyncingGps(false);
        }
      },
      (err) => {
        setSyncingGps(false);
        if (!isSilent) addToast(`GPS access error: ${err.message}. Please allow location permission.`, "error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [liveEmps, storeList] = await Promise.all([
        getLiveLocations(),
        getLocations(),
      ]);
      setEmployees(liveEmps);
      setStores(storeList);
      if (isManual) addToast("Live employee coordinates refreshed", "success");
    } catch (err) {
      console.error("Failed to fetch live locations:", err);
      if (isManual) addToast("Failed to refresh live locations", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    handleSyncMyLocation(true);
  }, []);

  // Periodic Auto-refresh every 20 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Initialize Leaflet Map once loading finishes and container is mounted
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const defaultLat = 17.688009; // Default to active store region (Visakhapatnam)
    const defaultLng = 83.262097;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersGroupRef.current = L.featureGroup().addTo(map);
    mapInstanceRef.current = map;

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading]);

  // Update map markers whenever employees or stores data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    const group = markersGroupRef.current;
    group.clearLayers();
    employeeMarkerMapRef.current = {};

    const bounds = [];

    // 1. Add Store Markers
    stores.forEach((store) => {
      if (store.latitude && store.longitude) {
        const storeIcon = L.divIcon({
          className: "custom-store-pin",
          html: `
            <div style="background-color: #4f46e5; color: white; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.4); border: 2px solid white;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([store.latitude, store.longitude], { icon: storeIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px;">
            <div style="font-weight: 700; color: #1e1b4b; font-size: 14px;">🏢 ${store.name}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px;">Code: <strong>${store.location_id}</strong></div>
            <div style="color: #334155; margin-top: 4px;">${store.address || "No address entered"}</div>
            <div style="color: #4f46e5; font-size: 11px; margin-top: 6px; font-family: monospace;">GPS: ${store.latitude}, ${store.longitude}</div>
          </div>
        `);
        group.addLayer(marker);
        bounds.push([store.latitude, store.longitude]);
      }
    });

    // 2. Add Employee & Admin Markers
    employees.forEach((emp) => {
      if (emp.current_latitude && emp.current_longitude) {
        const isOnline = emp.is_online;
        const isAdmin = emp.role === "admin";

        let color = isOnline ? "#10b981" : "#64748b"; // Green online, Slate offline
        if (isAdmin) {
          color = isOnline ? "#8b5cf6" : "#6366f1"; // Purple for Admin
        }

        const ring = isOnline
          ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: ${isAdmin ? "#8b5cf6" : "#10b981"}; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
          : "";

        const empIcon = L.divIcon({
          className: "custom-emp-pin",
          html: `
            <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
              ${ring}
              <div style="position: relative; background-color: ${color}; color: white; width: 30px; height: 30px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                ${isAdmin ? "ADM" : emp.name.charAt(0).toUpperCase()}
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([emp.current_latitude, emp.current_longitude], { icon: empIcon });
        
        let storeDistText = "No assigned store coordinates";
        if (emp.assigned_location && emp.assigned_location.latitude && emp.assigned_location.longitude) {
          const distKm = calculateDistance(
            emp.current_latitude,
            emp.current_longitude,
            emp.assigned_location.latitude,
            emp.assigned_location.longitude
          );
          if (distKm !== null) {
            storeDistText = distKm < 0.08
              ? `<span style="color: #10b981; font-weight: 600;">✓ Inside Store (${Math.round(distKm * 1000)}m)</span>`
              : `<span style="color: #f59e0b; font-weight: 600;">${distKm.toFixed(2)} km from ${emp.assigned_location.name}</span>`;
          }
        }

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <div style="font-weight: 700; color: #0f172a; font-size: 14px;">${isAdmin ? "👑 " : "👤 "}${emp.name}</div>
            <div style="color: #64748b; font-size: 11px;">ID: <strong>${emp.employee_id}</strong> • <span style="text-transform: uppercase; font-weight: 600; color: ${isAdmin ? '#7c3aed' : '#2563eb'}">${emp.role}</span></div>
            <div style="margin-top: 6px; padding: 4px 8px; border-radius: 6px; background-color: ${isOnline ? "#ecfdf5" : "#f1f5f9"}; color: ${isOnline ? "#065f46" : "#475569"}; font-weight: 600;">
              ● ${isOnline ? "Online Right Now" : `Last seen ${emp.minutes_ago ? `${emp.minutes_ago} mins ago` : "recently"}`}
            </div>
            <div style="margin-top: 6px; color: #334155;">
              <strong>Store / Base:</strong> ${emp.assigned_location ? emp.assigned_location.name : (isAdmin ? "HQ" : "Unassigned")}
            </div>
            <div style="margin-top: 4px;">${storeDistText}</div>
            <div style="margin-top: 6px; font-family: monospace; color: #64748b; font-size: 10px;">
              Lat: ${emp.current_latitude.toFixed(5)}, Lon: ${emp.current_longitude.toFixed(5)}
            </div>
          </div>
        `);

        group.addLayer(marker);
        employeeMarkerMapRef.current[emp.id] = marker;
        bounds.push([emp.current_latitude, emp.current_longitude]);
      }
    });

    // Fit map bounds if markers exist
    if (bounds.length === 1) {
      mapInstanceRef.current.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
  }, [employees, stores, loading]);

  const handleFocusEmployee = (emp) => {
    if (!emp.current_latitude || !emp.current_longitude || !mapInstanceRef.current) {
      addToast(`No live coordinates recorded for ${emp.name} yet.`, "error");
      return;
    }
    mapInstanceRef.current.setView([emp.current_latitude, emp.current_longitude], 16, {
      animate: true,
      duration: 1,
    });
    const marker = employeeMarkerMapRef.current[emp.id];
    if (marker) {
      marker.openPopup();
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (filterMode === "online") return emp.is_online;
    if (filterMode === "with_gps") return emp.current_latitude && emp.current_longitude;
    return true;
  });

  const onlineCount = employees.filter((e) => e.is_online).length;
  const withGpsCount = employees.filter((e) => e.current_latitude && e.current_longitude).length;

  return (
    <Layout
      title="Live Employee Telemetry & Geolocation"
      subtitle="Real-time GPS tracking of field staff, store attendance geofencing, and active workforce map"
      action={
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => handleSyncMyLocation(false)}
            disabled={syncingGps}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition disabled:opacity-50"
            title="Update admin coordinates with your current device GPS"
          >
            <LocateFixed className={`w-4 h-4 ${syncingGps ? "animate-spin text-indigo-600" : "text-indigo-600"}`} />
            <span>{syncingGps ? "Detecting GPS..." : "Sync My Real Location"}</span>
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 text-indigo-600 rounded"
            />
            <span>Auto-refresh (20s)</span>
          </label>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Updating..." : "Refresh Live GPS"}</span>
          </button>
        </div>
      }
    >
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Staff</span>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {employees.length}
                </span>
                <span className="text-xs text-slate-400 ml-2">rostered</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
                <span>Online Right Now</span>
                <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-emerald-600 font-mono">
                  {onlineCount}
                </span>
                <span className="text-xs text-emerald-600/70 ml-2">active in field/store</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Geotagged Employees</span>
                <Navigation className="w-4 h-4 text-sky-600" />
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {withGpsCount}
                </span>
                <span className="text-xs text-slate-400 ml-2">with GPS telemetry</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Stores Mapped</span>
                <Building2 className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-slate-900 font-mono">
                  {stores.filter((s) => s.latitude && s.longitude).length}
                </span>
                <span className="text-xs text-slate-400 ml-2">geofenced locations</span>
              </div>
            </div>
          </div>

          {/* Interactive Map Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Fleet Live Geolocation Map
                  </h3>
                  <p className="text-xs text-slate-500">
                    Blue squares = Store Outlets • Green circles = Live Staff • Gray circles = Last known location
                  </p>
                </div>
              </div>

              {/* Map Filter Controls */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    filterMode === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  All Staff ({employees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("online")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    filterMode === "online" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Online Only ({onlineCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("with_gps")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    filterMode === "with_gps" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  With GPS ({withGpsCount})
                </button>
              </div>
            </div>

            {/* Map Container */}
            <div
              ref={mapContainerRef}
              className="w-full h-[450px] rounded-xl border border-slate-200 z-10"
              style={{ minHeight: "450px" }}
            />
          </div>

          {/* Employee Tracking Status Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                Staff GPS Status & Proximity Roster
              </h4>
              <span className="text-xs text-slate-400">
                Showing {filteredEmployees.length} employee records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Staff Member</th>
                    <th className="px-6 py-4 font-semibold">Employee ID</th>
                    <th className="px-6 py-4 font-semibold">Assigned Store</th>
                    <th className="px-6 py-4 font-semibold">Live GPS Coordinates</th>
                    <th className="px-6 py-4 font-semibold">Distance to Store</th>
                    <th className="px-6 py-4 font-semibold">Status / Last Ping</th>
                    <th className="px-6 py-4 font-semibold text-right">Locate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const hasGPS = emp.current_latitude && emp.current_longitude;
                    let distText = "—";
                    let isNearby = false;

                    if (hasGPS && emp.assigned_location && emp.assigned_location.latitude && emp.assigned_location.longitude) {
                      const distKm = calculateDistance(
                        emp.current_latitude,
                        emp.current_longitude,
                        emp.assigned_location.latitude,
                        emp.assigned_location.longitude
                      );
                      if (distKm !== null) {
                        isNearby = distKm < 0.08;
                        distText = isNearby
                          ? `At Store (${Math.round(distKm * 1000)}m)`
                          : `${distKm.toFixed(2)} km`;
                      }
                    }

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                {emp.name.charAt(0)}
                              </div>
                              {emp.is_online && (
                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                              )}
                            </div>
                            <div>
                              <span className="block font-semibold text-slate-900">
                                {emp.name}
                              </span>
                              <span className="block text-xs text-slate-400">
                                {emp.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-700">
                          {emp.employee_id}
                        </td>

                        <td className="px-6 py-4 text-xs">
                          {emp.assigned_location ? (
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{emp.assigned_location.name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs">
                          {hasGPS ? (
                            <div className="font-mono text-slate-700 flex items-center gap-1.5">
                              <Navigation className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>
                                {emp.current_latitude.toFixed(4)}, {emp.current_longitude.toFixed(4)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              No coordinates reported
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full font-medium ${
                              isNearby
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : hasGPS
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "text-slate-400"
                            }`}
                          >
                            {distText}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                                emp.is_online
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  emp.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                                }`}
                              />
                              {emp.is_online ? "Online" : "Offline"}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {emp.location_updated_at ? (
                                emp.minutes_ago === 0
                                  ? "Pinged just now"
                                  : `Pinged ${emp.minutes_ago}m ago`
                              ) : (
                                "No pings yet"
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleFocusEmployee(emp)}
                            disabled={!hasGPS}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              hasGPS
                                ? "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200"
                                : "text-slate-300 cursor-not-allowed border border-slate-200"
                            }`}
                            title={hasGPS ? "Center on map" : "No GPS data"}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Locate</span>
                          </button>
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
    </Layout>
  );
};

export default AdminLiveTracking;
