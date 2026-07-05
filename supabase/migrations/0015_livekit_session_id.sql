-- LiveKit Cloud dashboard links use room SID (RM_…), not room name.
alter table public.sessions
  add column if not exists livekit_session_id text;

create index if not exists sessions_livekit_session_id_idx
  on public.sessions (livekit_session_id)
  where livekit_session_id is not null;
