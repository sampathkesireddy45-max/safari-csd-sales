# Safari CSD Sales & Stock Telemetry - Session Checkpoint

**Last Saved Timestamp:** October 18, 2026 - 21:40 IST  
**Conversation ID:** `c5cac8be-450b-42f8-aca6-df8d20ae1aec`  
**Workspace Path:** `C:\Users\sampa\overall sales`  

---

## 1. System Access & Credentials
- **Admin Portal**:
  - User ID / Login: `admin`
  - Password: `canteen@123`
  - Role: `admin`
- **Synced Staff & Store Nodes**:
  - 10 Employees synced from live cloud: `admin`, `SAF20162` (MESALA UPENDRA RAO), `SAF19323` (YERRABILLI ARUNA), `SAF17376` (PEDADA RAJESWARA RAO), `S1414` (GOLAGANA JANAKI), `SAF19324` (NARENDRA ROY), `SAF12884` (ANIL SETHY), `SAF10343` (PITAMBER MUKHI), `SAF18993` (AJAY SETHI), `SAF8177` (SANATAN BARAL).
  - 8 Store Locations: `INCS CANTEEN`, `NSN CANTEEN`, `NCB CANTEEN`, `202 COBRA SUNABEDA`, `TTR CANTEEN GOPALPUR`, `NCC CANTEEN CUTTACK`, `ADGM 2`, `ARC CHARBATIA`.
  - Stock & Sales Status: Current Stock reset to 0 across all products; Sales reset to 0.

---

