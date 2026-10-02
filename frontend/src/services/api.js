export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL !== undefined
  ? import.meta.env.VITE_BACKEND_URL
  : (typeof window !== "undefined" && window.location.port === "5173"
      ? "http://localhost:8000"
      : "");

// Retrieve token from storage
export const getToken = () => localStorage.getItem("safari_token");
export const setToken = (token) => localStorage.setItem("safari_token", token);
export const removeToken = () => localStorage.removeItem("safari_token");

export const fetchApi = async (endpoint, options = {}) => {
  try {
    const token = getToken();
    const headers = {
      ...(options.headers || {}),
    };

    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Unauthorized: clear token
      // removeToken();
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === "string" 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        }
      } catch (e) {
        // Fallback to text if not json
      }
      throw new Error(errorMessage);
    }

    // For file downloads
    const contentType = response.headers.get("content-type");
    if (contentType && (contentType.includes("text/csv") || contentType.includes("application/octet-stream"))) {
      return await response.blob();
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
};

// --- Auth API ---
export const loginApi = async (credentials) => {
  return await fetchApi("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
};

export const getMe = async () => {
  return await fetchApi("/auth/me");
};

// --- Damage Photos & Reports API ---
export const uploadDamagePhoto = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", `${API_BASE_URL}/damages/upload-photo`);
    
    const token = getToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        let errDetail = "Upload failed";
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes.detail) errDetail = errRes.detail;
        } catch (e) {}
        reject(new Error(errDetail));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during photo upload"));
    xhr.send(formData);
  });
};

export const getDamagePhotoUrl = (storageKey) => {
  const token = getToken();
  return `${API_BASE_URL}/damages/photos/file/${storageKey}?token=${encodeURIComponent(token || "")}`;
};

export const getDamagePhotoDownloadUrl = (storageKey) => {
  const token = getToken();
  return `${API_BASE_URL}/damages/photos/file/${storageKey}?download=true&token=${encodeURIComponent(token || "")}`;
};

export const createDamageReport = async (damageReportData) => {
  return await fetchApi("/damages/", {
    method: "POST",
    body: JSON.stringify(damageReportData),
  });
};

export const getDamageReports = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      searchParams.append(key, params[key]);
    }
  });
  const queryString = searchParams.toString();
  const endpoint = queryString ? `/damages/?${queryString}` : "/damages/";
  return await fetchApi(endpoint);
};

export const markDamageReplaced = async (damageReportId) => {
  return await fetchApi(`/damages/${damageReportId}/replace`, {
    method: "POST",
  });
};

export const deleteDamagePhoto = async (damageReportId, photoId) => {
  return await fetchApi(`/damages/${damageReportId}/photos/${photoId}`, {
    method: "DELETE",
  });
};

export const getDamageAuditLogs = async () => {
  return await fetchApi("/damages/audit-logs");
};

export const exportDamagesCsvUrl = () => {
  const token = getToken();
  return `${API_BASE_URL}/damages/export/csv?token=${encodeURIComponent(token || "")}`;
};

// --- Sales API ---
export const createSale = async (saleData) => {
  return await fetchApi("/sales/", {
    method: "POST",
    body: JSON.stringify(saleData),
  });
};

export const getSales = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      searchParams.append(key, params[key]);
    }
  });
  const queryString = searchParams.toString();
  const endpoint = queryString ? `/sales/?${queryString}` : "/sales/";
  return await fetchApi(endpoint);
};

// --- Employee API ---
export const getEmployees = async () => {
  return await fetchApi("/employees/");
};

export const createEmployee = async (employeeData) => {
  return await fetchApi("/employees/", {
    method: "POST",
    body: JSON.stringify(employeeData),
  });
};

export const updateEmployee = async (employeeId, employeeData) => {
  return await fetchApi(`/employees/${employeeId}`, {
    method: "PUT",
    body: JSON.stringify(employeeData),
  });
};

export const deleteEmployee = async (employeeId) => {
  return await fetchApi(`/employees/${employeeId}`, {
    method: "DELETE",
  });
};

// --- Location API ---
export const getLocations = async () => {
  return await fetchApi("/locations/");
};

export const createLocation = async (locationData) => {
  return await fetchApi("/locations/", {
    method: "POST",
    body: JSON.stringify(locationData),
  });
};

export const updateLocation = async (locationId, locationData) => {
  return await fetchApi(`/locations/${locationId}`, {
    method: "PUT",
    body: JSON.stringify(locationData),
  });
};

export const deleteLocation = async (locationId) => {
  return await fetchApi(`/locations/${locationId}`, {
    method: "DELETE",
  });
};

export const searchRealLocations = async (query) => {
  if (!query || query.trim().length < 2) return [];
  return await fetchApi(`/locations/search-real?q=${encodeURIComponent(query.trim())}`);
};

export const resolveRealLocation = async (locationData) => {
  return await fetchApi("/locations/resolve-real", {
    method: "POST",
    body: JSON.stringify(locationData),
  });
};

// --- Live Location Telemetry API ---
export const getLiveLocations = async () => {
  return await fetchApi("/employees/live-locations");
};

export const updateLiveLocation = async (coordinates) => {
  return await fetchApi("/employees/live-location", {
    method: "POST",
    body: JSON.stringify(coordinates),
  });
};

export const resetEmployeePassword = async (employeeId, password) => {
  return await fetchApi(`/employees/${employeeId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
};

export const getProducts = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      searchParams.append(key, params[key]);
    }
  });
  const queryString = searchParams.toString();
  const endpoint = queryString ? `/products/?${queryString}` : "/products/";
  return await fetchApi(endpoint);
};

export const createProduct = async (productData) => {
  return await fetchApi("/products/", {
    method: "POST",
    body: JSON.stringify(productData),
  });
};

// --- Inventory API ---
export const getInventories = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      searchParams.append(key, params[key]);
    }
  });
  const queryString = searchParams.toString();
  const endpoint = queryString ? `/inventory/?${queryString}` : "/inventory/";
  return await fetchApi(endpoint);
};

export const updateStock = async (stockData) => {
  return await fetchApi("/inventory/update-stock", {
    method: "POST",
    body: JSON.stringify(stockData),
  });
};

export const resetInventoryToZero = async (locationId = null) => {
  const url = locationId ? `/inventory/reset-to-zero?location_id=${locationId}` : "/inventory/reset-to-zero";
  return await fetchApi(url, {
    method: "POST",
  });
};


// --- Dashboard Stats API ---
export const getAdminDashboardStats = async () => {
  return await fetchApi("/admin/dashboard/stats");
};

export const getEmployeeDashboardStats = async (employeeId) => {
  return await fetchApi(`/employees/dashboard/${employeeId}`);
};

export default {
  getToken,
  setToken,
  removeToken,
  fetchApi,
  loginApi,
  getMe,
  uploadDamagePhoto,
  getDamagePhotoUrl,
  getDamagePhotoDownloadUrl,
  createDamageReport,
  getDamageReports,
  markDamageReplaced,
  deleteDamagePhoto,
  getDamageAuditLogs,
  exportDamagesCsvUrl,
  createSale,
  getSales,
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getLocations,
  createLocation,
  getProducts,
  createProduct,
  getInventories,
  updateStock,
  resetInventoryToZero,
  getAdminDashboardStats,
  getEmployeeDashboardStats,
};
