import { db } from "./db";
import { env } from "./env";

// Server-side data access for the dashboard (service-role; RLS-bypassing).

export type SessionRow = {
  id: string;
  room_name: string;
  status: string;
  completion_reason: string | null;
  candidate_name: string | null;
  agent_name: string | null;
  interview_type: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  created_at: string;
};

export type DashboardStats = {
  total: number;
  completed: number;
  abandoned: number;
  active: number;
  withIssues: number;
  avgDurationSec: number | null;
};

export const PAGE_SIZE = 25;

export async function listSessions(page = 1): Promise<{ sessions: SessionRow[]; total: number }> {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await db()
    .from("sessions")
    .select(
      "id, room_name, status, completion_reason, candidate_name, agent_name, interview_type, started_at, ended_at, duration_sec, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  return { sessions: (data ?? []) as SessionRow[], total: count ?? 0 };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = db();
  const [totals, issueAnalyses, durations] = await Promise.all([
    supabase
      .from("sessions")
      .select("status", { count: "exact" }),
    supabase
      .from("analyses")
      .select("session_id, verdict")
      .eq("kind", "issue_detection"),
    supabase
      .from("sessions")
      .select("duration_sec")
      .not("duration_sec", "is", null),
  ]);

  const sessions = totals.data ?? [];
  const total = totals.count ?? 0;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const abandoned = sessions.filter((s) => s.status === "abandoned").length;
  const active = sessions.filter((s) => s.status === "active").length;

  const withIssues = (issueAnalyses.data ?? []).filter(
    (a) => ((a.verdict as any)?.findings?.length ?? 0) > 0,
  ).length;

  const durs = (durations.data ?? []).map((s) => s.duration_sec as number);
  const avgDurationSec = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : null;

  return { total, completed, abandoned, active, withIssues, avgDurationSec };
}

export async function getSessionDetail(id: string) {
  const supabase = db();
  const { data: session } = await supabase.from("sessions").select("*").eq("id", id).single();
  if (!session) return null;

  const [turns, flags, analyses, recordings, events] = await Promise.all([
    supabase.from("transcript_turns").select("*").eq("session_id", id).order("ts"),
    supabase.from("flags").select("*").eq("session_id", id).order("ts"),
    supabase.from("analyses").select("*").eq("session_id", id),
    supabase.from("recordings").select("*").eq("session_id", id),
    supabase
      .from("events")
      .select("id, source, type, ts")
      .eq("session_id", id)
      .order("ts", { ascending: true })
      .limit(500),
  ]);

  let recordingUrl: string | null = null;
  const rec = (recordings.data ?? [])[0] as { bucket_key?: string } | undefined;
  if (rec?.bucket_key) {
    const { data: signed } = await supabase.storage
      .from(env.recordingsBucket())
      .createSignedUrl(rec.bucket_key, 600);
    recordingUrl = signed?.signedUrl ?? null;
  }

  const byKind: Record<string, any> = {};
  for (const a of analyses.data ?? []) byKind[(a as any).kind] = a;

  return {
    session,
    transcript: turns.data ?? [],
    flags: flags.data ?? [],
    analyses: byKind,
    recordings: recordings.data ?? [],
    recordingUrl,
    timeline: events.data ?? [],
  };
}
