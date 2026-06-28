import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { webhook_url } = await req.json();
  if (!webhook_url) return NextResponse.json({ error: "webhook_url required" }, { status: 400 });

  const res = await fetch(webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "✅ *Argus* — test notification. Slack integration is working correctly.",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Slack returned ${res.status}: ${text}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
