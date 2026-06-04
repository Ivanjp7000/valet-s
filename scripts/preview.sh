#!/bin/bash
# Local preview — loads .env, runs dev server, shows you the URL
set -e
cd "$(dirname "$0")/.."

PORT=${PORT:-5174}

# Load .env — properly handles values with spaces
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    export "$line"
  done < .env
  echo "✓ .env loaded"
else
  echo "✗ .env not found"
  exit 1
fi

# Kill any existing dev server on our port
EXISTING=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "⚠️  Killing existing process on :$PORT ($EXISTING)"
  kill $EXISTING 2>/dev/null || true
  sleep 1
fi

echo ""
echo "▶ Starting local preview..."
echo "  → http://localhost:$PORT"
echo "  → http://192.168.1.25:$PORT (LAN)"
echo "  (Ctrl+C to stop)"
echo ""

NODE_ENV=development VITE_ALLOW_VIEW=true PORT=$PORT exec /opt/homebrew/bin/node node_modules/tsx/dist/cli.mjs server/index.ts
