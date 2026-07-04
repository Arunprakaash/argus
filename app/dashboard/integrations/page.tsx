import { createClient } from "@supabase/supabase-js";
import IntegrationsClient from "./IntegrationsClient";
import { getSemanticSearchSettings } from "@/lib/settings";

async function getSlackSettings() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from("settings").select("value").eq("key", "slack_integration").single();
  const defaults = {
    webhook_url: "",
    enabled: false,
    notify_on: { issues: true, judge_disagree: true, abandoned: true, proctoring: true },
  };
  const value = data?.value as typeof defaults | undefined;
  return {
    ...defaults,
    ...value,
    notify_on: { ...defaults.notify_on, ...(value?.notify_on ?? {}) },
  };
}

export default async function IntegrationsPage() {
  const [slack, semanticSearch] = await Promise.all([
    getSlackSettings(),
    getSemanticSearchSettings(),
  ]);
  return <IntegrationsClient slack={slack} semanticSearch={semanticSearch} />;
}
