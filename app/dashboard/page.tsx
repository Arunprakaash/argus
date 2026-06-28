import { listSessions } from "@/lib/data";
import SessionsTable from "@/components/SessionsTable";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await listSessions();
  const completed = sessions.filter((s) => s.status === "completed").length;
  const abandoned = sessions.filter((s) => s.status === "abandoned").length;

  return (
    <div className="content">
      <h1 className="page">Sessions</h1>
      <p className="sub">Every interview the agent has run — transcript, audio, flags and AI analysis.</p>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <div className="card stat-card"><div className="stat-l">Total sessions</div><div className="stat">{sessions.length}</div></div>
        <div className="card stat-card"><div className="stat-l">Completed</div><div className="stat">{completed}</div></div>
        <div className="card stat-card"><div className="stat-l">Abandoned</div><div className="stat">{abandoned}</div></div>
      </div>

      <SessionsTable sessions={sessions} />
    </div>
  );
}
