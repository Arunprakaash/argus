import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
  WebhookReceiver,
} from "livekit-server-sdk";
import { env } from "./env";

export function webhookReceiver(): WebhookReceiver {
  return new WebhookReceiver(env.livekitApiKey(), env.livekitApiSecret());
}

function egressClient(): EgressClient {
  return new EgressClient(env.livekitUrl(), env.livekitApiKey(), env.livekitApiSecret());
}

// S3Upload pointed at Supabase Storage (S3-compatible).
function supabaseS3(): S3Upload {
  return new S3Upload({
    accessKey: env.s3AccessKey(),
    secret: env.s3SecretKey(),
    region: env.s3Region(),
    bucket: env.recordingsBucket(),
    endpoint: env.s3Endpoint(),
    forcePathStyle: true,
  });
}

// Start an audio-only room-composite egress into Supabase Storage.
// Returns { egressId, bucketKey }. Video is deferred — flip audioOnly off later.
export async function startAudioEgress(
  roomName: string,
): Promise<{ egressId: string; bucketKey: string }> {
  // Deterministic key per room so we can correlate on egress_ended.
  const bucketKey = `audio/${roomName}.ogg`;
  const fileOutput = new EncodedFileOutput({
    fileType: EncodedFileType.OGG,
    filepath: bucketKey,
    disableManifest: true,
    output: { case: "s3", value: supabaseS3() },
  });

  const info = await egressClient().startRoomCompositeEgress(
    roomName,
    { file: fileOutput },
    { audioOnly: true },
  );
  return { egressId: info.egressId, bucketKey };
}
