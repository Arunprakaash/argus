import { db } from "./db";
import { env } from "./env";
import { llmCostUsd, ttsCostUsd, sttCostUsd } from "./cost";

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

export type ModelUsageStat = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  inputPricePerM: number;
  outputPricePerM: number;
};
export type TtsUsageStat = { model: string; chars: number; costUsd: number; pricePerMChars: number };
export type SttUsageStat = { durationSec: number; costUsd: number; pricePerMin: number };

export type DashboardStats = {
  total: number;
  completed: number;
  abandoned: number;
  active: number;
  withIssues: number;
  avgDurationSec: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTtsChars: number;
  totalSttSec: number;
  estimatedCostUsd: number;
  llmByModel: ModelUsageStat[];
  ttsByModel: TtsUsageStat[];
  sttStats: SttUsageStat;
};

export const PAGE_SIZE = 8;

export type SessionFilters = {
  page?: number;
  q?: string;
  status?: string;
  period?: string;
};

export async function listSessions(
  filters: SessionFilters = {},
): Promise<{ sessions: SessionRow[]; total: number }> {
  const { page = 1, q, status, period } = filters;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = db()
    .from("sessions")
    .select(
      "id, room_name, status, completion_reason, candidate_name, agent_name, interview_type, started_at, ended_at, duration_sec, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q?.trim()) {
    query = query.or(`candidate_name.ilike.%${q.trim()}%,room_name.ilike.%${q.trim()}%`);
  }

  if (status && ["active", "completed", "abandoned"].includes(status)) {
    query = query.eq("status", status);
  }

  if (period && period !== "all") {
    const days = period === "today" ? 0 : period === "7d" ? 7 : period === "30d" ? 30 : null;
    if (days !== null) {
      const cutoff = new Date();
      if (days === 0) cutoff.setHours(0, 0, 0, 0);
      else cutoff.setDate(cutoff.getDate() - days);
      query = query.gte("created_at", cutoff.toISOString());
    }
  }

  const { data, count } = await query;
  return { sessions: (data ?? []) as SessionRow[], total: count ?? 0 };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = db();
  const [totals, issueAnalyses, durations, metricsData] = await Promise.all([
    supabase.from("sessions").select("status", { count: "exact" }),
    supabase.from("analyses").select("session_id, verdict").eq("kind", "issue_detection"),
    supabase.from("sessions").select("duration_sec").not("duration_sec", "is", null),
    supabase.from("sessions").select("metrics").not("metrics", "is", null),
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

  // Aggregate token usage + cost across all sessions, keeping per-model breakdown
  let totalInputTokens = 0, totalOutputTokens = 0, totalTtsChars = 0, totalSttSec = 0;
  let estimatedCostUsd = 0;
  const llmMap: Record<string, ModelUsageStat> = {};
  const ttsMap: Record<string, TtsUsageStat> = {};
  let sttDur = 0, sttCost = 0;

  const { ModelInfoMap } = await import("llm-info");

  for (const row of metricsData.data ?? []) {
    const usage: any[] = (row.metrics as any)?.model_usage ?? [];
    for (const u of usage) {
      if (u.type === "llm_usage") {
        const model = u.model ?? "unknown";
        const inp = u.input_tokens ?? 0;
        const out = u.output_tokens ?? 0;
        const info = (ModelInfoMap as Record<string, any>)[model];
        const inPrice = info?.pricePerMillionInputTokens ?? 0;
        const outPrice = info?.pricePerMillionOutputTokens ?? 0;
        const cost = (inp * inPrice + out * outPrice) / 1_000_000;
        totalInputTokens += inp;
        totalOutputTokens += out;
        estimatedCostUsd += cost;
        if (!llmMap[model]) llmMap[model] = { model, inputTokens: 0, outputTokens: 0, costUsd: 0, inputPricePerM: inPrice, outputPricePerM: outPrice };
        llmMap[model].inputTokens += inp;
        llmMap[model].outputTokens += out;
        llmMap[model].costUsd += cost;
      } else if (u.type === "tts_usage") {
        const model = u.model ?? "tts-1";
        const chars = u.characters_count ?? 0;
        const isHd = model.includes("hd");
        const pricePerMChars = isHd ? 30 : 15;
        const cost = (chars * pricePerMChars) / 1_000_000;
        totalTtsChars += chars;
        estimatedCostUsd += cost;
        if (!ttsMap[model]) ttsMap[model] = { model, chars: 0, costUsd: 0, pricePerMChars };
        ttsMap[model].chars += chars;
        ttsMap[model].costUsd += cost;
      } else if (u.type === "stt_usage") {
        const secs = u.audio_duration ?? 0;
        const cost = sttCostUsd(secs);
        totalSttSec += secs;
        sttDur += secs;
        sttCost += cost;
        estimatedCostUsd += cost;
      }
    }
  }

  return {
    total, completed, abandoned, active, withIssues, avgDurationSec,
    totalInputTokens, totalOutputTokens, totalTtsChars, totalSttSec, estimatedCostUsd,
    llmByModel: Object.values(llmMap),
    ttsByModel: Object.values(ttsMap),
    sttStats: { durationSec: sttDur, costUsd: sttCost, pricePerMin: 0.0059 },
  };
}

export async function getSessionDetail(id: string) {
  const supabase = db();
  const { data: session } = await supabase.from("sessions").select("*").eq("id", id).single();
  if (!session) return null;

  const [turns, flags, analyses, recordings, events, toolEvents, annotations] = await Promise.all([
    supabase.from("transcript_turns").select("id, session_id, role, text, ts, interrupted").eq("session_id", id).order("ts"),
    supabase.from("flags").select("*").eq("session_id", id).order("ts"),
    supabase.from("analyses").select("*").eq("session_id", id),
    supabase.from("recordings").select("*").eq("session_id", id),
    supabase
      .from("events")
      .select("id, source, type, ts")
      .eq("session_id", id)
      .order("ts", { ascending: true })
      .limit(500),
    supabase
      .from("events")
      .select("id, ts, payload")
      .eq("session_id", id)
      .eq("type", "function_tools_executed")
      .order("ts", { ascending: true }),
    supabase
      .from("annotations")
      .select("id, note, author, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true }),
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
    toolEvents: toolEvents.data ?? [],
    annotations: annotations.data ?? [],
  };
}
