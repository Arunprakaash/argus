"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { statusBadgeClass, fmtDuration, fmtDate, titleCase } from "@/lib/format";
import type { SessionRow } from "@/lib/data";
import { PAGE_SIZE } from "@/lib/data";


export default function SessionsTable({
  sessions,
  page,
  total,
  totalPages,
}: {
  sessions: SessionRow[];
  page: number;
  total: number;
  totalPages: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const from = (page - 1) * PAGE_SIZE + 1;

  function pageHref(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `?${next.toString()}`;
  }
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
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
                <td>
                  <span className={`badge ${s.status === "active" ? "" : "dot "}${statusBadgeClass(s.status)}`}>
                    {s.status === "active" ? <span className="live-pulse" /> : null}
                    {s.status}
                  </span>
                </td>
                <td className="muted">{titleCase(s.completion_reason)}</td>
                <td>{fmtDuration(s.duration_sec)}</td>
                <td className="muted">{fmtDate(s.started_at || s.created_at)}</td>
                <td className="mono">{s.room_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <span className="pg-info">{from}–{to} of {total}</span>
          <div className="pg-btns">
            {page > 1
              ? <a href={pageHref(page - 1)} className="btn">← Prev</a>
              : <span className="btn" style={{ opacity: 0.35, cursor: "not-allowed" }}>← Prev</span>}
            <span className="pg-curr">{page} / {totalPages}</span>
            {page < totalPages
              ? <a href={pageHref(page + 1)} className="btn">Next →</a>
              : <span className="btn" style={{ opacity: 0.35, cursor: "not-allowed" }}>Next →</span>}
          </div>
        </div>
      )}
    </div>
  );
}
