"use client";

import { useState, useEffect } from "react";
import { statusBadgeClass, severityClass, fmtDuration, fmtDate, titleCase } from "@/lib/format";
import { useSetBreadcrumbTail } from "./breadcrumb-context";
import NotesPanel from "./NotesPanel";


function num(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString() : String(n);
}
function secs(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? fmtDuration(v) : "—";
}

const USAGE_FIELDS: Record<string, { label: string; fmt: (v: unknown) => string }> = {
  input_tokens: { label: "Input tokens", fmt: num },
  output_tokens: { label: "Output tokens", fmt: num },
  input_audio_tokens: { label: "Input audio tokens", fmt: num },
  output_audio_tokens: { label: "Output audio tokens", fmt: num },
  input_cached_text_tokens: { label: "Cached text tokens", fmt: num },
  characters_count: { label: "Characters", fmt: num },
  audio_duration: { label: "Audio", fmt: secs },
  total_requests: { label: "Requests", fmt: num },
};
const USAGE_TITLE: Record<string, string> = {
  llm_usage: "LLM",
  tts_usage: "Text-to-Speech",
  stt_usage: "Speech-to-Text",
  interruption_usage: "Interruptions",
};

const TABS = ["Transcript", "Analysis", "Questions", "Usage", "Notes", "Timeline"] as const;

const TOOL_LABELS: Record<string, string> = {
  handle_out_of_context:   "Out of context",
  handle_profanity:        "Profanity detected",
  handle_prompt_injection: "Prompt injection attempt",
  postpone_interview:      "Candidate tried to postpone",
  complete_interview:      "Interview completed",
};
const TOOL_COLOR = "#556c72";

type MergedItem =
  | { _kind: "turn"; id: string; role: string; text: string; ts: string }
  | { _kind: "tool"; _idx: number; ts: string; name: string; args: any; output: any };

