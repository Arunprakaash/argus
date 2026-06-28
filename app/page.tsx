// Backend-first build. The dashboard UI is a separate follow-up; this is a
// placeholder so the app deploys and the API routes are reachable.
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>Interview Observer</h1>
      <p>Backend is running. The dashboard UI is built in a later phase.</p>
      <ul>
        <li><code>POST /api/ingest/events</code> — agent observer SDK ingestion</li>
        <li><code>POST /api/livekit/webhook</code> — LiveKit Cloud webhooks</li>
        <li><code>GET /api/sessions</code> — list sessions</li>
        <li><code>GET /api/sessions/&#123;id&#125;</code> — session detail</li>
        <li><code>GET /api/sessions/&#123;id&#125;/recording</code> — signed audio URL</li>
      </ul>
    </main>
  );
}
