create table public.annotations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  note        text not null,
  author      text,
  created_at  timestamptz not null default now()
);

create index on public.annotations (session_id, created_at);
alter table public.annotations enable row level security;
