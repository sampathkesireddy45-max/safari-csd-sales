import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEmployees from "./pages/AdminEmployees";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import SalesEntry from "./pages/SalesEntry";
import SalesList from "./pages/SalesList";
import DamagesReport from "./pages/DamagesReport";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/employees" element={<AdminEmployees />} />
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/employee/sales-entry" element={<SalesEntry />} />
          <Route path="/employee/sales-list" element={<SalesList />} />
          <Route path="/employee/damages-report" element={<DamagesReport />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
