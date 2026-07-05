"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type {
  ApiKeyRow,
  EmailSettings,
  GenericWebhookSettings,
  LiveKitSettings,
  NotifyOn,
  SemanticSearchSettings,
  SlackSettings,
} from "@/lib/integration-types";
import { INTEGRATION_ICONS, IntegrationIcon, LiveKitIcon, ResendIcon, SlackIcon } from "./integration-icons";
import {
  IntegrationCardHeader,
  NotifyOnFields,
  SaveRow,
  persistSetting,
} from "./integration-ui";

type Status = { type: "ok" | "err"; msg: string } | null;

function notifyBadge(configured: boolean, enabled: boolean) {
  if (configured && enabled) return { label: "active", tone: "green" as const };
  if (configured) return { label: "disabled", tone: "gray" as const };
  return { label: "not configured", tone: "gray" as const };
}

export default function IntegrationsClient({
  slack: initialSlack,
  email: initialEmail,
  webhook: initialWebhook,
  livekit: initialLivekit,
  semanticSearch: initialSemanticSearch,
  apiKeys: initialApiKeys,
}: {
  slack: SlackSettings;
  email: EmailSettings;
  webhook: GenericWebhookSettings;
  livekit: LiveKitSettings;
  semanticSearch: SemanticSearchSettings;
  apiKeys: ApiKeyRow[];
}) {
  const [slack, setSlack] = useState(initialSlack);
  const [email, setEmail] = useState(initialEmail);
  const [webhook, setWebhook] = useState(initialWebhook);
  const [livekit, setLivekit] = useState(initialLivekit);
  const [semanticSearch, setSemanticSearch] = useState(initialSemanticSearch);
  const [apiKeys, setApiKeys] = useState(initialApiKeys);

  const [slackSaving, setSlackSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [livekitSaving, setLivekitSaving] = useState(false);
  const [semanticSaving, setSemanticSaving] = useState(false);

  const [slackTesting, setSlackTesting] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);

  const [slackStatus, setSlackStatus] = useState<Status>(null);
  const [emailStatus, setEmailStatus] = useState<Status>(null);
  const [webhookStatus, setWebhookStatus] = useState<Status>(null);
  const [livekitStatus, setLivekitStatus] = useState<Status>(null);
  const [semanticStatus, setSemanticStatus] = useState<Status>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<Status>(null);

  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  function patchNotifyOn<T extends { notify_on: NotifyOn }>(
    setter: Dispatch<SetStateAction<T>>,
    key: keyof NotifyOn,
    val: boolean,
  ) {
    setter((s) => ({ ...s, notify_on: { ...s.notify_on, [key]: val } }));
  }

  async function testSlack() {
    if (!slack.webhook_url) return;
    setSlackTesting(true);
    setSlackStatus(null);
    const res = await fetch("/api/integrations/slack/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhook_url: slack.webhook_url }),
    });
    setSlackTesting(false);
    if (res.ok) setSlackStatus({ type: "ok", msg: "Test notification sent — check Slack." });
    else setSlackStatus({ type: "err", msg: (await res.json()).error ?? "Test failed." });
  }

  async function testEmail() {
    if (!email.to) return;
    setEmailTesting(true);
    setEmailStatus(null);
    const res = await fetch("/api/integrations/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: email.to }),
    });
    setEmailTesting(false);
    if (res.ok) setEmailStatus({ type: "ok", msg: "Test email sent." });
    else setEmailStatus({ type: "err", msg: (await res.json()).error ?? "Test failed." });
  }

  async function testWebhook() {
    if (!webhook.url) return;
    setWebhookTesting(true);
    setWebhookStatus(null);
    const res = await fetch("/api/integrations/webhook/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhook.url }),
    });
    setWebhookTesting(false);
    if (res.ok) setWebhookStatus({ type: "ok", msg: "Test payload delivered." });
    else setWebhookStatus({ type: "err", msg: (await res.json()).error ?? "Test failed." });
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setApiKeyStatus(null);
    setCreatedKey(null);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    setCreatingKey(false);
    if (!res.ok) {
      setApiKeyStatus({ type: "err", msg: "Failed to create API key." });
      return;
    }
    const data = await res.json();
    setCreatedKey(data.key);
    setApiKeys((keys) => [data.api_key, ...keys]);
    setNewKeyName("");
    setApiKeyStatus({ type: "ok", msg: "API key created — copy it now; it won't be shown again." });
  }

  async function revokeApiKey(id: string) {
    setApiKeyStatus(null);
    const res = await fetch("/api/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setApiKeys((keys) => keys.filter((k) => k.id !== id));
      setApiKeyStatus({ type: "ok", msg: "API key revoked." });
    } else {
      setApiKeyStatus({ type: "err", msg: "Failed to revoke key." });
    }
  }

  return (
    <div className="content">
      <h1 className="page" style={{ marginBottom: 4 }}>Integrations</h1>
      <p className="muted" style={{ marginBottom: 24, fontSize: 13 }}>
        Configure notifications and external API access for Argus.
      </p>

      <div className="integrations-masonry">
        {/* Left column — tall + short cards mixed */}
        <div className="integrations-column">
          <div className="card">
            <IntegrationCardHeader
              icon={<SlackIcon size={18} />}
              title="Slack"
              badge={notifyBadge(!!slack.webhook_url, slack.enabled)}
            />
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="field-group">
                <label className="field-label">Incoming webhook URL</label>
                <input
                  type="url"
                  className="inp"
                  placeholder="https://hooks.slack.com/services/…"
                  value={slack.webhook_url}
                  onChange={(e) => setSlack((s) => ({ ...s, webhook_url: e.target.value }))}
                />
              </div>
              <label className="toggle-row">
                <input type="checkbox" checked={slack.enabled} onChange={(e) => setSlack((s) => ({ ...s, enabled: e.target.checked }))} />
                <span>Enable Slack notifications</span>
              </label>
              <NotifyOnFields value={slack.notify_on} onChange={(k, v) => patchNotifyOn(setSlack, k, v)} />
              <SaveRow
                saving={slackSaving}
                onSave={() => persistSetting("slack_integration", slack, setSlackSaving, setSlackStatus)}
                onTest={testSlack}
                testing={slackTesting}
                testDisabled={!slack.webhook_url}
                status={slackStatus}
              />
            </div>
          </div>

          <div className="card">
            <IntegrationCardHeader
              icon={<LiveKitIcon size={18} />}
              title="LiveKit dashboard"
              badge={notifyBadge(!!livekit.dashboard_url, !!livekit.dashboard_url)}
            />
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="field-group">
                <label className="field-label">Project dashboard URL</label>
                <input
                  type="url"
                  className="inp"
                  placeholder="https://cloud.livekit.io/projects/p_…"
                  value={livekit.dashboard_url}
                  onChange={(e) => setLivekit({ dashboard_url: e.target.value })}
                />
                  <div className="field-hint">
                  Paste your project URL, e.g.{" "}
                  <span className="mono">https://cloud.livekit.io/projects/p_5bz8iswts61</span>.
                  Alert links use the LiveKit session id (<span className="mono">RM_…</span>), not the room name.
                </div>
              </div>
              <SaveRow
                saving={livekitSaving}
                onSave={() => persistSetting("livekit_integration", livekit, setLivekitSaving, setLivekitStatus)}
                status={livekitStatus}
              />
            </div>
          </div>

          <div className="card">
            <IntegrationCardHeader
              icon={<IntegrationIcon src={INTEGRATION_ICONS.webhook} alt="Webhook" />}
              title="Generic webhook"
              badge={notifyBadge(!!webhook.url, webhook.enabled)}
            />
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="field-group">
                <label className="field-label">Webhook URL</label>
                <input
                  type="url"
                  className="inp"
                  placeholder="https://your-service.com/hooks/argus"
                  value={webhook.url}
                  onChange={(e) => setWebhook((s) => ({ ...s, url: e.target.value }))}
                />
                <div className="field-hint">Receives JSON POST with event <span className="mono">argus.session.alert</span>.</div>
              </div>
              <label className="toggle-row">
                <input type="checkbox" checked={webhook.enabled} onChange={(e) => setWebhook((s) => ({ ...s, enabled: e.target.checked }))} />
                <span>Enable webhook notifications</span>
              </label>
              <NotifyOnFields value={webhook.notify_on} onChange={(k, v) => patchNotifyOn(setWebhook, k, v)} />
              <SaveRow
                saving={webhookSaving}
                onSave={() => persistSetting("generic_webhook_integration", webhook, setWebhookSaving, setWebhookStatus)}
                onTest={testWebhook}
                testing={webhookTesting}
                testDisabled={!webhook.url}
                status={webhookStatus}
              />
            </div>
          </div>
        </div>

        {/* Right column — offset start, mixed heights */}
        <div className="integrations-column">
          <div className="card">
            <IntegrationCardHeader
              icon={<ResendIcon height={14} />}
              title="Email"
              badge={notifyBadge(!!email.to, email.enabled)}
            />
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="field-group">
                <label className="field-label">Alert recipient</label>
                <input
                  type="email"
                  className="inp"
                  placeholder="qa@company.com"
                  value={email.to}
                  onChange={(e) => setEmail((s) => ({ ...s, to: e.target.value }))}
                />
                <div className="field-hint">Uses Resend — set <span className="mono">RESEND_API_KEY</span> on the server.</div>
              </div>
              <label className="toggle-row">
                <input type="checkbox" checked={email.enabled} onChange={(e) => setEmail((s) => ({ ...s, enabled: e.target.checked }))} />
                <span>Enable email alerts</span>
              </label>
              <NotifyOnFields value={email.notify_on} onChange={(k, v) => patchNotifyOn(setEmail, k, v)} />
              <SaveRow
                saving={emailSaving}
                onSave={() => persistSetting("email_integration", email, setEmailSaving, setEmailStatus)}
                onTest={testEmail}
                testing={emailTesting}
                testDisabled={!email.to}
                status={emailStatus}
              />
            </div>
          </div>

          <div className="card">
            <IntegrationCardHeader
              icon={<IntegrationIcon src={INTEGRATION_ICONS.semanticSearch} alt="Semantic search" />}
              title="Semantic search"
              badge={{ label: semanticSearch.enabled ? "enabled" : "disabled", tone: semanticSearch.enabled ? "green" : "gray" }}
            />
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={semanticSearch.enabled}
                  onChange={(e) => setSemanticSearch((s) => ({ ...s, enabled: e.target.checked }))}
                />
                <span>Enable transcript indexing and semantic search</span>
              </label>
              <div className="field-hint">
                When off, new interviews are not embedded and dashboard search uses keyword matching only.
              </div>
              <SaveRow
                saving={semanticSaving}
                onSave={() => persistSetting("semantic_search", semanticSearch, setSemanticSaving, setSemanticStatus)}
                status={semanticStatus}
              />
            </div>
          </div>

          <div className="card">
            <IntegrationCardHeader
              icon={<IntegrationIcon src={INTEGRATION_ICONS.apiKeys} alt="API keys" />}
              title="Read-only API keys"
              badge={{ label: apiKeys.length ? `${apiKeys.length} active` : "none", tone: apiKeys.length ? "green" : "gray" }}
            />
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="field-hint">
                External services can call <span className="mono">GET /api/sessions</span> and{" "}
                <span className="mono">GET /api/sessions/:id</span> with{" "}
                <span className="mono">Authorization: Bearer argus_…</span>
              </div>

              {createdKey && (
                <div className="field-group">
                  <label className="field-label">New key (copy now)</label>
                  <input type="text" className="inp mono" readOnly value={createdKey} onFocus={(e) => e.target.select()} />
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="inp"
                  placeholder="Key name (e.g. BI pipeline)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
                <button className="btn btn-primary" onClick={createApiKey} disabled={creatingKey || !newKeyName.trim()}>
                  {creatingKey ? "Creating…" : "Create"}
                </button>
              </div>

              {apiKeys.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {apiKeys.map((k) => (
                    <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{k.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          <span className="mono">{k.key_prefix}…</span>
                          {" · "}
                          created {new Date(k.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button className="btn" onClick={() => revokeApiKey(k.id)}>Revoke</button>
                    </div>
                  ))}
                </div>
              )}

              {apiKeyStatus && (
                <span style={{ fontSize: 13, color: apiKeyStatus.type === "ok" ? "var(--accent)" : "crimson" }}>
                  {apiKeyStatus.msg}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
