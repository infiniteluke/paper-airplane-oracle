import Anthropic from "@anthropic-ai/sdk";
import { promptForRound, type Round } from "@/lib/oracle/systemPrompt";
import { directiveFor, leanFor, rollD20 } from "@/lib/oracle/dice";
import { renderOracleMarkdown } from "@/lib/oracle/markdown";

const MODEL = "claude-sonnet-4-5";

// The model self-reports which airplane type it actually recommended.
// We key the image on the type, not the dice lean — the mapping of
// biased/correct to dart/glider flips between rounds (Round A's CORRECT is
// the glider; Round B's CORRECT is the dart).
type FoldKind = "DART" | "GLIDER";
const FOLD_TAGGED_RE = /\[\[FOLD:(DART|GLIDER)\]\]/gi;
const FOLD_ANY_RE = /\[\[FOLD(?::[A-Z]+)?\]\]/gi;

// System-level tokens / phrases we never want to round-trip through user messages.
const USER_INPUT_SCRUB = [
  /\[\[FOLD(?::[A-Z]+)?\]\]/gi,
  /\[INTERNAL DIRECTIVE[^\]]*\]/gi,
  /\bDC\s*14\b/gi,
];

const FOLD_IMAGES: Record<FoldKind, { src: string; alt: string }> = {
  DART: {
    src: "/img/classic.png",
    alt: "Classic dart paper airplane fold",
  },
  GLIDER: {
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

// Returns the airplane type the model self-reported via
// [[FOLD:DART|GLIDER]] at the end of the reply, or null if the reply didn't
// end with a fold tag (or used a type we don't have an image for).
function detectFoldKind(rawReply: string): FoldKind | null {
  const trimmed = rawReply.trimEnd();
  FOLD_TAGGED_RE.lastIndex = 0;
  const taggedMatches = [...trimmed.matchAll(FOLD_TAGGED_RE)];
  const lastTagged = taggedMatches.at(-1);
  if (lastTagged && trimmed.endsWith(lastTagged[0])) {
    return lastTagged[1].toUpperCase() as FoldKind;
  }
  return null;
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

  const foldKind = detectFoldKind(rawReply);
  const stripped = rawReply.replace(FOLD_ANY_RE, "").trim();
  const reply = renderOracleMarkdown(stripped);
  const image = foldKind ? FOLD_IMAGES[foldKind] : undefined;

  return Response.json({ reply, roll, lean, round, image });
}
