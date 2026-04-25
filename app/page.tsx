export default function Home() {
  return (
    <div className="oracle-app">
      <header className="oracle-header">
        <h1>The Oracle</h1>
      </header>
      <main className="oracle-main">
        <p className="oracle-placeholder">The Oracle awaits your question.</p>
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
