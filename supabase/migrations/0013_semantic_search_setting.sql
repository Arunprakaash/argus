insert into public.settings (key, value) values (
  'semantic_search',
  '{"enabled": false}'::jsonb
) on conflict do nothing;
