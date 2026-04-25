import Anthropic from "@anthropic-ai/sdk";
import { ORACLE_SYSTEM_PROMPT } from "@/lib/oracle/systemPrompt";
import { directiveFor, leanFor, rollD20 } from "@/lib/oracle/dice";

const MODEL = "claude-sonnet-4-5";

const client = new Anthropic();

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type OracleRequest = {
  messages: ChatMessage[];
  role?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as OracleRequest;
  const messages = body.messages ?? [];

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "messages must end with a user turn" },
      { status: 400 },
    );
  }

  const roll = rollD20();
  const lean = leanFor(roll);
  const system = `${ORACLE_SYSTEM_PROMPT}\n\n${directiveFor(roll)}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system,
    messages,
  });

  const reply = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return Response.json({ reply, roll, lean });
}
