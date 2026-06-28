import { listSessions, getDashboardStats, PAGE_SIZE } from "@/lib/data";
import SessionsTable from "@/components/SessionsTable";
import SessionsFilter from "@/components/SessionsFilter";
import LiveIndicator from "@/components/LiveIndicator";
import DashboardStrip from "@/components/DashboardStrip";
import { fmtDuration } from "@/lib/format";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; period?: string; review?: string }>;
}) {
  const { page: pageParam, q, status, period, review } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));

  const [{ sessions, total }, stats] = await Promise.all([
    listSessions({ page, q, status, period, review }),
    getDashboardStats(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 className="page" style={{ marginBottom: 0 }}>Sessions</h1>
        <LiveIndicator initial={stats.active} />
      </div>
      <p className="sub">Every interview the agent has run — transcript, audio, flags and AI analysis.</p>

      <DashboardStrip
        total={stats.total}
        completed={stats.completed}
        abandoned={stats.abandoned}
        withIssues={stats.withIssues}
        issueRate={stats.total > 0 ? `${Math.round((stats.withIssues / stats.total) * 100)}%` : "—"}
        avgDuration={stats.avgDurationSec != null ? fmtDuration(stats.avgDurationSec) : "—"}
        totalInputTokens={stats.totalInputTokens}
        totalOutputTokens={stats.totalOutputTokens}
        totalTtsChars={stats.totalTtsChars}
        totalSttSec={stats.totalSttSec}
        estimatedCostUsd={stats.estimatedCostUsd}
        llmByModel={stats.llmByModel}
        ttsByModel={stats.ttsByModel}
        sttStats={stats.sttStats}
      />

      <Suspense>
        <SessionsFilter />
      </Suspense>

      <SessionsTable sessions={sessions} page={page} total={total} totalPages={totalPages} />
    </div>
  );
}
