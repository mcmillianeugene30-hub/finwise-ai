/**
 * client/src/components/Dashboard.jsx
 * ──────────────────────────────────────────────────────────────
 * FinWise AI — Expense Dashboard component.
 *
 * Features:
 *  - Summary cards: total spent, top category, expense count
 *  - Doughnut chart of spending by category (Chart.js)
 *  - Paginated, filterable expense table
 *  - Add Expense modal (inline form)
 *  - Edit expense inline
 *  - Delete expense with confirmation
 *  - Date range + category filters
 * ──────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

// ── Constants ─────────────────────────────────────────────────
const CATEGORIES = [
  "Food & Dining", "Transport", "Housing", "Utilities",
  "Entertainment", "Healthcare", "Shopping", "Education",
  "Travel", "Personal Care", "Investments", "Other",
];

const CATEGORY_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
  "#ec4899", "#14b8a6", "#6366f1", "#94a3b8",
];

const EMPTY_FORM = {
  title: "", amount: "", category: "Food & Dining", date: "", note: "",
};

// ── Helpers ───────────────────────────────────────────────────
const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ── Summary Card ──────────────────────────────────────────────
const SummaryCard = ({ icon, label, value, sub, color }) => (
  <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${color}`}>
        {icon}
      </div>
      <span className="text-slate-400 text-sm font-medium">{label}</span>
    </div>
    <p className="text-white font-bold text-2xl">{value}</p>
    {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
  </div>
);

// ── Expense Row ───────────────────────────────────────────────
const ExpenseRow = ({ expense, onEdit, onDelete }) => (
  <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
    <td className="py-3 px-4">
      <p className="text-white text-sm font-medium">{expense.title}</p>
      {expense.note && <p className="text-slate-500 text-xs mt-0.5 truncate max-w-[200px]">{expense.note}</p>}
    </td>
    <td className="py-3 px-4">
      <span className="bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-full">
        {expense.category}
      </span>
    </td>
    <td className="py-3 px-4 text-slate-400 text-sm">{formatDate(expense.date)}</td>
    <td className="py-3 px-4 text-right">
      <span className="text-emerald-400 font-semibold text-sm">
        {formatCurrency(expense.amount)}
      </span>
    </td>
    <td className="py-3 px-4 text-right">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onEdit(expense)}
          className="text-slate-400 hover:text-white text-xs px-3 py-1 rounded-lg hover:bg-slate-600 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(expense)}
          className="text-red-400 hover:text-red-300 text-xs px-3 py-1 rounded-lg hover:bg-red-900/30 transition-colors"
        >
          Delete
        </button>
      </div>
    </td>
  </tr>
);

// ── Expense Form Modal ─────────────────────────────────────────
const ExpenseModal = ({ isOpen, onClose, onSave, editingExpense }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingExpense) {
      setForm({
        title: editingExpense.title,
        amount: editingExpense.amount,
        category: editingExpense.category,
        date: editingExpense.date ? editingExpense.date.split("T")[0] : "",
        note: editingExpense.note || "",
      });
    } else {
      setForm({ ...EMPTY_FORM, date: new Date().toISOString().split("T")[0] });
    }
  }, [editingExpense, isOpen]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount || !form.category) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    await onSave(form, editingExpense?._id || editingExpense?.id);
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-white font-semibold text-lg mb-5">
          {editingExpense ? "✏️ Edit Expense" : "➕ Add Expense"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1">
              Title *
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Grocery run"
              className="w-full bg-slate-700 border border-slate-600 focus:border-emerald-500 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none"
              required
              maxLength={100}
            />
          </div>

          {/* Amount + Category (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">
                Amount ($) *
              </label>
              <input
                name="amount"
                type="number"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                className="w-full bg-slate-700 border border-slate-600 focus:border-emerald-500 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">
                Category *
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full bg-slate-700 border border-slate-600 focus:border-emerald-500 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1">Date</label>
            <input
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              className="w-full bg-slate-700 border border-slate-600 focus:border-emerald-500 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1">
              Note (optional)
            </label>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Any additional details…"
              rows={2}
              maxLength={500}
              className="w-full bg-slate-700 border border-slate-600 focus:border-emerald-500 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition-colors"
            >
              {saving ? "Saving…" : editingExpense ? "Save Changes" : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────
const Dashboard = () => {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [filters, setFilters] = useState({ category: "", startDate: "", endDate: "" });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // ── Data fetching ───────────────────────────────────────────
  const fetchExpenses = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 10, sort: "-date", ...filters };
      // Remove empty filter params
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);

      const { data } = await axios.get("/api/expenses", { params });
      setExpenses(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error("Failed to load expenses.");
    }
  }, [filters]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const { data } = await axios.get("/api/expenses/summary", { params });
      setSummary(data.summary || []);
    } catch {
      // Non-critical — silently fail
    }
  }, [filters]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchExpenses(1), fetchSummary()]);
      setLoading(false);
    };
    load();
  }, [fetchExpenses, fetchSummary]);

  // ── CRUD handlers ───────────────────────────────────────────
  const handleSave = async (form, id) => {
    try {
      if (id) {
        await axios.put(`/api/expenses/${id}`, form);
        toast.success("Expense updated!");
      } else {
        await axios.post("/api/expenses", form);
        toast.success("Expense added!");
      }
      setModalOpen(false);
      setEditingExpense(null);
      await Promise.all([fetchExpenses(pagination.page), fetchSummary()]);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save expense.");
    }
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`Delete "${expense.title}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/expenses/${expense._id || expense.id}`);
      toast.success("Expense deleted.");
      await Promise.all([fetchExpenses(pagination.page), fetchSummary()]);
    } catch {
      toast.error("Failed to delete expense.");
    }
  };

  const openAdd = () => { setEditingExpense(null); setModalOpen(true); };
  const openEdit = (exp) => { setEditingExpense(exp); setModalOpen(true); };

  // ── Chart data ──────────────────────────────────────────────
  const chartData = {
    labels: summary.map((s) => s.category),
    datasets: [{
      data: summary.map((s) => s.total),
      backgroundColor: CATEGORY_COLORS.slice(0, summary.length),
      borderColor: "#1e293b",
      borderWidth: 3,
      hoverOffset: 6,
    }],
  };

  const chartOptions = {
    cutout: "65%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
        },
      },
    },
  };

  const grandTotal = summary.reduce((s, i) => s + i.total, 0);
  const topCategory = summary[0]?.category || "—";

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8">
      <div className="max-w-6xl mx-auto">

        {/* Page title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white font-bold text-2xl">📊 Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Track and manage your expenses</p>
          </div>
          <button
            onClick={openAdd}
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            + Add Expense
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard
            icon="💸"
            label="Total Spent"
            value={formatCurrency(grandTotal)}
            sub="Based on current filters"
            color="bg-emerald-500/20 text-emerald-400"
          />
          <SummaryCard
            icon="🏆"
            label="Top Category"
            value={topCategory}
            sub={summary[0] ? formatCurrency(summary[0].total) : "No data"}
            color="bg-amber-500/20 text-amber-400"
          />
          <SummaryCard
            icon="🧾"
            label="Total Expenses"
            value={pagination.total}
            sub="Matching current filters"
            color="bg-indigo-500/20 text-indigo-400"
          />
        </div>

        {/* Chart + Category breakdown */}
        {summary.length > 0 && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-8">
            <h2 className="text-white font-semibold mb-5">Spending by Category</h2>
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Doughnut chart */}
              <div className="w-48 h-48 flex-shrink-0">
                <Doughnut data={chartData} options={chartOptions} />
              </div>
              {/* Legend */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {summary.map((item, idx) => (
                  <div key={item.category} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[idx] }}
                      />
                      <span className="text-slate-300 text-xs">{item.category}</span>
                    </div>
                    <span className="text-emerald-400 text-xs font-semibold">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-xs">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-xs">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-xs">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
          {(filters.category || filters.startDate || filters.endDate) && (
            <button
              onClick={() => setFilters({ category: "", startDate: "", endDate: "" })}
              className="text-slate-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Expense table */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-slate-400">No expenses found.</p>
              <button onClick={openAdd} className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm">
                Add your first expense →
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="py-3 px-4 text-slate-400 text-xs font-medium">EXPENSE</th>
                  <th className="py-3 px-4 text-slate-400 text-xs font-medium">CATEGORY</th>
                  <th className="py-3 px-4 text-slate-400 text-xs font-medium">DATE</th>
                  <th className="py-3 px-4 text-slate-400 text-xs font-medium text-right">AMOUNT</th>
                  <th className="py-3 px-4 text-slate-400 text-xs font-medium text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <ExpenseRow
                    key={exp._id || exp.id}
                    expense={exp}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 py-4 border-t border-slate-700">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => fetchExpenses(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    p === pagination.page
                      ? "bg-emerald-500 text-white"
                      : "text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      <ExpenseModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingExpense(null); }}
        onSave={handleSave}
        editingExpense={editingExpense}
      />
    </div>
  );
};

export default Dashboard;
