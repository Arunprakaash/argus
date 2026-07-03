alter table public.events
  drop constraint if exists events_source_check;

alter table public.events
  add constraint events_source_check
  check (source in ('session','room','webhook','vision_proctor'));

update public.settings
set value = jsonb_set(
  value,
  '{notify_on,proctoring}',
  'true'::jsonb,
  true
)
where key = 'slack_integration'
  and value #> '{notify_on,proctoring}' is null;
