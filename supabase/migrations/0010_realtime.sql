-- Enable Supabase Realtime for the sessions table so the LiveIndicator
-- subscription in the browser client receives INSERT/UPDATE/DELETE events.
alter publication supabase_realtime add table public.sessions;

-- Allow authenticated users (logged-in Argus users) to SELECT sessions.
-- Required for Realtime to deliver events through RLS. The app is fully
-- auth-gated so this does not expose data to anonymous users.
create policy "authenticated users can read sessions"
  on public.sessions for select
  to authenticated
  using (true);

-- Needed so UPDATE events carry the full row (not just changed columns).
alter table public.sessions replica identity full;
