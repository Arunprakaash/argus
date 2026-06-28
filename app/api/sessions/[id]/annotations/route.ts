import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { note, author } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "note required" }, { status: 400 });

  const { data, error } = await sb()
    .from("annotations")
    .insert({ session_id: id, note: note.trim(), author: author?.trim() || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { annotationId } = await req.json();
  const { error } = await sb().from("annotations").delete().eq("id", annotationId).eq("session_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
