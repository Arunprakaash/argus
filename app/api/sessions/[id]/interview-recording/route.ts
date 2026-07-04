import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RecordingNotFoundError, signInterviewRecording } from "@/lib/interview-recording";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data: session, error } = await db()
    .from("sessions")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  try {
    const signed = await signInterviewRecording(session.metadata);
    return NextResponse.json(signed);
  } catch (err) {
    if (err instanceof RecordingNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const msg = err instanceof Error ? err.message : "sign failed";
    if (msg.includes("does not match")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
