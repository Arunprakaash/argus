import { NextResponse } from "next/server";
import { getSessionDetail } from "@/lib/data";
import { fmtDuration } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function row(...cols: unknown[]): string {
  return cols.map(esc).join(",");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await getSessionDetail(id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const s = data.session as any;
  const coverage = (data.analyses["coverage_recheck"] as any)?.verdict;
  const issues = (data.analyses["issue_detection"] as any)?.verdict;
  const missing: string[] = coverage?.missing ?? [];
  const fixedQ: string[] = s.fixed_questions ?? [];

  const lines: string[] = [];

  // ── Session summary ──────────────────────────────────────────
  lines.push("section,key,value");
  lines.push(row("summary", "candidate", s.candidate_name ?? ""));
  lines.push(row("summary", "room", s.room_name));
  lines.push(row("summary", "agent", s.agent_name ?? ""));
  lines.push(row("summary", "interview_type", s.interview_type ?? ""));
  lines.push(row("summary", "status", s.status));
  lines.push(row("summary", "started_at", s.started_at ?? ""));
  lines.push(row("summary", "duration", s.duration_sec ? fmtDuration(s.duration_sec) : ""));
  lines.push(row("summary", "coverage", fixedQ.length ? `${fixedQ.length - missing.length}/${fixedQ.length}` : ""));
  lines.push(row("summary", "issues_detected", issues?.findings?.length ?? 0));
  lines.push(row("summary", "judge_verdict", coverage?.agreesWithAgent === true ? "correct" : coverage?.agreesWithAgent === false ? "disagreed" : ""));
  lines.push("");

  // ── Questions ────────────────────────────────────────────────
  if (fixedQ.length) {
    lines.push("section,status,question");
    for (const q of fixedQ) {
      lines.push(row("question", missing.includes(q) ? "missing" : "asked", q));
    }
    lines.push("");
  }

  // ── Issues ───────────────────────────────────────────────────
  if (issues?.findings?.length) {
    lines.push("section,severity,category,evidence");
    for (const f of issues.findings) {
      lines.push(row("issue", f.severity, f.category, f.evidence));
    }
    lines.push("");
  }

  // ── Transcript ───────────────────────────────────────────────
  lines.push("section,turn,timestamp,role,speaker,text");
  data.transcript.forEach((t: any, i: number) => {
    const speaker = t.role === "assistant" ? (s.agent_name ?? "Agent") : (s.candidate_name ?? "Candidate");
    lines.push(row("transcript", i + 1, t.ts, t.role, speaker, t.text));
  });

  // ── Notes ────────────────────────────────────────────────────
  if (data.annotations?.length) {
    lines.push("");
    lines.push("section,author,created_at,note");
    for (const n of data.annotations as any[]) {
      lines.push(row("note", n.author ?? "", n.created_at, n.note));
    }
  }

  const filename = `${s.candidate_name ?? s.room_name}-${s.started_at?.slice(0, 10) ?? "session"}.csv`
    .replace(/[^a-z0-9\-_.]/gi, "_");

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
