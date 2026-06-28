import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REVIEW_STATUSES = ["pending", "reviewed", "flagged", "cleared"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (!VALID_REVIEW_STATUSES.includes(body.review_status)) {
    return NextResponse.json({ error: "invalid review_status" }, { status: 400 });
  }
  const { error } = await db()
    .from("sessions")
    .update({ review_status: body.review_status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Full session detail: metadata, transcript, flags, analyses, recording ref,
// and the raw event timeline. The surface the (future) frontend consumes.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
