"use client";

import { useState } from "react";

interface SlackSettings {
  webhook_url: string;
  enabled: boolean;
  notify_on: { issues: boolean; judge_disagree: boolean; abandoned: boolean };
}

export default function IntegrationsClient({ slack: initial }: { slack: SlackSettings }) {
  const [slack, setSlack] = useState<SlackSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  function setNotifyOn(key: keyof SlackSettings["notify_on"], val: boolean) {
    setSlack(s => ({ ...s, notify_on: { ...s.notify_on, [key]: val } }));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "slack_integration", value: slack }),
    });
    setSaving(false);
    if (res.ok) setStatus({ type: "ok", msg: "Settings saved." });
    else setStatus({ type: "err", msg: "Failed to save settings." });
  }

  async function testSlack() {
    if (!slack.webhook_url) return;
    setTesting(true);
    setStatus(null);
    const res = await fetch("/api/integrations/slack/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhook_url: slack.webhook_url }),
    });
    setTesting(false);
    if (res.ok) setStatus({ type: "ok", msg: "Test notification sent — check your Slack channel." });
    else {
      const d = await res.json();
      setStatus({ type: "err", msg: d.error ?? "Test failed." });
    }
  }

  const configured = !!slack.webhook_url;

  return (
    <div className="content" style={{ maxWidth: 680 }}>
      <h1 className="page" style={{ marginBottom: 4 }}>Integrations</h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 13 }}>
        Configure notifications so Argus alerts you when issues are detected in an interview.
      </p>

      {/* Slack card */}
      <div className="card">
        <div className="card-h" style={{ background: "var(--panel)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Slack bolt icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span style={{ fontWeight: 600 }}>Slack</span>
          </div>
          <span className={`badge dot ${configured && slack.enabled ? "green" : "gray"}`}>
            {configured && slack.enabled ? "active" : configured ? "disabled" : "not configured"}
          </span>
        </div>
        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Webhook URL */}
          <div className="field-group">
            <label className="field-label">Incoming webhook URL</label>
            <input
              type="url"
              className="inp"
              placeholder="https://hooks.slack.com/services/…"
              value={slack.webhook_url}
              onChange={e => setSlack(s => ({ ...s, webhook_url: e.target.value }))}
            />
            <div className="field-hint">
              Create one at <span className="mono">api.slack.com/messaging/webhooks</span>
            </div>
          </div>

          {/* Enable toggle */}
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={slack.enabled}
              onChange={e => setSlack(s => ({ ...s, enabled: e.target.checked }))}
            />
            <span>Enable Slack notifications</span>
          </label>

          {/* Conditions */}
          <div>
            <div className="field-label" style={{ marginBottom: 10 }}>Notify when</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="toggle-row">
                <input type="checkbox" checked={slack.notify_on.issues}
                  onChange={e => setNotifyOn("issues", e.target.checked)} />
                <span>Issues detected in interview</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={slack.notify_on.judge_disagree}
                  onChange={e => setNotifyOn("judge_disagree", e.target.checked)} />
                <span>Coverage judge disagrees with agent</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={slack.notify_on.abandoned}
                  onChange={e => setNotifyOn("abandoned", e.target.checked)} />
                <span>Interview abandoned / not completed cleanly</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn" onClick={testSlack} disabled={testing || !slack.webhook_url}>
              {testing ? "Sending…" : "Send test"}
            </button>
            {status && (
              <span style={{ fontSize: 13, color: status.type === "ok" ? "var(--accent)" : "crimson" }}>
                {status.msg}
              </span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