function ToolCallRow({ item }: { item: Extract<MergedItem, { _kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const c = TOOL_COLOR;
  return (
    <div style={{ margin: "3px 0" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 14px", cursor: "pointer",
          background: open ? `${c}35` : `${c}20`,
          fontSize: 12,
        }}
      >
        <span style={{ color: c, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>Tool call</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)" }}>{TOOL_LABELS[item.name] ?? item.name}</span>
        <span className="ts" style={{ marginLeft: "auto" }}>{fmtDate(item.ts)}</span>
        <span style={{ color: "var(--muted)", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ background: `${c}0d`, borderTop: `1px solid ${c}30`, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {item.args != null && (
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", marginBottom: 3, letterSpacing: "0.06em" }}>Arguments</div>
              <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--text)", background: "var(--bg)", padding: "8px", border: "1px solid var(--border)" }}>
                {typeof item.args === "string" ? item.args : JSON.stringify(item.args, null, 2)}
              </pre>
            </div>
          )}
          {item.output != null && (
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", marginBottom: 3, letterSpacing: "0.06em" }}>Output</div>
              <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--text)", background: "var(--bg)", padding: "8px", border: "1px solid var(--border)" }}>
                {typeof item.output === "string" ? item.output : JSON.stringify(item.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TranscriptWithTools({ transcript, toolEvents, agentName }: { transcript: any[]; toolEvents: any[]; agentName: string }) {
  const toolItems: Extract<MergedItem, { _kind: "tool" }>[] = [];
  let idx = 0;
  for (const ev of toolEvents) {
    const calls: any[] = ev.payload?.function_calls ?? [];
    const outputs: any[] = ev.payload?.function_call_outputs ?? [];
    calls.forEach((c: any, i: number) => {
      toolItems.push({ _kind: "tool", _idx: idx++, ts: ev.ts, name: c.name ?? "", args: c.arguments ?? null, output: outputs[i] ?? null });
    });
  }
  const merged: MergedItem[] = [
    ...transcript.map((t: any) => ({ _kind: "turn" as const, ...t })),
    ...toolItems,
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (merged.length === 0) return <div className="empty">No transcript.</div>;

  return (
    <div className="transcript">
      {merged.map((item) => {
        if (item._kind === "turn") {
          return (
            <div className={`turn ${item.role}`} key={item.id}>
              <div className="avatar">{(item.role === "assistant" ? agentName || "A" : "C").slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="turn-role">{item.role === "assistant" ? agentName : "Candidate"}</div>
                <div className="txt">{item.text}</div>
                <div className="ts" suppressHydrationWarning>{fmtDate(item.ts)}</div>
              </div>
            </div>
          );
        }
        return <ToolCallRow key={`tool-${item._idx}`} item={item} />;
      })}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="vtile">
      <div className="vt-l">{label}</div>
      <div className="vt-v">{value}</div>
    </div>
  );
}

export default function SessionView({ data, agentName }: { data: any; agentName: string }) {
  const s = data.session;
  const coverage = data.analyses["coverage_recheck"]?.verdict;
  const completion = data.analyses["completion"]?.verdict;
  const issues = data.analyses["issue_detection"]?.verdict;
  const quality = data.analyses["quality"]?.verdict;
  const fixedQuestions: string[] = s.fixed_questions ?? [];
  const modelUsage: any[] = s.metrics?.model_usage ?? [];
  const missing: string[] = coverage?.missing ?? [];
  const askedCount = fixedQuestions.length - missing.length;

  useSetBreadcrumbTail(s.room_name);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Transcript");

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < TABS.length) setTab(TABS[idx]);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const judge =
    coverage?.agreesWithAgent === true ? "✓ Correct"
    : coverage?.agreesWithAgent === false ? "✗ Disagreed"
    : "—";
  const agreeClass =
    coverage?.agreesWithAgent === true ? "green"
    : coverage?.agreesWithAgent === false ? "red" : "gray";

  return (
    <div className="detail-shell">
      <div className="detail-top"><div className="detail-inner">
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <h1 className="page" style={{ marginBottom: 0 }}>{s.candidate_name || "Unknown candidate"}</h1>
            <span className={`badge dot ${statusBadgeClass(s.status)}`}>{s.status}</span>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {agentName} · {titleCase(s.interview_type)} · <span className="mono">{s.room_name}</span>
          </div>
        </div>
        <a
          href={`/api/sessions/${s.id}/export`}
          download
          className="btn"
          style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Excel
        </a>
      </div>

      {/* Verdict strip */}
      <div className="verdict-strip">
        <Tile label="Judge" value={judge} />
        <Tile label="Coverage" value={coverage ? `${askedCount}/${fixedQuestions.length}` : "—"} />
        <Tile label="Issues" value={issues?.findings?.length ?? "—"} />
        <Tile label="Flags" value={data.flags.length} />
        <Tile label="Duration" value={fmtDuration(s.duration_sec)} />
        <Tile label="Completion" value={completion?.cleanlyCompleted ? "Clean" : titleCase(s.completion_reason)} />
      </div>

      {/* Tabs */}
      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      </div></div>

      <div className="detail-body"><div className="detail-inner">
      <div className="tabpanel">

        {/* ── Transcript ─────────────────────────────────────── */}
        {tab === "Transcript" && (
          <TranscriptWithTools transcript={data.transcript} toolEvents={data.toolEvents ?? []} agentName={agentName} />
        )}


        {/* ── Analysis ───────────────────────────────────────── */}
        {tab === "Analysis" && (
          <div className="analysis-grid">
            {/* Coverage & judge — teal-accented */}
            <div className={`card an-card${coverage?.agreesWithAgent === false || missing.length > 0 ? " an-warn" : " an-ok"}`}>
              <div className="card-h">
                Coverage &amp; judge
                <span className={`badge ${agreeClass}`}>{judge}</span>
              </div>
              <div className="card-b">
                {!coverage ? <div className="muted">Pending analysis…</div> : (
                  <>
                    <div className="an-row">
                      <div className="an-metric">
                        <div className="an-val">{askedCount}<span className="an-of">/{fixedQuestions.length}</span></div>
                        <div className="an-lbl">questions covered</div>
                      </div>
                      <div className="an-checks">
                        <div className="an-check-row">
                          <span className="an-dot" data-ok={!coverage.ourMissingDetected} />
                          <span>Re-check: {coverage.ourMissingDetected ? <span className="an-warn-t">{missing.length} missing</span> : "all covered"}</span>
                        </div>
                        <div className="an-check-row">
                          <span className="an-dot" data-ok={coverage.agentDetectedMissing === false} />
                          <span>Agent judge: {coverage.agentDetectedMissing === null ? "no verdict"
                            : coverage.agentDetectedMissing ? <span className="an-warn-t">flagged gaps</span>
                            : "all covered"}</span>
                        </div>
                      </div>
                    </div>
                    {missing.length > 0 && (
                      <div className="an-missing">
                        <div className="an-missing-h">Never asked</div>
                        <ul className="qlist">{missing.map((q, i) => <li key={i}>{q}</li>)}</ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Completion */}
            <div className={`card an-card${completion && !completion.cleanlyCompleted ? " an-warn" : " an-ok"}`}>
              <div className="card-h">Completion</div>
              <div className="card-b">
                {!completion ? <div className="muted">Pending analysis…</div> : (
                  <>
                    <div className="an-row">
                      <div className="an-metric">
                        <div className="an-val" style={{ fontSize: 22 }}>{completion.cleanlyCompleted ? "Clean" : "Partial"}</div>
                        <div className="an-lbl">{titleCase(completion.reason)}</div>
                      </div>
                      <div className="an-checks">
                        <div className="an-check-row">
                          <span className="an-dot" data-ok={completion.cleanlyCompleted} />
                          <span>Clean finish</span>
                        </div>
                        <div className="an-check-row">
                          <span className="an-dot" data-ok />
                          <span>{fmtDuration(completion.durationSec)} duration</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Issues — full width, prominent */}
            <div className={`card an-card span2${issues?.findings?.length ? " an-issues" : " an-ok"}`}>
              <div className="card-h">
                Detected issues
                {issues?.findings?.length
                  ? <span className="badge amber">{issues.findings.length}</span>
                  : <span className="badge green">none</span>}
              </div>
              <div className="card-b">
                {!issues ? <div className="muted">Pending analysis…</div>
                  : issues.findings?.length === 0
                  ? <div className="an-clear">No issues detected in this session.</div>
                  : <div className="findings-grid">
                    {issues.findings.map((f: any, i: number) => (
                      <div className="finding-card" key={i}>
                        <div className="row" style={{ marginBottom: 6 }}>
                          <span className={`badge ${severityClass(f.severity)}`}>{f.severity}</span>
                          <strong style={{ fontSize: 13 }}>{titleCase(f.category)}</strong>
                        </div>
                        <div className="ev">{f.evidence}</div>
                      </div>
                    ))}
                  </div>}
              </div>
            </div>

            {/* Flags */}
            <div className={`card an-card span2${data.flags.length ? " an-warn" : " an-ok"}`}>
              <div className="card-h">
                Behavioral flags
                {data.flags.length
                  ? <span className="badge amber">{data.flags.length}</span>
                  : <span className="badge green">none</span>}
              </div>
              <div className="card-b">
                {data.flags.length === 0
                  ? <div className="an-clear">No behavioral flags raised.</div>
                  : data.flags.map((f: any) => (
                    <div className="finding" key={f.id}>
                      <div className="row">
                        <span className="badge">{titleCase(f.type)}</span>
                        <span className="muted mono">{fmtDate(f.ts)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Questions ──────────────────────────────────────── */}
        {tab === "Questions" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {fixedQuestions.length === 0
              ? <div className="empty">No fixed questions configured for this session.</div>
              : fixedQuestions.map((q, i) => {
                const asked = !missing.includes(q);
                return (
                  <div className={`q-row${asked ? "" : " q-missing"}`} key={i}>
                    <span className={`badge ${asked ? "green" : "amber"}`}>{asked ? "asked" : "missing"}</span>
                    <span className="q-text">{q}</span>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── Usage ──────────────────────────────────────────── */}
        {tab === "Usage" && (
          <div>
            {modelUsage.length === 0
              ? <div className="empty">No usage captured for this session.</div>
              : modelUsage.map((u: any, i: number) => {
                const fields = Object.entries(u).filter(([k, v]) => USAGE_FIELDS[k] && Number(v) > 0);
                return (
                  <div className="usage-block" key={i}>
                    <div className="uh">
                      <strong>{USAGE_TITLE[u.type] || titleCase(u.type)}</strong>
                      <span className="um">{u.model}</span>
                    </div>
                    <div className="ub">
                      {fields.length === 0
                        ? <span className="muted">No measured usage.</span>
                        : <div className="fieldgrid">
                          {fields.map(([k, v]) => (
                            <div className="field" key={k}>
                              <div className="v">{USAGE_FIELDS[k].fmt(v)}</div>
                              <div className="l">{USAGE_FIELDS[k].label}</div>
                            </div>
                          ))}
                        </div>}
                    </div>
                  </div>
                );
              })}
            {quality && (
              <div className="usage-block" style={{ marginTop: 16 }}>
                <div className="uh"><strong>Quality</strong></div>
                <div className="ub">
                  <dl className="kv">
                    {Object.entries(quality).map(([k, v]) => (
                      <div key={k} style={{ display: "contents" }}>
                        <dt>{titleCase(k)}</dt>
                        <dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Notes ─────────────────────────────────────────── */}
        {tab === "Notes" && (
          <NotesPanel sessionId={s.id} initial={data.annotations ?? []} />
        )}

        {/* ── Timeline ───────────────────────────────────────── */}
        {tab === "Timeline" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Source</th><th>Type</th></tr></thead>
              <tbody>
                {data.timeline.map((e: any) => (
                  <tr key={e.id}>
                    <td className="mono">{fmtDate(e.ts)}</td>
                    <td><span className="badge gray">{e.source}</span></td>
                    <td className="mono">{e.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
      </div></div>
    </div>
  );
}
