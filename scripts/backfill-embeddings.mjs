#!/usr/bin/env node
// Backfills transcript_embedding for all sessions that have transcripts but no embedding.
// Run from the project root: node scripts/backfill-embeddings.mjs

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Parse .env.local
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

async function main() {
  // Find sessions with transcript turns but no embedding
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, candidate_name, room_name")
    .is("transcript_embedding", null)
    .order("created_at", { ascending: false });

  if (error) { console.error("fetch failed:", error.message); process.exit(1); }
  if (!sessions?.length) { console.log("All sessions already have embeddings."); return; }

  console.log(`Found ${sessions.length} sessions without embeddings. Processing...`);

  let done = 0, skipped = 0, failed = 0;

  for (const session of sessions) {
    const { data: turns } = await supabase
      .from("transcript_turns")
      .select("role, text")
      .eq("session_id", session.id)
      .order("ts");

    const text = (turns ?? []).map((t) => `${t.role}: ${t.text}`).join("\n").trim().slice(0, 8000);

    if (!text) {
      console.log(`  skip ${session.room_name} — no transcript`);
      skipped++;
      continue;
    }

    try {
      const resp = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
      await supabase
        .from("sessions")
        .update({ transcript_embedding: resp.data[0].embedding })
        .eq("id", session.id);
      done++;
      console.log(`  [${done}/${sessions.length - skipped}] embedded ${session.candidate_name ?? "Unknown"} (${session.room_name})`);
    } catch (err) {
      failed++;
      console.error(`  FAILED ${session.room_name}:`, err.message);
    }
  }

  console.log(`\nDone. embedded=${done} skipped=${skipped} failed=${failed}`);
}

main();
