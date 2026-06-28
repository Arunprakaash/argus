import { NextResponse } from "next/server";
import { webhookReceiver, startAudioEgress } from "@/lib/livekit";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// LiveKit Cloud webhook receiver: room/participant/egress lifecycle.
// This stream is independent of the agent process, so we still learn final
// room state + egress file locations even if the agent crashes.
export async function POST(req: Request) {
  const body = await req.text();
  const authHeader = req.headers.get("Authorization") ?? "";

  let event;
  try {
    event = await webhookReceiver().receive(body, authHeader);
  } catch (err) {
    console.error("webhook verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const supabase = db();
  const roomName = event.room?.name ?? event.egressInfo?.roomName;

  try {
    switch (event.event) {
      case "room_started": {
        if (!roomName) break;
        // Ensure a session row exists, then start audio egress into our bucket.
        await supabase.from("sessions").upsert(
          { room_name: roomName, started_at: new Date().toISOString() },
          { onConflict: "room_name" },
        );
        try {
          const { egressId } = await startAudioEgress(roomName);
          await supabase.from("sessions").update({ egress_id: egressId }).eq("room_name", roomName);
        } catch (err) {
          console.error("startAudioEgress failed:", err);
        }
        break;
      }

      case "room_finished": {
        if (!roomName) break;
        // Mark abandoned only if the agent didn't already report a clean close.
        await supabase
          .from("sessions")
          .update({ ended_at: new Date().toISOString() })
          .eq("room_name", roomName)
          .is("ended_at", null);
        break;
      }

      case "egress_ended": {
        const info = event.egressInfo;
        if (!info || !roomName) break;
        const file = info.fileResults?.[0];
        const { data: sess } = await supabase
          .from("sessions")
          .select("id")
          .eq("room_name", roomName)
          .single();
        if (!sess) break;
        // bigint nanoseconds → seconds / ISO.
        const nsToSec = (v?: bigint) => (v ? Number(v) / 1e9 : null);
        const nsToIso = (v?: bigint) =>
          v ? new Date(Number(v) / 1e6).toISOString() : null;
        await supabase.from("recordings").upsert(
          {
            session_id: sess.id,
            egress_id: info.egressId,
            bucket_key: file?.filename ?? `audio/${roomName}.ogg`,
            kind: "audio",
            duration_sec: nsToSec(file?.duration),
            size_bytes: file?.size ? Number(file.size) : null,
            started_at: nsToIso(file?.startedAt),
            ended_at: nsToIso(file?.endedAt),
          },
          { onConflict: "session_id,bucket_key" },
        );
        break;
      }

      // egress_started / egress_updated / participant_* / track_* — logged implicitly
      // by the agent observer; nothing extra to persist here for now.
      default:
        break;
    }
  } catch (err) {
    console.error(`webhook handler error (${event.event}):`, err);
    // Return 200 so LiveKit doesn't hammer retries on our transient DB errors.
  }

  return NextResponse.json({ ok: true });
}
