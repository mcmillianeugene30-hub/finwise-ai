/**
 * client/src/components/Chat.jsx
 * ──────────────────────────────────────────────────────────────
 * FinWise AI — Chat interface component.
 *
 * Features:
 *  - Full conversation history maintained in local state
 *  - Streams GPT-4 replies (standard response, not streaming API)
 *  - "Typing…" indicator while awaiting AI response
 *  - Auto-scrolls to the latest message
 *  - Suggestion chips for common financial questions
 *  - Renders AI messages with basic markdown-style formatting
 *  - Clears conversation history button
 * ──────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";

// ── Suggestion chips shown on empty state ─────────────────────
const SUGGESTIONS = [
  "How am I doing with my budget this month?",
  "Which category am I overspending on?",
  "Give me 3 tips to reduce my Food & Dining expenses.",
  "What percentage of my income should I save?",
  "How can I build an emergency fund?",
  "Explain the 50/30/20 budgeting rule.",
];

// ── Helpers ───────────────────────────────────────────────────

/** Format an ISO timestamp to a short HH:MM string */
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Very lightweight markdown renderer for AI responses.
 * Handles **bold**, `code`, and newlines only — avoids a full MD parser dep.
 */
const renderMessageContent = (text) => {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Replace **bold** with <strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      // Replace `code` with <code>
      const codeParts = part.split(/(`[^`]+`)/g).map((cp, k) => {
        if (cp.startsWith("`") && cp.endsWith("`")) {
          return (
            <code key={k} className="bg-slate-700 text-emerald-300 px-1 py-0.5 rounded text-xs font-mono">
              {cp.slice(1, -1)}
            </code>
          );
        }
        return cp;
      });
      return <span key={j}>{codeParts}</span>;
    });

    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
};

// ── Message bubble ─────────────────────────────────────────────
const MessageBubble = ({ message }) => {
  const isUser = message.role === "user";
  const isTyping = message.role === "typing";

  if (isTyping) {
    return (
      <div className="flex items-end gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm flex-shrink-0">
          🤖
        </div>
        <div className="bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
          <div className="flex gap-1 items-center h-5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
          isUser ? "bg-indigo-500" : "bg-emerald-500"
        }`}
      >
        {isUser ? "👤" : "🤖"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-slate-700 text-slate-100 rounded-bl-sm"
        }`}
      >
        <p>{isUser ? message.content : renderMessageContent(message.content)}</p>
        <p
          className={`text-xs mt-1.5 ${
            isUser ? "text-indigo-300 text-right" : "text-slate-500"
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
};

// ── Main Chat Component ───────────────────────────────────────
const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  /** Auto-scroll to the latest message whenever the list updates */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Focus the input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Send a message to the backend /api/chat endpoint.
   * @param {string} text - The message text to send
   */
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage = {
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      // Append user message + typing indicator
      setMessages((prev) => [
        ...prev,
        userMessage,
        { role: "typing", content: "", timestamp: new Date().toISOString() },
      ]);
      setInput("");
      setIsLoading(true);

      try {
        // Build history for the API (last 10 messages, exclude typing indicators)
        const history = messages
          .filter((m) => m.role !== "typing")
          .slice(-10)
          .map(({ role, content }) => ({ role, content }));

        const { data } = await axios.post("/api/chat", {
          message: trimmed,
          conversationHistory: history,
        });

        const aiMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };

        // Replace typing indicator with real response
        setMessages((prev) => [...prev.filter((m) => m.role !== "typing"), aiMessage]);
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.role !== "typing"));

        const errMsg =
          err.response?.data?.error || "Failed to get a response. Please try again.";
        toast.error(errMsg);

        // Show error as a system message in the chat
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ ${errMsg}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [messages, isLoading]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (suggestion) => {
    sendMessage(suggestion);
  };

  const clearChat = () => {
    setMessages([]);
    toast.success("Conversation cleared.");
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* ── Page header ── */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-lg">🤖 AI Financial Assistant</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Powered by GPT-4 · Knows your expense history
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            🗑 Clear
          </button>
        )}
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
        {messages.length === 0 ? (
          /* Empty state with suggestion chips */
          <div className="flex flex-col items-center justify-center h-full gap-8 py-12">
            <div className="text-center">
              <div className="text-5xl mb-4">💬</div>
              <h2 className="text-white font-semibold text-xl mb-2">
                Ask your financial assistant
              </h2>
              <p className="text-slate-400 text-sm max-w-sm">
                I have access to your expense data and can help you budget, save, and
                make smarter financial decisions.
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-left bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-emerald-500 text-slate-300 text-sm px-4 py-3 rounded-xl transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation messages */
          <div className="flex flex-col gap-5">
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-3"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask about your spending, budgeting tips… (Enter to send, Shift+Enter for new line)"
            rows={1}
            maxLength={1000}
            disabled={isLoading}
            className="flex-1 bg-slate-700 text-slate-100 placeholder-slate-500 border border-slate-600 focus:border-emerald-500 focus:outline-none rounded-xl px-4 py-3 text-sm resize-none leading-relaxed transition-colors disabled:opacity-60"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium px-5 py-3 rounded-xl text-sm transition-colors flex-shrink-0"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-1" />
            ) : (
              "Send ↑"
            )}
          </button>
        </form>
        <p className="text-center text-slate-600 text-xs mt-2 max-w-3xl mx-auto">
          AI responses are for informational purposes only and do not constitute financial advice.
        </p>
      </div>
    </div>
  );
};

export default Chat;
