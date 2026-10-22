import React, { createContext, useState, useContext, useEffect } from "react";
import { loginApi, getMe, setToken, removeToken, getToken } from "../services/api";

const AuthContext = createContext();

let pendingRefresh = null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session from backend on load
  useEffect(() => {
    const restoreSession = async () => {
      const token = getToken();
      if (token) {
        try {
          const userData = await getMe();
          setUser(userData);
        } catch (err) {
          console.warn("Session expired or invalid token:", err);
          removeToken();
          setUser(null);
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, []);

  const login = async (credentials) => {
    const response = await loginApi(credentials);
    if (response && response.access_token) {
      setToken(response.access_token);
      setUser(response.user);
      return response.user;
    }
    throw new Error("Invalid response from server");
  };

  const refreshUser = async () => {
    const token = getToken();
    if (!token) return null;
    if (pendingRefresh) return pendingRefresh;

    pendingRefresh = (async () => {
      try {
        const userData = await getMe();
        setUser(userData);
        return userData;
      } catch (err) {
        console.warn("Failed to refresh user profile:", err);
        return null;
      } finally {
        setTimeout(() => {
          pendingRefresh = null;
        }, 1500);
      }
    })();
    return pendingRefresh;
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAdmin: user?.role === "admin",
    isEmployee: user?.role === "employee",
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
