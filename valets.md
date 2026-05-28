# valets.md — Migration Log & Plan

## Status: In Progress

## Checkpoint (2026-05-29 06:00 JST)

- **Branch:** `migration/railway`
- **Latest commit:** `b1abc78 Remove Replit auth, object storage, photo routes; add clean auth module`
- **Build:** `npm run build` passes (2.56s, dist/index.js 184.5kb)
- **Type check:** `npm run check` has existing TypeScript errors (client/admin/staff + server types) — not yet clean
- **OpenClaw version:** 2026.5.26 (stable — do NOT update until Jane crash on 2026.5.27 is understood)
- **Model:** `qwen36-local` for implementation, `gpt-5.5` for review

### What's Done
- Branch `migration/railway` created from `master`
- Replit auth module removed
- Replit object storage routes removed
- Photo upload/access routes temporarily disabled with `503` responses
- Clean auth module added
- Build verified passing

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
