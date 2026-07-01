// Supabase Edge Function (Deno) — 14-day data retention purge.
// Invoked daily by pg_cron. Deletes sessions older than 14 days:
//   1. Removes recording objects from Supabase Storage
//   2. Deletes sessions rows — all child tables cascade automatically
//      (events, transcript_turns, flags, analyses, annotations, recordings)
//
// Secrets required (same as analyze function):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RECORDINGS_BUCKET (default: recordings)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = Deno.env.get("RECORDINGS_BUCKET") ?? "recordings";
const RETENTION_DAYS = 14;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  // 1. Find sessions to purge + their storage keys
  const { data: sessions, error: fetchErr } = await supabase
    .from("sessions")
    .select("id, room_name, recordings(bucket_key)")
    .lt("created_at", cutoff.toISOString());

  if (fetchErr) {
    console.error("fetch error:", fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  if (!sessions?.length) {
    return new Response(JSON.stringify({ purged: 0 }), { status: 200 });
  }

  // 2. Delete storage objects for sessions that have recordings
  const bucketKeys = (sessions as any[])
    .flatMap((s) => (s.recordings ?? []).map((r: any) => r.bucket_key))
    .filter(Boolean);

  if (bucketKeys.length) {
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .remove(bucketKeys);
    if (storageErr) {
      // Log but don't abort — orphaned files are recoverable; orphaned DB rows are not
      console.error("storage remove error:", storageErr.message);
    }
  }

  // 3. Delete sessions — cascades to all child tables
  const sessionIds = (sessions as any[]).map((s) => s.id);
  const { error: deleteErr, count } = await supabase
    .from("sessions")
    .delete({ count: "exact" })
    .in("id", sessionIds);

  if (deleteErr) {
    console.error("delete error:", deleteErr.message);
    return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500 });
  }

  console.log(`purged ${count} sessions (cutoff: ${cutoff.toISOString()}, storage keys: ${bucketKeys.length})`);
  return new Response(
    JSON.stringify({ purged: count, storageKeysDeleted: bucketKeys.length }),
    { status: 200 },
  );
});
