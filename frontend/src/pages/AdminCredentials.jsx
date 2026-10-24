import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { getEmployees, resetEmployeePassword, getLocations, createEmployee, deleteEmployee } from "../services/api";
import { TableSkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import RealLocationInput from "../components/RealLocationInput";
import {
  Key,
  Shield,
  Copy,
  Check,
  RefreshCw,
  UserCheck,
  Building2,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  Share2,
  X,
  AlertCircle,
  Trash2,
  CheckCircle
} from "lucide-react";

const AdminCredentials = () => {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Password Reset Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPlainPassword, setShowPlainPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [removingEmployeeId, setRemovingEmployeeId] = useState(null);
  const [passwordSuccessData, setPasswordSuccessData] = useState(null);
  const [sessionPasswords, setSessionPasswords] = useState(() => {
    try {
      const stored = localStorage.getItem("safari_staff_passwords");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const saveToSessionPasswords = (newEntries) => {
    setSessionPasswords((prev) => {
      const updated = { ...prev, ...newEntries };
      try {
        localStorage.setItem("safari_staff_passwords", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Copied state indicator
  const [copiedId, setCopiedId] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmpData, setNewEmpData] = useState({
    employee_id: "",
    name: "",
    email: "",
    phone: "",
    role: "employee",
    status: "active",
    assigned_location_id: "",
    password: "",
  });

  const loadData = async () => {
    try {
      const [empsData, locsData] = await Promise.all([
        getEmployees(),
        getLocations(),
      ]);
      setEmployees((empsData || []).filter((employee) => employee.status === "active"));
      setLocations(locsData);
    } catch (err) {
      console.error("Failed to load staff:", err);
      addToast("Failed to load employee directory", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateRandomPassword = () => {
    const prefixes = ["Safari", "Staff", "Retail", "Store"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${prefix}@${num}`;
  };

  const handleOpenPasswordModal = (emp) => {
    setSelectedEmployee(emp);
    setPasswordSuccessData(null);
    const existingPwd = sessionPasswords[emp.id] || sessionPasswords[emp.employee_id] || sessionPasswords[(emp.employee_id || "").toUpperCase()] || "";
    setNewPassword(existingPwd || generateRandomPassword());
    setShowPlainPassword(true);
    setShowPasswordModal(true);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setSelectedEmployee(null);
    setPasswordSuccessData(null);
    setNewPassword("");
  };

  const handleCopyJustPassword = (pwd, empId = null) => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedField(`pwd-${empId || "modal"}`);
    addToast("Password copied to clipboard!", "success");
    setTimeout(() => setCopiedField(null), 3000);
  };

  const handleCopyUserId = (userId) => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopiedField(`user-${userId}`);
    addToast(`User ID ${userId} copied!`, "success");
    setTimeout(() => setCopiedField(null), 3000);
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    const cleanPassword = (newPassword || "").trim();
    if (!cleanPassword || cleanPassword.length < 4) {
      addToast("Password must be at least 4 characters long", "error");
      return;
    }

    setSavingPassword(true);
    try {
      await resetEmployeePassword(selectedEmployee.id, cleanPassword);
      saveToSessionPasswords({
        [selectedEmployee.id]: cleanPassword,
        [selectedEmployee.employee_id]: cleanPassword,
        [(selectedEmployee.employee_id || "").toUpperCase()]: cleanPassword,
      });

      setPasswordSuccessData({
        employee: selectedEmployee,
        password: cleanPassword,
      });

      addToast(`Password updated for ${selectedEmployee.name} (${selectedEmployee.employee_id})!`, "success");
      loadData();
    } catch (err) {
      console.error("Failed to set password:", err);
      addToast(err.message || "Failed to set employee password", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCopyCredentials = (emp, pwd = null) => {
    const loc = locations.find((l) => l.id === emp.assigned_location_id);
    const effectivePwd = pwd 
      || sessionPasswords[emp.id] 
      || sessionPasswords[emp.employee_id] 
      || sessionPasswords[(emp.employee_id || "").toUpperCase()] 
      || "canteen@123";
    const slip = `=====================================
SAFARI STAFF PORTAL LOGIN ACCESS
=====================================
Staff Member : ${emp.name}
User ID (Login) : ${emp.employee_id}
Work Email   : ${emp.email}
Password     : ${effectivePwd}
Assigned Store: ${loc ? loc.name : "Safari Operations"}
Portal URL   : ${window.location.origin}/login
=====================================
Please log in using your User ID and the password above.`;

    navigator.clipboard.writeText(slip);
    setCopiedId(emp.id);
    addToast(`Login memo for ${emp.employee_id} copied to clipboard!`, "success");
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleOpenAddModal = () => {
    const randomId = `EMP${Math.floor(100 + Math.random() * 900)}`;
    setNewEmpData({
      employee_id: randomId,
      name: "",
      email: "",
      phone: "",
      role: "employee",
      status: "active",
      assigned_location_id: locations.length > 0 ? locations[0].id : "",
      password: generateRandomPassword(),
    });
    setShowAddModal(true);
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newEmpData,
        assigned_location_id: newEmpData.assigned_location_id ? parseInt(newEmpData.assigned_location_id, 10) : null,
      };
      await createEmployee(payload);
      addToast("Staff member & credentials created successfully!", "success");
      setShowAddModal(false);
      loadData();
    } catch (err) {
      console.error("Failed to create employee:", err);
      addToast(err.message || "Failed to create staff account", "error");
    }
  };

  const handleRemoveEmployee = async (emp) => {
    if (emp.role === "admin") {
      addToast("Admin accounts cannot be removed from the staff portal", "error");
      return;
    }
    if (!window.confirm(`Remove ${emp.name} (${emp.employee_id}) from staff credentials? This action cannot be undone.`)) {
      return;
    }
    setRemovingEmployeeId(emp.id);
    try {
      await deleteEmployee(emp.id);
      setEmployees((current) => current.filter((employee) => employee.id !== emp.id));
      addToast(`${emp.name} was removed successfully. Historical sales and reports were preserved.`, "success");
    } catch (err) {
      addToast(err.message || "Failed to remove employee", "error");
    } finally {
      setRemovingEmployeeId(null);
    }
  };

  return (
    <Layout
      title="Staff Credentials & Access Control"
      subtitle="Issue User IDs and configure passwords for employees to access the staff portal"
      action={
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Issue New Staff Pass</span>
        </button>
      }
    >
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <div className="space-y-6">
          {/* Information & Security Policy Banner */}
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 sm:mt-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-indigo-950">
                  Admin-Controlled Authentication Policy
                </h3>
                <p className="text-xs text-indigo-800/80 mt-1 max-w-2xl leading-relaxed">
                  Employees cannot register or reset their own passwords. As an administrator, you configure and issue each staff member's <strong>User ID</strong> and <strong>Password</strong>. When staff enter their credentials at the login screen, their dedicated staff dashboard unlocks.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-semibold text-indigo-900 shadow-sm flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>{employees.length} Authorized Accounts</span>
              </div>
            </div>
          </div>

          {/* Credentials Directory Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Staff Access Credential Registry</span>
              </h4>
              <span className="text-xs text-slate-400">
                Click "Set Password" or "Copy Pass" to dispatch to staff
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Staff Member</th>
                    <th className="px-6 py-4 font-semibold">User ID (Login ID)</th>
                    <th className="px-6 py-4 font-semibold">Assigned Store</th>
                    <th className="px-6 py-4 font-semibold">System Role</th>
                    <th className="px-6 py-4 font-semibold">Access Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Credential Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const loc = locations.find((l) => l.id === emp.assigned_location_id);
                    const isCopied = copiedId === emp.id;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                              {emp.name.charAt(0)}
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

                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-50/60 border border-indigo-100">
                            <span className="font-mono text-xs font-bold text-indigo-800">
                              {emp.employee_id}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs">
                          {loc ? (
                            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{loc.name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              emp.role === "admin"
                                ? "bg-amber-50 text-amber-800 border border-amber-200/60"
                                : "bg-indigo-50 text-indigo-800 border border-indigo-200/60"
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {emp.role}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                              emp.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Always available Copy Pass button */}
                            <button
                              type="button"
                              onClick={() => {
                                const activePwd = sessionPasswords[emp.id] || sessionPasswords[emp.employee_id] || sessionPasswords[(emp.employee_id || "").toUpperCase()] || "canteen@123";
                                handleCopyJustPassword(activePwd, emp.id);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shadow-sm"
                              title={`Copy active password (${sessionPasswords[emp.id] || sessionPasswords[emp.employee_id] || "canteen@123"})`}
                            >
                              {copiedField === `pwd-${emp.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Key className="w-3.5 h-3.5 text-emerald-600" />}
                              <span>{copiedField === `pwd-${emp.id}` ? "Copied!" : "Copy Pass"}</span>
                            </button>

                            {/* Set / Change Password button */}
                            <button
                              type="button"
                              onClick={() => handleOpenPasswordModal(emp)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200"
                              title="Set or change password"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Change</span>
                            </button>

                            {/* Copy Full Memo Slip */}
                            <button
                              type="button"
                              onClick={() => handleCopyCredentials(emp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                              title="Copy complete staff login slip memo"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            {emp.role !== "admin" && (
                              <button
                                type="button"
                                onClick={() => handleRemoveEmployee(emp)}
                                disabled={removingEmployeeId === emp.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 transition disabled:opacity-50"
                                title="Remove employee"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{removingEmployeeId === emp.id ? "Removing..." : "Remove"}</span>
                              </button>
                            )}
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

      {/* Set Password Modal */}
      {showPasswordModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600" />
                <span>{passwordSuccessData ? "Password Updated Successfully" : "Configure Employee Password"}</span>
              </h3>
              <button
                onClick={handleClosePasswordModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordSuccessData ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-950">Active & Ready for Login</h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    The changed password has been committed to the database. Staff can log in immediately.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">User ID (Login)</div>
                      <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                        {passwordSuccessData.employee.employee_id}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyUserId(passwordSuccessData.employee.employee_id)}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 rounded-lg flex items-center gap-1 shadow-sm transition"
                    >
                      {copiedField === `user-${passwordSuccessData.employee.employee_id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy ID</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="border-t border-slate-200/80 pt-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">New Password</div>
                      <div className="font-mono text-sm font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                        {passwordSuccessData.password}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyJustPassword(passwordSuccessData.password, "modal")}
                      className="px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg flex items-center gap-1.5 shadow-sm transition"
                    >
                      {copiedField === "pwd-modal" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(passwordSuccessData.employee, passwordSuccessData.password)}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copy Full Login Slip Memo (for WhatsApp / SMS)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePasswordModal}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePassword} className="mt-4 space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Configuring credentials for:</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {selectedEmployee.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">User ID:</span>
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {selectedEmployee.employee_id}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      New Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewPassword(generateRandomPassword())}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Strong Password</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPlainPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new employee password"
                      autoComplete="new-password"
                      className="w-full text-sm px-3 py-2.5 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPlainPassword(!showPlainPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPlainPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Minimum 4 characters. Active immediately for employee sign-in.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Remember to share this password with <strong>{selectedEmployee.name}</strong> along with their User ID <strong>{selectedEmployee.employee_id}</strong>.
                  </span>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleClosePasswordModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{savingPassword ? "Updating..." : "Save & Set Password"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Issue New Staff Account & Pass</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    User ID (Login ID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmpData.employee_id}
                    onChange={(e) => setNewEmpData({ ...newEmpData, employee_id: e.target.value.toUpperCase() })}
                    placeholder="e.g. EMP105"
                    className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmpData.name}
                    onChange={(e) => setNewEmpData({ ...newEmpData, name: e.target.value })}
                    placeholder="e.g. Suresh Kumar"
                    className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmpData.email}
                  onChange={(e) => setNewEmpData({ ...newEmpData, email: e.target.value })}
                  placeholder="e.g. suresh@safari.com"
                  className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <RealLocationInput
                  value={newEmpData.assigned_location_id}
                  existingLocations={locations}
                  label="Assigned Retail Store Location"
                  onLocationSelected={(loc) => {
                    setNewEmpData((prev) => ({
                      ...prev,
                      assigned_location_id: loc ? loc.id : "",
                    }));
                    if (loc && !locations.some((l) => l.id === loc.id)) {
                      setLocations((prev) => [...prev, loc]);
                    }
                  }}
                />
              </div>

              {/* Password configuration */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    Admin-Configured Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewEmpData({ ...newEmpData, password: generateRandomPassword() })}
                    className="text-[10px] text-indigo-600 font-semibold hover:underline"
                  >
                    Randomize
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newEmpData.password}
                  onChange={(e) => setNewEmpData({ ...newEmpData, password: e.target.value })}
                  placeholder="Set initial password for employee"
                  className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Provide this password and User ID to the employee for their login.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                >
                  Create & Issue Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminCredentials;
