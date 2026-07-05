import { NextResponse } from "next/server";
import { requireSessionOrApiKey } from "@/lib/api-key";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full session detail: metadata, transcript, flags, analyses, recording ref,
// and the raw event timeline. Requires dashboard session or read-only API key.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireSessionOrApiKey(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const supabase = db();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [turns, flags, analyses, recordings, events] = await Promise.all([
    supabase.from("transcript_turns").select("*").eq("session_id", id).order("ts"),
    supabase.from("flags").select("*").eq("session_id", id).order("ts"),
    supabase.from("analyses").select("*").eq("session_id", id),
    supabase.from("recordings").select("*").eq("session_id", id),
    supabase.from("events").select("id, source, type, ts, payload").eq("session_id", id).order("ts"),
  ]);

  return NextResponse.json({
    session,
    transcript: turns.data ?? [],
    flags: flags.data ?? [],
    analyses: analyses.data ?? [],
    recordings: recordings.data ?? [],
    timeline: events.data ?? [],
  });
}
