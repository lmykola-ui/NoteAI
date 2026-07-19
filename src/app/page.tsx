export default function HomePage() {
  return (
    <main className="mobile-shell">
      <section className="screen">
        <h1>Що в голові?</h1>
        <p>Напишіть або скажіть усе підряд</p>
      </section>
      <nav aria-label="Основна навігація" className="bottom-nav">
        <button type="button" aria-current="page">Capture</button>
        <button type="button">Inbox</button>
        <button type="button">План</button>
      </nav>
    </main>
  );
}
