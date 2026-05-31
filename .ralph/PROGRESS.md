# Ralph Progress — Edit Page for /view

## Iteration 1: Server API ✅ (2026-05-31 09:52 JST)
- Inlined ESM-safe edit routes inside `registerRoutes()` in `server/routes.ts`
- Endpoints: `/api/edit/tree`, `/api/edit/file/*` (GET/POST), `/api/edit/git/*`, `/api/edit/build-check`, `/api/edit/deploy`
- Build verified: passes, 4 pre-existing TS errors only (not from our code)
- **NOT pushed yet** — Ivan needs to review

## Next: Iteration 2 — Install Monaco Editor dependency
## Then: Iteration 3 — UI: FileTree + Editor + NLCommand panel components
