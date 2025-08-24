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

app.post("/ask", async (req, res) => {
  const { question, mode } = req.body;

  if (!question || !mode) {
    return res.status(400).json({ error: "Missing question or mode" });
  }

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
          {
            role: "system",
            content:
              mode === "exam"
                ? "You are a motivational, supportive South African high school study coach. Answer step-by-step with clarity, structure, and confidence. Use exam-style formatting with helpful tone."
                : "You are an uplifting tutor helping learners understand things clearly. Summarise answers gently and encourage learners to ask follow-ups.",
          },
          {
            role: "user",
            content: question,
          },
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
