#!/bin/bash
# Wrapper for LaunchAgent — starts valet-s dev server (absolute paths, no nvm dependency)
export PATH="/opt/homebrew/bin:$PATH"

cd /Users/oscarmolt/Projects/valet-s

# Load .env properly (handles spaces in values)
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    export "$line"
  done < .env
fi

NODE_ENV=development VITE_ALLOW_VIEW=true PORT=5174 exec /opt/homebrew/bin/node node_modules/tsx/dist/cli.mjs server/index.ts
