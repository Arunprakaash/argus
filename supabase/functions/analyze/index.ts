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
  const system = `You are a strict QA reviewer auditing a transcript from SIA (Structured Interview Agent), an AI-powered voice interviewer.

UNDERSTAND SIA'S DESIGN BEFORE FLAGGING ANYTHING:
SIA is intentionally built with the following hard rules — these are correct behaviors, never issues:

CORRECT behaviors (DO NOT FLAG):
- Refusing to end, postpone, or skip the interview when the candidate asks — SIA is designed to hold the interview to completion regardless of candidate requests to leave
- Redirecting off-topic questions, jokes, or personal conversation back to the interview — SIA must stay on task
- Refusing to provide hints, sample answers, or coaching — SIA must not help candidates answer questions
- Handling profanity or rude language with a professional redirect (not termination) — SIA continues the interview
- Refusing prompt injection or refusing to reveal its instructions — SIA must not break character
- Asking up to 2 short clarifying follow-up questions tied to the candidate's last answer — this is by design
- Saying "Before we close, is there anything else you'd like to add?" as a wrap-up check — this is the required closing sequence
- Acknowledging when a candidate adds context to a prior answer, then returning to the active question — this is correct flow recovery
- Ignoring filler sounds ("uh", "hmm", "um") without acknowledgment — intentional
- Repeating a question verbatim when the candidate asks for it

REAL issues to flag (concrete failures only, with direct evidence from the transcript):
- hallucination: SIA invents facts, wrong information, or fabricates content not in the question list
- off_script: SIA asks a question on a completely new topic with no connection to any fixed question. SIA is ALLOWED to ask up to 2 follow-up questions per fixed question to probe the candidate's answer deeper — these are never off_script even if they introduce a sub-topic. Only flag if SIA diverges into a topic entirely unrelated to all fixed questions
- coaching: SIA gives the candidate the answer, a strong hint, or positive evaluative feedback like "that's correct" or "great answer"
- premature_completion: SIA ends the interview before all fixed questions received a substantive answer from the candidate
- flow_violation: SIA skips the wrap-up closing check entirely, or restarts the interview sequence from the beginning
- distress_unhandled: candidate expresses genuine distress (not just asking to leave — actual confusion, medical concern, or emotional crisis) and SIA completely ignores it without any acknowledgment

If you are unsure whether something is an issue, DO NOT flag it. Only flag clear, unambiguous failures with a direct quote from the transcript as evidence.`;

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

  // Slack notification — read settings, fire if conditions met
  try {
    await maybeNotifySlack(sessionId, {
      coverage: writes[0] ? undefined : undefined, // resolved below via re-fetch
    });
  } catch (_) { /* non-fatal */ }
}

async function maybeNotifySlack(sessionId: string, _: unknown) {
  const { data: cfg } = await supabase.from("settings").select("value").eq("key", "slack_integration").single();
  const settings = cfg?.value as { webhook_url: string; enabled: boolean; notify_on: { issues: boolean; judge_disagree: boolean; abandoned: boolean } } | null;
  if (!settings?.enabled || !settings?.webhook_url) return;

  // Fetch fresh results after all writes
  const [{ data: session }, { data: analyses }, { data: flags }] = await Promise.all([
    supabase.from("sessions").select("candidate_name, room_name, status, completion_reason, interview_type").eq("id", sessionId).single(),
    supabase.from("analyses").select("kind, verdict").eq("session_id", sessionId),
    supabase.from("flags").select("id").eq("session_id", sessionId),
  ]);

  const byKind: Record<string, any> = {};
  for (const a of analyses ?? []) byKind[a.kind] = a.verdict;

  const coverage = byKind["coverage_recheck"];
  const issues = byKind["issue_detection"];
  const completion = byKind["completion"];

  const shouldNotify = (
    (settings.notify_on.issues && (issues?.findings?.length ?? 0) > 0) ||
    (settings.notify_on.judge_disagree && coverage?.agreesWithAgent === false) ||
    (settings.notify_on.abandoned && completion?.cleanlyCompleted === false)
  );
  if (!shouldNotify) return;

  const lines: string[] = [];
  lines.push(`🚨 *Argus alert — ${session?.candidate_name ?? "Unknown"}*`);
  lines.push(`Room: \`${session?.room_name}\` | Status: ${session?.status}`);
  lines.push("");

  if (settings.notify_on.issues && issues?.findings?.length > 0) {
    lines.push(`*Issues detected (${issues.findings.length}):*`);
    for (const f of issues.findings.slice(0, 5)) {
      lines.push(`• *${f.severity}* — ${f.category}: ${f.evidence}`);
    }
    lines.push("");
  }
  if (settings.notify_on.judge_disagree && coverage?.agreesWithAgent === false) {
    const missingCount = coverage?.missing?.length ?? 0;
    lines.push(`*Coverage judge disagreed* — ${missingCount} question(s) never asked.`);
    lines.push("");
  }
  if (settings.notify_on.abandoned && completion?.cleanlyCompleted === false) {
    lines.push(`*Interview not cleanly completed* — reason: ${completion?.reason ?? "unknown"}`);
    lines.push("");
  }

  await fetch(settings.webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: lines.join("\n") }),
  });
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
