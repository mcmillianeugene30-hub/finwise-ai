/**
 * server/routes/expenses.js
 * ──────────────────────────────────────────────────────────────
 * Expense CRUD routes for FinWise AI.
 *
 * All routes require a valid JWT (enforced by authMiddleware).
 * Users can only access their own expenses.
 *
 * Endpoints:
 *  GET    /api/expenses           — List expenses (with filters)
 *  GET    /api/expenses/summary   — Category totals for a period
 *  POST   /api/expenses           — Create a new expense
 *  PUT    /api/expenses/:id       — Update an expense
 *  DELETE /api/expenses/:id       — Delete an expense
 * ──────────────────────────────────────────────────────────────
 */

"use strict";

const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const mongoose = require("mongoose");

const authMiddleware = require("../middleware/auth");
const Expense = require("../models/Expense");

const router = express.Router();

// All expense routes are protected
router.use(authMiddleware);

// ── Helpers ───────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "Food & Dining",
  "Transport",
  "Housing",
  "Utilities",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Education",
  "Travel",
  "Personal Care",
  "Investments",
  "Other",
];

/** Returns formatted express-validator errors or null */
const getErrors = (req) => {
  const result = validationResult(req);
  return result.isEmpty()
    ? null
    : { errors: result.array().map((e) => ({ field: e.path, message: e.msg })) };
};

/** Checks that an ID is a valid MongoDB ObjectId */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── GET /api/expenses ─────────────────────────────────────────
router.get(
  "/",
  [
    query("category").optional().isIn(VALID_CATEGORIES).withMessage("Invalid category."),
    query("startDate").optional().isISO8601().withMessage("startDate must be a valid ISO 8601 date."),
    query("endDate").optional().isISO8601().withMessage("endDate must be a valid ISO 8601 date."),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100."),
    query("sort").optional().isIn(["date", "-date", "amount", "-amount"]).withMessage("Invalid sort field."),
  ],
  async (req, res) => {
    try {
      const errors = getErrors(req);
      if (errors) return res.status(422).json(errors);

      const {
        category,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sort = "-date",
      } = req.query;

      // Build dynamic filter object
      const filter = { user: req.user.id };
      if (category) filter.category = category;
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Run count and data queries concurrently for efficiency
      const [total, expenses] = await Promise.all([
        Expense.countDocuments(filter),
        Expense.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
      ]);

      res.json({
        data: expenses,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      console.error("[Expenses/GET]", err.message);
      res.status(500).json({ error: "Failed to fetch expenses." });
    }
  }
);

// ── GET /api/expenses/summary ─────────────────────────────────
// Returns totals grouped by category for dashboard charts
router.get("/summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = { user: new mongoose.Types.ObjectId(req.user.id) };
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const summary = await Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
        },
      },
      { $sort: { total: -1 } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          total: { $round: ["$total", 2] },
          count: 1,
          avgAmount: { $round: ["$avgAmount", 2] },
        },
      },
    ]);

    const grandTotal = summary.reduce((sum, item) => sum + item.total, 0);

    res.json({
      summary,
      grandTotal: Math.round(grandTotal * 100) / 100,
    });
  } catch (err) {
    console.error("[Expenses/summary]", err.message);
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

// ── POST /api/expenses ────────────────────────────────────────
router.post(
  "/",
  [
    body("title")
      .trim()
      .notEmpty().withMessage("Title is required.")
      .isLength({ max: 100 }).withMessage("Title must not exceed 100 characters."),
    body("amount")
      .notEmpty().withMessage("Amount is required.")
      .isFloat({ min: 0.01, max: 1_000_000 }).withMessage("Amount must be between $0.01 and $1,000,000."),
    body("category")
      .notEmpty().withMessage("Category is required.")
      .isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(", ")}`),
    body("date")
      .optional()
      .isISO8601().withMessage("date must be a valid ISO 8601 date."),
    body("note")
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage("Note must not exceed 500 characters."),
  ],
  async (req, res) => {
    try {
      const errors = getErrors(req);
      if (errors) return res.status(422).json(errors);

      const { title, amount, category, date, note } = req.body;

      const expense = await Expense.create({
        user: req.user.id,
        title,
        amount: parseFloat(amount),
        category,
        date: date ? new Date(date) : new Date(),
        note: note || "",
      });

      res.status(201).json({ data: expense });
    } catch (err) {
      console.error("[Expenses/POST]", err.message);
      res.status(500).json({ error: "Failed to create expense." });
    }
  }
);

// ── PUT /api/expenses/:id ─────────────────────────────────────
router.put(
  "/:id",
  [
    param("id").custom((v) => isValidObjectId(v)).withMessage("Invalid expense ID."),
    body("title")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage("Title must be between 1 and 100 characters."),
    body("amount")
      .optional()
      .isFloat({ min: 0.01, max: 1_000_000 }).withMessage("Amount must be between $0.01 and $1,000,000."),
    body("category")
      .optional()
      .isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(", ")}`),
    body("date")
      .optional()
      .isISO8601().withMessage("date must be a valid ISO 8601 date."),
    body("note")
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage("Note must not exceed 500 characters."),
  ],
  async (req, res) => {
    try {
      const errors = getErrors(req);
      if (errors) return res.status(422).json(errors);

      // Find expense that belongs to the current user (prevents access to others' data)
      const expense = await Expense.findOne({ _id: req.params.id, user: req.user.id });
      if (!expense) {
        return res.status(404).json({ error: "Expense not found." });
      }

      // Only update fields that were provided in the request body
      const allowedFields = ["title", "amount", "category", "date", "note"];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          expense[field] = field === "amount" ? parseFloat(req.body[field]) : req.body[field];
        }
      });

      await expense.save();

      res.json({ data: expense });
    } catch (err) {
      console.error("[Expenses/PUT]", err.message);
      res.status(500).json({ error: "Failed to update expense." });
    }
  }
);

// ── DELETE /api/expenses/:id ──────────────────────────────────
router.delete(
  "/:id",
  [param("id").custom((v) => isValidObjectId(v)).withMessage("Invalid expense ID.")],
  async (req, res) => {
    try {
      const errors = getErrors(req);
      if (errors) return res.status(422).json(errors);

      const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user.id });
      if (!expense) {
        return res.status(404).json({ error: "Expense not found." });
      }

      res.json({ message: "Expense deleted successfully.", id: req.params.id });
    } catch (err) {
      console.error("[Expenses/DELETE]", err.message);
      res.status(500).json({ error: "Failed to delete expense." });
    }
  }
);

module.exports = router;
