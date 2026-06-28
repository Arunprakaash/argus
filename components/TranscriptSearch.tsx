"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { statusBadgeClass, fmtDuration, fmtDate, titleCase } from "@/lib/format";

type Result = {
  id: string; candidate_name: string | null; agent_name: string | null;
  interview_type: string | null; status: string; duration_sec: number | null;
  started_at: string | null; room_name: string; similarity: number;
};

export default function TranscriptSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(val: string) {
    setQ(val);
    if (debounce.current) clearTimeout(debounce.current);
    if (!val.trim()) { setResults(null); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/sessions/semantic-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: val }),
        });
        const data = await res.json();
        setResults(data.sessions ?? []);
      } finally {
        setLoading(false);
      }
    }, 500);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ position: "relative" }}>
        <input
          className="filter-search"
          style={{ width: "100%", border: "1px solid var(--border-strong)", padding: "8px 12px" }}
          placeholder="Search transcripts semantically — e.g. 'candidate mentioned microservices' or 'confused about AWS'"
          value={q}
          onChange={(e) => search(e.target.value)}
        />
        {loading && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--muted)" }}>
            searching…
          </span>
        )}
      </div>

      {results !== null && (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          {results.length === 0
            ? <div className="empty" style={{ padding: "20px 16px" }}>No matching sessions found.</div>
            : <table>
              <thead>
                <tr>
                  <th>Candidate</th><th>Agent</th><th>Type</th>
                  <th>Status</th><th>Duration</th><th>Started</th><th>Match</th>
                </tr>
              </thead>
              <tbody>
                {results.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => router.push(`/dashboard/sessions/${s.id}`)}>
                    <td style={{ fontWeight: 600 }}>{s.candidate_name || "Unknown"}</td>
                    <td>{s.agent_name || "—"}</td>
                    <td>{titleCase(s.interview_type)}</td>
                    <td><span className={`badge dot ${statusBadgeClass(s.status)}`}>{s.status}</span></td>
                    <td>{fmtDuration(s.duration_sec)}</td>
                    <td className="muted">{fmtDate(s.started_at)}</td>
                    <td><span className="badge gray">{Math.round(s.similarity * 100)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      )}
    </div>
  );
}
