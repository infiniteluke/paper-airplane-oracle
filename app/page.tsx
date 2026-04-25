"use client";

import { useEffect, useRef, useState } from "react";

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

const STORAGE_KEY = "oracle:conversation:v1";
const ROLE_KEY = "oracle:role:v1";

function randomConfidence() {
  return 90 + Math.floor(Math.random() * 10);
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [role, setRole] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage post-mount: SSR has no `localStorage`, so we can't
  // read it during render without a hydration mismatch.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const storedRole = localStorage.getItem(ROLE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setMessages(JSON.parse(stored) as ChatMessage[]);
      if (storedRole) setRole(storedRole);
    } catch {
      // Ignore corrupted localStorage; start fresh.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);

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
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, role }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        reply: string;
        image?: OracleImage;
      };
      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.reply,
          confidence: randomConfidence(),
          image: data.image,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([]);
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
        <h1>The Oracle</h1>
      </header>

      <main className="oracle-main">
        <div className="oracle-chat" ref={scrollRef}>
          {messages.length === 0 && !loading && (
            <p className="oracle-placeholder">
              The Oracle awaits your question.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`oracle-msg oracle-msg-${m.role}`}>
              {m.role === "assistant" && m.confidence !== undefined && (
                <span className="oracle-confidence">
                  Confidence: {m.confidence}%
                </span>
              )}
              <div className="oracle-msg-text">{m.content}</div>
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
              The Oracle is consulting…
            </div>
          )}
          {error && <div className="oracle-error">Error: {error}</div>}
        </div>

        <div className="oracle-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask The Oracle…"
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
