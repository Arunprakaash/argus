"use client";

import { useRouter } from "next/navigation";
import { statusBadgeClass, fmtDuration, fmtDate, titleCase } from "@/lib/format";
import type { SessionRow } from "@/lib/data";

export default function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();

  return (
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
            <tr
              key={s.id}
              className="clickable"
              onClick={() => router.push(`/dashboard/sessions/${s.id}`)}
            >
              <td style={{ fontWeight: 600 }}>{s.candidate_name || "Unknown"}</td>
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
  );
}
