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

export async function listSessions(limit = 100): Promise<SessionRow[]> {
  const { data } = await db()
    .from("sessions")
    .select(
      "id, room_name, status, completion_reason, candidate_name, agent_name, interview_type, started_at, ended_at, duration_sec, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as SessionRow[];
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

  // Signed URL for the latest audio recording, if any.
  let recordingUrl: string | null = null;
  const rec = (recordings.data ?? [])[0] as { bucket_key?: string } | undefined;
  if (rec?.bucket_key) {
    const { data: signed } = await supabase.storage
      .from(env.recordingsBucket())
      .createSignedUrl(rec.bucket_key, 600);
    recordingUrl = signed?.signedUrl ?? null;
  }

  // index analyses by kind for easy access
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
