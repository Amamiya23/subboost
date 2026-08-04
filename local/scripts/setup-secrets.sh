#!/usr/bin/env bash
# Generate and upload Cloudflare Worker secrets in one shot.
#
# Usage:
#   ./setup-secrets.sh                              # interactive: prompts for APP_URL
#   ./setup-secrets.sh https://subboost-local.xxx.workers.dev
#   MIGRATE=1 ./setup-secrets.sh <app_url>          # prompt for existing ENCRYPTION_KEY/JWT_SECRET to reuse
#
# Run from the repository root or the local/ directory. Requires openssl + npx.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$LOCAL_DIR"

if ! command -v openssl >/dev/null 2>&1; then
  echo "Error: openssl is required." >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx (Node.js) is required." >&2
  exit 1
fi

MIGRATE="${MIGRATE:-0}"
APP_URL="${1:-}"

echo "Cloudflare Worker secrets setup"
echo "================================"
echo

if [ "$MIGRATE" = "1" ]; then
  echo "Migration mode: reuse existing keys so encrypted data and sessions stay valid."
  echo
  read -r -p "Existing ENCRYPTION_KEY: " ENCRYPTION_KEY
  read -r -p "Existing JWT_SECRET:     " JWT_SECRET
  CRON_SECRET="$(openssl rand -base64 32)"
  echo "Generated new CRON_SECRET: $CRON_SECRET"
else
  echo "Generating fresh random secrets..."
  ENCRYPTION_KEY="$(openssl rand -base64 32)"
  JWT_SECRET="$(openssl rand -base64 32)"
  CRON_SECRET="$(openssl rand -base64 32)"
fi

echo
echo "Uploading secrets to Cloudflare..."
echo "$ENCRYPTION_KEY" | npx wrangler secret put ENCRYPTION_KEY >/dev/null
echo "$JWT_SECRET"     | npx wrangler secret put JWT_SECRET     >/dev/null
echo "$CRON_SECRET"    | npx wrangler secret put CRON_SECRET    >/dev/null
echo "✓ ENCRYPTION_KEY / JWT_SECRET / CRON_SECRET uploaded"

if [ -z "$APP_URL" ]; then
  echo
  echo "Enter your Workers URL (e.g. https://subboost-local.<subdomain>.workers.dev):"
  read -r APP_URL
fi
echo "$APP_URL" | npx wrangler secret put APP_URL >/dev/null
echo "✓ APP_URL = $APP_URL"

echo
echo "================================"
echo "Done. Keep these values in a safe place:"
echo "  ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "  JWT_SECRET=$JWT_SECRET"
echo "  CRON_SECRET=$CRON_SECRET"
echo "  APP_URL=$APP_URL"
if [ "$MIGRATE" != "1" ]; then
  echo
  echo "If you ever need to redeploy or migrate data, reuse the same ENCRYPTION_KEY"
  echo "and JWT_SECRET — otherwise encrypted subscriptions and login sessions break."
fi
