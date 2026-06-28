import { createClient } from "@supabase/supabase-js";
import IntegrationsClient from "./IntegrationsClient";

async function getSlackSettings() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from("settings").select("value").eq("key", "slack_integration").single();
  return data?.value ?? { webhook_url: "", enabled: false, notify_on: { issues: true, judge_disagree: true, abandoned: true } };
}

export default async function IntegrationsPage() {
  const slack = await getSlackSettings();
  return <IntegrationsClient slack={slack} />;
}
