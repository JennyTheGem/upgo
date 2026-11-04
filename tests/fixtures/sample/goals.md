# Lumen: roadmap

Purpose: a small offline-first notes app for the desktop and the web.

Legend: [ ] open · 🚧 partial · 📋 planned · ✅ done · ❌ dropped

### Live traps (read first)

- **The sync worker owns the database**, so the UI never writes to IndexedDB directly.
  Go through `syncClient` or the next sync overwrites the change.
- **A note's id is its file name on disk.** Renaming a note on disk without the index breaks every link to it.

### How to read this

- Phase tags in bold, size and scope right after the title.

## 1. Editor

- [ ] **(Now)** **Markdown tables** (M, all platforms). Insert, resize and sort tables in the editor.
  - ↳ files: `src/editor/table.ts`, `src/editor/keymap.ts`
  - ↳ seam: `editorCommands`
  - ↳ trap: the table plugin re-renders the whole doc on every keystroke
- 🚧 **(Next)** **Spell check** (S, desktop). Uses the OS checker, the web build has none yet.
- [ ] **(Later)** Vim keybindings for the editor. Opt-in, off by default.
- ✅ Word count in the status bar

## §2 Sync

Sync is the riskiest area, read the traps first.

- [ ] **(Next)** **Conflict view** (L, desktop + web, backend). Show both versions side by side and let the user pick.
  - ↳ depends: `sync-v2`
  - ↳ check: two clients editing the same note offline both keep their text
- 📋 **(Way later)** **End-to-end encryption.** Plan: [`e2e`](./docs/goalsDetails/e2e.md).
- [ ] **(Maybe)** Peer-to-peer sync over the local network

## 3. Search

- [ ] **(Now)** Full-text search across every notebook, ranked by recency. Must stay under 50 ms for 10k notes.
- [ ] **(Way later, maybe)** Semantic search
- ❌ Search inside attachments

## Apps

- [ ] **(Later)** **Mobile share target** (M, android). Share text or a link into a new note.
- [ ] Tray icon with a quick-capture window

---

Release notes below this rule are not goals.

