import { NextResponse } from "next/server";
import { verifyIngestAuth } from "@/lib/auth";
import { ingestBatch } from "@/lib/schema";
import { processBatch } from "@/lib/ingest";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Receives batched native LiveKit events from the agent observer SDK.
export async function POST(req: Request) {
  if (!verifyIngestAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = ingestBatch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // The observer batches per room, but be defensive: group by roomName.
  const byRoom = new Map<string, typeof parsed.data.events>();
  for (const e of parsed.data.events) {
    const list = byRoom.get(e.roomName) ?? [];
    list.push(e);
    byRoom.set(e.roomName, list);
  }

  try {
    const results = [];
    for (const group of byRoom.values()) {
      results.push(await processBatch(db(), group));
    }
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("ingest processing error:", err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
