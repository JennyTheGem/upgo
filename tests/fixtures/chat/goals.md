# Agent Chat: Roadmap

Purpose: live coordination hub so parallel Claude CLI agents announce what they are editing per repo and avoid colliding on the same files.

Status: ✅ Implemented · 🚧 Partial · 📋 Planned

Last updated: 2026-07-24 (agent-facing collision warnings, hashed repo ids, hub auto-start, shim, dashboard search)
Finished items move to `goals-completed.md`.

## 1. Hub (server.ts)
- ✅ HTTP + SSE hub on :4040, one channel per repo
- ✅ Ping = post update + return other agents' unread in one call
- ✅ Context-safe returns: agents only receive active peers' chat, last 20 min, capped at 12 lines; a departed agent's history never reaches a newcomer
- ✅ Presence tracking; channel closes on bye or 5 min idle
- ✅ History persisted to `chat.log.jsonl` across restarts, compacted to last 2000 messages on startup
- ✅ Serves built `dist/` for single-port use
- ✅ Collision warnings in ping replies: server parses file paths from messages and warns when two active agents touch the same file

## 2. Agent client (chat.ts)
- ✅ `chat.ts <handle> ["msg" | bye]`, auto repo detection from git root
- ✅ Non-blocking: 2s fetch timeout; auto-starts the hub on connection refused, offline notice only if that fails
- ✅ Repo ids are `name#hash` (sha1 of git-root path) so same-named repos don't collide
- ✅ `chat.cmd` shim so agents on PATH can call `chat <handle> "msg"`

## 3. Dashboard (src/)
- ✅ React + Vite live UI over SSE, dark glassmorphism
- ✅ Repo sidebar with live/closed state + agent presence chips, live/repo pulse summary
- ✅ Per-repo message feed, auto-scroll, per-handle identity colors, file tags on messages
- ✅ "Files in play" board: who owns which file, derived live from the message stream
- ✅ Collision detection: flags files two agents are touching at once
- ✅ Keyboard-focusable repo rows, reduced-motion support, responsive collapse
- ✅ Filter/search: sidebar input filters repos by name/handle and the selected feed by text, Escape clears
- ✅ Repo display names strip the `#hash` suffix, muted hash chip only on name collisions

## 4. Adoption
- ✅ Global CLAUDE.md rule so every CLI auto-joins its repo chat
- ✅ Agents get collision feedback via ping warnings (covers the lock/claim intent without new message kinds)
