"use client";

import { useState } from "react";

export default function Home() {
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function consult() {
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      const res = await fetch("/api/oracle", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { reply: string };
      setReply(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="oracle-app">
      <header className="oracle-header">
        <h1>The Oracle</h1>
      </header>
      <main className="oracle-main">
        <button
          type="button"
          onClick={consult}
          disabled={loading}
          className="oracle-consult"
        >
          {loading ? "The Oracle is consulting…" : "Consult The Oracle"}
        </button>
        {reply && <p className="oracle-reply">{reply}</p>}
        {error && <p className="oracle-error">Error: {error}</p>}
      </main>
      <footer className="oracle-footer">
        <button type="button" disabled>
          Reset conversation
        </button>
        <a href="/admin">View query log</a>
      </footer>
    </div>
  );
}
