import { db } from "./db";
import {
  parseEmailSettings,
  parseGenericWebhookSettings,
  parseLiveKitSettings,
  parseSlackSettings,
  type EmailSettings,
  type GenericWebhookSettings,
  type LiveKitSettings,
  type SemanticSearchSettings,
  type SlackSettings,
} from "./integration-types";

async function getSetting<T>(key: string, parse: (v: unknown) => T): Promise<T> {
  const { data } = await db().from("settings").select("value").eq("key", key).single();
  return parse(data?.value);
}

export async function getSemanticSearchSettings(): Promise<SemanticSearchSettings> {
  const s = await getSetting("semantic_search", (v) => ({
    enabled: (v as SemanticSearchSettings | undefined)?.enabled ?? false,
  }));
  return s;
}

export async function getSlackSettings(): Promise<SlackSettings> {
  return getSetting("slack_integration", parseSlackSettings);
}

export async function getEmailSettings(): Promise<EmailSettings> {
  return getSetting("email_integration", parseEmailSettings);
}

export async function getGenericWebhookSettings(): Promise<GenericWebhookSettings> {
  return getSetting("generic_webhook_integration", parseGenericWebhookSettings);
}

export async function getLiveKitSettings(): Promise<LiveKitSettings> {
  return getSetting("livekit_integration", parseLiveKitSettings);
}
