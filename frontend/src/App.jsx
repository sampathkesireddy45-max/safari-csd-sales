import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import { ThemeProvider } from "./context/ThemeContext";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEmployees from "./pages/AdminEmployees";
import AdminDamages from "./pages/AdminDamages";
import AdminLocations from "./pages/AdminLocations";
import AdminLiveTracking from "./pages/AdminLiveTracking";
import AdminCredentials from "./pages/AdminCredentials";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import SalesEntry from "./pages/SalesEntry";
import DamagesReport from "./pages/DamagesReport";
import NotFound from "./pages/NotFound";
import AdminReports from "./pages/AdminReports";
import SystemHealth from "./pages/SystemHealth";
import AdminSales from "./pages/AdminSales";
import ShiftReconciliation from "./pages/ShiftReconciliation";
import AdminReconciliation from "./pages/AdminReconciliation";

function App() {
  return (
    <Router>
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/locations" element={<AdminLocations />} />
            <Route path="/admin/live-locations" element={<AdminLiveTracking />} />
            <Route path="/admin/credentials" element={<AdminCredentials />} />
            <Route path="/admin/employees" element={<AdminEmployees />} />
            <Route path="/admin/damages" element={<AdminDamages />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/sales" element={<AdminSales />} />
            <Route path="/admin/reconciliations" element={<AdminReconciliation />} />
            <Route path="/admin/reconciliation" element={<AdminReconciliation />} />
            <Route path="/admin/system-health" element={<SystemHealth />} />
            <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
            <Route path="/employee/sales-entry" element={<SalesEntry />} />
            <Route path="/employee/damages" element={<DamagesReport />} />
            <Route path="/employee/damages-report" element={<DamagesReport />} />
            <Route path="/employee/reconciliation" element={<ShiftReconciliation />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;