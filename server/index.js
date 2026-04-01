/**
 * server/index.js
 * ──────────────────────────────────────────────────────────────
 * FinWise AI — Express server entry point.
 *
 * Responsibilities:
 *  - Load environment variables via dotenv
 *  - Connect to MongoDB with Mongoose
 *  - Register global middleware (helmet, cors, morgan, JSON parser)
 *  - Mount API route groups
 *  - Serve the React production build in production mode
 *  - Global error handler
 * ──────────────────────────────────────────────────────────────
 */

"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

// ── Route imports ────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const expenseRoutes = require("./routes/expenses");

// ── App initialisation ───────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ── Security middleware ──────────────────────────────────────
// Helmet sets a variety of security-related HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: NODE_ENV === "production" ? undefined : false,
  })
);

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || "http://localhost:3000",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman) in development
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  })
);

// ── Request logging ──────────────────────────────────────────
// Use 'combined' format in production for richer logs; 'dev' for development
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

// ── Body parsers ─────────────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // Reject payloads > 10 KB
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ── Global rate limiter ──────────────────────────────────────
// Limits each IP to 100 requests per 15-minute window
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", globalLimiter);

// ── API routes ───────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/expenses", expenseRoutes);

// ── Health check ─────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Serve React build in production ──────────────────────────
if (NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "../client/build");
  app.use(express.static(buildPath));

  // Return the React app for any non-API route (client-side routing)
  app.get("*", (_req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

// ── Global error handler ─────────────────────────────────────
// Must be defined after all routes; Express identifies it by the 4-arg signature
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[GlobalErrorHandler]", err.stack || err.message);

  const statusCode = err.statusCode || err.status || 500;
  const message =
    NODE_ENV === "production" && statusCode === 500
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(statusCode).json({ error: message });
});

// ── MongoDB connection + server start ────────────────────────
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 8+ no longer needs these flags, but shown for clarity
    });
    console.log("✅  MongoDB connected:", mongoose.connection.host);

    app.listen(PORT, () => {
      console.log(`🚀  FinWise AI server running on http://localhost:${PORT}`);
      console.log(`    Environment : ${NODE_ENV}`);
    });
  } catch (err) {
    console.error("❌  MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections gracefully
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});

startServer();

module.exports = app; // Export for testing
