import Anthropic from "@anthropic-ai/sdk";
import { ORACLE_SYSTEM_PROMPT } from "@/lib/oracle/systemPrompt";
import { directiveFor, leanFor, rollD20, type Lean } from "@/lib/oracle/dice";

const MODEL = "claude-sonnet-4-5";
const FOLD_TOKEN = "[[FOLD]]";

const FOLD_IMAGES: Record<Lean, { src: string; alt: string }> = {
  BIASED: {
    src: "/img/classic.jpg",
    alt: "Classic dart paper airplane fold",
  },
  CORRECT: {
    src: "/img/glider.png",
    alt: "Broad-wing glider paper airplane fold",
  },
};

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
    messages: messages.map(({ role, content }) => ({ role, content })),
  });

  const rawReply = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const wantsFoldImage = rawReply.includes(FOLD_TOKEN);
  const reply = rawReply.replaceAll(FOLD_TOKEN, "").trim();
  const image = wantsFoldImage ? FOLD_IMAGES[lean] : undefined;

  return Response.json({ reply, roll, lean, image });
}
