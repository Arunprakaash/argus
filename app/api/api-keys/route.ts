import { NextRequest, NextResponse } from "next/server";
import { requireDashboardUser, unauthorizedResponse } from "@/lib/auth-dashboard";
import { generateApiKey } from "@/lib/api-key";
import { db } from "@/lib/db";

export async function GET() {
  const user = await requireDashboardUser();
  if (!user) return unauthorizedResponse();

  const { data, error } = await db()
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireDashboardUser();
  if (!user) return unauthorizedResponse();

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { key, prefix, hash } = generateApiKey();
  const { data, error } = await db()
    .from("api_keys")
    .insert({ name: name.trim(), key_prefix: prefix, key_hash: hash })
    .select("id, name, key_prefix, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key, api_key: data });
}

export async function DELETE(req: NextRequest) {
  const user = await requireDashboardUser();
  if (!user) return unauthorizedResponse();

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db().from("api_keys").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
