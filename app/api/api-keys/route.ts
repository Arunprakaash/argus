import { NextRequest, NextResponse } from "next/server";
import { requireDashboardUser, unauthorizedResponse } from "@/lib/auth-dashboard";
import { generateApiKey } from "@/lib/api-key";
import { db } from "@/lib/db";

function apiKeysErrorResponse(message: string, status = 500) {
  if (/api_keys|schema cache|does not exist|42P01/i.test(message)) {
    return NextResponse.json(
      {
        error:
          "The api_keys table is missing. Apply migrations with `supabase db push`, or run scripts/apply-api-keys-table.sql in the Supabase SQL editor.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const user = await requireDashboardUser();
  if (!user) return unauthorizedResponse();

  const { data, error } = await db()
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .order("created_at", { ascending: false });
  if (error) return apiKeysErrorResponse(error.message);
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
  if (error) return apiKeysErrorResponse(error.message);
  return NextResponse.json({ key, api_key: data });
}

export async function DELETE(req: NextRequest) {
  const user = await requireDashboardUser();
  if (!user) return unauthorizedResponse();

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db().from("api_keys").delete().eq("id", id);
  if (error) return apiKeysErrorResponse(error.message);
  return NextResponse.json({ ok: true });
}
