// Supabase Edge Function (Deno) — analysis worker.
// Invoked on a schedule (pg_cron → net.http_post). Drains the `analysis_jobs`
// pgmq queue and runs LLM analyses against stored interview data.
//
// Secrets (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
//   ANALYSIS_MODEL (default claude-sonnet-4-6), ANALYSIS_MODEL_HARD (claude-opus-4-8)

import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MODEL = Deno.env.get("ANALYSIS_MODEL") ?? "gpt-4o-mini";
const MODEL_HARD = Deno.env.get("ANALYSIS_MODEL_HARD") ?? "gpt-4o";

const BATCH = 5; // jobs per invocation
const VT = 120; // visibility timeout seconds

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── LLM helpers ───────────────────────────────────────────────────────────────
async function askJson<T>(model: string, system: string, user: string): Promise<T> {
  const resp = await openai.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${system}\n\nRespond ONLY with a single valid JSON object, no prose.`,
      },
      { role: "user", content: user },
    ],
  });
  const text = resp.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text) as T;
}

// Port of judge/question_coverage.yaml — one target question at a time.
const COVERAGE_SYSTEM = `You are verifying whether a specific interview question was asked during an interview.
Given all messages spoken by the interviewer and ONE target question, answer whether
the interviewer asked that question (or a clear paraphrase of it).

Rules:
- Paraphrasing, reordering words, or natural conversational rephrasing all count as asked.
- If the question was clearly raised at any point, return asked: true.
- Only return asked: false if the question topic was never raised at all.`;

async function judgeQuestionAsked(question: string, transcript: string): Promise<boolean> {
  const out = await askJson<{ asked: boolean }>(
    MODEL,
    COVERAGE_SYSTEM,
    `Target question: ${question}\n\nInterviewer messages:\n${transcript}`,
  );
  return Boolean(out.asked);
}

// ── analyses ────────────────────────────────────────────────────────────────────
type Turn = { role: string; text: string; ts: string };

function interviewerTranscript(turns: Turn[]): string {
  return turns
    .filter((t) => t.role === "assistant" && t.text.trim())
    .map((t, i) => `[${i + 1}] ${t.text.trim()}`)
    .join("\n\n");
}

function fullTranscript(turns: Turn[]): string {
  return turns.map((t) => `${t.role}: ${t.text}`).join("\n");
}

// Reconstruct the agent judge's decision from complete_interview tool outputs.
function agentDetectedMissing(events: Array<{ type: string; payload: any }>): boolean | null {
  const completeCalls = events
    .filter((e) => e.type === "function_tools_executed")
    .flatMap((e) => {
      const calls = e.payload?.function_calls ?? [];
      const outputs = e.payload?.function_call_outputs ?? [];
      return calls
        .map((c: any, i: number) => ({ name: c?.name, output: outputs[i] }))
        .filter((c: any) => c.name === "complete_interview");
    });
  if (completeCalls.length === 0) return null;
  // If any complete_interview output instructed a revisit, the agent judge found gaps.
  return completeCalls.some((c: any) =>
    /revisit|missing|still.*ask|not.*asked|haven't asked/i.test(JSON.stringify(c.output ?? "")),
  );
}

async function runCoverageRecheck(
  fixedQuestions: string[],
  turns: Turn[],
  events: Array<{ type: string; payload: any }>,
) {
  const transcript = interviewerTranscript(turns);
  const results = await Promise.all(
    fixedQuestions.map(async (q) => ({ q, asked: await judgeQuestionAsked(q, transcript) })),
  );
  const missing = results.filter((r) => !r.asked).map((r) => r.q);
  const ourMissingDetected = missing.length > 0;
  const agentMissing = agentDetectedMissing(events);
  return {
    missing,
    ourMissingDetected,
    agentDetectedMissing: agentMissing,
    // null agentMissing = agent never called complete_interview (e.g. dropout)
    agreesWithAgent: agentMissing === null ? null : agentMissing === ourMissingDetected,
  };
}

async function runIssueDetection(fixedQuestions: string[], turns: Turn[]) {
  const system = `You are a strict QA reviewer auditing an AI interviewer's transcript.
Flag concrete issues only, with evidence. Categories:
- hallucination: the interviewer invents facts/answers/content
- off_script: asks a question on a NET-NEW topic not derived from the fixed questions.
  Brief clarifying follow-ups tied to the candidate's last answer are ALLOWED (the
  interviewer may ask up to two per question) — do NOT flag those as off_script.
