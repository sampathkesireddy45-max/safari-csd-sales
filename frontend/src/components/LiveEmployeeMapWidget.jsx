import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { getLiveLocations, getLocations, updateLiveLocation } from "../services/api";
import { useToast } from "./Toast";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Users,
  Navigation,
  RefreshCw,
  Building2,
  Radio,
  ExternalLink,
  ShieldCheck,
  Compass,
  LocateFixed
} from "lucide-react";

// Fix default Leaflet icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // km
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

const LiveEmployeeMapWidget = () => {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingGps, setSyncingGps] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const markerMapRef = useRef({});

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [liveEmps, storeList] = await Promise.all([
        getLiveLocations(),
        getLocations(),
      ]);
      setEmployees(liveEmps || []);
      setStores(storeList || []);
      if (isManual) addToast("Live employee telemetry refreshed", "success");
    } catch (err) {
      console.error("Failed to fetch live employee telemetry:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Sync real device location for the Admin
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
          fetchData();
        } catch (err) {
          if (!isSilent) addToast("Failed to update admin GPS location on server", "error");
        } finally {
          setSyncingGps(false);
        }
      },
      (err) => {
        setSyncingGps(false);
        if (!isSilent) {
          addToast(`Could not acquire GPS: ${err.message}. Please allow location access in browser.`, "error");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  useEffect(() => {
    fetchData();
    // Silently attempt to broadcast admin's real GPS if browser permission exists
    handleSyncMyLocation(true);

    // Auto-refresh every 25 seconds
    const interval = setInterval(() => {
      fetchData(false);
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default to Visakhapatnam / active store coordinates
    const defaultLat = 17.688009;
    const defaultLng = 83.262097;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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

  // Update Markers
  useEffect(() => {
    if (loading || !mapInstanceRef.current || !markersGroupRef.current) return;

    const group = markersGroupRef.current;
    group.clearLayers();
    markerMapRef.current = {};
    const bounds = [];

    // Store markers
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
          <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
            <div style="font-weight: 700; color: #1e1b4b; font-size: 14px;">🏢 ${store.name}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px;">Store Code: <strong>${store.location_id}</strong></div>
            <div style="color: #334155; margin-top: 4px;">${store.address || "Address registered"}</div>
            <div style="color: #4f46e5; font-size: 10px; font-family: monospace; margin-top: 4px;">Lat: ${store.latitude}, Lon: ${store.longitude}</div>
          </div>
        `);
        group.addLayer(marker);
        bounds.push([store.latitude, store.longitude]);
      }
    });

    // Employee & Admin markers
    employees.forEach((emp) => {
      if (emp.current_latitude && emp.current_longitude) {
        const isOnline = emp.is_online;
        const isAdmin = emp.role === "admin";
        
        let bgColor = "#10b981"; // Green online
        if (isAdmin) {
          bgColor = isOnline ? "#8b5cf6" : "#6366f1"; // Purple for Admin
        } else if (!isOnline) {
          bgColor = "#64748b"; // Slate for offline
        }

        const ring = isOnline
          ? `<span style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: ${isAdmin ? "#8b5cf6" : "#10b981"}; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
          : "";

        const empIcon = L.divIcon({
          className: "custom-emp-pin",
          html: `
            <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
              ${ring}
              <div style="position: relative; background-color: ${bgColor}; color: white; width: 30px; height: 30px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                ${isAdmin ? "ADM" : emp.name.charAt(0).toUpperCase()}
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([emp.current_latitude, emp.current_longitude], { icon: empIcon });

        let storeDistText = "Store unassigned";
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
          <div style="font-family: sans-serif; font-size: 12px; padding: 2px;">
            <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${isAdmin ? "👑 " : "👤 "}${emp.name}</div>
            <div style="color: #64748b; font-size: 11px;">User ID: <strong>${emp.employee_id}</strong> • <span style="text-transform: uppercase; font-weight: 600; color: ${isAdmin ? '#7c3aed' : '#2563eb'}">${emp.role}</span></div>
            <div style="margin-top: 4px; padding: 3px 6px; border-radius: 5px; background-color: ${isOnline ? "#ecfdf5" : "#f1f5f9"}; color: ${isOnline ? "#065f46" : "#475569"}; font-weight: 600; font-size: 11px;">
              ● ${isOnline ? "Online Right Now" : `Last seen ${emp.minutes_ago ? `${emp.minutes_ago}m ago` : "recently"}`}
            </div>
            <div style="margin-top: 4px; color: #334155;">
              <strong>Store / Base:</strong> ${emp.assigned_location ? emp.assigned_location.name : "Operations HQ"}
            </div>
            <div style="margin-top: 2px;">${storeDistText}</div>
            <div style="margin-top: 4px; font-family: monospace; color: #64748b; font-size: 10px;">
              GPS: ${emp.current_latitude.toFixed(5)}, ${emp.current_longitude.toFixed(5)}
            </div>
          </div>
        `);

        group.addLayer(marker);
        markerMapRef.current[emp.id] = marker;
        bounds.push([emp.current_latitude, emp.current_longitude]);
      }
    });

    if (bounds.length === 1) {
      mapInstanceRef.current.setView(bounds[0], 13);
    } else if (bounds.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
  }, [employees, stores, loading]);

  const handleFocusEmployee = (emp) => {
    if (!emp.current_latitude || !emp.current_longitude || !mapInstanceRef.current) {
      addToast(`No live coordinates recorded for ${emp.name}`, "error");
      return;
    }
    mapInstanceRef.current.setView([emp.current_latitude, emp.current_longitude], 15, {
      animate: true,
      duration: 0.8,
    });
    const marker = markerMapRef.current[emp.id];
    if (marker) {
      marker.openPopup();
    }
  };

  const onlineCount = employees.filter((e) => e.is_online).length;
  const withGpsCount = employees.filter((e) => e.current_latitude && e.current_longitude).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Widget Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Live Employee Fleet Map & Field Attendance
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                <span>{onlineCount} Online</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time GPS coordinates of staff in field or assigned retail canteen outlets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleSyncMyLocation(false)}
            disabled={syncingGps}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition disabled:opacity-50"
            title="Update admin location with your current browser GPS coordinates"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${syncingGps ? "animate-spin text-indigo-600" : "text-indigo-600"}`} />
            <span>{syncingGps ? "Detecting GPS..." : "Sync My Real Location"}</span>
          </button>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
            title="Refresh GPS positions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <Link
            to="/admin/live-locations"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
          >
            <span>Full Map & Geofence</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Main Grid: Map on Left, Active Roster on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Map View */}
        <div className="lg:col-span-2 relative min-h-[380px] bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-100">
          <div
            ref={mapContainerRef}
            className="w-full h-[380px] z-10"
            style={{ minHeight: "380px" }}
          />

          {/* Quick Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200 shadow-md text-[11px] text-slate-600 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="font-medium">Online Staff</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span>
              <span className="font-medium">Admin HQ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-indigo-600 inline-block"></span>
              <span className="font-medium">Store Outlet</span>
            </div>
          </div>
        </div>

        {/* Staff Roster Sidebar */}
        <div className="p-4 flex flex-col h-[380px] overflow-y-auto divide-y divide-slate-100">
          <div className="pb-2.5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Staff Attendance ({employees.length})
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {withGpsCount} Geotagged
            </span>
          </div>

          {employees.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No staff registered yet.
            </div>
          ) : (
            employees.map((emp) => {
              const hasGps = emp.current_latitude && emp.current_longitude;
              const isOnline = emp.is_online;
              const isAdmin = emp.role === "admin";

              return (
                <div
                  key={emp.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                        isAdmin ? "bg-purple-600" : isOnline ? "bg-emerald-600" : "bg-slate-400"
                      }`}>
                        {isAdmin ? "A" : emp.name.charAt(0).toUpperCase()}
                      </div>
                      {isOnline && (
                        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 ${
                          isAdmin ? "bg-purple-500 ring-purple-300" : "bg-emerald-500 ring-emerald-300"
                        }`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {emp.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                          {emp.employee_id}
                        </span>
                        {isAdmin && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-bold uppercase">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {emp.assigned_location ? emp.assigned_location.name : (isAdmin ? "HQ" : "No store assigned")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasGps ? (
                      <button
                        type="button"
                        onClick={() => handleFocusEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                        title="Locate on map"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Locate</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        No GPS
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveEmployeeMapWidget;
