import { NextRequest, NextResponse } from "next/server";
import { buildWebhookPayload } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const payload = buildWebhookPayload({
    sessionId: "00000000-0000-0000-0000-000000000000",
    candidateName: "Test Candidate",
    roomName: "interview_test_room",
    status: "completed",
    completionReason: null,
    interviewType: "technical",
    issues: [],
    coverageDisagrees: false,
    missingCount: 0,
    notCleanlyCompleted: false,
    completionReasonDetail: null,
    proctoringFlags: [],
    dashboardUrl: null,
    livekitUrl: null,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, test: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Webhook returned ${res.status}: ${text}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
