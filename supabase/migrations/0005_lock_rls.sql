-- Security: the anon (publishable) key is public and PostgREST exposes public
-- tables. Enable RLS with NO policies on all data tables so anon/authenticated
-- cannot read interview data via the REST API. The backend + Edge Function use
-- the service-role key, which bypasses RLS.

alter table public.sessions          enable row level security;
alter table public.events            enable row level security;
alter table public.transcript_turns  enable row level security;
alter table public.flags             enable row level security;
alter table public.recordings        enable row level security;
alter table public.analyses          enable row level security;

-- (profiles already has RLS + policies from 0003.)
