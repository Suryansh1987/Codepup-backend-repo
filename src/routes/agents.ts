import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { agent1SystemPrompt } from "../defaults/starterAgentsPrompt";
const router = express.Router();
const anthropic = new Anthropic();
router.post("/", async (req, res) => {
  const { prompt, userId } = req.body;
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-0",
    max_tokens: 1000,
    temperature: 1,
    system: agent1SystemPrompt,
    messages: [{ role: "user", content: prompt }],
  });
  const data = message.content[0];
  res.json({ data });
});

export default router;
