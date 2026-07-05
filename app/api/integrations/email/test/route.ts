import { NextRequest, NextResponse } from "next/server";
import { buildAlertLines, sendResendEmail } from "@/lib/notifications";

const SAMPLE: Parameters<typeof buildAlertLines>[0] = {
  sessionId: "00000000-0000-0000-0000-000000000000",
  candidateName: "Test Candidate",
  roomName: "interview_test_room",
  status: "completed",
  completionReason: null,
  interviewType: "technical",
  issues: [{ severity: "medium", category: "clarity", evidence: "Example issue from test notification." }],
  coverageDisagrees: false,
  missingCount: 0,
  notCleanlyCompleted: false,
  completionReasonDetail: null,
  proctoringFlags: [],
  dashboardUrl: null,
  livekitUrl: null,
};

export async function POST(req: NextRequest) {
  const { to } = await req.json();
  if (!to) return NextResponse.json({ error: "to required" }, { status: 400 });

  try {
    const text = buildAlertLines(SAMPLE).join("\n");
    await sendResendEmail(to, "Argus test notification", text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
