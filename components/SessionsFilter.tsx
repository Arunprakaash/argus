"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useState, useRef, useEffect } from "react";
import { statusBadgeClass, fmtDuration, fmtDate, titleCase } from "@/lib/format";
import SessionsTable from "@/components/SessionsTable";
import type { SessionRow } from "@/lib/data";

const STATUSES = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

type SemanticResult = {
  id: string; candidate_name: string | null; agent_name: string | null;
  interview_type: string | null; status: string; duration_sec: number | null;
  started_at: string | null; room_name: string; similarity: number;
};

export default function SessionsFilter({
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
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const period = params.get("period") ?? "all";

  const [nlResults, setNlResults] = useState<SemanticResult[] | null>(null);
  const [nlQuery, setNlQuery] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [queryMode, setQueryMode] = useState<"keyword" | "semantic" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [inputValue, setInputValue] = useState(q);
  const [placeholder, setPlaceholder] = useState("");

  const EXAMPLES = [
    "candidate confused about system design",
    "who struggled with SQL questions?",
    "sessions where profanity was handled",
    "interviews that ended early",
    "candidate mentioned microservices",
    "who asked to postpone the interview?",
  ];

  useEffect(() => {
    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const phrase = EXAMPLES[phraseIdx];
      if (!deleting) {
        charIdx++;
        setPlaceholder(phrase.slice(0, charIdx));
        if (charIdx === phrase.length) {
          deleting = true;
          timer = setTimeout(tick, 1800);
        } else {
          timer = setTimeout(tick, 48);
        }
      } else {
        charIdx--;
        setPlaceholder(phrase.slice(0, charIdx));
        if (charIdx === 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % EXAMPLES.length;
          timer = setTimeout(tick, 400);
        } else {
          timer = setTimeout(tick, 28);
        }
      }
    }

    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, []);

  const push = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === "all" || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

  function isNLQuery(val: string): boolean {
    const s = val.toLowerCase().trim();
    const words = s.split(/\s+/);
    if (words.length === 1) return false;
    if (s.includes("?")) return true;
    if (words.length >= 4) return true;
    const nlWords = /\b(who|what|when|where|why|how|did|was|were|has|have|had|is|are|can|could|should|would|will|mention|said|talked|spoke|discuss|asked|confused|struggled|failed|passed|answered|about|regarding|related|topic|experience|candidate|interviewer)\b/;
    return nlWords.test(s);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setNlResults(null);
      setNlQuery("");
      setQueryMode(null);
      push({ q: "" });
      return;
    }

    if (isNLQuery(val)) {
      setQueryMode("semantic");
      debounceRef.current = setTimeout(() => runSemanticSearch(val), 500);
    } else {
      setQueryMode("keyword");
      setNlResults(null);
      setNlQuery("");
      push({ q: val });
    }
  }

  async function runSemanticSearch(val: string) {
    setNlLoading(true);
    setNlQuery(val);
    push({ q: "" }); // clear ilike filter while showing semantic results
    try {
      const res = await fetch("/api/sessions/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: val }),
      });
      const data = await res.json();
      setNlResults(data.sessions ?? []);
    } finally {
      setNlLoading(false);
    }
  }

  function clearNl() {
    setNlResults(null);
    setNlQuery("");
    setQueryMode(null);
    setInputValue("");
    if (inputRef.current) inputRef.current.value = "";
    push({ q: "" });
  }

  return (
    <div>
      <div className="filter-bar">
        {/* Unified search — auto-classifies: short/simple = keyword ilike, sentence/NL = semantic */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1 }}>
          <input
            ref={inputRef}
            className="filter-search"
            style={{ flex: 1 }}
            type="search"
            placeholder={inputFocused ? "Search by name, room, or describe in plain English…" : ""}
            defaultValue={q}
            onChange={handleChange}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
          {/* Animated placeholder — only shown when idle (not focused, no value) */}
          {!inputValue && !inputFocused && (
            <span style={{
              position: "absolute", left: 10, pointerEvents: "none",
              fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden",
            }}>
              <span style={{ opacity: 0.5 }}>e.g. </span>{placeholder}<span style={{ borderRight: "1px solid var(--muted)", marginLeft: 1, animation: "blink 1s step-end infinite" }} />
            </span>
          )}
          {queryMode && !nlLoading && (
            <span style={{ position: "absolute", right: 10, fontSize: 10, color: "var(--muted)", background: "var(--bg)", padding: "1px 5px", border: "1px solid var(--border)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {queryMode}
            </span>
          )}
          {nlLoading && (
            <span style={{ position: "absolute", right: 10, fontSize: 11, color: "var(--muted)" }}>searching…</span>
          )}
        </div>

        {/* Status pills */}
        <div className="filter-pills">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              className={`pill${status === s.value ? " active" : ""}`}
              onClick={() => push({ status: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Period select */}
        <select
          className="filter-select"
          value={period}
          onChange={(e) => push({ period: e.target.value })}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Semantic results — replaces the normal table when active */}
      {nlResults !== null ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              results for <strong style={{ color: "var(--text)" }}>"{nlQuery}"</strong>
              {" "}— {nlResults.length} match{nlResults.length !== 1 ? "es" : ""}
            </span>
            <button onClick={clearNl} className="btn" style={{ fontSize: 11, padding: "2px 8px" }}>Clear</button>
          </div>
          <div className="table-wrap">
            {nlResults.length === 0
              ? <div className="empty" style={{ padding: "18px 16px" }}>No matching sessions found.</div>
              : <table>
                <thead>
                  <tr>
                    <th>Candidate</th><th>Agent</th><th>Type</th>
                    <th>Status</th><th>Duration</th><th>Started</th><th>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {nlResults.map((s) => (
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
        </div>
      ) : (
        <SessionsTable sessions={sessions} page={page} total={total} totalPages={totalPages} />
      )}
    </div>
  );
}
