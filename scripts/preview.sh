#!/bin/bash
# Local preview — loads .env, runs dev server, tells you the URL
set -e
cd "$(dirname "$0")/.."

# Load .env as exports
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Kill any existing dev server on 5000
EXISTING=$(lsof -ti:5000 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "⚠️  Killing existing process on :5000 ($EXISTING)"
  kill $EXISTING 2>/dev/null || true
  sleep 1
fi

echo "▶ Starting local preview..."
echo "  URL: http://localhost:5000"
echo "  LAN: http://192.168.1.25:5000"
echo ""
NODE_ENV=development npx tsx server/index.ts
