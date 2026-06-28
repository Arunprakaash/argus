import { listSessions, getDashboardStats, PAGE_SIZE } from "@/lib/data";
import SessionsTable from "@/components/SessionsTable";
import LiveIndicator from "@/components/LiveIndicator";
import { fmtDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));
  const [{ sessions, total }, stats] = await Promise.all([
    listSessions(page),
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

      {/* Stats strip */}
      <div className="stats-strip">
        <div className="stat-tile">
          <div className="st-l">Total</div>
          <div className="st-v">{stats.total}</div>
        </div>
        <div className="stat-tile">
          <div className="st-l">Completed</div>
          <div className="st-v">{stats.completed}</div>
        </div>
        <div className="stat-tile">
          <div className="st-l">Abandoned</div>
          <div className="st-v">{stats.abandoned}</div>
        </div>
        <div className="stat-tile">
          <div className="st-l">With issues</div>
          <div className="st-v">{stats.withIssues}</div>
        </div>
        <div className="stat-tile">
          <div className="st-l">Issue rate</div>
          <div className="st-v">
            {stats.total > 0 ? `${Math.round((stats.withIssues / stats.total) * 100)}%` : "—"}
          </div>
        </div>
        <div className="stat-tile">
          <div className="st-l">Avg duration</div>
          <div className="st-v">{stats.avgDurationSec != null ? fmtDuration(stats.avgDurationSec) : "—"}</div>
        </div>
      </div>

      <SessionsTable sessions={sessions} page={page} total={total} totalPages={totalPages} />
    </div>
  );
}
