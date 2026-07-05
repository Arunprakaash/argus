import {
  getEmailSettings,
  getGenericWebhookSettings,
  getLiveKitSettings,
  getSemanticSearchSettings,
  getSlackSettings,
} from "@/lib/settings";
import { db } from "@/lib/db";
import IntegrationsClient from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const [slack, email, webhook, livekit, semanticSearch, apiKeysResult] = await Promise.all([
    getSlackSettings(),
    getEmailSettings(),
    getGenericWebhookSettings(),
    getLiveKitSettings(),
    getSemanticSearchSettings(),
    db()
      .from("api_keys")
      .select("id, name, key_prefix, created_at, last_used_at")
      .order("created_at", { ascending: false }),
  ]);

  const apiKeys = apiKeysResult.error ? [] : (apiKeysResult.data ?? []);
  const apiKeysSetupError = apiKeysResult.error
    ? (/api_keys|schema cache|does not exist|42P01/i.test(apiKeysResult.error.message)
        ? "The api_keys table is missing. Run `supabase db push` or scripts/apply-api-keys-table.sql in the Supabase SQL editor."
        : apiKeysResult.error.message)
    : null;

  return (
    <IntegrationsClient
      slack={slack}
      email={email}
      webhook={webhook}
      livekit={livekit}
      semanticSearch={semanticSearch}
      apiKeys={apiKeys}
      apiKeysSetupError={apiKeysSetupError}
    />
  );
}
