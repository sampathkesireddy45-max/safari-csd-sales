# Safari CSD Sales & Stock Telemetry - Session Checkpoint

**Last Saved Timestamp:** October 18, 2026 - 14:55 IST  
**Conversation ID:** `c770b319-1fa5-47ba-95cf-7457f78d8586` (resumed from `beac8206-6b50-4249-ba27-4d0476831be3`)  
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

---

## 4. Key Files
- `frontend/src/pages/ShiftReconciliation.jsx`: Counter staff shift opening and closing reconciliation worksheet with live variance detection.
- `frontend/src/pages/AdminReconciliation.jsx`: Admin supervisor audit portal for shift reconciliation verification, history, and CSV export.
- `backend/app/models/reconciliation.py`: SQLAlchemy models `ShiftReconciliation` and `ReconciliationItem`.
- `backend/app/schemas/reconciliation.py`: Pydantic validation schemas for worksheets, submissions, and responses.
- `backend/app/crud/reconciliation.py`: CRUD operations for live worksheet generation, submission, inventory sync, and audit querying.
- `backend/app/routers/reconciliation.py`: FastAPI endpoints for worksheets, submission, verification, and CSV export.
- `frontend/src/pages/AdminSales.jsx`: Upgraded sales dashboard with dedicated Individual Index-Wise Sales table, search, brand filters, and multi-format IST exports.
- `frontend/src/pages/AdminDashboard.jsx`: Executive dashboard with cases/pieces toggle, brand filters, synchronized price editor modal, Current Stock column, and Low Stock (<5) filter.
- `frontend/src/pages/EmployeeDashboard.jsx`: Representative dashboard with real-time dynamic inventory counts, piece/case converter, and red Low Stock (<5) visual alerts.
- `frontend/src/pages/SalesEntry.jsx`: Sales counter with real-time stock availability verification and low-stock warning banners.
- `frontend/src/components/ProductSearchSelect.jsx`: Product lookup autocomplete with live stock level indicators and low stock badges.
- `backend/app/models/product.py`: Product model with dynamic `total_stock` inventory calculation property.
- `backend/app/schemas/product.py`: Product Pydantic schemas serializing `total_stock`.

---

## 5. Instructions to Resume Tomorrow
When the user says:
- `"restart tomorrow"`
- `"resume this conversation"`
- `"resume tomorrow"`
- `"continue overall sales"`
- `"continue sales"`
- or opens the session:
Check that both backend (`http://localhost:8000`) and frontend (`http://localhost:5173`) are running, read this checkpoint, and resume immediately.

