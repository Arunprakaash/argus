import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionDetail } from "@/lib/data";
import { statusBadgeClass, severityClass, fmtDuration, fmtDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getSessionDetail(id);
  if (!d) notFound();

  const s = d.session as any;
  const coverage = d.analyses["coverage_recheck"]?.verdict;
  const completion = d.analyses["completion"]?.verdict;
  const issues = d.analyses["issue_detection"]?.verdict;
  const quality = d.analyses["quality"]?.verdict;
  const fixedQuestions: string[] = s.fixed_questions ?? [];
  const metrics = s.metrics && Object.keys(s.metrics).length ? s.metrics : null;

  const agree =
    coverage?.agreesWithAgent === true ? { c: "green", t: "Judge classified correctly" }
    : coverage?.agreesWithAgent === false ? { c: "red", t: "Judge disagreed" }
    : { c: "gray", t: "N/A" };

  return (
    <>
      <Link href="/dashboard" className="back">← All sessions</Link>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>{s.candidate_name || "Unknown candidate"}</h1>
        <span className={`badge dot ${statusBadgeClass(s.status)}`}>{s.status}</span>
      </div>
      <p className="sub">Interview with {s.agent_name || "agent"} · {titleCase(s.interview_type)}</p>

      {/* Overview */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-b">
          <dl className="kv">
            <dt>Completion</dt><dd>{titleCase(s.completion_reason)}</dd>
            <dt>Duration</dt><dd>{fmtDuration(s.duration_sec)}</dd>
            <dt>Started</dt><dd>{fmtDate(s.started_at)}</dd>
            <dt>Ended</dt><dd>{fmtDate(s.ended_at)}</dd>
            <dt>Room</dt><dd className="mono">{s.room_name}</dd>
            <dt>Session ID</dt><dd className="mono">{s.id}</dd>
          </dl>
        </div>
      </div>

      {/* Audio */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">Audio recording</div>
        <div className="card-b">
          {d.recordingUrl ? (
            <audio controls preload="none" src={d.recordingUrl} />
          ) : (
            <div className="muted">No recording captured (egress runs only when the observer is deployed with a public webhook).</div>
          )}
        </div>
      </div>

      {/* AI analysis */}
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        {/* Coverage / judge correctness */}
        <div className="card">
          <div className="card-h">Question coverage <span className={`badge ${agree.c}`}>{agree.t}</span></div>
          <div className="card-b">
            {coverage ? (
              <>
                <div className="row" style={{ marginBottom: 10 }}>
                  <span className="muted">Our re-check:</span>
                  {coverage.ourMissingDetected
                    ? <span className="badge amber">{coverage.missing?.length || 0} missing</span>
                    : <span className="badge green">all covered</span>}
                  <span className="muted">Agent judge:</span>
                  {coverage.agentDetectedMissing === null
                    ? <span className="badge gray">no verdict</span>
                    : coverage.agentDetectedMissing
                    ? <span className="badge amber">flagged gaps</span>
                    : <span className="badge green">all covered</span>}
                </div>
                {coverage.missing?.length > 0 && (
                  <>
                    <div className="muted" style={{ marginBottom: 4 }}>Missing questions:</div>
                    <ul className="qlist">{coverage.missing.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>
                  </>
                )}
              </>
            ) : <div className="muted">Pending analysis…</div>}
          </div>
        </div>

        {/* Completion */}
        <div className="card">
          <div className="card-h">Completion</div>
          <div className="card-b">
            {completion ? (
              <dl className="kv">
                <dt>Clean finish</dt>
                <dd>{completion.cleanlyCompleted ? <span className="badge green">yes</span> : <span className="badge amber">no</span>}</dd>
                <dt>Reason</dt><dd>{titleCase(completion.reason)}</dd>
                <dt>Duration</dt><dd>{fmtDuration(completion.durationSec)}</dd>
              </dl>
            ) : <div className="muted">Pending analysis…</div>}
          </div>
        </div>
      </div>

      {/* Issues */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">Detected issues {issues?.findings?.length ? <span className="badge amber">{issues.findings.length}</span> : <span className="badge green">none</span>}</div>
        <div className="card-b">
          {!issues ? <div className="muted">Pending analysis…</div>
            : issues.findings?.length === 0 ? <div className="muted">No issues detected.</div>
            : issues.findings.map((f: any, i: number) => (
              <div className="finding" key={i}>
                <div className="row">
                  <span className={`badge ${severityClass(f.severity)}`}>{f.severity}</span>
                  <strong>{titleCase(f.category)}</strong>
                </div>
                <div className="ev">{f.evidence}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Flags + Fixed questions */}
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-h">Behavioral flags {d.flags.length ? <span className="badge red">{d.flags.length}</span> : <span className="badge green">none</span>}</div>
          <div className="card-b">
            {d.flags.length === 0 ? <div className="muted">No flags raised.</div>
              : d.flags.map((f: any) => (
                <div className="finding" key={f.id}>
                  <span className={`badge ${f.type === "profanity" || f.type === "prompt_injection" ? "red" : "amber"}`}>{titleCase(f.type)}</span>
                  <span className="muted mono" style={{ marginLeft: 8 }}>{fmtDate(f.ts)}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h">Fixed questions <span className="badge gray">{fixedQuestions.length}</span></div>
          <div className="card-b">
            {fixedQuestions.length === 0 ? <div className="muted">None configured.</div>
              : <ul className="qlist">{fixedQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>}
          </div>
        </div>
      </div>

      {/* Quality (optional) + Metrics (optional) */}
      {(quality || metrics) && (
        <div className="grid cols-2" style={{ marginBottom: 16 }}>
          {quality && (
            <div className="card"><div className="card-h">Quality</div><div className="card-b">
              <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(quality, null, 2)}</pre>
            </div></div>
          )}
          {metrics && (
            <div className="card"><div className="card-h">Usage / cost</div><div className="card-b">
              <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(metrics, null, 2)}</pre>
            </div></div>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">Transcript <span className="badge gray">{d.transcript.length} turns</span></div>
        <div className="card-b">
          {d.transcript.length === 0 ? <div className="muted">No transcript.</div>
            : d.transcript.map((t: any) => (
              <div className={`turn ${t.role}`} key={t.id}>
                <div className="who">{t.role === "assistant" ? (s.agent_name || "Agent") : "Candidate"}</div>
                <div>
                  <div className="txt">{t.text}</div>
                  <div className="ts">{fmtDate(t.ts)}</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="card-h">Event timeline <span className="badge gray">{d.timeline.length}</span></div>
        <div className="card-b" style={{ maxHeight: 320, overflow: "auto" }}>
          <table>
            <thead><tr><th>Time</th><th>Source</th><th>Type</th></tr></thead>
            <tbody>
              {d.timeline.map((e: any) => (
                <tr key={e.id}>
                  <td className="mono">{fmtDate(e.ts)}</td>
                  <td><span className="badge gray">{e.source}</span></td>
                  <td className="mono">{e.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
