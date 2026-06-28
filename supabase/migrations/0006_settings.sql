create table public.settings (
  key  text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
-- service-role only, same as all data tables

create or replace function public.upsert_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer as $$
begin
  insert into public.settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update set value = p_value, updated_at = now();
end;
$$;

-- Seed default (disabled) slack integration
insert into public.settings (key, value) values (
  'slack_integration',
  '{
    "webhook_url": "",
    "enabled": false,
    "notify_on": {
      "issues": true,
      "judge_disagree": true,
      "abandoned": true
    }
  }'::jsonb
) on conflict do nothing;
