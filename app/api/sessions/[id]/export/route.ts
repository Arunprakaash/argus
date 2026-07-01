import { NextResponse } from "next/server";
import { getSessionDetail } from "@/lib/data";
import { fmtDuration, fmtDate } from "@/lib/format";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await getSessionDetail(id);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const s = data.session as any;
  const coverage = (data.analyses["coverage_recheck"] as any)?.verdict;
  const issues = (data.analyses["issue_detection"] as any)?.verdict;
  const missing: string[] = coverage?.missing ?? [];
  const fixedQ: string[] = s.fixed_questions ?? [];

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ────────────────────────────────────────────
  const summaryRows = [
    ["Field", "Value"],
    ["Candidate", s.candidate_name ?? ""],
    ["Room", s.room_name],
    ["Agent", s.agent_name ?? ""],
    ["Interview Type", s.interview_type ?? ""],
    ["Status", s.status],
    ["Completion Reason", s.completion_reason ?? ""],
    ["Started At", s.started_at ? fmtDate(s.started_at) : ""],
    ["Ended At", s.ended_at ? fmtDate(s.ended_at) : ""],
    ["Duration", s.duration_sec ? fmtDuration(s.duration_sec) : ""],
    ["Questions Coverage", fixedQ.length ? `${fixedQ.length - missing.length} / ${fixedQ.length} asked` : ""],
    ["Issues Detected", issues?.findings?.length ?? 0],
    ["Judge Verdict", coverage?.agreesWithAgent === true ? "✓ Correct" : coverage?.agreesWithAgent === false ? "✗ Disagreed" : "—"],
    ["Session ID", s.id],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 22 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // ── Sheet 2: Questions ──────────────────────────────────────────
  if (fixedQ.length) {
    const qRows = [["#", "Status", "Question"]];
    fixedQ.forEach((q, i) => {
      qRows.push([(i + 1) as any, missing.includes(q) ? "Missing" : "Asked", q]);
    });
    const wsQ = XLSX.utils.aoa_to_sheet(qRows);
    wsQ["!cols"] = [{ wch: 4 }, { wch: 10 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsQ, "Questions");
  }

  // ── Sheet 3: Issues ─────────────────────────────────────────────
  if (issues?.findings?.length) {
    const iRows = [["#", "Severity", "Category", "Evidence"]];
    issues.findings.forEach((f: any, i: number) => {
      iRows.push([(i + 1) as any, f.severity, f.category, f.evidence]);
    });
    const wsI = XLSX.utils.aoa_to_sheet(iRows);
    wsI["!cols"] = [{ wch: 4 }, { wch: 10 }, { wch: 22 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsI, "Issues");
  }

  // ── Sheet 4: Transcript ─────────────────────────────────────────
  const txRows = [["Turn", "Timestamp", "Role", "Speaker", "Message"]];
  data.transcript.forEach((t: any, i: number) => {
    const speaker = t.role === "assistant" ? (s.agent_name ?? "Agent") : (s.candidate_name ?? "Candidate");
    const time = t.ts && s.started_at
      ? `${Math.round((new Date(t.ts).getTime() - new Date(s.started_at).getTime()) / 1000)}s`
      : t.ts ?? "";
    txRows.push([(i + 1) as any, time, t.role, speaker, t.text]);
  });
  const wsTx = XLSX.utils.aoa_to_sheet(txRows);
  wsTx["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsTx, "Transcript");

  // ── Sheet 5: Notes ──────────────────────────────────────────────
  if (data.annotations?.length) {
    const nRows = [["#", "Author", "Created At", "Note"]];
    (data.annotations as any[]).forEach((n, i) => {
      nRows.push([(i + 1) as any, n.author ?? "", fmtDate(n.created_at), n.note]);
    });
    const wsN = XLSX.utils.aoa_to_sheet(nRows);
    wsN["!cols"] = [{ wch: 4 }, { wch: 18 }, { wch: 20 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsN, "Notes");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `${s.candidate_name ?? s.room_name}-${s.started_at?.slice(0, 10) ?? "session"}.xlsx`
    .replace(/[^a-z0-9\-_.]/gi, "_");

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
