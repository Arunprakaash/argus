// Centralized environment access. Throws early if a required server var is missing.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),

  ingestApiKey: () => required("INGEST_API_KEY"),

  livekitUrl: () => required("LIVEKIT_URL"),
  livekitApiKey: () => required("LIVEKIT_API_KEY"),
  livekitApiSecret: () => required("LIVEKIT_API_SECRET"),

  // Supabase Storage S3-compatible endpoint (egress target)
  s3Endpoint: () => required("SUPABASE_S3_ENDPOINT"),
  s3Region: () => optional("SUPABASE_S3_REGION", "us-east-1"),
  s3AccessKey: () => required("SUPABASE_S3_ACCESS_KEY"),
  s3SecretKey: () => required("SUPABASE_S3_SECRET_KEY"),
  recordingsBucket: () => optional("RECORDINGS_BUCKET", "recordings"),
};
