import Anthropic from "@anthropic-ai/sdk";
import { promptForRound, type Round } from "@/lib/oracle/systemPrompt";
import { directiveFor, leanFor, rollD20, type Lean } from "@/lib/oracle/dice";
import { renderOracleMarkdown } from "@/lib/oracle/markdown";

const MODEL = "claude-sonnet-4-5";

// Any form the model might emit. The tagged variants are the source of truth
// for which image to show (the model self-reports which answer it actually
// gave); the untagged legacy form falls back to the dice-derived lean.
const FOLD_TAGGED_RE = /\[\[FOLD:(BIASED|CORRECT)\]\]/gi;
const FOLD_ANY_RE = /\[\[FOLD(?::[A-Z]+)?\]\]/gi;

// System-level tokens / phrases we never want to round-trip through user messages.
const USER_INPUT_SCRUB = [
  /\[\[FOLD(?::[A-Z]+)?\]\]/gi,
  /\[INTERNAL DIRECTIVE[^\]]*\]/gi,
  /\bDC\s*14\b/gi,
];

const FOLD_IMAGES: Record<Lean, { src: string; alt: string }> = {
  BIASED: {
    src: "/img/classic.png",
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

// Returns the lean the model self-reported via [[FOLD:BIASED|CORRECT]] at the
// end of the reply, or "UNTAGGED" if the reply ended with the legacy [[FOLD]]
// token, or null if the reply didn't end with any fold marker.
function detectFoldLean(rawReply: string): Lean | "UNTAGGED" | null {
  const trimmed = rawReply.trimEnd();

  FOLD_TAGGED_RE.lastIndex = 0;
  const taggedMatches = [...trimmed.matchAll(FOLD_TAGGED_RE)];
  const lastTagged = taggedMatches.at(-1);
  if (lastTagged && trimmed.endsWith(lastTagged[0])) {
    return lastTagged[1].toUpperCase() as Lean;
  }

  if (trimmed.endsWith("[[FOLD]]")) return "UNTAGGED";
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

  const detected = detectFoldLean(rawReply);
  const imageLean: Lean | null =
    detected === "BIASED" || detected === "CORRECT"
      ? detected
      : detected === "UNTAGGED"
        ? lean
        : null;

  const stripped = rawReply.replace(FOLD_ANY_RE, "").trim();
  const reply = renderOracleMarkdown(stripped);
  const image = imageLean ? FOLD_IMAGES[imageLean] : undefined;

  return Response.json({ reply, roll, lean, round, image });
}
