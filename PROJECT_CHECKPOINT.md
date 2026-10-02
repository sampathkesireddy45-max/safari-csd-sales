# Safari CSD Sales & Stock Telemetry - Session Checkpoint

**Last Saved Timestamp:** September 29, 2026 - 22:36 IST  
**Conversation ID:** `a708744d-9fbe-4167-ab1b-2313d326b458`  
**Workspace Path:** `C:\Users\sampa\overall sales`  

---

## 1. System Access & Credentials
- **Admin Portal**:
  - User ID / Login: `admin`
  - Password: `canteen@123`
  - Role: `admin`
  - Assigned Base Node: `Scindia (Visakhapatnam)` (Lat: `17.688009`, Lon: `83.262097`)
- **Staff / Employee Portal**:
  - Employee ID: `EMP101`
  - Name: `UPENDRA`
  - Email: `sampathkesireddy.45@gmail.com`
  - Password: (Configured via Admin Staff Credentials page)
  - Assigned Retail Location: `Scindia (Visakhapatnam)` (Lat: `17.688009`, Lon: `83.262097`)

---

## 2. Active Services & URLs
- **GitHub Repository**: [https://github.com/sampathkesireddy45-max/safari-csd-sales](https://github.com/sampathkesireddy45-max/safari-csd-sales)
- **Public Live Deployment Link**: [https://robbie-sheffield-growing-unsigned.trycloudflare.com](https://robbie-sheffield-growing-unsigned.trycloudflare.com)
- **Frontend App**: `http://localhost:5173` (Vite dev) or unified on `http://localhost:8000`
- **Backend API**: `http://localhost:8000` (FastAPI + SQLAlchemy + SQLite `backend/test.db`)
- **Interactive API Docs**: `http://localhost:8000/docs` (or `/docs` on the public deployment link)

---

## 3. Key Completed Features & Architecture

### A. Safari CSD Catalog & Dynamic Inventory
- Imported official Safari CSD rates catalog from `C:\Users\sampa\Downloads\safari csd rates pcs .xlsx`.
- Contains all official CSD Index Numbers (e.g., `36812`, `36813`), model descriptions, base rates per piece, and canteen selling prices.
- Dynamic inventory management: Both employees and admins can directly enter and update physical piece counts per item.
- Searchable product selector during sales and damage entries by CSD Index Number or product name.

### B. Real Store Locations & Geofencing
- Admin enters store locations with real-world verification via OpenStreetMap / Nominatim geocoding.
- Locations include latitude and longitude coordinates.
- Active store: **Scindia (Visakhapatnam, Andhra Pradesh)** at `Lat: 17.688009, Lon: 83.262097`.

### C. Live Employee & Admin Geolocation Map
- Interactive Leaflet map powered by OpenStreetMap tiles.
- **Embedded Admin Dashboard Widget** (`frontend/src/components/LiveEmployeeMapWidget.jsx`):
  - Visible directly on the Admin Dashboard (`/admin/dashboard`).
  - Active staff pins (emerald green for online with radar pulse, slate for offline).
  - Distinct purple pin for Admin HQ with `ADM` badge.
  - Retail store building markers with code and address popups.
  - Staff attendance roster with **"Locate"** button to zoom directly to any employee.
  - **"Sync My Real Location"** button: Automatically acquires real device GPS via browser `navigator.geolocation` and syncs coordinates to the backend database.
- **Full Geofence & Tracking Page** (`frontend/src/pages/AdminLiveTracking.jsx` at `/admin/live-locations`):
  - Auto-refresh every 20s, filter tabs (`All Staff`, `Online Only`, `With GPS`).
  - Geofence distance calculation to assigned stores.

### D. Damage Claims & "Replaced" Lifecycle
- Replaced damage claims are excluded from active damages calculations (`totalDamaged` in dashboard metrics, 7-day velocity chart, active reports list).
- Both Admin Dashboard and Damage Reports page provide a **[Replaced]** button.
- Status filter: `Active Damages`, `Replaced Pieces`, `All Records`.
- Audit logs recorded for all replacements and photo modifications.

---

## 4. Key Files
- `frontend/src/pages/AdminDashboard.jsx`: Executive fleet dashboard with embedded live map and telemetry.
- `frontend/src/components/LiveEmployeeMapWidget.jsx`: Embedded Leaflet map widget with GPS sync.
- `frontend/src/pages/AdminLiveTracking.jsx`: Full-screen live tracking and geofence dashboard.
- `frontend/src/pages/AdminDamages.jsx`: Damage reports gallery & table with "Replaced" action.
- `frontend/src/services/api.js`: All API client bindings including live locations, replacement, and catalog.
- `backend/app/routers/employee.py`: Live locations broadcast & retrieval routes.
- `backend/app/routers/damage_report.py`: Damage reporting, photo uploads, audit logs, and replacement endpoints.
- `backend/app/routers/admin.py`: Fleet metrics and sales/defect velocity calculations.

---

## 5. Instructions to Resume Tomorrow
When the user says:
- `"restart tomorrow"`
- `"resume"`
- `"continue"`
- or opens the session:
Check that both backend and frontend servers are listening on `8000` and `5173`, read this checkpoint, and resume immediately from this exact state.
