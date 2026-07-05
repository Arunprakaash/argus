-- Run in Supabase SQL editor if API key creation fails with "api_keys table missing".
-- Safe to re-run (uses IF NOT EXISTS).

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  key_prefix   text not null,
  key_hash     text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);
alter table public.api_keys enable row level security;
