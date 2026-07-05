import { createHash, randomBytes } from "crypto";
import { db } from "./db";

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `argus_${randomBytes(24).toString("hex")}`;
  const prefix = key.slice(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function readApiKeyFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  const header = req.headers.get("x-api-key");
  return header?.trim() || null;
}

export async function validateApiKey(key: string | null): Promise<boolean> {
  if (!key?.startsWith("argus_")) return false;
  const hash = hashApiKey(key);
  const { data } = await db()
    .from("api_keys")
    .select("id")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!data) return false;
  void db().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return true;
}

export async function requireSessionOrApiKey(req: Request): Promise<boolean> {
  const key = readApiKeyFromRequest(req);
  if (key && (await validateApiKey(key))) return true;
  const { supabaseServer } = await import("./supabase-server");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}
