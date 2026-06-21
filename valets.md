# valets.md — Migration Log & Plan

## Status: Live on Railway ✅

## Checkpoint (2026-06-21 09:36 JST)

- **Neon compute idle fix:** Ivan received a Neon warning that the project had used 93% of its monthly compute allowance even though the migrated app was not actively in use.
- **Cause:** Server-side scheduled ticket pollers queried Neon every 5 minutes / 2 minutes for scheduled departures and retrieval pre-alerts, preventing Neon from auto-idling.
- **Fix:** `server/routes.ts` now gates those scheduled pollers behind `ENABLE_VALET_BACKGROUND_JOBS=true`. By default they are disabled, so idle production should stop continuously waking Neon.
- **Behavior change:** Normal app usage still queries Neon on demand. Scheduled auto-close and 15-minute retrieval pre-alert automation only run when the env var is explicitly enabled.
- **Verification before deploy:** `npm run build` passed. Local production-mode smoke test on port 5099 returned `/api/health` `{"ok":true}` and logged `Scheduled ticket pollers disabled; set ENABLE_VALET_BACKGROUND_JOBS=true to enable`.

## Development & Deployment Workflow

### How Changes Get to Production

```
Oscar edits code locally → npm run build → git commit → git push origin main → railway up → Railway builds & deploys → https://valet-s-production.up.railway.app
```

### Step by Step

| Step | Action | Command |
|------|--------|---------|
| 1. Edit | Code changes in `client/`, `server/`, `shared/` | Oscar via `edit` tool |
| 2. Build | Verify it compiles | `npm run build` |
| 3. Commit | Save to local git | `git add -A && git commit -m "..."` |
| 4. Push | Send to GitHub | `git push origin main` |
| 5. Deploy | Upload + rebuild on Railway | `railway up` |
| 6. Verify | Check logs, test endpoints | `railway logs`, `curl /api/health` |

### Key Rules

- **Single branch:** `main` only (migration/railway merged and deleted 2026-05-30)
- **No auto-deploy from GitHub push** — Railway deploys via `railway up` from local machine only
- **Railway builds fresh each time** — runs `npm install && npm run build`, then `npm start`
- **No staging environment** — direct to production
- **Railway project linked** — `railway link --workspace "Ivan Dimitrov's Projects" --project valet-s`
- **Railway project ID:** `7dcb739a-99dd-44c1-afa4-679b82681bb3`

### File Structure

```
/Users/oscarmolt/Projects/valet-s/
├── client/src/          ← React frontend (Vite)
├── server/routes.ts     ← Express API + audit endpoint
├── server/index.ts      ← Server entry point
├── shared/schema.ts     ← Database schema (Drizzle)
├── scripts/audit.ts     ← Local audit CLI tool
├── railway.json         ← Railway build/deploy config
└── package.json
```

### Lessons Learned

- `railway redeploy` only **restarts** the existing container — it does NOT rebuild from source. Use `railway up` to force a fresh build.
- ESM runtime (`--format=esm`) doesn't define `__dirname` — use `fileURLToPath(new URL('.', import.meta.url))` instead.

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

## Checkpoint (2026-06-01 18:55 JST)

- **Local dev server:** `ai.openclaw.valet-dev` LaunchAgent restarted and running on port 5174.
- **Local `/view` Editor ON → NL Command fix:** Updated `server/routes.ts` so `/api/edit/apply` no longer sends the full `client/src` source tree to Qwen on every prompt. The handler now selects a relevance-ranked subset of source files, caps prompt context around 120-140 KB, normalizes model-returned paths like `client/src/pages/view.tsx` back to `pages/view.tsx`, and gives the local model up to 180 seconds.
- **Why:** Full-context payload was about 390 KB and hit the old 60-second abort path, causing visible NL command timeouts. Path mismatch could also make otherwise valid model edits fail to apply.
- **Verification:** `npm run build` passes. Plain unauthenticated POST to `/api/edit/apply` returns expected 401, confirming the patched route is live behind auth. `npm run check` still has unrelated pre-existing TypeScript errors.

## Checkpoint (2026-06-01 19:05 JST)

- **Local NL Command conversational fallback fix:** Ivan tested `Hi Oscar do you copy` and `what can you see at the moment` in Editor ON → NL Command. The endpoint no longer timed out, but Qwen treated both as non-edit prompts and returned `{"edits":[],"summary":"No changes needed"}` after 46-52 seconds.
- **Fix:** Updated `server/routes.ts` so obvious conversational/status prompts bypass Qwen and return an immediate assistant/status reply. Real edit prompts still go through the relevance-ranked Qwen edit path.
- **UI polish:** Updated `client/src/components/edit-nl-command.tsx` so longer NL Command replies wrap cleanly instead of overflowing.
- **Verification:** `npm run build` passes. `ai.openclaw.valet-dev` was restarted and is running on port 5174. Unauthenticated POST still returns expected 401; authenticated browser requests should now show direct replies for greetings/status instead of `No changes needed`.

## Checkpoint (2026-06-01 19:11 JST)

- **Local NL Command chat mode fix:** Ivan reported that casual follow-up messages like `nice that was fast` still returned `No changes needed`.
- **Cause:** The endpoint still defaulted to edit mode for any prompt not caught by a small greeting/status regex.
- **Fix:** Updated `server/routes.ts` so `/api/edit/apply` classifies chat vs edit first. Normal messages now use assistant mode with recent panel history; only clear app-edit requests enter the code-edit path. Simple acknowledgement messages return immediately.
- **UI polish:** Updated `client/src/components/edit-nl-command.tsx` into `Oscar Command`, with history sent to the backend and display text adjusted for normal chat plus app edits.
- **Verification:** `npm run build` passes. `ai.openclaw.valet-dev` was restarted and is running on port 5174. Unauthenticated POST remains expected 401, so the route is live and auth is still enforced.

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
