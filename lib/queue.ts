import { db } from "./db";

// Supabase Queues (pgmq) — enqueue an analysis job.
// Requires the Queues feature enabled (exposes the `pgmq_public` schema with
// send/read/archive/delete RPCs).
export type AnalysisJob = {
  sessionId: string;
  roomName: string;
  // Which analyses to run; defaults to all four.
  kinds?: Array<"coverage_recheck" | "issue_detection" | "completion" | "quality">;
};

export async function enqueueAnalysis(job: AnalysisJob): Promise<void> {
  // public.enqueue_analysis is a SECURITY DEFINER wrapper over pgmq.send.
  const { error } = await db().rpc("enqueue_analysis", { job });
  if (error) throw new Error(`enqueueAnalysis failed: ${error.message}`);
}
