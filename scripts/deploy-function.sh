#!/usr/bin/env bash
# Deploy the `analyze` Edge Function + set its secrets.
# Prereq: a Supabase personal access token.
#   https://supabase.com/dashboard/account/tokens
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/deploy-function.sh
set -euo pipefail

REF="nvtthdxgguceecoojjhh"
cd "$(dirname "$0")/.."

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Set SUPABASE_ACCESS_TOKEN (from https://supabase.com/dashboard/account/tokens)" >&2
  exit 1
fi

# Pull keys from .env.local without exporting the whole file.
OPENAI_API_KEY=$(grep -E '^OPENAI_API_KEY=' .env.local | cut -d= -f2-)
ANALYSIS_MODEL=$(grep -E '^ANALYSIS_MODEL=' .env.local | cut -d= -f2-)
ANALYSIS_MODEL_HARD=$(grep -E '^ANALYSIS_MODEL_HARD=' .env.local | cut -d= -f2-)
# DB password is parsed from DATABASE_URL in .env.local (never hardcode secrets).
DB_PASSWORD=$(grep -E '^DATABASE_URL=' .env.local | sed -E 's#.*//[^:]+:([^@]+)@.*#\1#')

echo "==> Linking project $REF"
npx supabase link --project-ref "$REF" --password "$DB_PASSWORD"

echo "==> Setting function secrets (SUPABASE_URL/SERVICE_ROLE are auto-provided)"
npx supabase secrets set \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  ANALYSIS_MODEL="$ANALYSIS_MODEL" \
  ANALYSIS_MODEL_HARD="$ANALYSIS_MODEL_HARD"

echo "==> Deploying analyze function"
# --use-api avoids needing Docker for bundling.
npx supabase functions deploy analyze --use-api

echo "==> Done. Function URL: https://${REF}.functions.supabase.co/analyze"
