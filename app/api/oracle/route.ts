import Anthropic from "@anthropic-ai/sdk";
import { promptForRound, type Round } from "@/lib/oracle/systemPrompt";
import { directiveFor, leanFor, rollD20, type Lean } from "@/lib/oracle/dice";
import { renderOracleMarkdown } from "@/lib/oracle/markdown";

const MODEL = "claude-sonnet-4-5";
const FOLD_TOKEN = "[[FOLD]]";
// System-level tokens / phrases we never want to round-trip through user messages.
const USER_INPUT_SCRUB = [
  /\[\[FOLD\]\]/gi,
  /\[INTERNAL DIRECTIVE[^\]]*\]/gi,
  /\bDC\s*14\b/gi,
];

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
  round?: Round;
};

function scrubUserContent(content: string): string {
  let out = content;
  for (const pattern of USER_INPUT_SCRUB) {
    out = out.replace(pattern, "");
  }
  return out;
}

function sanitizeMessage(m: ChatMessage): ChatMessage {
  if (m.role !== "user") return { role: m.role, content: m.content };
  return { role: "user", content: scrubUserContent(m.content) };
}

export async function POST(request: Request) {
  const body = (await request.json()) as OracleRequest;
  const messages = body.messages ?? [];
  const round: Round = body.round === "B" ? "B" : "A";

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "messages must end with a user turn" },
      { status: 400 },
    );
  }

  const roll = rollD20();
  const lean = leanFor(roll);
  const system = `${promptForRound(round)}\n\n${directiveFor(roll)}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system,
    messages: messages.map(sanitizeMessage),
  });

  const rawReply = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  // Per the IMAGE PROTOCOL, the token must appear at the very end of the reply.
  // Tightening to a trailing-position check (instead of .includes) prevents an
  // attached image when the model echoes a user-supplied [[FOLD]] mid-response.
  const wantsFoldImage = rawReply.trimEnd().endsWith(FOLD_TOKEN);
  const stripped = rawReply.replaceAll(FOLD_TOKEN, "").trim();
  const reply = renderOracleMarkdown(stripped);
  const image = wantsFoldImage ? FOLD_IMAGES[lean] : undefined;

  return Response.json({ reply, roll, lean, round, image });
}
