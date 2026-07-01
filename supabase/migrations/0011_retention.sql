-- 14-day data retention: schedule daily purge of old sessions.
-- Invokes the `purge` Edge Function which deletes storage objects first,
-- then deletes sessions rows (all child tables cascade automatically).
--
-- Replace the placeholders before running:
--   <PROJECT_REF>      e.g. abcdefghijklmno (from Supabase dashboard URL)
--   <SERVICE_ROLE_KEY> the project's service-role key
--
-- pg_cron and pg_net are already enabled (see 0002_schedule_analysis.sql).

select cron.schedule(
  'purge-old-sessions',
  '0 2 * * *',   -- 2 AM UTC daily
  $$
  select net.http_post(
    url     := 'https://nvtthdxgguceecoojjhh.functions.supabase.co/purge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
