import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const PRESIGN_EXPIRES_SEC = 600;

export type ParsedS3Object = { bucket: string; key: string; region: string };

/** Pull recording_url from session metadata (ingested job metadata). */
export function extractRecordingUrl(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as Record<string, unknown>).recording_url;
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim();
}

/** Parse virtual-hosted-style S3 URL: bucket.s3.region.amazonaws.com/key */
export function parseS3HttpUrl(url: string): ParsedS3Object | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const hostMatch = parsed.hostname.match(/^([^.]+)\.s3(?:\.([a-z0-9-]+))?\.amazonaws\.com$/i);
  if (!hostMatch) return null;

  const bucket = hostMatch[1];
  const region = hostMatch[2] || env.interviewS3Region();
  const key = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!key) return null;

  return { bucket, key, region };
}

function assertInterviewS3Config(): { bucket: string; region: string; accessKeyId: string; secretAccessKey: string } {
  const bucket = env.interviewS3Bucket();
  const region = env.interviewS3Region();
  const accessKeyId = env.awsAccessKeyId();
  const secretAccessKey = env.awsSecretAccessKey();
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Interview S3 is not configured (INTERVIEW_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)");
  }
  return { bucket, region, accessKeyId, secretAccessKey };
}

/** Mint a presigned GET URL for the interview recording referenced in metadata. */
export async function signInterviewRecording(metadata: unknown): Promise<{ url: string; expiresInSec: number }> {
  const rawUrl = extractRecordingUrl(metadata);
  if (!rawUrl) throw new RecordingNotFoundError();

  const parsed = parseS3HttpUrl(rawUrl);
  if (!parsed) throw new Error("Invalid interview recording URL in session metadata");

  const cfg = assertInterviewS3Config();
  if (parsed.bucket !== cfg.bucket) {
    throw new Error("Recording bucket does not match INTERVIEW_S3_BUCKET");
  }

  const client = new S3Client({
    region: parsed.region || cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
      ResponseContentType: "video/mp4",
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: PRESIGN_EXPIRES_SEC },
  );

  return { url, expiresInSec: PRESIGN_EXPIRES_SEC };
}

export class RecordingNotFoundError extends Error {
  constructor() {
    super("no interview recording in session metadata");
    this.name = "RecordingNotFoundError";
  }
}
