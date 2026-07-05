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
  const [slack, email, webhook, livekit, semanticSearch, apiKeys] = await Promise.all([
    getSlackSettings(),
    getEmailSettings(),
    getGenericWebhookSettings(),
    getLiveKitSettings(),
    getSemanticSearchSettings(),
    db()
      .from("api_keys")
      .select("id, name, key_prefix, created_at, last_used_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => data ?? []),
  ]);

  return (
    <IntegrationsClient
      slack={slack}
      email={email}
      webhook={webhook}
      livekit={livekit}
      semanticSearch={semanticSearch}
      apiKeys={apiKeys}
    />
  );
}
