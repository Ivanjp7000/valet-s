# Edit Page Spec — valet-s.com /view

## Goal
Add a live editing layer to the existing `/view` responsive testing harness. Two modes, both inside the same page:

### Mode 1: Inline Code Editor
- Monaco-based code editor panel
- File tree browser (client/src/ pages, components, styles)
- Click file → edit in Monaco → save → hot reload preview frames
- Syntax highlighting, line numbers, basic lint feedback
- Undo/redo, format on save

### Mode 2: Natural Language Command Panel
- Text input: "make the hero section darker", "add padding to cards"
- Submits to Oscar via API endpoint
- Oscar applies changes to local source files
- Preview frames hot-reload to show result
- Change log showing what was modified

### Shared Infrastructure
- REST API endpoints for file read/write (`/api/edit/fs/*`)
- Live reload webhook to refresh preview iframes
- Git staging/commit from the page
- "Push to Railway" button (manual approval)
- Diff viewer for changes before committing

## Layout
```
┌──────────────────────────────────────────────────────────┐
│  Toolbar: URL input | Quick pages | Device toggles      │
├──────────┬───────────────────────┬───────────────────────┤
│ File Tree│   Preview Frames      │ NL Command Panel      │
│          │   (existing iframe    │   or                  │
│ [toggle  │    device frames]     │   Monaco Editor       │
│  to      │                       │                       │
│  editor]├───────────────────────┴───────────────────────┤
│          │  Bottom: Change log / Git status              │
└──────────┴───────────────────────────────────────────────┘
```

## Architecture
- New server routes in `server/routes-edit.ts`
- Editor panel: Monaco Editor (vscode-style)
- Preview: existing iframe device frames
- File tree: recursive read of `client/src/` via API
- Hot reload: Vite HMR or iframe refresh
- Git: server-side `git` commands via API endpoints

## Iteration Plan
1. ✅ Ralph workspace + spec
2. Server API: file read/write/list endpoints
3. Server API: git status/commit/push endpoints  
4. UI: file tree panel component
5. UI: Monaco editor integration
6. UI: NL command panel
7. Wire: editor ↔ preview hot reload
8. Wire: NL command → file changes
9. Polish: diff viewer, change log
10. Git commit locally → Ivan reviews → push + deploy

## Safety
- File writes restricted to `client/src/` and `shared/` only
- Server files require explicit confirmation
- All changes committed locally first (no auto-push)
- Diff preview before save
- Rollback button
