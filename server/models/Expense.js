/**
 * server/models/Expense.js
 * ──────────────────────────────────────────────────────────────
 * Mongoose Expense model for FinWise AI.
 *
 * Fields:
 *  - user      : Reference to the owning User (ObjectId)
 *  - title     : Short description of the expense
 *  - amount    : Positive decimal number (stored as Number)
 *  - category  : Enum — one of the predefined categories
 *  - date      : Date the expense was incurred (defaults to now)
 *  - note      : Optional free-text note
 *  - createdAt : Auto-managed by Mongoose timestamps
 *  - updatedAt : Auto-managed by Mongoose timestamps
 * ──────────────────────────────────────────────────────────────
 */

"use strict";

const mongoose = require("mongoose");

// ── Category enum ─────────────────────────────────────────────
// Centralised here so it can be imported in routes for validation
const EXPENSE_CATEGORIES = [
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

// ── Schema definition ─────────────────────────────────────────
const expenseSchema = new mongoose.Schema(
  {
    /**
     * The user who owns this expense.
     * ref: "User" enables Mongoose .populate() calls.
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Expense must belong to a user."],
      index: true,
    },

    title: {
      type: String,
      required: [true, "Title is required."],
      trim: true,
      minlength: [1, "Title cannot be empty."],
      maxlength: [100, "Title must not exceed 100 characters."],
    },

    amount: {
      type: Number,
      required: [true, "Amount is required."],
      min: [0.01, "Amount must be at least $0.01."],
      max: [1_000_000, "Amount must not exceed $1,000,000."],
      // Store as fixed 2-decimal precision
      set: (v) => Math.round(v * 100) / 100,
    },

    category: {
      type: String,
      required: [true, "Category is required."],
      enum: {
        values: EXPENSE_CATEGORIES,
        message: `Category must be one of: ${EXPENSE_CATEGORIES.join(", ")}`,
      },
      index: true,
    },

    date: {
      type: Date,
      required: [true, "Date is required."],
      default: Date.now,
      index: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note must not exceed 500 characters."],
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

// ── Compound indexes ──────────────────────────────────────────

/**
 * Primary query pattern: fetch all expenses for a user sorted by date.
 * This index covers the vast majority of list queries.
 */
expenseSchema.index({ user: 1, date: -1 });

/**
 * Secondary query pattern: filter by user + category (for summaries).
 */
expenseSchema.index({ user: 1, category: 1 });

/**
 * Aggregation pattern: monthly summaries filtered by user + date range.
 */
expenseSchema.index({ user: 1, date: -1, category: 1 });

// ── Virtual fields ────────────────────────────────────────────

/**
 * Formats amount as a USD currency string.
 * e.g. 42.5 → "$42.50"
 */
expenseSchema.virtual("formattedAmount").get(function () {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(this.amount);
});

// ── Static methods ────────────────────────────────────────────

/**
 * Returns the total amount spent by a user within an optional date range.
 *
 * @param {string} userId
 * @param {Date}   [startDate]
 * @param {Date}   [endDate]
 * @returns {Promise<number>}
 */
expenseSchema.statics.getTotalForUser = async function (userId, startDate, endDate) {
  const match = { user: new mongoose.Types.ObjectId(userId) };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }

  const result = await this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return result.length > 0 ? Math.round(result[0].total * 100) / 100 : 0;
};

// ── Model + constants export ──────────────────────────────────
const Expense = mongoose.model("Expense", expenseSchema);

module.exports = Expense;
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
