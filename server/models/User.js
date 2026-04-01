/**
 * server/models/User.js
 * ──────────────────────────────────────────────────────────────
 * Mongoose User model for FinWise AI.
 *
 * Fields:
 *  - name          : Display name (2–50 chars)
 *  - email         : Unique, lowercased, indexed
 *  - passwordHash  : bcrypt hash — excluded from queries by default
 *  - lastLoginAt   : Timestamp of last successful login
 *  - createdAt     : Auto-managed by Mongoose timestamps
 *  - updatedAt     : Auto-managed by Mongoose timestamps
 * ──────────────────────────────────────────────────────────────
 */

"use strict";

const mongoose = require("mongoose");

// ── Schema definition ─────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [2, "Name must be at least 2 characters."],
      maxlength: [50, "Name must not exceed 50 characters."],
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address.",
      ],
      index: true, // Speeds up login lookups by email
    },

    /**
     * passwordHash is excluded from query results by default (select: false).
     * To include it, callers must explicitly use .select("+passwordHash").
     * This prevents the hash from accidentally leaking in API responses.
     */
    passwordHash: {
      type: String,
      required: [true, "Password hash is required."],
      select: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    // Automatically add createdAt and updatedAt fields
    timestamps: true,

    // Remove the version key (__v) from documents
    versionKey: false,

    // Transform toJSON output to omit internal fields
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.passwordHash; // Safety net
        return ret;
      },
    },
  }
);

// ── Indexes ───────────────────────────────────────────────────
// Compound index for sorting users by creation date (admin dashboards, etc.)
userSchema.index({ createdAt: -1 });

// ── Static methods ────────────────────────────────────────────

/**
 * Find a user by email, including the passwordHash field.
 * Used exclusively during login.
 *
 * @param {string} email
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select("+passwordHash");
};

// ── Instance methods ──────────────────────────────────────────

/**
 * Returns a safe public representation of the user.
 * Never includes passwordHash.
 *
 * @returns {object}
 */
userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

// ── Model export ──────────────────────────────────────────────
const User = mongoose.model("User", userSchema);

module.exports = User;
