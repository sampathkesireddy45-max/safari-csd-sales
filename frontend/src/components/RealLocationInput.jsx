import React, { useState, useEffect, useRef } from "react";
import { searchRealLocations, resolveRealLocation } from "../services/api";
import {
  MapPin,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Navigation,
  Loader2,
  X,
  ExternalLink
} from "lucide-react";

/**
 * RealLocationInput:
 * Replaces static dropdowns with a real-time, real-world verified location search.
 * Ensures the location is a verified real geographic place with authentic GPS coordinates.
 */
const RealLocationInput = ({
  value, // currently selected location object or id
  existingLocations = [], // existing store locations registered in DB
  onLocationSelected, // callback({ location_id, id, name, address, latitude, longitude })
  label = "Assigned Retail Store Location",
  required = false,
}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [locatingGPS, setLocatingGPS] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const wrapperRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Sync with initial value if provided
  useEffect(() => {
    if (value && typeof value === "object" && value.name) {
      setSelectedPlace(value);
      setQuery(value.name);
    } else if (value && (typeof value === "number" || typeof value === "string")) {
      const match = existingLocations.find((l) => l.id === parseInt(value, 10));
      if (match) {
        setSelectedPlace(match);
        setQuery(match.name);
      }
    }
  }, [value, existingLocations]);

  // Click outside listener to dismiss suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle typing search
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setErrorMsg("");

    // If user cleared text, clear selected place
    if (!val.trim()) {
      setSelectedPlace(null);
      setSuggestions([]);
      setIsOpen(false);
      onLocationSelected(null);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setLoading(true);
    setIsOpen(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // 1. Check existing DB locations that match
        const localMatches = existingLocations
          .filter(
            (l) =>
              l.name.toLowerCase().includes(val.toLowerCase()) ||
              (l.address && l.address.toLowerCase().includes(val.toLowerCase())) ||
              l.location_id.toLowerCase().includes(val.toLowerCase())
          )
          .map((l) => ({
            ...l,
            isExistingStore: true,
          }));

        // 2. Fetch real-world OpenStreetMap places
        const realPlaces = await searchRealLocations(val);

        // Combine (local stores first, followed by real map places)
        const combined = [...localMatches, ...realPlaces];
        setSuggestions(combined);
      } catch (err) {
        console.error("Geocoding failed:", err);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  // Select place from dropdown
  const handleSelectPlace = async (place) => {
    setErrorMsg("");
    setLoading(true);
    try {
      let resolvedLoc = place;

      // If place is not already in DB, resolve/create it in DB to get real location ID
      if (!place.id) {
        resolvedLoc = await resolveRealLocation({
          name: place.name,
          address: place.address || place.name,
          latitude: place.latitude,
          longitude: place.longitude,
        });
      }

      setSelectedPlace(resolvedLoc);
      setQuery(resolvedLoc.name);
      setIsOpen(false);
      onLocationSelected(resolvedLoc);
    } catch (err) {
      console.error("Failed to resolve location:", err);
      setErrorMsg("Failed to verify real-world place. Please pick from list.");
    } finally {
      setLoading(false);
    }
  };

  // "Use Current GPS" button to locate real device coordinates
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser");
      return;
    }
    setLocatingGPS(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        try {
          // Resolve real place via backend
          const resolved = await resolveRealLocation({
            name: `Store Node @ ${lat}, ${lon}`,
            address: `GPS Pin (${lat}, ${lon})`,
            latitude: lat,
            longitude: lon,
          });
          setSelectedPlace(resolved);
          setQuery(resolved.name);
          onLocationSelected(resolved);
        } catch (err) {
          setErrorMsg("Failed to save real GPS location");
        } finally {
          setLocatingGPS(false);
        }
      },
      (err) => {
        setLocatingGPS(false);
        setErrorMsg("Failed to get current GPS position: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleClear = () => {
    setSelectedPlace(null);
    setQuery("");
    setSuggestions([]);
    setErrorMsg("");
    onLocationSelected(null);
  };

  return (
    <div ref={wrapperRef} className="relative space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <button
          type="button"
          onClick={handleUseCurrentGPS}
          disabled={locatingGPS}
          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
        >
          <Navigation className="w-3 h-3" />
          <span>{locatingGPS ? "Detecting GPS..." : "Use Current GPS"}</span>
        </button>
      </div>

      {/* Selected Verified Place Card */}
      {selectedPlace && selectedPlace.latitude && selectedPlace.longitude ? (
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {selectedPlace.name}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300/60 uppercase">
                  Real Place Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-600 truncate mt-0.5">
                {selectedPlace.address || selectedPlace.name}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-emerald-700">
                <span>
                  GPS: {selectedPlace.latitude?.toFixed(4)}, {selectedPlace.longitude?.toFixed(4)}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${selectedPlace.latitude},${selectedPlace.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-0.5"
                >
                  <span>View Map</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            title="Change Location"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Real Place Search Input */
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>

          <input
            type="text"
            required={required}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (query.trim().length >= 2) setIsOpen(true);
            }}
            placeholder="Type real store address or place (e.g. Inorbit Mall, Airport, MG Road)..."
            className="w-full text-xs pl-9 pr-8 py-2.5 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Autocomplete Real-World Suggestions Box */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 text-xs animate-in fade-in duration-100">
              {suggestions.length === 0 ? (
                <div className="p-3 text-center text-slate-500">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying real places on world map...</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700">No real places found</p>
                      <p className="text-[11px] text-slate-400">
                        Please type a real city, street, mall, landmark, or airport
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                suggestions.map((place, idx) => (
                  <button
                    key={`${place.name}-${idx}`}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    className="w-full text-left p-3 hover:bg-indigo-50/70 transition flex items-start gap-2.5 group"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0 mt-0.5">
                      {place.isExistingStore ? (
                        <Building2 className="w-3.5 h-3.5" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 group-hover:text-indigo-900 truncate">
                          {place.name}
                        </span>
                        {place.isExistingStore ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-100 text-indigo-700">
                            Registered Store
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-700">
                            Real Map Location
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {place.address}
                      </p>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        Lat: {place.latitude?.toFixed(4)}, Lon: {place.longitude?.toFixed(4)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 mt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!selectedPlace && (
        <p className="text-[10px] text-slate-400">
          Type to search real-world addresses, malls, or retail hubs. Real GPS coordinates are verified automatically.
        </p>
      )}
    </div>
  );
};

export default RealLocationInput;
