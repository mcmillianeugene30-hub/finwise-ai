/**
 * client/src/components/Login.jsx
 * ──────────────────────────────────────────────────────────────
 * FinWise AI — Authentication form component.
 *
 * Handles both Login and Register in a single component by
 * toggling between two modes with a tab-style switcher.
 *
 * Features:
 *  - Toggle between Login and Register modes
 *  - Client-side validation with inline field errors
 *  - Password strength indicator (register mode)
 *  - Show/hide password toggle
 *  - Loading state with spinner
 *  - Redirects to /dashboard on success
 *  - Redirects already-authenticated users away from this page
 * ──────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../App";

// ── Password strength helpers ─────────────────────────────────
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: "Very weak", color: "bg-red-500" },
    { label: "Weak",      color: "bg-orange-500" },
    { label: "Fair",      color: "bg-yellow-500" },
    { label: "Good",      color: "bg-blue-500" },
    { label: "Strong",    color: "bg-emerald-500" },
  ];
  return { score, ...levels[Math.min(score - 1, 4)] };
};

// ── Input Field ───────────────────────────────────────────────
const FormField = ({ label, name, type = "text", value, onChange, error, placeholder, children }) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={name} className="text-slate-300 text-sm font-medium">
      {label}
    </label>
    <div className="relative">
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={name === "password" ? "current-password" : name}
        className={`w-full bg-slate-700 border ${
          error ? "border-red-500" : "border-slate-600 focus:border-emerald-500"
        } text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors pr-${children ? "10" : "4"}`}
      />
      {children}
    </div>
    {error && <p className="text-red-400 text-xs">{error}</p>}
  </div>
);

// ── Login Component ───────────────────────────────────────────
const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form values
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  // Inline field errors
  const [fieldErrors, setFieldErrors] = useState({});

  // Redirect already-authenticated users
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  // Reset form + errors when switching modes
  const switchMode = (newMode) => {
    setMode(newMode);
    setForm({ name: "", email: "", password: "" });
    setFieldErrors({});
    setShowPassword(false);
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    // Clear the error for this field as the user types
    if (fieldErrors[e.target.name]) {
      setFieldErrors((fe) => ({ ...fe, [e.target.name]: "" }));
    }
  };

  // ── Client-side validation ──────────────────────────────────
  const validate = () => {
    const errors = {};

    if (mode === "register") {
      if (!form.name.trim()) errors.name = "Name is required.";
      else if (form.name.trim().length < 2) errors.name = "Name must be at least 2 characters.";
    }

    if (!form.email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!form.password) {
      errors.password = "Password is required.";
    } else if (mode === "register" && form.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    } else if (
      mode === "register" &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)
    ) {
      errors.password =
        "Password must contain uppercase, lowercase, and a number.";
    }

    return errors;
  };

  // ── Form submission ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };

      const { data } = await axios.post(endpoint, payload);

      login(data.token, data.user);
      toast.success(
        mode === "login"
          ? `Welcome back, ${data.user.name}! 👋`
          : `Account created! Welcome to FinWise, ${data.user.name}! 🎉`
      );
      navigate("/dashboard");
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      const serverMessage = err.response?.data?.error;

      if (serverErrors && Array.isArray(serverErrors)) {
        // Map server validation errors back to field names
        const mapped = {};
        serverErrors.forEach(({ field, message }) => {
          mapped[field] = message;
        });
        setFieldErrors(mapped);
      } else if (serverMessage) {
        toast.error(serverMessage);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = mode === "register" ? getPasswordStrength(form.password) : null;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💰</div>
          <h1 className="text-white font-bold text-3xl tracking-tight">
            Fin<span className="text-emerald-400">Wise</span> AI
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Your personal AI-powered finance companion
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

          {/* Mode tabs */}
          <div className="flex border-b border-slate-700">
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-4 text-sm font-medium transition-colors capitalize ${
                  mode === m
                    ? "text-white bg-slate-800 border-b-2 border-emerald-500"
                    : "text-slate-400 bg-slate-900 hover:text-slate-200"
                }`}
              >
                {m === "login" ? "🔑 Sign In" : "✨ Create Account"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5" noValidate>

            {/* Name field (register only) */}
            {mode === "register" && (
              <FormField
                label="Full Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Smith"
                error={fieldErrors.name}
              />
            )}

            {/* Email */}
            <FormField
              label="Email Address"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              error={fieldErrors.email}
            />

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-slate-300 text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder={mode === "login" ? "Your password" : "Min. 8 characters"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={`w-full bg-slate-700 border ${
                    fieldErrors.password
                      ? "border-red-500"
                      : "border-slate-600 focus:border-emerald-500"
                  } text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors pr-12`}
                />
                {/* Show/hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-lg"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-red-400 text-xs">{fieldErrors.password}</p>
              )}

              {/* Password strength bar (register only) */}
              {mode === "register" && form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.score ? strength.color : "bg-slate-600"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Strength:{" "}
                    <span
                      className={
                        strength.score >= 4 ? "text-emerald-400" :
                        strength.score >= 3 ? "text-yellow-400" : "text-red-400"
                      }
                    >
                      {strength.label}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                mode === "login" ? "Sign In →" : "Create Account →"
              )}
            </button>

            {/* Mode switch hint */}
            <p className="text-center text-slate-400 text-xs">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    Create one for free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          FinWise AI · Personal finance, powered by GPT-4
        </p>
      </div>
    </div>
  );
};

export default Login;
