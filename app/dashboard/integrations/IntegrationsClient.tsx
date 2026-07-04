"use client";

import { useState } from "react";

interface SlackSettings {
  webhook_url: string;
  enabled: boolean;
  notify_on: { issues: boolean; judge_disagree: boolean; abandoned: boolean; proctoring: boolean };
}

interface SemanticSearchSettings {
  enabled: boolean;
}

export default function IntegrationsClient({
  slack: initialSlack,
  semanticSearch: initialSemanticSearch,
}: {
  slack: SlackSettings;
  semanticSearch: SemanticSearchSettings;
}) {
  const [slack, setSlack] = useState<SlackSettings>(initialSlack);
  const [semanticSearch, setSemanticSearch] = useState<SemanticSearchSettings>(initialSemanticSearch);
  const [slackSaving, setSlackSaving] = useState(false);
  const [semanticSaving, setSemanticSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [slackStatus, setSlackStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [semanticStatus, setSemanticStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  function setNotifyOn(key: keyof SlackSettings["notify_on"], val: boolean) {
    setSlack(s => ({ ...s, notify_on: { ...s.notify_on, [key]: val } }));
  }

  async function saveSlack() {
    setSlackSaving(true);
    setSlackStatus(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "slack_integration", value: slack }),
    });
    setSlackSaving(false);
    if (res.ok) setSlackStatus({ type: "ok", msg: "Settings saved." });
    else setSlackStatus({ type: "err", msg: "Failed to save settings." });
  }

  async function saveSemanticSearch() {
    setSemanticSaving(true);
    setSemanticStatus(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "semantic_search", value: semanticSearch }),
    });
    setSemanticSaving(false);
    if (res.ok) setSemanticStatus({ type: "ok", msg: "Settings saved." });
    else setSemanticStatus({ type: "err", msg: "Failed to save settings." });
  }

  async function testSlack() {
    if (!slack.webhook_url) return;
    setTesting(true);
    setSlackStatus(null);
    const res = await fetch("/api/integrations/slack/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhook_url: slack.webhook_url }),
    });
    setTesting(false);
    if (res.ok) setSlackStatus({ type: "ok", msg: "Test notification sent — check your Slack channel." });
    else {
      const d = await res.json();
      setSlackStatus({ type: "err", msg: d.error ?? "Test failed." });
    }
  }

  const configured = !!slack.webhook_url;

  return (
    <div className="content" style={{ maxWidth: 680 }}>
      <h1 className="page" style={{ marginBottom: 4 }}>Integrations</h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 13 }}>
        Configure notifications and search behavior for your Argus dashboard.
      </p>

      {/* Slack card */}
      <div className="card">
        <div className="card-h" style={{ background: "var(--panel)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={slack.enabled}
              onChange={e => setSlack(s => ({ ...s, enabled: e.target.checked }))}
            />
            <span>Enable Slack notifications</span>
          </label>

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
              <label className="toggle-row">
                <input type="checkbox" checked={slack.notify_on.proctoring}
                  onChange={e => setNotifyOn("proctoring", e.target.checked)} />
                <span>Vision proctoring flags detected</span>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
            <button className="btn btn-primary" onClick={saveSlack} disabled={slackSaving}>
              {slackSaving ? "Saving…" : "Save"}
            </button>
            <button className="btn" onClick={testSlack} disabled={testing || !slack.webhook_url}>
              {testing ? "Sending…" : "Send test"}
            </button>
            {slackStatus && (
              <span style={{ fontSize: 13, color: slackStatus.type === "ok" ? "var(--accent)" : "crimson" }}>
                {slackStatus.msg}
              </span>
            )}
          </div>

        </div>
      </div>

      {/* Semantic search card */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-h" style={{ background: "var(--panel)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span style={{ fontWeight: 600 }}>Semantic search</span>
          </div>
          <span className={`badge dot ${semanticSearch.enabled ? "green" : "gray"}`}>
            {semanticSearch.enabled ? "enabled" : "disabled"}
          </span>
        </div>
        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={semanticSearch.enabled}
              onChange={e => setSemanticSearch(s => ({ ...s, enabled: e.target.checked }))}
            />
            <span>Enable transcript indexing and semantic search</span>
          </label>
          <div className="field-hint">
            When off, new interviews are not embedded (saves OpenAI cost) and dashboard search uses keyword matching only.
            Existing indexed sessions are kept and become searchable again if you re-enable this.
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
            <button className="btn btn-primary" onClick={saveSemanticSearch} disabled={semanticSaving}>
              {semanticSaving ? "Saving…" : "Save"}
            </button>
            {semanticStatus && (
              <span style={{ fontSize: 13, color: semanticStatus.type === "ok" ? "var(--accent)" : "crimson" }}>
                {semanticStatus.msg}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
