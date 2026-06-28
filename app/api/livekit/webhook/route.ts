import { NextResponse } from "next/server";
import { webhookReceiver } from "@/lib/livekit";
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
        await supabase.from("sessions").upsert(
          { room_name: roomName, started_at: new Date().toISOString() },
          { onConflict: "room_name" },
        );
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

      default:
        break;
    }
  } catch (err) {
    console.error(`webhook handler error (${event.event}):`, err);
    // Return 200 so LiveKit doesn't hammer retries on our transient DB errors.
  }

  return NextResponse.json({ ok: true });
}