## 2. Active Services & URLs
- **GitHub Repository**: [https://github.com/sampathkesireddy45-max/safari-csd-sales](https://github.com/sampathkesireddy45-max/safari-csd-sales)
- **Public Live Deployment Link**: [https://booking-insulin-shorter-quantitative.trycloudflare.com](https://booking-insulin-shorter-quantitative.trycloudflare.com)
- **Frontend App**: `http://localhost:5173` (Vite dev, running `--host`)
- **Backend API**: `http://localhost:8000` (FastAPI + SQLAlchemy + SQLite `backend/test.db`, running `--reload`)
- **Interactive API Docs**: `http://localhost:8000/docs`

---

## 3. Key Completed Features & Recent Modifications

### A. Fresh Product Catalog Imported from INDEX.xlsx (100 SKUs)
- Removed all legacy sample products and imported the complete **100 products** from `C:\Users\sampa\Downloads\INDEX.xlsx`.
- Every product incorporates:
  - Official CSD Index Number (e.g., `#36812`, `#36813`)
  - Full distinct model description with colour specification (e.g., `SENTINEL 56 4W (WINE)`)
  - Brand identification: `SAFARI` (92 SKUs) & `URBEN JUNGLE` (8 SKUs)
  - Category (`HL` - Hard Luggage, `SL` - Soft Luggage)
  - Sub-Category (`PC UPRIGHT`, `BACKPACK`, `RDFL`, `PP UPRIGHT`, `SL UPRIGHT`, `U/J PC UPRIGHT`, `SCHOOL BAG`)
  - Case Pack size (`4`, `3`, `20`, `8`, `12`, `2`, `15` pieces/case)
  - Official Canteen Selling Rates per Piece
- Zero-inventory baseline seeded for active retail store (`Scindia`), ready for physical counts.

### B. Dynamic Cases & Pieces Conversion Engine
- **Admin Catalog Unit Switcher**:
  - Global toggle `[ 📦 Pieces (PCS) ]` vs `[ 🧰 Cases (BOXES) ]` on Admin Dashboard.
  - Switches table view instantly between Piece Rate (`₹2,693.85 / PC`) and Case Rate (`₹10,775.40 / Case`).
  - Automatically calculates `Case Rate = Piece Rate × Case Pack`.
- **Stock Entry Modal (`StockEntryModal.jsx`)**:
  - Staff & Admins can switch entry unit between **Pieces** and **Cases (Boxes)**.
  - Live conversion badge: `e.g. 5 Cases × 4 Pcs/Case = 20 Pieces`.
  - Quick addition buttons adapt dynamically (`+1 Case`, `+5 Cases`, `+10 Cases` vs `+5 Pcs`, `+20 Pcs`).
  - Backend supports direct `unit: "cases"` and stores effective physical pieces count.
- **Retail Sales Counter (`SalesEntry.jsx`)**:
  - Cashier / staff can sell in **Pieces** or **Cases**.
  - Subtotal automatically calculates `quantity × (selling_rate × case_pack)` when selling by case.
  - Decrements live warehouse inventory in pieces accurately.
- **Stock Displays**:
  - Both Employee and Admin Dashboards display live inventory as `{quantity} PCS ≈ {quantity // case_pack} Cases`.

### C. Admin Price Management & SKU Creation
- **Synchronized Price Editor**:
  - Admin can click **"Price"** on any SKU in the catalog table.
  - Dual synchronized inputs: editing Price per Piece automatically updates Price per Case, and vice-versa.
  - Persists directly via `PUT /products/{id}`.
- **Add New SKU Modal**:
  - Admin can click **"+ Add New SKU"** to create a product on the fly.
  - Captures Index No., Model Name, Colour, Brand, Category, Sub-Category, Case Pack, and Selling Rate.
  - Persists directly via `POST /products/`.

### D. Real Store Locations & Live GPS Telemetry
- Active node: **Scindia (Visakhapatnam, Andhra Pradesh)** at `Lat: 17.688009, Lon: 83.262097`.
- Embedded interactive Leaflet radar map with online/offline employee GPS tracking.
- Damage replacement tracking and staff credentials management.

### E. Individual Index-Wise Sales & Accurate IST Export
- **Dedicated Index-Wise Sales Section (`AdminSales.jsx`)**:
  - Distinct section presenting index-by-index SKU performance across all 100 catalog products.
  - Displays: Index Number (`#36812`), Product Name, Brand, Colour, Category, Case Pack, Unit Selling Price (`₹ / PC`), Case Price (`₹ / Case`), Total Pieces Sold, Equivalent Cases Sold, Total Sales Revenue, and Transaction frequency.
  - Interactive search bar, brand filter (SAFARI / URBEN JUNGLE), sold-only filter, and instant Pieces/Cases unit toggle.
- **Indian Standard Time (IST) Timezone Fix (`timezone.py` & `admin.py`)**:
  - Timezone utility converts UTC database timestamps to accurate naive Indian Standard Time (IST, UTC+5:30).
  - All Excel exports now feature two comprehensive worksheets:
    1. **"Index-Wise Sales Summary"**: Full product catalog sales aggregate with formatted currency and summary formulas.
    2. **"Sale Transactions"**: Individual transaction log with exact IST Date (`yyyy-mm-dd`) and IST Time (`hh:mm:ss AM/PM`) and SKU breakdown.
  - Dedicated Index-Wise CSV and Transactions CSV export endpoints.

### F. Low Stock (< 5 Pieces) Real-Time Visual Indication System
- **Backend Schema & Serializer**:
  - Updated `backend/app/models/product.py` with `@property def total_stock(self) -> int` dynamically aggregated across all store inventory records.
  - Added `total_stock: Optional[int] = 0` to `ProductInDBBase` schema (`backend/app/schemas/product.py`) so all product queries provide stock status instantly.
- **Admin Catalog (`AdminDashboard.jsx`)**:
  - Split inventory metrics into two distinct columns: **"Current Stock"** (clean numerical piece count and case breakdown) and **"Stock Status"** (dedicated status column).
  - Status classification rules:
    - `< 5 Pieces`: Displays **"Low Stock (<5)"** red alert badge (or **"Out of Stock (0)"** if 0 pieces), accented with a red left border.
    - `> 10 Pieces`: Displays **"Overstock (>10)"** amber badge with high inventory notice (`{qty} pcs`), accented with an amber left border.
    - `5–10 Pieces`: Displays **"Normal (5–10)"** emerald badge indicating optimal stock.
  - Added dual filter buttons in toolbar: **"Low Stock (<5 pcs)"** and **"Overstock (>10 pcs)"** with live product counts.
- **Representative Dashboard (`EmployeeDashboard.jsx`)**:
  - Store inventory cards display **"Low Stock"** (<5 pcs) or **"Overstock"** (>10 pcs) badges and alerts.
  - Added quick filter buttons for both **"Low Stock (<5)"** and **"Overstock (>10)"**.
- **Luggage Search & Sales Entry (`ProductSearchSelect.jsx` & `SalesEntry.jsx`)**:
  - Autocomplete search dropdown badges items in real time: `< 5 pcs` Low Stock / Out of Stock, `> 10 pcs` Overstock, and `5–10 pcs` Optimal Stock.

### G. Exported Sheets "Date Sold" & "SKU's" Branding Update
- **CSV & Excel Exported Sheets (`admin.py`)**:
  - Replaced the `"Transactions Count"` column with `"Date Sold"` across both Index-Wise CSV and Excel exports.
  - Dynamically extracts and formats the actual dates each product was sold (e.g., `2026-10-18`) in Indian Standard Time (IST).
- **Sales & Admin Dashboards (`AdminSales.jsx` & `AdminDashboard.jsx`)**:
  - Standardized terminology across the sales dashboard from `"SKUs"` to `"SKU's"` (`Index SKU's Active`, `/ 100 SKU's`, `All 100 SKU's`, `Sold SKU's Only`, `Showing X Index SKU's`, and `Index Total (X SKU's)`).
  - Aligned the Index-Wise table column in the UI to display `"Date Sold"` instead of `"Txns"`.

### H. Daily Shift Opening & Closing Stock Reconciliation
- **Data Model & Backend Architecture (`reconciliation.py`)**:
  - `ShiftReconciliation`: captures store counter, audit date, shift type (`opening`, `closing`, `daily`), submitter, expected pieces, physical pieces, net variance, discrepancy counts, auto-inventory sync flag, supervisor verifier ID, and remarks.
  - `ReconciliationItem`: captures individual product SKUs, starting stock, received units, sales count today, damage count today, expected count, physical counted pieces, variance (`physical - expected`), and specific discrepancy notes.
  - Automatic inventory sync: updates live stock records in `inventory` table and writes an audit transaction in `inventory_transactions` with type `reconciliation_adjustment`.
- **Backend API Endpoints (`/reconciliation`)**:
  - `GET /reconciliation/worksheet`: fetches live worksheet with current recorded counter stock, today's sales, and damages.
  - `POST /reconciliation/submit`: validates counts, computes discrepancies, optionally auto-adjusts live inventory, and records reconciliation.
  - `GET /reconciliation/history`: retrieves past reconciliation records with filters (counter, shift type, status: balanced/variance_flagged/verified, date range).
  - `GET /reconciliation/{id}`: provides detailed line-item SKU breakdown for specific audit records.
  - `POST /reconciliation/{id}/verify`: admin supervisor review and formal verification endpoint with remarks.
  - `GET /reconciliation/export/csv`: generates Excel-compatible UTF-8 BOM CSV exports of shift audit logs.
- **Counter Staff Interface (`ShiftReconciliation.jsx` at `/employee/reconciliation`)**:
  - Date & Shift selector (`Opening Shift`, `Closing Shift`, `Full Day / Daily`).
  - Live summary KPI cards: Expected Stock, Physical Counted, Net Variance (Balanced/Surplus/Shortage), and Discrepancy SKU counts.
  - Quick action buttons: **"Pre-fill Expected"** (one-click match) and **"Zero All"**.
  - Interactive table with stepper increment/decrement buttons, color-coded variance tags (`0 Match`, `+X Surplus`, `-X Shortage`), and line-item note inputs.
  - Confirmation modal and past shift audit history breakdown.
- **Admin Supervision & Audit Portal (`AdminReconciliation.jsx` at `/admin/reconciliations`)**:
  - Store counter filters, shift filters, status filters, and date range filters.
  - KPI audit metrics: Total Shift Audits, Flagged Variances, Balanced Shifts, and Admin Verified counts.
  - Single-click CSV export button.
  - **"Audit & Verify"** modal allowing supervisors to review SKU-level discrepancies, review staff handover remarks, and approve or flag records.

### F. Sales Dashboard Streamlining, Terminology & Live Counter Stock
- **Sales Transactions Removed**: Removed the Sale Transactions table and dedicated transaction exports from the Sales Dashboard (`AdminSales.jsx`), leaving a clean, high-performance Index-Wise sales register.
- **"Rostered" Replaced with "Assigned"**: Completely replaced all instances of "rostered" with "assigned" across GPS tracking tables, attendance sidebars, and staff directories.
- **Opening & Closing Stock in Sales Dashboard**:
  - Added dedicated **Opening Stock** and **Closing Stock** columns to the Sales Dashboard table and exports (both CSV and multi-sheet XLSX).
  - Formulas dynamically compute `Opening Stock = Closing Stock + Volume Sold`, maintaining strict retail accounting accuracy.
- **Live Counter Stock Display in Employee Sales Entry**:
  - `SalesEntry.jsx` now reactively merges catalog products with the employee's assigned store location inventory.
  - An available store stock badge is displayed for every selected line item.
  - Submitting sales triggers an immediate dual-refresh of both inventory and catalog data so counter stock decrements in real time without a manual page reload.
- **Reconciliations Removed**: Shift and store reconciliations have been completely eliminated from the frontend routing, sidebar navigation, and backend router registry.

### G. Store Assignment Synchronization & Employee Sales & Stock Dashboard
- **Admin Store Assignment Instant Sync**:
  - `UserResponse` schema in `backend/app/routers/auth.py` now includes `assigned_location_name`.
  - Added `refreshUser` helper in `AuthContext.jsx` and mounted automatic refresh on `Sidebar.jsx`, `SalesEntry.jsx`, `EmployeeDashboard.jsx`, and `EmployeeSalesDashboard.jsx`.
  - Whenever an admin reassigns an employee's store counter in the Admin Portal (`/admin/employees` or `/admin/locations`), the employee's assigned store name and counter details update dynamically in the employee portal.
  - Added assigned store outlet badge and counter validation to `SalesEntry.jsx` and `Sidebar.jsx`.
- **Employee Sales & Stock Dashboard (`/employee/sales-dashboard`)**:
  - Added dedicated page `EmployeeSalesDashboard.jsx` accessible from `Sidebar.jsx` ("My Sales & Stock") and the staff dashboard banner.
  - Displays individual sales volume, individual revenue, total opening stock, total closing stock, low stock (<5 PCS), out of stock (0 PCS), and overflow stock (>10 PCS).
  - Index-wise catalog stock table displaying Index No, Name, Brand, Selling Price, My Sold Pieces, Opening Stock, Closing Stock, and Stock Status.
  - **Editable Opening Stock**: Staff can edit **Opening Stock only** via an inline modal. Validates that opening stock cannot be less than volume already sold in the period. Closing stock is automatically recalculated (`Closing = Opening - Sold`), updating the live store inventory and writing an `opening_stock_adjustment` transaction audit log.
  - **Sales History Tab**: Lists individual counter sales receipts with IST timestamps, total amounts, and SKU breakdown.

---

## 4. Key Files
- `frontend/src/pages/EmployeeSalesDashboard.jsx`: Dedicated employee sales & stock dashboard with opening/closing stock analysis, stock alerts, and opening stock editor.
- `backend/app/routers/employee.py`: Staff dashboard stats and sales dashboard endpoints (`/employees/sales-dashboard` and `/employees/sales-dashboard/opening-stock`).
- `frontend/src/pages/AdminSales.jsx`: Streamlined sales dashboard with Index-Wise SKU breakdown, Opening Stock, Volume Sold, Closing Stock, brand filters, and clean CSV/XLSX exports.
- `frontend/src/pages/SalesEntry.jsx`: Sales counter with real-time stock availability verification, instant decrementation, live counter stock badges, and assigned store banner.
- `frontend/src/context/AuthContext.jsx`: Auth context providing session persistence and `refreshUser` for dynamic store reassignments.
- `frontend/src/components/Sidebar.jsx`: Portal navigation showing staff's assigned store counter and links.

---

## 5. Instructions to Resume
When the user says:
- `"restart tomorrow"`
- `"resume this conversation"`
- `"resume tomorrow"`
- `"continue overall sales"`
- `"continue sales"`
- or references this project:
Check that both backend (`http://localhost:8000`) and frontend (`http://localhost:5173`) are running, read this checkpoint, and resume immediately.

