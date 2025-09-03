// index.js (ES Module compatible for Render)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

// --- CORS (for dev + prod frontends) ---
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://empowermint-pwa.vercel.app",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// --- Health check ---
app.get("/", (_req, res) => {
  res.status(200).send("empowermint gpt proxy is healthy ✅");
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Helper: Strip formatting ---
function stripFormatting(text = "") {
  let out = text;
  out = out.replace(/\*\*(.*?)\*\*/g, "$1");
  out = out.replace(/\*(.*?)\*/g, "$1");
  out = out.replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1");
  out = out.replace(/\\\[|\\\]|\$\$|\$/g, "");
  out = out.replace(/\\text\s*\{([^}]*)\}/g, "$1");
  out = out.replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, "($1) / ($2)");
  out = out.replace(/\\[a-zA-Z]+\s*\{([^}]*)\}/g, "$1");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\\+/g, "");
  return out.trim();
}

// --- Helper: Build system prompt ---
function buildSystemPrompt(mode = "exam") {
  const base = `
You are "EB" — the patient, encouraging tutor in the empowermint PWA for South African high school learners (CAPS/IEB).
Tone: supportive, clear, step-by-step, culturally aware, and action-oriented. Avoid LaTeX, avoid bold markdown.
Use simple ASCII when showing formulas, e.g. (Cost - Residual) / Useful life.

ALWAYS follow this structure:
1) Quick Summary (1–2 lines)
2) Step-by-Step Solution (numbered steps, plain text)
3) Key Formula(s) in simple ASCII
4) Common Mistakes & Tips (2–4 bullets)
5) If relevant: Mini Practice (1 short practice question, no answer)

Rules:
- DO NOT output LaTeX (no \\frac, \\text, \\[ \\], or $...$).
- DO NOT use **bold** or markdown tables.
- Prefer clear headings with plain text like "Summary:", "Steps:", etc.
- Stay within the SA CAPS/IEB syllabus where applicable.
  `.trim();

  const exam = `When mode = "exam", be thorough and methodical. Show working and reasoning clearly.`;
  const tldr = `When mode = "tldr", give a crisp, high-yield explanation first, then a compact set of steps.`;

  return `${base}\n\n${mode === "tldr" ? tldr : exam}`;
}

// --- GPT Route ---
app.post("/ask", async (req, res) => {
  try {
    const { prompt, mode } = req.body || {};
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Missing 'prompt' string." });
    }

    const system = buildSystemPrompt((mode || "exam").toLowerCase());

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 1000,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            prompt +
            "\n\nReminder: DO NOT use LaTeX or Markdown. Return clean ASCII output only.",
        },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content?.toString() || "No answer.";
    const answer = stripFormatting(raw);

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("Error in /ask:", err?.response?.data || err);
    return res.status(500).json({
      error: "Sorry — I couldn't generate a response right now. Please try again.",
    });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`empowermint gpt proxy listening on port ${PORT}`);
});
