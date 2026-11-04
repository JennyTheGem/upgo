# Lumen: completed

## 1. Editor

- ✅ **2026-03-02 - Undo history survives a reload.** Stored per note next to the draft.
  - ↳ files: `src/editor/history.ts`
- **Autosave (2026-02-14).** Every two seconds and on blur.
- **Dropped: Rich text mode (2026-03-10).** Markdown only, by decision.

**Line numbers (2026-03-20).** Shipped as an option in settings,
off by default.

- **Part**: the gutter reuses the fold markers.
- Verified: tests green.

| Setting | Default |
|---|---|
| lineNumbers | off |

## §2 Sync

- **Sync v1 (2026-01-30).** Last write wins, per note.
- **Delta sync, dropped 2026-02-20.** Not worth it before conflicts are solved.
- 2026-04-01 Background sync on the desktop app

_(open, see `goals.md`)_

## 5. Old platform

- Electron shell replaced by the native webview
