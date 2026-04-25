"use client";

import { useEffect, useRef, useState } from "react";
import type { Round } from "@/lib/oracle/systemPrompt";

type OracleImage = {
  src: string;
  alt: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  image?: OracleImage;
};

type Conversations = Record<Round, ChatMessage[]>;

const CONV_KEY = "oracle:conversations:v1";
const ROUND_KEY = "oracle:round:v1";
const ROLE_KEY = "oracle:role:v1";

const EMPTY_CONVERSATIONS: Conversations = { A: [], B: [] };

function randomConfidence() {
  return 90 + Math.floor(Math.random() * 10);
}

function isRound(value: unknown): value is Round {
  return value === "A" || value === "B";
}

export default function Home() {
  const [conversations, setConversations] =
    useState<Conversations>(EMPTY_CONVERSATIONS);
  const [round, setRound] = useState<Round>("A");
  const [role, setRole] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = conversations[round];

  // Hydrate from localStorage post-mount: SSR has no `localStorage`, so we can't
  // read it during render without a hydration mismatch.
  useEffect(() => {
    try {
      const storedConv = localStorage.getItem(CONV_KEY);
      const storedRound = localStorage.getItem(ROUND_KEY);
      const storedRole = localStorage.getItem(ROLE_KEY);
      if (storedConv) {
        const parsed = JSON.parse(storedConv) as Partial<Conversations>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConversations({
          A: Array.isArray(parsed.A) ? parsed.A : [],
          B: Array.isArray(parsed.B) ? parsed.B : [],
        });
      }
      if (isRound(storedRound)) setRound(storedRound);
      if (storedRole) setRole(storedRole);
    } catch {
      // Ignore corrupted localStorage; start fresh.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CONV_KEY, JSON.stringify(conversations));
  }, [conversations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(ROUND_KEY, round);
  }, [round, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(ROLE_KEY, role);
  }, [role, hydrated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const requestRound = round;
    const nextHistory: ChatMessage[] = [
      ...conversations[requestRound],
      { role: "user", content: trimmed },
    ];
    setConversations((prev) => ({ ...prev, [requestRound]: nextHistory }));
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory,
          role,
          round: requestRound,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        reply: string;
        image?: OracleImage;
      };
      setConversations((prev) => ({
        ...prev,
        [requestRound]: [
          ...prev[requestRound],
          {
            role: "assistant",
            content: data.reply,
            confidence: randomConfidence(),
            image: data.image,
          },
        ],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setConversations((prev) => ({ ...prev, [round]: [] }));
    setError(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="oracle-app">
      <header className="oracle-header">
        <h1>The Airplane ORacle</h1>
        <div
          className="oracle-rounds"
          role="tablist"
          aria-label="Round selector"
        >
          {(["A", "B"] as Round[]).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={round === r}
              className={`oracle-round ${round === r ? "is-active" : ""}`}
              onClick={() => setRound(r)}
            >
              Round {r}
            </button>
          ))}
        </div>
      </header>

      <main className="oracle-main">
        <div className="oracle-chat" ref={scrollRef}>
          {messages.length === 0 && !loading && (
            <p className="oracle-placeholder">
              The ORacle awaits your question.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`oracle-msg oracle-msg-${m.role}`}>
              {m.role === "assistant" && m.confidence !== undefined && (
                <span className="oracle-confidence">
                  Confidence: {m.confidence}%
                </span>
              )}
              {m.role === "assistant" ? (
                <div
                  className="oracle-msg-text"
                  // Trusted: server-rendered + sanitize-html allowlist (see lib/oracle/markdown.ts).
                  dangerouslySetInnerHTML={{ __html: m.content }}
                />
              ) : (
                <div className="oracle-msg-text">{m.content}</div>
              )}
              {m.role === "assistant" && m.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="oracle-msg-image"
                  src={m.image.src}
                  alt={m.image.alt}
                />
              )}
            </div>
          ))}
          {loading && (
            <div className="oracle-msg oracle-msg-loading">
              🔮 The ORacle is conjuring...
            </div>
          )}
          {error && <div className="oracle-error">Error: {error}</div>}
        </div>

        <div className="oracle-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask The ORacle…"
            rows={2}
            disabled={loading}
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </main>

      <footer className="oracle-footer">
        <button
          type="button"
          onClick={reset}
          disabled={messages.length === 0 && !error}
        >
          Reset conversation
        </button>
      </footer>
    </div>
  );
}
