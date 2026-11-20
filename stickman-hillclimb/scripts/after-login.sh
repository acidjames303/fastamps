#!/usr/bin/env bash
# Run after Base44 device login succeeds.
set -euo pipefail
cd "$(dirname "$0")/.."
export BASE44_APP_ID="${BASE44_APP_ID:-6afb374c91d1c9194f9d6554}"

echo "== whoami =="
npx base44 whoami

echo "== locate stickman source =="
npx base44 --app-id "$BASE44_APP_ID" --json sandbox grep 'mt=3e3|Ot=7e3|xt=270|StickmanOverlay|sm-figure' \
  --glob '*.{ts,tsx,js,jsx}' --max-results 40 | tee artifacts/sandbox-locate.json

echo "== dry-run manners patch =="
npm run apply:manners:dry

echo "== apply manners patch =="
npm run apply:manners

echo "== playtest =="
npm run playtest

echo "Done. Inspect artifacts/latest/report.json flags."
