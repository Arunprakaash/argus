export type NotifyOn = {
  issues: boolean;
  judge_disagree: boolean;
  abandoned: boolean;
  proctoring: boolean;
};

export const DEFAULT_NOTIFY_ON: NotifyOn = {
  issues: true,
  judge_disagree: true,
  abandoned: true,
  proctoring: true,
};

export type SlackSettings = {
  webhook_url: string;
  enabled: boolean;
  notify_on: NotifyOn;
};

export type EmailSettings = {
  enabled: boolean;
  to: string;
  notify_on: NotifyOn;
};

export type GenericWebhookSettings = {
  enabled: boolean;
  url: string;
  notify_on: NotifyOn;
};

export type LiveKitSettings = {
  dashboard_url: string;
};

export type ObservabilitySettings = {
  datadog: { enabled: boolean; api_key: string; site: string };
  sentry: { enabled: boolean; dsn: string };
};

export type SemanticSearchSettings = { enabled: boolean };

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

function mergeNotifyOn(partial?: Partial<NotifyOn>): NotifyOn {
  return { ...DEFAULT_NOTIFY_ON, ...(partial ?? {}) };
}

export function parseSlackSettings(value: unknown): SlackSettings {
  const v = (value ?? {}) as Partial<SlackSettings>;
  return {
    webhook_url: v.webhook_url ?? "",
    enabled: v.enabled ?? false,
    notify_on: mergeNotifyOn(v.notify_on),
  };
}

export function parseEmailSettings(value: unknown): EmailSettings {
  const v = (value ?? {}) as Partial<EmailSettings>;
  return {
    enabled: v.enabled ?? false,
    to: v.to ?? "",
    notify_on: mergeNotifyOn(v.notify_on),
  };
}

export function parseGenericWebhookSettings(value: unknown): GenericWebhookSettings {
  const v = (value ?? {}) as Partial<GenericWebhookSettings>;
  return {
    enabled: v.enabled ?? false,
    url: v.url ?? "",
    notify_on: mergeNotifyOn(v.notify_on),
  };
}

export function parseLiveKitSettings(value: unknown): LiveKitSettings {
  const v = (value ?? {}) as Partial<LiveKitSettings>;
  return { dashboard_url: v.dashboard_url ?? "" };
}

export function parseObservabilitySettings(value: unknown): ObservabilitySettings {
  const v = (value ?? {}) as Partial<ObservabilitySettings>;
  return {
    datadog: {
      enabled: v.datadog?.enabled ?? false,
      api_key: v.datadog?.api_key ?? "",
      site: v.datadog?.site ?? "datadoghq.com",
    },
    sentry: {
      enabled: v.sentry?.enabled ?? false,
      dsn: v.sentry?.dsn ?? "",
    },
  };
}
