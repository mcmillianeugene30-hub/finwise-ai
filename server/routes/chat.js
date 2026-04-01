/**
 * server/routes/chat.js
 * ──────────────────────────────────────────────────────────────
 * AI chat endpoint for FinWise AI.
 *
 * Endpoint:
 *  POST /api/chat — Send a message to the AI financial assistant.
 *
 * The assistant is context-aware: it receives the user's recent
 * expense summary alongside the conversation history so that it
 * can give personalised, data-driven financial advice.
 * ──────────────────────────────────────────────────────────────
 */

"use strict";

const express = require("express");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");

const authMiddleware = require("../middleware/auth");
const Expense = require("../models/Expense");

const router = express.Router();

// ── OpenAI client ─────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 512;

// ── Chat-specific rate limiter ────────────────────────────────
// More restrictive than the global limiter to protect OpenAI quota
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // 20 chat messages per minute per IP
  message: { error: "Too many chat requests. Please slow down." },
});

// ── System prompt factory ─────────────────────────────────────
/**
 * Builds the system prompt for the AI assistant.
 * Injects real expense data so the AI can give contextualised advice.
 *
 * @param {object} expenseSummary - { totalSpent, categoryBreakdown, recentExpenses }
 * @returns {string} System prompt string
 */
const buildSystemPrompt = (expenseSummary) => {
  const { totalSpent, categoryBreakdown, recentExpenses } = expenseSummary;

  const categoryLines = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a) // Sort by highest spend
    .map(([cat, amount]) => `  • ${cat}: $${amount.toFixed(2)}`)
    .join("\n");

  const recentLines = recentExpenses
    .slice(0, 5)
    .map((e) => `  • ${e.title} — $${e.amount.toFixed(2)} (${e.category})`)
    .join("\n");

  return `You are FinWise, a friendly and knowledgeable personal finance assistant. \
Your goal is to help users understand their spending habits, save money, and make smarter financial decisions.

Here is the user's current financial snapshot:

📊 EXPENSE SUMMARY (this month)
Total spent: $${totalSpent.toFixed(2)}

Breakdown by category:
${categoryLines || "  (No expenses recorded yet)"}

Most recent expenses:
${recentLines || "  (No recent expenses)"}

Guidelines:
- Always be encouraging and non-judgmental about spending habits.
- Give specific, actionable advice based on their actual data when relevant.
- If asked about topics unrelated to personal finance, politely redirect.
- Keep responses concise (3–5 sentences unless detail is specifically requested).
- Use plain language — avoid jargon unless the user demonstrates financial literacy.
- Format currency as US dollars with 2 decimal places.`;
};

// ── POST /api/chat ────────────────────────────────────────────
router.post(
  "/",
  authMiddleware,
  chatLimiter,
  [
    body("message")
      .trim()
      .notEmpty().withMessage("Message cannot be empty.")
      .isLength({ max: 1000 }).withMessage("Message must not exceed 1000 characters."),
    body("conversationHistory")
      .optional()
      .isArray({ max: 20 }).withMessage("Conversation history must be an array of up to 20 messages."),
  ],
  async (req, res) => {
    try {
      // 1. Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({
          errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
      }

      const { message, conversationHistory = [] } = req.body;
      const userId = req.user.id;

      // 2. Fetch user's expense summary for context injection
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [expenses, recentExpenses] = await Promise.all([
        // This month's expenses for summary
        Expense.find({ user: userId, date: { $gte: startOfMonth } }).lean(),
        // 5 most recent expenses across all time
        Expense.find({ user: userId }).sort({ date: -1 }).limit(5).lean(),
      ]);

      // Build category breakdown from this month's expenses
      const categoryBreakdown = expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {});

      const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

      const expenseSummary = { totalSpent, categoryBreakdown, recentExpenses };

      // 3. Build the messages array for the OpenAI Chat Completions API
      //    Structure: [system, ...history (max 10 pairs), user message]
      const systemPrompt = buildSystemPrompt(expenseSummary);

      // Sanitise history: only keep valid role/content pairs
      const sanitisedHistory = conversationHistory
        .filter(
          (m) =>
            m &&
            typeof m.content === "string" &&
            ["user", "assistant"].includes(m.role)
        )
        .slice(-20); // Keep last 20 messages (10 turns)

      const messages = [
        { role: "system", content: systemPrompt },
        ...sanitisedHistory,
        { role: "user", content: message },
      ];

      // 4. Call the OpenAI Chat Completions API
      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,     // Balanced creativity / factuality
        presence_penalty: 0.1, // Slight encouragement of topic variety
      });

      const aiReply = completion.choices[0]?.message?.content?.trim();

      if (!aiReply) {
        throw new Error("OpenAI returned an empty response.");
      }

      // 5. Return the AI reply with token usage metadata
      res.json({
        reply: aiReply,
        usage: completion.usage, // { prompt_tokens, completion_tokens, total_tokens }
        model: completion.model,
      });
    } catch (err) {
      // Surface OpenAI-specific errors clearly
      if (err?.status === 429) {
        return res.status(429).json({ error: "AI service is busy. Please try again in a moment." });
      }
      if (err?.status === 401) {
        return res.status(500).json({ error: "AI service configuration error." });
      }

      console.error("[Chat]", err.message);
      res.status(500).json({ error: "Failed to get AI response. Please try again." });
    }
  }
);

module.exports = router;
