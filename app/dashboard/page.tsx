import Link from "next/link";
import { listSessions } from "@/lib/data";
import { statusBadgeClass, fmtDuration, fmtDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await listSessions();

  const completed = sessions.filter((s) => s.status === "completed").length;
  const abandoned = sessions.filter((s) => s.status === "abandoned").length;

  return (
    <>
      <h1 className="page">Sessions</h1>
      <p className="sub">Every interview the agent has run, with transcript, audio, flags and AI analysis.</p>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <div className="card"><div className="card-b"><div className="stat">{sessions.length}</div><div className="stat-l">Total sessions</div></div></div>
        <div className="card"><div className="card-b"><div className="stat">{completed}</div><div className="stat-l">Completed</div></div></div>
        <div className="card"><div className="card-b"><div className="stat">{abandoned}</div><div className="stat-l">Abandoned</div></div></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Agent</th>
              <th>Type</th>
              <th>Status</th>
              <th>Completion</th>
              <th>Duration</th>
              <th>Started</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr><td colSpan={8}><div className="empty">No sessions yet. Run an interview to see it here.</div></td></tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id} className="clickable">
                <td>
                  <Link href={`/dashboard/sessions/${s.id}`} style={{ fontWeight: 600 }}>
                    {s.candidate_name || "Unknown"}
                  </Link>
                </td>
                <td>{s.agent_name || "—"}</td>
                <td>{titleCase(s.interview_type)}</td>
                <td><span className={`badge dot ${statusBadgeClass(s.status)}`}>{s.status}</span></td>
                <td className="muted">{titleCase(s.completion_reason)}</td>
                <td>{fmtDuration(s.duration_sec)}</td>
                <td className="muted">{fmtDate(s.started_at || s.created_at)}</td>
                <td className="mono">{s.room_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
