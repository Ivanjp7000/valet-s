#!/usr/bin/env bash
# valet-deploy.sh — push to GitHub, then deploy to Railway
# Ensures GitHub is always in sync before Railway gets new code
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== valet-s deploy ==="
echo ""

# 1. Push to GitHub first
echo "[1/2] Pushing to GitHub..."
if ! git push origin main 2>&1; then
  echo ""
  echo "❌ Push failed. Aborting deploy. Fix the push first."
  exit 1
fi
echo "   GitHub is in sync."
echo ""

# 2. Deploy to Railway
echo "[2/2] Deploying to Railway..."
if ! railway up; then
  echo ""
  echo "⚠️  Deploy failed. Code is pushed to GitHub — run 'railway up' manually to retry."
  exit 1
fi

echo ""
echo "✅ Deployed. GitHub + Railway are in sync."