- coaching: gives the candidate answers, hints, or evaluative feedback
- premature_completion: wraps up before all questions were covered
- flow_violation: skips the wrap-up check-in or restarts the sequence
- distress_unhandled: ignores candidate confusion/distress`;
  const user = `Fixed questions:\n${fixedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Transcript:
${fullTranscript(turns)}

Return JSON: { "findings": [ { "category": string, "severity": "low|medium|high", "evidence": string } ] }`;
  return askJson<{ findings: Array<{ category: string; severity: string; evidence: string }> }>(
    MODEL_HARD,
    system,
    user,
  );
}

// ── per-job processing ────────────────────────────────────────────────────────────
async function processJob(sessionId: string) {
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, completion_reason, fixed_questions, started_at, ended_at")
    .eq("id", sessionId)
    .single();
  if (!session) return;

  const { data: turns } = await supabase
    .from("transcript_turns")
    .select("role, text, ts")
    .eq("session_id", sessionId)
    .order("ts");
  const { data: events } = await supabase
    .from("events")
    .select("type, payload")
    .eq("session_id", sessionId)
    .eq("type", "function_tools_executed");

  const fixedQuestions: string[] = (session.fixed_questions ?? []) as string[];
  const turnList = (turns ?? []) as Turn[];
  const evs = (events ?? []) as Array<{ type: string; payload: any }>;

  const writes: Array<Promise<unknown>> = [];

  // 1) coverage re-check + judge-correctness
  try {
    const verdict = await runCoverageRecheck(fixedQuestions, turnList, evs);
    writes.push(upsertAnalysis(sessionId, "coverage_recheck", verdict, MODEL));
  } catch (err) {
    writes.push(upsertAnalysisError(sessionId, "coverage_recheck", err));
  }

  // 2) completion check (rule-based, cheap) + duration backfill
  let durationSec: number | null = null;
  if (session.started_at && session.ended_at) {
    durationSec =
      (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000;
    writes.push(supabase.from("sessions").update({ duration_sec: durationSec }).eq("id", sessionId));
  }
  const completionVerdict = {
    status: session.status,
    reason: session.completion_reason,
    cleanlyCompleted: session.status === "completed",
    durationSec,
  };
  writes.push(upsertAnalysis(sessionId, "completion", completionVerdict, "rule-based"));

  // 3) issue detection
  try {
    const issues = await runIssueDetection(fixedQuestions, turnList);
    writes.push(upsertAnalysis(sessionId, "issue_detection", issues, MODEL_HARD));
  } catch (err) {
    writes.push(upsertAnalysisError(sessionId, "issue_detection", err));
  }

  await Promise.all(writes);
}

function upsertAnalysis(sessionId: string, kind: string, verdict: unknown, model: string) {
  return supabase
    .from("analyses")
    .upsert(
      { session_id: sessionId, kind, verdict, model, status: "done", error: null },
      { onConflict: "session_id,kind" },
    );
}

function upsertAnalysisError(sessionId: string, kind: string, err: unknown) {
  return supabase
    .from("analyses")
    .upsert(
      { session_id: sessionId, kind, verdict: {}, status: "error", error: String(err) },
      { onConflict: "session_id,kind" },
    );
}

// ── queue drain ─────────────────────────────────────────────────────────────────
Deno.serve(async () => {
  const { data: messages, error } = await supabase.rpc("read_analysis_jobs", {
    vt: VT,
    qty: BATCH,
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let processed = 0;
  for (const m of messages ?? []) {
    const job = m.message as { sessionId: string };
    try {
      await processJob(job.sessionId);
      await supabase.rpc("delete_analysis_job", { msg_id: m.msg_id });
      processed++;
    } catch (err) {
      console.error("job failed, leaving for retry:", err);
      // Leave the message; visibility timeout will re-surface it.
    }
  }

  return new Response(JSON.stringify({ ok: true, processed }), {
    headers: { "content-type": "application/json" },
  });
});
