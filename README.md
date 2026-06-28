# Interview Observer

Standalone observability & QA dashboard **backend** for the LiveKit interview agent
(`ai-assessment`). It ingests **native LiveKit events** from the agent, receives **LiveKit
Cloud webhooks**, records **audio** via its own egress, and runs **active LLM analysis**
(question-coverage re-check, completion check, issue detection) — all **independent of the
existing sia/api**.

Fully serverless / free-tier: **Next.js on Vercel** + **Supabase** (Postgres, Storage,
Queues/pgmq, Edge Functions, Cron). No servers to host.

> Backend-only for now. The dashboard UI is a separate follow-up.

## Architecture

```
agent (observer SDK) ─POST─►  /api/ingest/events ─┐
LiveKit Cloud ───webhook──►   /api/livekit/webhook ┼─► Supabase Postgres
                                                   │   + Storage (audio egress)
                                                   └─► pgmq ─► analyze Edge Fn (Cron)
                                                                └─► Claude analyses
```

Everything correlates by **room name**. See the full design in the plan file.

## Layout

| Path | What |
|------|------|
| `app/api/ingest/events/route.ts` | Ingestion endpoint for the observer SDK |
| `app/api/livekit/webhook/route.ts` | LiveKit webhook receiver + egress start |
| `app/api/sessions/...` | Read APIs (list / detail / signed recording URL) |
| `lib/*.ts` | Supabase client, zod schema, auth, LiveKit, pgmq, ingest logic |
| `supabase/migrations/*.sql` | Schema + pgmq queue + cron schedule template |
| `supabase/functions/analyze/index.ts` | Scheduled analysis worker (Deno) |
| `sdk-python/interview_observer/` | Agent-side observer SDK (drop into the agent) |

## Setup

1. **Supabase project** (free tier). Run migrations:
   ```bash
   supabase db push        # or paste supabase/migrations/0001_init.sql in the SQL editor
   ```
   Enable **Queues** (pgmq), and create a **Storage bucket** named `recordings`.
2. **Env**: copy `.env.example` → `.env.local`, fill Supabase + LiveKit + OpenAI values.
3. **Run locally**:
   ```bash
   npm install
   npm run dev
   ```
4. **LiveKit webhook**: in LiveKit Cloud, point a webhook at
   `https://<deploy>/api/livekit/webhook`.
5. **Analysis function** (OpenAI: `gpt-4o-mini` / `gpt-4o`). Get a token at
   https://supabase.com/dashboard/account/tokens, then:
   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/deploy-function.sh
   ```
   This links the project, sets `OPENAI_API_KEY` + model secrets, and deploys.
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-provided to functions.
   Then apply `supabase/migrations/0002_schedule_analysis.sql` (fill the placeholders) to
   schedule the drain every minute via pg_cron.

## Wiring the observer into the agent

In the agent repo, install the SDK (`pip install -e path/to/sdk-python`) and add — this is
**purely additive**, it does not change interview behavior:

```python
from interview_observer import Observer

observer = Observer(
    base_url=os.environ["OBSERVER_INGEST_URL"],   # the deployed dashboard backend
    api_key=os.environ["OBSERVER_INGEST_KEY"],     # == INGEST_API_KEY on the backend
    room_name=ctx.room.name,
)
observer.set_metadata(
    candidate_name=metadata["talent_name"],
    agent_name=metadata["agent_name"],
    interview_type=metadata["interview_type"],
    fixed_questions=[q["question_text"] for q in metadata.get("fixed_questions", [])],
    raw=metadata,
)
observer.attach(session, ctx)   # registers native @session.on / @ctx.room.on listeners
```

The SDK captures the judge's decision and proctoring flags from the native
`function_tools_executed` events — **no wiring into `_judge_questions_coverage`**.

## Auth (dashboard sign-in)

Supabase Auth owns the users (`auth.users`); `0003_auth_profiles.sql` adds a `profiles`
mirror auto-populated on sign-up. Two methods are wired:

- **Magic link (email)** — works with **zero external config**. Just set the redirect URLs
  below.
- **Google** — needs a Google Cloud OAuth client. In Supabase: *Authentication → Providers →
  Google*, paste the Client ID/Secret. Add `https://<project>.supabase.co/auth/v1/callback`
  as an authorized redirect URI in Google Cloud.

In Supabase *Authentication → URL Configuration*, set **Site URL** to your deploy origin and
add `http://localhost:3000/auth/callback` + `https://<deploy>/auth/callback` to redirect
allow-list.

Routes: `/login` (Google + magic link), `/auth/callback` (code exchange), `/dashboard`
(protected by `middleware.ts`). API routes are excluded from the auth middleware — they use
their own keys.

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/ingest/events` | Bearer `INGEST_API_KEY`; body `{ events: [...] }` |
| POST | `/api/livekit/webhook` | LiveKit-signed; verified via `WebhookReceiver` |
| GET | `/api/sessions` | `?status=`, `?limit=` |
| GET | `/api/sessions/{id}` | session + transcript + flags + analyses + timeline |
| GET | `/api/sessions/{id}/recording` | short-lived signed audio URL |
| GET | `/api/health` | liveness |
