import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getFunctionStats() {
  const supabase = db();
  const [last, counts, errors] = await Promise.all([
    supabase
      .from("analyses")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("analyses")
      .select("kind, status"),
    supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("status", "error"),
  ]);

  const all = counts.data ?? [];
  const byKind: Record<string, { done: number; error: number }> = {};
  for (const a of all) {
    const k = (a as any).kind as string;
    if (!byKind[k]) byKind[k] = { done: 0, error: 0 };
    if ((a as any).status === "done") byKind[k].done++;
    else if ((a as any).status === "error") byKind[k].error++;
  }

  return {
    lastRun: (last.data as any)?.created_at ?? null,
    totalRuns: all.length,
    errorCount: errors.count ?? 0,
    byKind,
  };
}

export default async function FunctionsPage() {
  const stats = await getFunctionStats();

  const FUNCTIONS = [
    {
      slug: "analyze",
      description: "Runs coverage re-check, issue detection, and completion analysis after each interview. Triggered immediately on session end via pg_net, with a 5-minute cron as fallback.",
      analyses: [
        { kind: "coverage_recheck", label: "Coverage re-check" },
        { kind: "issue_detection", label: "Issue detection" },
        { kind: "completion", label: "Completion check" },
      ],
    },
  ];

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <h1 className="page" style={{ marginBottom: 4 }}>Functions</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
        Supabase Edge Functions deployed for Argus — analysis engine and worker status.
      </p>

      {FUNCTIONS.map((fn) => (
        <div className="card" key={fn.slug} style={{ marginBottom: 16 }}>
          <div className="card-h" style={{ background: "var(--panel)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
              <span style={{ fontWeight: 600, fontFamily: "var(--mono)", fontSize: 13 }}>{fn.slug}</span>
            </div>
            <span className={`badge dot ${stats.errorCount > 0 ? "amber" : "green"}`}>
              {stats.errorCount > 0 ? `${stats.errorCount} errors` : "healthy"}
            </span>
          </div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fn.description}</p>

            {/* Run stats */}
            <div className="fn-stats">
              <div className="fn-stat">
                <div className="st-l">Total runs</div>
                <div className="st-v" style={{ fontSize: 18 }}>{stats.totalRuns}</div>
              </div>
              <div className="fn-stat">
                <div className="st-l">Errors</div>
                <div className="st-v" style={{ fontSize: 18, color: stats.errorCount > 0 ? "var(--text)" : "var(--muted)" }}>
                  {stats.errorCount}
                </div>
              </div>
              <div className="fn-stat">
                <div className="st-l">Last run</div>
                <div className="st-v" style={{ fontSize: 14, fontWeight: 500 }}>{fmtDate(stats.lastRun)}</div>
              </div>
            </div>

            {/* Per-analysis breakdown */}
            <div>
              <div className="field-label" style={{ marginBottom: 10 }}>Analysis breakdown</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Analysis</th><th>Completed</th><th>Errors</th></tr>
                  </thead>
                  <tbody>
                    {fn.analyses.map(({ kind, label }) => {
                      const k = stats.byKind[kind] ?? { done: 0, error: 0 };
                      return (
                        <tr key={kind}>
                          <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{label}</td>
                          <td><span className="badge green">{k.done}</span></td>
                          <td>{k.error > 0 ? <span className="badge amber">{k.error}</span> : <span className="muted">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Trigger info */}
            <div style={{ fontSize: 12, color: "var(--muted-2)", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              Triggered by <span className="mono">pg_net.http_post</span> on analysis job enqueue ·
              Cron fallback every 5 min · Queue: <span className="mono">analysis_jobs</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
