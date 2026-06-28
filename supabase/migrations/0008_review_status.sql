alter table public.sessions
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'reviewed', 'flagged', 'cleared'));
