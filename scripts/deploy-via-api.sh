#!/usr/bin/env bash
# Deploy the `analyze` Edge Function + set secrets via the Supabase Management API.
# Works with sbp_v0_ tokens that the CLI's local format check rejects.
# Usage: SUPABASE_ACCESS_TOKEN=sbp_... bash scripts/deploy-via-api.sh
set -euo pipefail

REF="nvtthdxgguceecoojjhh"
API="https://api.supabase.com/v1/projects/${REF}"
cd "$(dirname "$0")/.."

TOK="${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"

OPENAI_API_KEY=$(grep -E '^OPENAI_API_KEY=' .env.local | cut -d= -f2-)
ANALYSIS_MODEL=$(grep -E '^ANALYSIS_MODEL=' .env.local | cut -d= -f2-)
ANALYSIS_MODEL_HARD=$(grep -E '^ANALYSIS_MODEL_HARD=' .env.local | cut -d= -f2-)

echo "==> Setting function secrets"
PAYLOAD=$(K="$OPENAI_API_KEY" M="$ANALYSIS_MODEL" MH="$ANALYSIS_MODEL_HARD" node -e 'const e=process.env;console.log(JSON.stringify([
        {name:"OPENAI_API_KEY",value:e.K},
        {name:"ANALYSIS_MODEL",value:e.M},
        {name:"ANALYSIS_MODEL_HARD",value:e.MH}
      ]))')
SECRET_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API}/secrets" \
  -H "Authorization: Bearer ${TOK}" -H "Content-Type: application/json" -d "$PAYLOAD")
[ "$SECRET_CODE" = "200" ] || [ "$SECRET_CODE" = "201" ] || { echo "secrets POST failed: HTTP $SECRET_CODE"; exit 1; }
echo " ...secrets set (HTTP $SECRET_CODE)"

echo "==> Deploying analyze function (server-side bundle)"
curl -sf -X POST "${API}/functions/deploy?slug=analyze" \
  -H "Authorization: Bearer ${TOK}" \
  -F 'metadata={"entrypoint_path":"index.ts","name":"analyze","verify_jwt":false};type=application/json' \
  -F 'file=@supabase/functions/analyze/index.ts;type=application/typescript;filename=index.ts' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(" ...deployed:",j.slug||j.id||JSON.stringify(j).slice(0,200))}catch{console.log(s.slice(0,300))}})'

echo "==> Function URL: https://${REF}.functions.supabase.co/analyze"
