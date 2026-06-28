import { env } from "./env";

// Constant-time-ish comparison to avoid trivial timing leaks.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// Verify the ingestion API key presented by the observer SDK.
// Accepts either `Authorization: Bearer <key>` or `x-api-key: <key>`.
export function verifyIngestAuth(req: Request): boolean {
  const expected = env.ingestApiKey();
  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return safeEqual(bearer.slice(7).trim(), expected);
  }
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) return safeEqual(apiKey.trim(), expected);
  return false;
}
