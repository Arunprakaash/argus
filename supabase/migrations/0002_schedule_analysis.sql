-- Schedule the analysis Edge Function to drain the queue every minute.
-- Run AFTER deploying the `analyze` function. Requires pg_cron + pg_net
-- (enable both under Database → Extensions in the Supabase dashboard).
--
-- Replace the placeholders before running:
--   <PROJECT_REF>      e.g. abcdefghijklmno
--   <SERVICE_ROLE_KEY> the project's service-role key
--
-- (Stored as a migration template; edit then apply, or run from the SQL editor.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'drain-analysis-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/analyze',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
