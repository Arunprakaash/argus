"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const [focused, setFocused] = useState(-1);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useEffect(() => { setFocused(-1); }, [sessions]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocused((i) => { const n = Math.min(i + 1, sessions.length - 1); rowRefs.current[n]?.scrollIntoView({ block: "nearest" }); return n; });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocused((i) => { const n = Math.max(i - 1, 0); rowRefs.current[n]?.scrollIntoView({ block: "nearest" }); return n; });
      } else if (e.key === "Enter" && focused >= 0 && sessions[focused]) {
        router.push(`/dashboard/sessions/${sessions[focused].id}`);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focused, sessions, router]);

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
            {sessions.map((s, i) => (
              <tr
                key={s.id}
                ref={(el) => { rowRefs.current[i] = el; }}
                className={`clickable${focused === i ? " kb-focused" : ""}`}
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
