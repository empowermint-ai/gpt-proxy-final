import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

const app = express();

// ---- CORS (dev + prod frontends) ----
// Only uses built-in deps (no extras) to avoid build issues.
const ALLOWLIST = ["http://localhost:5173", "https://empowermint-pwa.vercel.app"];
const corsOptions = {
  origin(origin, cb) {
    // allow non-browser tools like curl/postman (no Origin header)
    if (!origin) return cb(null, true);
    return cb(null, ALLOWLIST.includes(origin));
  },
  methods: ["POST", "OPTIONS", "GET"],
  allowedHeaders: ["Content-Type"],
};
app.use(cors(corsOptions));
// explicit preflight for all routes (esp. /ask)
app.options("*", cors(corsOptions));

// ---- Body parsing ----
app.use(express.json({ limit: "1mb" }));

// ---- Utils ----
const cleanText = (txt = "") =>
  (txt || "")
    .replace(/\*\*/g, "")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\\[|\]/g, "")
    .replace(/\\\(|\\\)/g, "")
    .trim();

// ---- Health & helpful routes ----
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "empowermint-gpt-proxy",
    endpoints: ["POST /ask", "GET /healthz"],
  });
});

app.get("/healthz", (_req, res) => {
  const ok = Boolean(process.env.OPENAI_API_KEY);
  res.status(ok ? 200 : 500).json({
    ok,
    openaiKey: ok ? "present" : "missing",
  });
});

// ---- OpenAI client ----
if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY is not set. /healthz will return 500 until it is configured.");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Main endpoint ----
app.post("/ask", async (req, res) => {
  try {
    const { prompt, mode } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }
    if (!mode || (mode !== "exam" && mode !== "tldr")) {
      return res.status(400).json({ error: "Missing or invalid mode (exam|tldr)" });
    }

    const promptTrim = prompt.trim();
    if (!promptTrim.length) {
      return res.status(400).json({ error: "Empty prompt" });
    }
    if (promptTrim.length > 4000) {
      return res.status(400).json({ error: "Prompt too long (max 4000 chars)" });
    }

    const systemPrompt =
      mode === "exam"
        ? "You are EB, a structured study coach for high school learners. Output plain text only. No Markdown, no LaTeX, no code fences. Be step-by-step, practical, and concise."
        : "You are EB, a motivational coach giving TL;DR summaries for high school learners. Output plain text only. No Markdown, no LaTeX. Keep it crisp and inspiring.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptTrim },
      ],
      temperature: 0.7,
    });

    const raw = completion?.choices?.[0]?.message?.content || "";
    const answer = cleanText(raw);
    return res.json({ answer });
  } catch (err) {
    console.error("Error in /ask:", err?.response?.data || err?.message || err);
    return res.status(500).json({ error: "Server error processing request" });
  }
});

// Helpful 405 for accidental GETs on /ask
app.get("/ask", (_req, res) => {
  res.status(405).json({ error: "Use POST /ask with JSON { prompt, mode }" });
});

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    hint: "POST /ask with JSON { prompt, mode:'exam'|'tldr' }",
  });
});

// ---- Error handler ----
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`empowermint GPT Proxy running on port ${PORT}`));
