"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "oracle:conversation:v1";
const ROLE_KEY = "oracle:role:v1";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [role, setRole] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setMessages(JSON.parse(stored) as ChatMessage[]);
      const storedRole = localStorage.getItem(ROLE_KEY);
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
      const data = (await res.json()) as { reply: string };
      setMessages([...next, { role: "assistant", content: data.reply }]);
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
        <input
          type="text"
          className="oracle-role"
          placeholder="Your role (optional, for logging)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
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
              {m.content}
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
        <a href="/admin">View query log</a>
      </footer>
    </div>
  );
}
