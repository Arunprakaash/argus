import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  const { q } = await req.json();
  if (!q?.trim()) return NextResponse.json({ sessions: [] });

  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: q.trim().slice(0, 1000),
  });

  const { data, error } = await db().rpc("match_sessions", {
    query_embedding: resp.data[0].embedding,
    match_count: 8,
    match_threshold: 0.25,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
