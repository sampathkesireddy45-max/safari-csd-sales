import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getLocations
} from "../services/api";
import Layout from "../components/Layout";
import { TableSkeleton } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import RealLocationInput from "../components/RealLocationInput";
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Shield,
  UserCheck,
  MapPin,
  X,
  Phone,
  Mail
} from "lucide-react";

const AdminEmployees = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [formData, setFormData] = useState({
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
      const [employeesData, locationsData] = await Promise.all([
        getEmployees(),
        getLocations(),
      ]);
      setEmployees(employeesData);
      setLocations(locationsData);
    } catch (err) {
      console.error("Failed to load employees:", err);
      addToast("Failed to load employees", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setShowAddModal(true);
    setFormData({
      employee_id: `EMP${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      email: "",
      phone: "",
      role: "employee",
      status: "active",
      assigned_location_id: locations.length > 0 ? locations[0].id : "",
      password: "safari" + Math.floor(100 + Math.random() * 900),
    });
  };

  const handleOpenEditModal = (emp) => {
    setEditEmployee(emp);
    setFormData({
      employee_id: emp.employee_id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone || "",
      role: emp.role || "employee",
      status: emp.status || "active",
      assigned_location_id: emp.assigned_location_id || "",
      password: "",
    });
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditEmployee(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        assigned_location_id: formData.assigned_location_id ? parseInt(formData.assigned_location_id, 10) : null,
      };
      if (!payload.password) delete payload.password;

      if (showAddModal) {
        await createEmployee(payload);
        addToast("Employee created successfully!", "success");
      } else if (showEditModal && editEmployee) {
        await updateEmployee(editEmployee.id, payload);
        addToast("Employee updated successfully!", "success");
      }
      handleCloseModal();
      loadData();
    } catch (err) {
      console.error("Failed to save employee:", err);
      addToast(err.message || "Failed to save employee", "error");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate or remove employee ${name}?`)) {
      return;
    }
    try {
      await deleteEmployee(id);
      addToast("Employee removed successfully", "success");
      loadData();
    } catch (err) {
      console.error("Failed to delete employee:", err);
      addToast(err.message || "Failed to delete employee", "error");
    }
  };

  return (
    <Layout
      title="Staff Directory & Roster"
      subtitle="Manage corporate credentials, store allocations, and system roles"
      action={
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      }
    >
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : employees.length === 0 ? (
        <EmptyState
          type="employees"
          title="No employees found"
          description="There are currently no staff records registered in the system."
          actionLabel="Create Employee"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Staff Member</th>
                  <th className="px-6 py-4 font-semibold">Employee ID</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Assigned Location</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const loc = locations.find((l) => l.id === emp.assigned_location_id);
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
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {emp.employee_id}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          emp.role === "admin"
                            ? "bg-amber-50 text-amber-800 border border-amber-200/60"
                            : "bg-indigo-50 text-indigo-800 border border-indigo-200/60"
                        }`}>
                          {emp.role === "admin" ? <Shield className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{loc ? loc.name : "Unassigned"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                          emp.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Edit employee"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {emp.id !== user.id && (
                            <button
                              type="button"
                              onClick={() => handleDelete(emp.id, emp.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete employee"
                            >
                              <Trash2 className="w-4 h-4" />
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
      )}

      {/* Add / Edit Employee Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {showAddModal ? "Register New Employee" : "Update Employee Record"}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Employee Code *
                  </label>
                  <input
                    type="text"
                    required
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleChange}
                    className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  required
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <RealLocationInput
                  value={formData.assigned_location_id}
                  existingLocations={locations}
                  label="Assigned Retail Store Location"
                  onLocationSelected={(loc) => {
                    setFormData((prev) => ({
                      ...prev,
                      assigned_location_id: loc ? loc.id : "",
                    }));
                    if (loc && !locations.some((l) => l.id === loc.id)) {
                      setLocations((prev) => [...prev, loc]);
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  {showAddModal ? "Employee Password (Set by Admin) *" : "Reset Employee Password (Optional)"}
                </label>
                <input
                  type="text"
                  required={showAddModal}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={showAddModal ? "Set password for employee" : "Leave blank to keep current password"}
                  className="w-full text-xs px-3 py-2 border rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Staff passwords are set exclusively by Admin. Provide this password to the employee to sign in.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                >
                  {showAddModal ? "Create Employee" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminEmployees;