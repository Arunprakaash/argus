import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List sessions, newest first. Supports ?status= and ?limit=.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  let q = db()
    .from("sessions")
    .select(
      "id, room_name, status, completion_reason, candidate_name, agent_name, interview_type, started_at, ended_at, duration_sec, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}
