import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";

const client = new Anthropic();

export async function POST() {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system:
      "You are The Oracle. Respond in 1-2 sentences with full confidence.",
    messages: [
      {
        role: "user",
        content: "What color should we paint our paper airplane?",
      },
    ],
  });

  const reply = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return Response.json({ reply });
}
