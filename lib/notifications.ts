import { createHash } from "crypto";

export type AlertContext = {
  sessionId: string;
  candidateName: string;
  roomName: string;
  status: string;
  completionReason: string | null;
  interviewType: string | null;
  issues: { severity: string; category: string; evidence: string }[];
  coverageDisagrees: boolean;
  missingCount: number;
  notCleanlyCompleted: boolean;
  completionReasonDetail: string | null;
  proctoringFlags: { type: string; elapsed?: number }[];
  dashboardUrl: string | null;
  livekitUrl: string | null;
};

export function buildAlertLines(ctx: AlertContext): string[] {
  const lines: string[] = [];
  lines.push(`🚨 Argus alert — ${ctx.candidateName}`);
  lines.push(`Room: ${ctx.roomName} | Status: ${ctx.status}`);
  if (ctx.dashboardUrl) lines.push(`Session: ${ctx.dashboardUrl}`);
  if (ctx.livekitUrl) lines.push(`LiveKit: ${ctx.livekitUrl}`);
  lines.push("");

  if (ctx.issues.length > 0) {
    lines.push(`Issues detected (${ctx.issues.length}):`);
    for (const f of ctx.issues.slice(0, 5)) {
      lines.push(`• ${f.severity} — ${f.category}: ${f.evidence}`);
    }
    lines.push("");
  }
  if (ctx.coverageDisagrees) {
    lines.push(`Coverage judge disagreed — ${ctx.missingCount} question(s) never asked.`);
    lines.push("");
  }
  if (ctx.notCleanlyCompleted) {
    lines.push(`Interview not cleanly completed — reason: ${ctx.completionReasonDetail ?? "unknown"}`);
    lines.push("");
  }
  if (ctx.proctoringFlags.length > 0) {
    lines.push(`Vision proctoring flags (${ctx.proctoringFlags.length}):`);
    for (const f of ctx.proctoringFlags.slice(0, 5)) {
      const suffix = f.elapsed === undefined ? "" : ` at ${f.elapsed}s`;
      lines.push(`• ${f.type}${suffix}`);
    }
    lines.push("");
  }
  return lines;
}

export function buildSlackPayload(ctx: AlertContext) {
  const text = buildAlertLines(ctx)
    .map((line) => {
      if (line.startsWith("🚨")) return line.replace("🚨 ", "🚨 *") + "*";
      if (line.startsWith("Issues detected")) return `*${line}*`;
      if (line.startsWith("Coverage judge")) return `*${line}*`;
      if (line.startsWith("Interview not cleanly")) return `*${line}*`;
      if (line.startsWith("Vision proctoring")) return `*${line}*`;
      if (line.startsWith("Room:")) {
        const [room, status] = line.split(" | ");
        return `${room.replace("Room: ", "Room: `")}\` | ${status}`;
      }
      return line;
    })
    .join("\n");
  return { text };
}

export function buildWebhookPayload(ctx: AlertContext) {
  return {
    event: "argus.session.alert",
    session_id: ctx.sessionId,
    candidate_name: ctx.candidateName,
    room_name: ctx.roomName,
    status: ctx.status,
    dashboard_url: ctx.dashboardUrl,
    livekit_url: ctx.livekitUrl,
    summary: buildAlertLines(ctx).join("\n"),
  };
}

export async function sendResendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const from = process.env.RESEND_FROM ?? "Argus <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend returned ${res.status}: ${body}`);
  }
}

export function hashApiKeyNode(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
