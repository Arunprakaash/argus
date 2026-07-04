import { db } from "./db";

export type SemanticSearchSettings = { enabled: boolean };

export async function getSemanticSearchSettings(): Promise<SemanticSearchSettings> {
  const { data } = await db().from("settings").select("value").eq("key", "semantic_search").single();
  return { enabled: (data?.value as SemanticSearchSettings | undefined)?.enabled ?? false };
}
