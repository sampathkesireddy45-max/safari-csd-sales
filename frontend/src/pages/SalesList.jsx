import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getSales, getEmployees, getProducts } from "../services/api";
import { useNavigate, Link } from "react-router-dom";

const SalesList = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch sales, employees, and products concurrently
        const [salesData, employeesData, productsData] = await Promise.all([
          getSales(),
          getEmployees(),
          getProducts(),
        ]);
        setSales(salesData);
        setEmployees(employeesData);
        setProducts(productsData);
        setSuccess("Data loaded successfully!");
      } catch (err) {
        console.error("Failed to load sales data:", err);
        setError("Failed to load sales data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    } else {
      setLoading(false);
      navigate("/login", { replace: true });
    }
  }, [user]);

  // Helper to get employee name by id
  const getEmployeeName = (employeeId) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.first_name} ${emp.last_name}` : `Employee ${employeeId}`;
  };

  // Helper to get product name by id
  const getProductName = (productId) => {
    const prod = products.find((p) => p.id === productId);
    return prod ? prod.name : `Product ${productId}`;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Sales History
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            View all recorded sales.
          </p>
        </div>
      </header>
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {success && <p className="mb-4 text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">{success}</p>}
          
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m2 0a2 2 0 110-4 2 2 0 010 4zm-10 0a2 2 0 100-4 2 2 0 000 4zm10 0v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3m14 0v3a2 2 0 01-2 2h-3.172a2 2 0 01-1.414-.586l-.828-.828A2 2 0 009.172 7H6.828a2 2 0 00-1.414.586l-.828.828A2 2 0 013 12v3a2 2 0 002 2h10a2 2 0 002-2v-3z" /></svg>
              <p className="mt-4 text-gray-500">No sales records found.</p>
              <Link to="/employee/sales-entry" className="mt-6 inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                Record First Sale
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 bg-white rounded-xl shadow-xl overflow-hidden">
                <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Pieces
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{sale.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(sale.sale_date).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {getEmployeeName(sale.employee_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sale.location_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {sale.total_pieces}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                          {sale.items.map((item) => (
                            <li key={item.id}>
                              {getProductName(item.product_id)}: {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => navigate("/employee/sales-entry")}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-md shadow-md hover:bg-gradient-to-s hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              Record New Sale
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SalesList;
