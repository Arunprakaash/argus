-- Free-plan optimization: make analysis event-driven instead of polling.
-- enqueue_analysis now also pings the Edge Function via pg_net (async, non-blocking),
-- so a completed interview is analyzed immediately and we stop burning ~43k/mo idle
-- Edge invocations on a per-minute cron. Cron is reduced to a 5-min retry safety net
-- (see the re-schedule applied alongside this migration).

create or replace function public.enqueue_analysis(job jsonb)
returns bigint language plpgsql security definer
set search_path = pgmq, public, net as $$
declare
  mid bigint;
begin
  select pgmq.send('analysis_jobs', job) into mid;
  -- Fire-and-forget trigger (pg_net queues the request on a background worker).
  perform net.http_post(
    url     := 'https://nvtthdxgguceecoojjhh.functions.supabase.co/analyze',
    body    := '{}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
  return mid;
end;
$$;

revoke execute on function public.enqueue_analysis(jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_analysis(jsonb) to service_role;
