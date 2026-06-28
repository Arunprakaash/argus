-- Interview Observer — initial schema
-- Standalone observability/QA store for the LiveKit interview agent.
-- Correlation key across all sources is the LiveKit room name.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pgmq;       -- Supabase Queues

-- ── sessions ────────────────────────────────────────────────────────────────
-- One row per interview, keyed by room name.
create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  room_name         text not null unique,
  status            text not null default 'active'
                      check (status in ('active','completed','abandoned','error')),
  completion_reason text,                       -- from CloseEvent.CloseReason / webhook
  -- metadata captured from ctx.job.metadata on the first event
  candidate_name    text,
  agent_name        text,
  interview_type    text,
  fixed_questions   jsonb default '[]'::jsonb,
  metadata          jsonb default '{}'::jsonb,  -- full raw job metadata
  -- lifecycle
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_sec      double precision,
  -- aggregate usage/metrics (rolled up from metrics/session_usage events)
  metrics           jsonb default '{}'::jsonb,
  -- egress
  egress_id         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists sessions_status_idx     on public.sessions (status);
create index if not exists sessions_created_at_idx  on public.sessions (created_at desc);

-- ── events ──────────────────────────────────────────────────────────────────
-- Append-only log of every native LiveKit event (session + room) and webhooks.
-- Drives the replay timeline.
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  source      text not null check (source in ('session','room','webhook')),
  type        text not null,                    -- verbatim native event name
  ts          timestamptz not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_session_ts_idx on public.events (session_id, ts);
create index if not exists events_type_idx        on public.events (type);

-- ── transcript_turns ──────────────────────────────────────────────────────────
-- Denormalized from conversation_item_added for fast querying / display.
create table if not exists public.transcript_turns (
  id           bigint generated always as identity primary key,
  session_id   uuid not null references public.sessions(id) on delete cascade,
  item_id      text,                            -- ChatMessage.id (idempotency)
  role         text not null,                   -- 'user' | 'assistant'
  text         text not null default '',
  ts           timestamptz,
  interrupted  boolean default false,
  metrics      jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (session_id, item_id)
);

create index if not exists transcript_turns_session_ts_idx
  on public.transcript_turns (session_id, ts);

-- ── flags ────────────────────────────────────────────────────────────────────
-- Behavioral events derived from function_tools_executed tool calls + room events.
create table if not exists public.flags (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  type        text not null,                    -- out_of_context | profanity | ...
  ts          timestamptz,
  data        jsonb default '{}'::jsonb,        -- tool args / output
  created_at  timestamptz not null default now()
);

create index if not exists flags_session_idx on public.flags (session_id);

-- ── recordings ────────────────────────────────────────────────────────────────
create table if not exists public.recordings (
  id           bigint generated always as identity primary key,
  session_id   uuid not null references public.sessions(id) on delete cascade,
  egress_id    text,
  bucket_key   text not null,                   -- object path within RECORDINGS_BUCKET
  kind         text not null default 'audio',   -- 'audio' | 'video' (video later)
  duration_sec double precision,
  size_bytes   bigint,
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz not null default now(),
  unique (session_id, bucket_key)
);

-- ── analyses ──────────────────────────────────────────────────────────────────
-- Output of the analysis Edge Function.
create table if not exists public.analyses (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  kind        text not null
                check (kind in ('coverage_recheck','issue_detection','completion','quality')),
  status      text not null default 'done'
                check (status in ('done','error')),
  verdict     jsonb not null default '{}'::jsonb,
  model       text,
  error       text,
  created_at  timestamptz not null default now(),
  unique (session_id, kind)
);

create index if not exists analyses_session_idx on public.analyses (session_id);

-- ── updated_at trigger for sessions ───────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_touch_updated_at on public.sessions;
create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ── analysis queue (pgmq) ──────────────────────────────────────────────────────
select pgmq.create('analysis_jobs');

-- Wrapper RPCs in the `public` schema so the queue is usable through PostgREST
-- (supabase-js) without enabling the Queues UI feature / exposing the pgmq schema.
-- SECURITY DEFINER so they run with the owner's pgmq access; execute granted to
-- service_role only (the backend + edge function use the service-role key).
create or replace function public.enqueue_analysis(job jsonb)
returns bigint language sql security definer
set search_path = pgmq, public as $$
  select pgmq.send('analysis_jobs', job);
$$;

create or replace function public.read_analysis_jobs(vt integer, qty integer)
returns setof pgmq.message_record language sql security definer
set search_path = pgmq, public as $$
  select * from pgmq.read('analysis_jobs', vt, qty);
$$;

create or replace function public.delete_analysis_job(msg_id bigint)
returns boolean language sql security definer
set search_path = pgmq, public as $$
  select pgmq.delete('analysis_jobs', msg_id);
$$;

revoke execute on function public.enqueue_analysis(jsonb) from public, anon, authenticated;
revoke execute on function public.read_analysis_jobs(integer, integer) from public, anon, authenticated;
revoke execute on function public.delete_analysis_job(bigint) from public, anon, authenticated;
grant execute on function public.enqueue_analysis(jsonb) to service_role;
grant execute on function public.read_analysis_jobs(integer, integer) to service_role;
grant execute on function public.delete_analysis_job(bigint) to service_role;
