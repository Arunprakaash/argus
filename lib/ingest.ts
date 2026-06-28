import type { SupabaseClient } from "@supabase/supabase-js";
import { FLAG_TOOL_TO_TYPE, type EventEnvelope } from "./schema";
import { enqueueAnalysis } from "./queue";

// Map LiveKit CloseReason → our session.status + whether the interview finished cleanly.
function statusFromCloseReason(reason: unknown): "completed" | "abandoned" | "error" {
  switch (reason) {
    case "task_completed":
      return "completed";
    case "error":
      return "error";
    default:
      // participant_disconnected | user_initiated | job_shutdown
      return "abandoned";
  }
}

// Pull plain text out of a serialized ChatMessage content (string | list of parts).
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : ((p as { text?: string })?.text ?? "")))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

type SessionRow = { id: string; status: string };

async function ensureSession(
  db: SupabaseClient,
  roomName: string,
  firstTs: string,
  meta?: EventEnvelope["meta"],
): Promise<SessionRow> {
  const patch: Record<string, unknown> = { room_name: roomName };
  if (meta) {
    if (meta.candidateName) patch.candidate_name = meta.candidateName;
    if (meta.agentName) patch.agent_name = meta.agentName;
    if (meta.interviewType) patch.interview_type = meta.interviewType;
    if (meta.fixedQuestions) patch.fixed_questions = meta.fixedQuestions;
    if (meta.raw) patch.metadata = meta.raw;
  }

  const { data, error } = await db
    .from("sessions")
    .upsert(patch, { onConflict: "room_name" })
    .select("id, status, started_at")
    .single();
  if (error) throw new Error(`ensureSession: ${error.message}`);

  // Backfill started_at if not yet set.
  if (data && !(data as { started_at: string | null }).started_at) {
    await db.from("sessions").update({ started_at: firstTs }).eq("id", data.id);
  }
  return { id: data.id as string, status: data.status as string };
}

export type IngestResult = { sessionId: string; events: number; completed: boolean };

// Process a validated batch of events. All events in a batch share one room.
export async function processBatch(
  db: SupabaseClient,
  events: EventEnvelope[],
): Promise<IngestResult> {
  const roomName = events[0].roomName;
  const meta = events.find((e) => e.meta)?.meta;
  const session = await ensureSession(db, roomName, events[0].ts, meta);
  const sessionId = session.id;

  // 1) Append-only event log.
  const eventRows = events.map((e) => ({
    session_id: sessionId,
    source: e.source,
    type: e.type,
    ts: e.ts,
    payload: e.data,
  }));
  {
    const { error } = await db.from("events").insert(eventRows);
    if (error) throw new Error(`insert events: ${error.message}`);
  }

  // 2) Derived rows.
  const turns: Record<string, unknown>[] = [];
  const flags: Record<string, unknown>[] = [];
  const sessionPatch: Record<string, unknown> = {};
  let completed = false;

  for (const e of events) {
    switch (e.type) {
      case "conversation_item_added": {
        const item = (e.data.item ?? {}) as Record<string, unknown>;
        if (item.type && item.type !== "message") break;
        const role = String(item.role ?? "");
        if (!role) break;
        turns.push({
          session_id: sessionId,
          item_id: (item.id as string) ?? null,
          role,
          text: extractText(item.content),
          ts: ((item.extra as Record<string, unknown>)?.timestamp as string) ?? e.ts,
          interrupted: Boolean(item.interrupted),
          metrics: (item.metrics as Record<string, unknown>) ?? {},
        });
        break;
      }
      case "function_tools_executed": {
        const calls = (e.data.function_calls ?? []) as Array<Record<string, unknown>>;
        const outputs = (e.data.function_call_outputs ?? []) as Array<unknown>;
        calls.forEach((call, i) => {
          const name = String(call.name ?? "");
          const flagType = FLAG_TOOL_TO_TYPE[name];
          if (!flagType) return; // complete_interview etc. stay in the event log for analysis
          flags.push({
            session_id: sessionId,
            type: flagType,
            ts: e.ts,
            data: { arguments: call.arguments ?? null, output: outputs[i] ?? null },
          });
        });
        break;
      }
      case "metrics_collected":
      case "session_usage_updated": {
        // Roll the latest usage snapshot onto the session.
        const usage = (e.data.usage ?? e.data.metrics ?? {}) as Record<string, unknown>;
        sessionPatch.metrics = usage;
        break;
      }
      case "close": {
        const reason = e.data.reason;
        sessionPatch.status = statusFromCloseReason(reason);
        sessionPatch.completion_reason = typeof reason === "string" ? reason : null;
        sessionPatch.ended_at = e.ts;
        completed = true;
        break;
      }
    }
  }

  if (turns.length) {
    const { error } = await db
      .from("transcript_turns")
      .upsert(turns, { onConflict: "session_id,item_id", ignoreDuplicates: true });
    if (error) throw new Error(`upsert turns: ${error.message}`);
  }
  if (flags.length) {
    const { error } = await db.from("flags").insert(flags);
    if (error) throw new Error(`insert flags: ${error.message}`);
  }
  if (Object.keys(sessionPatch).length) {
    const { error } = await db.from("sessions").update(sessionPatch).eq("id", sessionId);
    if (error) throw new Error(`update session: ${error.message}`);
  }

  // 3) On completion, enqueue analysis (best-effort — never fail ingestion on this).
  if (completed) {
    try {
      await enqueueAnalysis({ sessionId, roomName });
    } catch (err) {
      console.error("enqueueAnalysis failed (non-fatal):", err);
    }
  }

  return { sessionId, events: events.length, completed };
}
