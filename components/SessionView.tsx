"use client";

import { useState } from "react";
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
          <h1 className="page" style={{ marginBottom: 2 }}>{s.candidate_name || "Unknown candidate"}</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            {agentName} · {titleCase(s.interview_type)} · <span className="mono">{s.room_name}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`badge dot ${statusBadgeClass(s.status)}`}>{s.status}</span>
          <a
            href={`/api/sessions/${s.id}/export`}
            download
            className="btn"
            style={{ fontSize: 12 }}
          >
            Export CSV
          </a>
        </div>
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
          <>
            <div className="transcript">
              {data.transcript.length === 0
                ? <div className="empty">No transcript.</div>
                : data.transcript.map((t: any) => (
                  <div className={`turn ${t.role}`} key={t.id}>
                    <div className="avatar">{(t.role === "assistant" ? agentName || "A" : "C").slice(0, 1).toUpperCase()}</div>
                    <div>
                      <div className="turn-role">{t.role === "assistant" ? agentName : "Candidate"}</div>
                      <div className="txt">{t.text}</div>
                      <div className="ts">{fmtDate(t.ts)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </>
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
