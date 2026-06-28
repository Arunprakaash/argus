import { z } from "zod";

// Native LiveKit AgentSession events (@session.on) — verbatim from the SDK
// (livekit/agents/voice/events.py EventTypes).
export const SESSION_EVENT_TYPES = [
  "user_state_changed",
  "agent_state_changed",
  "user_input_transcribed",
  "conversation_item_added",
  "agent_false_interruption",
  "overlapping_speech",
  "function_tools_executed",
  "metrics_collected",
  "session_usage_updated",
  "speech_created",
  "error",
  "close",
] as const;

// Native LiveKit Room events (@ctx.room.on) — verbatim from livekit/rtc/room.py.
export const ROOM_EVENT_TYPES = [
  "participant_connected",
  "participant_disconnected",
  "participant_active",
  "local_track_published",
  "local_track_unpublished",
  "local_track_republished",
  "local_track_subscribed",
  "track_published",
  "track_unpublished",
  "track_subscribed",
  "track_unsubscribed",
  "track_subscription_failed",
  "track_muted",
  "track_unmuted",
  "participant_metadata_changed",
  "participant_name_changed",
  "participant_attributes_changed",
  "participant_encryption_status_changed",
  "participant_permissions_changed",
  "data_received",
  "connected",
  "disconnected",
  "reconnecting",
  "reconnected",
  "data_track_published",
  "data_track_unpublished",
] as const;

// Tool calls that map to proctoring-style flags (from the agent's structured.py).
// Captured via the `function_tools_executed` event, not custom hooks.
export const FLAG_TOOL_NAMES = [
  "handle_out_of_context",
  "handle_profanity",
  "handle_prompt_injection",
  "postpone_interview",
] as const;

export const FLAG_TOOL_TO_TYPE: Record<string, string> = {
  handle_out_of_context: "out_of_context",
  handle_profanity: "profanity",
  handle_prompt_injection: "prompt_injection",
  postpone_interview: "postpone_interview",
};

// One event envelope. `type` is the verbatim native LiveKit event name.
export const eventEnvelope = z.object({
  roomName: z.string().min(1),
  source: z.enum(["session", "room"]),
  type: z.string().min(1),
  // ISO-8601 timestamp (the observer stamps each event)
  ts: z.string().datetime({ offset: true }),
  data: z.record(z.string(), z.unknown()).default({}),
  // Optional session metadata, sent on the first event of a session.
  meta: z
    .object({
      candidateName: z.string().optional(),
      agentName: z.string().optional(),
      interviewType: z.string().optional(),
      fixedQuestions: z.array(z.string()).optional(),
      raw: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

// The ingestion endpoint accepts a batch.
export const ingestBatch = z.object({
  events: z.array(eventEnvelope).min(1).max(500),
});

export type EventEnvelope = z.infer<typeof eventEnvelope>;
export type IngestBatch = z.infer<typeof ingestBatch>;
