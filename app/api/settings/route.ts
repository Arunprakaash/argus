import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const { data, error } = await sb().from("settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const map: Record<string, any> = {};
  for (const row of data ?? []) map[row.key] = row.value;
  return NextResponse.json(map);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, value } = body;
  if (!key || value === undefined) return NextResponse.json({ error: "key and value required" }, { status: 400 });
  const { error } = await sb().rpc("upsert_setting", { p_key: key, p_value: value });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
