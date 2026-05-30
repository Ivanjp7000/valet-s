# valets.md — Migration Log & Plan

## Status: In Progress

## Checkpoint (2026-05-29 11:10 JST)

- **Railway project:** `valet-s`
- **Railway project ID:** `7dcb739a-99dd-44c1-afa4-679b82681bb3`
- **Railway production URL:** `https://valet-s-production.up.railway.app`
- **Deployment status:** Online
- **Health check:** `/api/health` returned `{"ok":true}` after deploy
- **Branch:** `migration/railway`
- **Latest known deploy commit:** `8f9a0b8 Fix all TypeScript errors, add railway.json + /api/health endpoint`
- **Important fixes for Railway:**
  - Added `engines.node >=20.0.0` so Nixpacks uses Node 20
  - Removed `reusePort: true` from `server/index.ts` because it crashed under Node 18 during early deploy attempts
- **Deployment lesson:** first attempts failed because Railway/Nixpacks selected Node 18 and the server crashed before healthcheck; after Node 20/runtime fix, service came online.
- **Qwen session health:** `qwen36-local` session `1a1bbff3-7174-4d5c-a1ee-9c3352b569a5` hung after the successful deploy summary and failed to write this checkpoint. Transcript shows `LLM idle timeout (120s)` followed by `503 Loading model`. Direct llama.cpp probe later returned `QWEN_OK_1109`, so backend recovered but the session should be treated as dirty.

### Next Migration Steps
1. Smoke test Railway URL: auth, OTP email, staff dashboard, ticket creation, guest lookup, WebSocket updates
2. Decide whether to update DNS for `valet-s.com` after smoke tests
3. Re-enable/rebuild photo upload routes later; they are currently disabled with `503`
4. Keep using fresh sessions if `qwen36-local` hits idle timeout or `503 Loading model`

## Checkpoint (2026-05-29 06:55 JST)

- **Branch:** `migration/railway`
- **Latest commit:** `8f9a0b8 Fix all TypeScript errors, add railway.json + /api/health endpoint`
- **Build:** `npm run build` passes (2.56s, dist/index.js 184.5kb)
- **Type check:** `npm run check` has existing TypeScript errors (client/admin/staff + server types) — not yet clean
- **OpenClaw version:** 2026.5.26 (Jane recovered — WebUI token issue, not update crash — safe to update now)
- **Model:** `qwen36-local` for implementation, `gpt-5.5` for review

### What's Done
- Branch `migration/railway` created from `master`
- Replit auth module removed
- Replit object storage routes removed
- Photo upload/access routes temporarily disabled with `503` responses
- Clean auth module added
- Build verified passing
- **All TypeScript errors fixed** (13 errors → 0) — commit `8f9a0b8`
- `railway.json` added (Nixpacks build + `/api/health` healthcheck)
- `/api/health` endpoint added to server
- `tsconfig.json` updated with `target: ES2020` to fix MapIterator iteration
- `npx tsc --noEmit` clean, `npm run build` passes (2.40s)

### Remaining Work
1. ~~Update `valets.md` with checkpoint~~ ✅
2. Fix `npm run check` TypeScript errors (or decide if Railway launch only needs `npm run build`)
3. Add Railway deployment config (`railway.json` with build/start commands)
4. Confirm environment variables for Railway:
   - `DATABASE_URL` (keep existing Neon DB for first deploy)
   - `SESSION_SECRET`
   - `GMAIL_USER` / `GMAIL_APP_PASSWORD`
   - `GOOGLE_VISION_API_KEY`
   - `SUPER_ADMIN_EMAILS` / `SUPER_ADMIN_IDS`
   - `APP_URL`
5. Deploy to Railway staging/test URL
6. Verify: login, OTP email, staff dashboard, ticket creation, guest lookup, WebSocket updates
7. Only after Railway works: update DNS for `valet-s.com`

### Known Issues
- `npm run check` TypeScript errors exist across client/admin/staff modules
- Photo routes disabled (503) — planned for later re-implementation
- Jane (`192.168.1.20`) crashed on OpenClaw 2026.5.27 update — do not update Oscar until root cause known
- USB KVM broken — cannot access Dell/Jane directly

### Lessons
- `edit` tool exact-text patches can fail on stale content — use line/structure-based patches instead
- Keep one OpenClaw instance stable before updating the second
- Model switch (qwen36-local → gpt-5.5 → qwen36-local) is safe for this work as both are Red-tier authorized
