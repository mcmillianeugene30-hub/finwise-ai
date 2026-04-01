/**
 * server/routes/auth.js
 * ──────────────────────────────────────────────────────────────
 * Authentication routes for FinWise AI.
 *
 * Endpoints:
 *  POST /api/auth/register  — Create a new user account
 *  POST /api/auth/login     — Authenticate and receive a JWT
 *  GET  /api/auth/me        — Get current user profile (protected)
 * ──────────────────────────────────────────────────────────────
 */

"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────

/**
 * Signs a JWT for the given user ID.
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {string} Signed JWT token
 */
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Extracts and formats validation errors from express-validator.
 * @param {object} req - Express request
 * @returns {{ errors: Array }|null} Null if no errors, error object otherwise
 */
const getValidationErrors = (req) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return { errors: result.array().map((e) => ({ field: e.path, message: e.msg })) };
  }
  return null;
};

// ── POST /api/auth/register ───────────────────────────────────
router.post(
  "/register",
  [
    body("name")
      .trim()
      .notEmpty().withMessage("Name is required")
      .isLength({ min: 2, max: 50 }).withMessage("Name must be between 2 and 50 characters"),
    body("email")
      .trim()
      .notEmpty().withMessage("Email is required")
      .isEmail().withMessage("Please provide a valid email address")
      .normalizeEmail(),
    body("password")
      .notEmpty().withMessage("Password is required")
      .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  ],
  async (req, res) => {
    try {
      // 1. Validate input
      const errors = getValidationErrors(req);
      if (errors) return res.status(422).json(errors);

      const { name, email, password } = req.body;

      // 2. Check for duplicate email
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }

      // 3. Hash password (salt rounds: 12 — good balance of security vs. speed)
      const passwordHash = await bcrypt.hash(password, 12);

      // 4. Persist new user
      const user = await User.create({ name, email, passwordHash });

      // 5. Issue JWT
      const token = signToken(user._id.toString());

      // 6. Return token + public user data (never return passwordHash)
      res.status(201).json({
        message: "Account created successfully.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      console.error("[Auth/register]", err.message);
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  }
);

// ── POST /api/auth/login ──────────────────────────────────────
router.post(
  "/login",
  [
    body("email")
      .trim()
      .notEmpty().withMessage("Email is required")
      .isEmail().withMessage("Please provide a valid email address")
      .normalizeEmail(),
    body("password")
      .notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      // 1. Validate input
      const errors = getValidationErrors(req);
      if (errors) return res.status(422).json(errors);

      const { email, password } = req.body;

      // 2. Look up user — include passwordHash for comparison (+select override)
      const user = await User.findOne({ email }).select("+passwordHash");
      if (!user) {
        // Use a generic message to avoid user-enumeration attacks
        return res.status(401).json({ error: "Invalid email or password." });
      }

      // 3. Compare submitted password with stored hash
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      // 4. Update last-login timestamp
      user.lastLoginAt = new Date();
      await user.save({ validateBeforeSave: false });

      // 5. Issue JWT
      const token = signToken(user._id.toString());

      res.json({
        message: "Login successful.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      console.error("[Auth/login]", err.message);
      res.status(500).json({ error: "Login failed. Please try again." });
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────
// Returns the currently authenticated user's profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // req.user is attached by the authMiddleware
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user });
  } catch (err) {
    console.error("[Auth/me]", err.message);
    res.status(500).json({ error: "Could not fetch profile." });
  }
});

module.exports = router;
