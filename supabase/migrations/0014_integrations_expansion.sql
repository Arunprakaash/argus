-- Additional integration settings + read-only API keys.

insert into public.settings (key, value) values
  ('email_integration', '{
    "enabled": false,
    "to": "",
    "notify_on": { "issues": true, "judge_disagree": true, "abandoned": true, "proctoring": true }
  }'::jsonb),
  ('generic_webhook_integration', '{
    "enabled": false,
    "url": "",
    "notify_on": { "issues": true, "judge_disagree": true, "abandoned": true, "proctoring": true }
  }'::jsonb),
  ('livekit_integration', '{
    "dashboard_url": ""
  }'::jsonb),
  ('observability_integration', '{
    "datadog": { "enabled": false, "api_key": "", "site": "datadoghq.com" },
    "sentry": { "enabled": false, "dsn": "" }
  }'::jsonb)
on conflict (key) do nothing;

create table if not exists public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  key_prefix  text not null,
  key_hash    text not null unique,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);
alter table public.api_keys enable row level security;
