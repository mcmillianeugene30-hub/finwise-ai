/**
 * server/middleware/auth.js
 * ──────────────────────────────────────────────────────────────
 * JWT Authentication Middleware for FinWise AI.
 *
 * Usage:
 *   const authMiddleware = require('./middleware/auth');
 *   router.get('/protected', authMiddleware, handler);
 *
 * What it does:
 *  1. Extracts the Bearer token from the Authorization header.
 *  2. Verifies the token's signature and expiry using JWT_SECRET.
 *  3. Confirms the user still exists in the database.
 *  4. Attaches { id, email, name } to req.user for downstream handlers.
 *
 * Responds with 401 Unauthorized on any failure so that route
 * handlers can trust req.user is always populated when they run.
 * ──────────────────────────────────────────────────────────────
 */

"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Express middleware that enforces JWT authentication.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const authMiddleware = async (req, res, next) => {
  try {
    // ── 1. Extract the token ────────────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required. Please provide a Bearer token.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token || token.trim() === "") {
      return res.status(401).json({ error: "Authentication token is missing." });
    }

    // ── 2. Verify the token ─────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Your session has expired. Please log in again.",
          code: "TOKEN_EXPIRED",
        });
      }
      if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({
          error: "Invalid authentication token.",
          code: "TOKEN_INVALID",
        });
      }
      // Any other JWT error
      return res.status(401).json({ error: "Authentication failed." });
    }

    // ── 3. Verify user still exists ─────────────────────────
    // This guards against tokens that were issued to since-deleted accounts.
    const user = await User.findById(decoded.id).select("id name email");

    if (!user) {
      return res.status(401).json({
        error: "The account associated with this token no longer exists.",
        code: "USER_NOT_FOUND",
      });
    }

    // ── 4. Attach user to request ───────────────────────────
    // Downstream route handlers can trust req.user is set.
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    };

    next();
  } catch (err) {
    // Catch-all for unexpected errors (e.g. DB connection issue during user lookup)
    console.error("[AuthMiddleware] Unexpected error:", err.message);
    res.status(500).json({ error: "Authentication check failed." });
  }
};

module.exports = authMiddleware;
