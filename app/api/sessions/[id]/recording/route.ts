import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mint a short-lived signed URL for the session's audio recording.
// The raw bucket object is never exposed directly.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = db();

  const { data: rec, error } = await supabase
    .from("recordings")
    .select("bucket_key")
    .eq("session_id", id)
    .eq("kind", "audio")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rec) return NextResponse.json({ error: "no recording" }, { status: 404 });

  const { data: signed, error: signErr } = await supabase.storage
    .from(env.recordingsBucket())
    .createSignedUrl(rec.bucket_key, 60 * 10); // 10 minutes
  if (signErr || !signed) {
    return NextResponse.json({ error: signErr?.message ?? "sign failed" }, { status: 500 });
  }
  return NextResponse.json({ url: signed.signedUrl, expiresInSec: 600 });
}
