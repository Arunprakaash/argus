import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Server-side Supabase client using the service-role key. Never import this from
// client components — it bypasses RLS.
let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}
