import type { SupabaseClient } from "@supabase/supabase-js";
import { FLAG_TOOL_TO_TYPE, type EventEnvelope } from "./schema";
import { enqueueAnalysis } from "./queue";

// High-frequency, low-value events: consumed for rollups but not stored as rows.
const NOISE_EVENT_TYPES = new Set([
  "metrics_collected",
  "session_usage_updated",
  "speech_created",
  "overlapping_speech",
]);

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

  // 1) Append-only event log — excluding high-frequency noise that would bloat
  // the DB (these are still consumed below for the metrics rollup, just not stored
  // as individual rows). Keeps ~dozens of meaningful rows/interview instead of 1000+.
  const eventRows = events
    .filter((e) => !NOISE_EVENT_TYPES.has(e.type))
    .map((e) => ({
      session_id: sessionId,
      source: e.source,
      type: e.type,
      ts: e.ts,
      payload: e.data,
    }));
  if (eventRows.length) {
    const { error } = await db.from("events").insert(eventRows);
    if (error) throw new Error(`insert events: ${error.message}`);
  }

  // 2) Derived rows + session rollups.
  const turns: Record<string, unknown>[] = [];
  const flags: Record<string, unknown>[] = [];
  const sessionPatch: Record<string, unknown> = {};
  let completeSucceeded = false;
  let closeReason: unknown = undefined;
  let endedAt: string | undefined;

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
          if (name === "complete_interview") {
            // Agent judge passed unless the tool asked to revisit missing questions.
            const out = JSON.stringify(outputs[i] ?? "");
            if (!/revisit|missing|still .*ask|not .*asked|haven't asked/i.test(out)) {
              completeSucceeded = true;
            }
            return;
          }
          const flagType = FLAG_TOOL_TO_TYPE[name];
          if (!flagType) return;
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
        // Roll the latest usage snapshot onto the session (not stored as rows).
        const usage = (e.data.usage ?? e.data.metrics ?? {}) as Record<string, unknown>;
        if (Object.keys(usage).length) sessionPatch.metrics = usage;
        break;
      }
      case "close": {
        closeReason = e.data.reason;
        endedAt = e.ts;
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

  // Completion: a successful `complete_interview` tool call is the authoritative
  // "finished cleanly" signal — the close event's CloseReason is usually
  // user_initiated/job_shutdown even on a normal finish.
  if (completeSucceeded) {
    sessionPatch.status = "completed";
    sessionPatch.completion_reason = "complete_interview";
  } else if (closeReason !== undefined) {
    sessionPatch.completion_reason = String(closeReason);
  }
  if (endedAt) sessionPatch.ended_at = endedAt;

  if (Object.keys(sessionPatch).length) {
    const { error } = await db.from("sessions").update(sessionPatch).eq("id", sessionId);
    if (error) throw new Error(`update session: ${error.message}`);
  }

  // Dropped interview → terminal status, but never downgrade a session already
  // marked completed (possibly by an earlier batch).
  if (!completeSucceeded && closeReason !== undefined) {
    await db
      .from("sessions")
      .update({ status: statusFromCloseReason(closeReason) })
      .eq("id", sessionId)
      .eq("status", "active");
  }

  // 3) On end (clean completion or drop), enqueue analysis (best-effort).
  const ended = completeSucceeded || closeReason !== undefined;
  if (ended) {
    try {
      await enqueueAnalysis({ sessionId, roomName });
    } catch (err) {
      console.error("enqueueAnalysis failed (non-fatal):", err);
    }
  }

  return { sessionId, events: events.length, completed: ended };
}
