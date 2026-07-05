import type { ReactNode } from "react";
import type { NotifyOn } from "@/lib/integration-types";

export function NotifyOnFields({
  value,
  onChange,
}: {
  value: NotifyOn;
  onChange: (key: keyof NotifyOn, val: boolean) => void;
}) {
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 10 }}>Notify when</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="toggle-row">
          <input type="checkbox" checked={value.issues} onChange={(e) => onChange("issues", e.target.checked)} />
          <span>Issues detected in interview</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={value.judge_disagree} onChange={(e) => onChange("judge_disagree", e.target.checked)} />
          <span>Coverage judge disagrees with agent</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={value.abandoned} onChange={(e) => onChange("abandoned", e.target.checked)} />
          <span>Interview abandoned / not completed cleanly</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={value.proctoring} onChange={(e) => onChange("proctoring", e.target.checked)} />
          <span>Vision proctoring flags detected</span>
        </label>
      </div>
    </div>
  );
}

export function SaveRow({
  saving,
  onSave,
  onTest,
  testing,
  testDisabled,
  status,
}: {
  saving: boolean;
  onSave: () => void;
  onTest?: () => void;
  testing?: boolean;
  testDisabled?: boolean;
  status: { type: "ok" | "err"; msg: string } | null;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4, flexWrap: "wrap" }}>
      <button className="btn btn-primary" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      {onTest && (
        <button className="btn" onClick={onTest} disabled={testing || testDisabled}>
          {testing ? "Sending…" : "Send test"}
        </button>
      )}
      {status && (
        <span style={{ fontSize: 13, color: status.type === "ok" ? "var(--accent)" : "crimson" }}>
          {status.msg}
        </span>
      )}
    </div>
  );
}

export function IntegrationCardHeader({
  icon,
  title,
  badge,
}: {
  icon: ReactNode;
  title: string;
  badge: { label: string; tone: "green" | "gray" };
}) {
  return (
    <div className="card-h" style={{ background: "var(--panel)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon}
        <span style={{ fontWeight: 600 }}>{title}</span>
      </div>
      <span className={`badge dot ${badge.tone}`}>{badge.label}</span>
    </div>
  );
}

async function saveSetting(key: string, value: unknown) {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  return res.ok;
}

export async function persistSetting(
  key: string,
  value: unknown,
  setSaving: (v: boolean) => void,
  setStatus: (s: { type: "ok" | "err"; msg: string } | null) => void,
) {
  setSaving(true);
  setStatus(null);
  const ok = await saveSetting(key, value);
  setSaving(false);
  setStatus(ok ? { type: "ok", msg: "Settings saved." } : { type: "err", msg: "Failed to save settings." });
}
