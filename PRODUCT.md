# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One developer (the owner) running many personal projects with Claude Code agents. She opens the dashboard both for a quick glance between tasks (what is now/next, pick items, copy them to Claude) and for longer planning sessions (reordering, editing, triaging goals across projects).

## Product Purpose

upgo keeps structured goals for every project: a `goals.json` per repo that agents only change through a validating CLI, a slim generated `goals.md` agents auto-load, and a local dashboard over every registered project. Success: at any moment she can see what matters across all projects and hand the right items to an agent in seconds.

## Positioning

Goals live in the repo next to the code and are agent-native: agents read and write them through a validated CLI, the human steers through the dashboard, and both stay in sync live.

## Operating Context

- Local only, `http://127.0.0.1:4141`, desktop browser, often beside a terminal running Claude Code.
- Live: when an agent changes a `goals.json`, the page updates by itself (SSE).
- Copy-for-agent ritual: tick items, Copy, paste into Claude.

## Capabilities and Constraints

- Items: id, section, title, body, phase (now, next, later, way later, maybe), status (planned, partial, done, dropped), size (S/M/L), scope tags, pointers, related refs, detail file, dates, note.
- Sections (numbered, ordered), traps (read-only in the UI, edited via CLI).
- Dashboard actions: filter/search, expand, edit, phase/status change, done with note, drop with reason, reopen, reorder (drag, Alt+Up/Down), section management, multi-select copy.
- Project summary API gives per project: open, done, dropped counts, purpose, error.
- Done and dropped items stay in the file as the archive.

## Brand Commitments

- Dark theme.
- Outfit as the UI font.
- Magenta accent (`rgb(204, 26, 236)`).

## Evidence on Hand

Real goals data from registered projects; no marketing claims needed (personal local tool).

## Product Principles

- The agent is a first-class user: nothing in the UI may drift from what the CLI validates.
- Glanceable first: what is "now" across projects must be obvious without clicking.
- Live and trustworthy: the page reflects the files, never a stale copy.
