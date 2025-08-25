import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();
const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("empowermint GPT proxy is live.");
});

// ✅ Custom system prompt based on mode
function getSystemPrompt(mode) {
  if (mode === "exam") {
    return `
You are EB, a motivational study coach and tutor from empowermint 🌱.
Answer this Grade 12 Accounting, Math, or Science question like you're helping a learner before an exam:
- Be clear, calm, and encouraging 🧘
- Break things down step-by-step ➗
- Use relatable real-life examples 💡
- Explain any formula in plain words: e.g. (Cost - Value) ÷ Life
- End with a summary tip or what to revise next 🎯
- Use emojis to keep it warm, not robotic — but don't overdo it.

Always speak with empathy and empowerment. Make the learner feel they can do this 💪.
    `;
  }

  if (mode === "tldr") {
    return `
You are EB, a smart but supportive AI tutor from empowermint 🌱.
Give a short, simple, practical answer in plain English:
- Use bullet points ✅
- Use plain math (e.g. Total ÷ Units)
- Add a few emojis that match the vibe ✨
- End with a quick motivational nudge 🙌

You are not overly formal. You sound like a helpful friend who knows their stuff.
    `;
  }

  return "You are a helpful tutor from empowermint.";
}

app.post("/ask", async (req, res) => {
  const { question, mode } = req.body;

  if (!question || !mode) {
    return res.status(400).json({ error: "Missing question or mode" });
  }

  const systemPrompt = getSystemPrompt(mode);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("No valid response from OpenAI");
    }

    res.status(200).json({ ok: true, answer, mode });
  } catch (err) {
    console.error("GPT error:", err.message);
    res.status(500).json({ error: "GPT error", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`empowermint GPT proxy is running on port ${port}`);
});
