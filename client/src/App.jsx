/**
 * client/src/App.jsx
 * ──────────────────────────────────────────────────────────────
 * FinWise AI — Root application component.
 *
 * Responsibilities:
 *  - Global AuthContext: provides user state + login/logout helpers
 *  - Axios interceptor: automatically attaches JWT to every request
 *  - React Router v6 routes: public (Login) and protected (Dashboard, Chat)
 *  - ProtectedRoute: redirects unauthenticated users to /login
 *  - Toaster: global toast notification container
 * ──────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";

import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Chat from "./components/Chat";

// ── Axios base configuration ──────────────────────────────────
// In development the CRA proxy forwards /api/* to localhost:5000
// In production the Express server serves the built client
axios.defaults.baseURL = process.env.REACT_APP_API_URL || "";

// ── Auth Context ──────────────────────────────────────────────
export const AuthContext = createContext(null);

/**
 * Custom hook — consume AuthContext anywhere in the tree.
 * @returns {{ user, token, login, logout, loading }}
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

// ── Auth Provider ─────────────────────────────────────────────
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("fw_token") || null);
  const [loading, setLoading] = useState(true);

  /**
   * Attach or remove the Authorization header on every Axios request.
   * This runs whenever the token changes.
   */
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("fw_token", token);
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem("fw_token");
    }
  }, [token]);

  /**
   * On mount: if a stored token exists, validate it by fetching /api/auth/me.
   * This keeps the user "logged in" across page refreshes.
   */
  useEffect(() => {
    const hydrateUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await axios.get("/api/auth/me");
        setUser(data.user);
      } catch {
        // Token is invalid or expired — clear it silently
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    hydrateUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Persist token + user state after a successful login/register API call.
   * @param {string} newToken
   * @param {object} userData
   */
  const login = useCallback((newToken, userData) => {
    setToken(newToken);
    setUser(userData);
  }, []);

  /**
   * Clear all auth state and redirect to /login (called from Navbar or on 401).
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    toast.success("You've been logged out.");
  }, []);

  // Global 401 interceptor — auto-logout on token expiry
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && token) {
          logout();
          toast.error("Session expired. Please log in again.");
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptorId);
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Protected Route ───────────────────────────────────────────
/**
 * Wrapper component that redirects to /login if the user is not authenticated.
 * Shows a loading spinner while the auth state is being hydrated.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading FinWise…</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};

// ── Navbar ─────────────────────────────────────────────────────
const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
      {/* Brand */}
      <Link to="/dashboard" className="flex items-center gap-2">
        <span className="text-2xl">💰</span>
        <span className="text-white font-bold text-xl tracking-tight">
          Fin<span className="text-emerald-400">Wise</span>
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-6">
        <Link
          to="/dashboard"
          className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
        >
          📊 Dashboard
        </Link>
        <Link
          to="/chat"
          className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
        >
          🤖 AI Chat
        </Link>
      </div>

      {/* User menu */}
      <div className="flex items-center gap-4">
        <span className="text-slate-400 text-sm hidden sm:block">
          👋 {user.name}
        </span>
        <button
          onClick={handleLogout}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-4 py-1.5 rounded-lg transition-colors"
        >
          Log out
        </button>
      </div>
    </nav>
  );
};

// ── App ───────────────────────────────────────────────────────
const App = () => {
  return (
    <AuthProvider>
      <Router>
        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1e293b",
              color: "#f1f5f9",
              border: "1px solid #334155",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#f1f5f9" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" } },
          }}
        />

        {/* Sticky top navigation (only shown when authenticated) */}
        <Navbar />

        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
