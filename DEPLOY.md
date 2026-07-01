# Argus — Deployment & Migration Reference

## Project

| Key | Value |
|-----|-------|
| Supabase project | `nvtthdxgguceecoojjhh` |
| Region | `ap-northeast-2` (Seoul) |
| Dashboard | https://supabase.com/dashboard/project/nvtthdxgguceecoojjhh |

---

## Running migrations

Uses a custom Node.js runner (not `supabase db push`) because the CLI requires Docker locally.

```bash
DATABASE_URL="postgresql://postgres.nvtthdxgguceecoojjhh:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres" \
  node scripts/apply-migrations.mjs
```

- The script skips files that still contain `<PROJECT_REF>` or `<SERVICE_ROLE_KEY>` placeholders.
- Migrations are **not idempotent** if they contain `cron.schedule()` or `pgmq.create()` calls — apply new ones individually (see below).

### Applying a single migration manually

```bash
node --input-type=module <<'EOF'
import pg from 'pg';
import { readFileSync } from 'node:fs';
const client = new pg.Client({
  connectionString: 'postgresql://postgres.nvtthdxgguceecoojjhh:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
const sql = readFileSync('supabase/migrations/00XX_name.sql', 'utf8');
await client.connect();
await client.query(sql);
console.log('done');
await client.end();
EOF
```

---

## Deploying Edge Functions

The Supabase CLI bundles inside Docker and the upload step fails in this environment. Use the Management API directly instead.

### Create a new function

```bash
FUNC_BODY=$(base64 -i supabase/functions/<name>/index.ts | tr -d '\n')

curl -X POST \
  "https://api.supabase.com/v1/projects/nvtthdxgguceecoojjhh/functions" \
  -H "Authorization: Bearer <SUPABASE_PERSONAL_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"slug\":\"<name>\",\"name\":\"<name>\",\"verify_jwt\":true,\"body\":\"$FUNC_BODY\"}"
```

### Update an existing function

```bash
FUNC_BODY=$(base64 -i supabase/functions/<name>/index.ts | tr -d '\n')

curl -X PATCH \
  "https://api.supabase.com/v1/projects/nvtthdxgguceecoojjhh/functions/<name>" \
  -H "Authorization: Bearer <SUPABASE_PERSONAL_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"body\":\"$FUNC_BODY\"}"
```

### Set / update secrets

```bash
curl -X POST \
  "https://api.supabase.com/v1/projects/nvtthdxgguceecoojjhh/secrets" \
  -H "Authorization: Bearer <SUPABASE_PERSONAL_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '[{"name":"MY_SECRET","value":"my-value"}]'
```

Personal access tokens live at https://supabase.com/dashboard/account/tokens.

---

## Deployed Edge Functions

| Function | Schedule (pg_cron) | Purpose |
|----------|-------------------|---------|
| `analyze` | `*/5 * * * *` | Drain analysis queue, run LLM analyses |
| `purge`   | `0 2 * * *` (2 AM UTC) | Delete sessions >14 days + storage files |

### Verify cron jobs in DB

```sql
SELECT jobname, schedule FROM cron.job;
```

---

## Cron jobs (pg_cron)

Add a new cron job:
```sql
select cron.schedule(
  'my-job-name',
  '0 3 * * *',   -- cron expression
  $$ select net.http_post(url:='https://nvtthdxgguceecoojjhh.functions.supabase.co/<fn>', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>'), body:='{}'::jsonb); $$
);
```

Remove a cron job:
```sql
select cron.unschedule('my-job-name');
```

---

## Next.js app (Vercel or local)

```bash
npm run dev       # local dev
npm run build     # type-check + build
```

Environment file: `.env.local` (gitignored). Copy from `.env.example` for new setups.
