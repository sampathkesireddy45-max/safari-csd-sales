# 🛒 Safari CSD Sales & Stock Telemetry Platform

A full-stack retail management and stock telemetry system designed for military canteen / CSD retail operations. Features live GPS employee tracking, dynamic piece inventory, Safari catalog pricing, sales point-of-sale, and defect/damage return lifecycle with photo verification.

---

## 🚀 One-Click Deploy to Render

### Option 1: Automatic Blueprint (Recommended)
1. Push this repository to your GitHub account.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **"New +"** -> **"Blueprint"**.
4. Select your connected repository (`safari-csd-sales`).
5. Render will automatically detect [`render.yaml`](render.yaml) and configure the build and start commands.
6. Click **"Apply"** — Render will build and deploy the entire full-stack app on a single free web service!

---

### Option 2: Manual Web Service Setup on Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **"New +"** -> **"Web Service"**.
3. Select your GitHub repository.
4. Fill in the following settings:
   - **Name**: `safari-csd-sales` (or any name you prefer)
   - **Language / Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     chmod +x render-build.sh && ./render-build.sh
     ```
   - **Start Command**:
     ```bash
     cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: `Free`
5. *(Optional)* Under **Environment Variables**, you can add:
   - `PYTHON_VERSION`: `3.12.0`
   - `NODE_VERSION`: `20.11.0`
   - `DATABASE_URL`: (Optional — defaults to included SQLite `test.db` with complete CSD catalog. If you attach a Render PostgreSQL database, the tables will automatically auto-migrate!)
6. Click **"Create Web Service"**.

---

## 🔑 Default Login Credentials

| Role | Username / ID | Password | Access Details |
|---|---|---|---|
| **Admin** | `admin` | `canteen@123` | Executive dashboard, live GPS fleet map, store creation, stock piece adjustments, damage audit approval & replacement |
| **Staff** | `EMP101` | *(Configured via Admin Staff page)* | Sales billing, real-time geolocation check-in, dynamic piece counting, damage photo reporting |

---

## 💻 Local Development

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

Interactive Swagger API docs available at: `http://localhost:8000/docs`.
