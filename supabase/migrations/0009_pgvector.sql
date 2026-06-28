create extension if not exists vector;

alter table public.sessions
  add column if not exists transcript_embedding vector(1536);

create index if not exists sessions_embedding_idx
  on public.sessions using hnsw (transcript_embedding vector_cosine_ops);

create or replace function match_sessions(
  query_embedding vector(1536),
  match_count     int   default 8,
  match_threshold float default 0.25
)
returns table (
  id               uuid,
  room_name        text,
  status           text,
  completion_reason text,
  candidate_name   text,
  agent_name       text,
  interview_type   text,
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_sec     float,
  created_at       timestamptz,
  similarity       float
)
language sql stable
as $$
  select
    s.id, s.room_name, s.status, s.completion_reason,
    s.candidate_name, s.agent_name, s.interview_type,
    s.started_at, s.ended_at, s.duration_sec, s.created_at,
    1 - (s.transcript_embedding <=> query_embedding) as similarity
  from public.sessions s
  where s.transcript_embedding is not null
    and 1 - (s.transcript_embedding <=> query_embedding) > match_threshold
  order by s.transcript_embedding <=> query_embedding
  limit match_count;
$$;
