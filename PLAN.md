# `upgo`: global goals tracker

First step on approval: copy this plan to `E:\Downloads\Projects\Assets\upgo\PLAN.md`.

**Change boundary:** I only write inside `E:\Downloads\Projects\Assets\upgo\` and `E:\Downloads\claude\backup\` without asking. The Velora frontend repo is not touched at all for now. Everything else (global CLAUDE.md, skill, vault, upex, any repo) waits for Jenny's explicit ok, asked as one batch when the tool is built and green.

## Context

Every repo keeps a hand-written `goals.md` + `goals-completed.md`, drifted into three dialects (Velora `[ ]` + `↳` pointers; upex/BeyondUI/chat `✅/🚧/📋` lists; Uplift with a 40-line narrative "Last updated"). Nothing enforces structure, there is no cross-repo view, and handing an item to an agent is manual copy-paste. Goal: structured JSON that agents can only touch through a validating CLI, a slim generated `goals.md` for agent context, and a local React dashboard over every registered project where Jenny can browse, filter, edit, reorder and copy items to an agent.

## Decisions

- **One `goals.json` per project** (open, done, dropped together, `status` field). Source of truth.
- **Agents never hand-edit it**: every mutation goes through the CLI (or the dashboard), both via one shared core that validates before writing.
- **Generated slim `goals.md`** keeps the existing `@goals.md` auto-load: traps, then per section `- \`id\` title (phase)` for now/next/later; wayLater/maybe collapse to a count; done/dropped never appear. No "Last updated" line. Agents get detail with `upgo show <id>`, and any slice with `upgo list --phase later|wayLater|maybe|... [--status done] [--section n] [--search q]`, so asking "what's in way later?" still works.
- **Traps** are a list in the JSON, rendered at the top of the md.
- `docs/goalsDetails/*.md` stay markdown, linked from an item's `detail`.
- **Ids** are readable slugs, unique per project; cross-project refs are `projectId:itemId`.
- **Registry**: a project joins only via `upgo init` there. Any folder can be a project (Velora-v2 cross-repo goals included). An item belongs to one project; halves link through `related`.
- **Drop** keeps the item (hidden, with reason) so nobody re-proposes it; **Delete** removes it (typos, duplicates).
- **Sections**: editable in the dashboard (add, rename, reorder; delete only when empty). A section with no open items renders as "closed" automatically, no manual list.
- **Reorder**: drag within and between sections (moving changes the item's section), keyboard move up/down as the accessible fallback.
- **Enforcement per repo**, installed by `init`: git pre-commit hook running `upgo check`, plus a Claude Code `PreToolUse` hook in the repo's `.claude/settings.json` that blocks Edit/Write on `goals.json` / `goals.md`.
- **Dashboard**: local only (bound to 127.0.0.1), separate app, React + Velora tokens and primitives copied into the app. Project sidebar, filters inside the project (section, phase, status, size, scope, search, show done/dropped). Copy = selected item(s) only, `id: title` + body.
- **Rollout**: Velora frontend first; afterwards "migrate goals" in any repo triggers the skill.
- **Backup first** into `E:\Downloads\claude\backup\2026-10-12\`.

## Layout

```
E:\Downloads\Projects\Assets\upgo\
  src/core/schema.ts     zod schema -> types for CLI/server/web + emitted goals.schema.json (VS Code autocomplete via $schema)
  src/core/store.ts      find project (walk up from cwd to goals.json), load, lock (O_EXCL lockfile, stale after 10s), atomic save (tmp + rename), always re-renders goals.md
  src/core/mutate.ts     add, edit, move, reorder, setPhase, setStatus, done, drop, delete, section ops
  src/core/check.ts      schema + semantic: unique slug ids, sections exist, related resolve via registry, detail files exist, goals.md in sync
  src/core/render.ts     goals.json -> slim goals.md
  tests/                 vitest suites for core, CLI, hooks, server, web (see Tests)
  cli.ts                 init | add | edit | show | list | done | drop | delete | move | section | check | render | hook | ui
  server.ts              REST mutations through core, fs.watch per project -> SSE, serves web/dist
  web/                   React + Vite dashboard
  registry.json          [{ id, name, path }]
  upgo.cmd             PATH shim (like chat/chat.cmd)
~/.claude/skills/upgo/SKILL.md   CLI usage for agents + the "migrate goals" procedure
```

Node 22.18+ runs the `.ts` files directly (same as `chat/server.ts`). Dependencies: `zod` (core); React/Vite/TypeScript for `web/`; dev only: `vitest`, `jsdom`, `@testing-library/react` + `user-event` (same test stack as BeyondUI), one runner for everything via `npm test`.

## File shape

```jsonc
{
  "$schema": "file:///E:/Downloads/Projects/Assets/upgo/goals.schema.json",
  "version": 1,
  "project": "velora-frontend-react",
  "purpose": "one line",
  "sections": [{ "n": 1, "title": "Playback & Audio Engine" }],   // array order = display order
  "traps": [{ "id": "backdrop-root", "title": "...", "body": "markdown" }],
  "items": [{                                                       // array order = display order
    "id": "random-logouts", "section": 10, "title": "Random logouts", "body": "markdown",
    "phase": "now|next|later|wayLater|maybe", "status": "planned|partial|done|dropped",
    "size": "S|M|L", "scope": ["all"],
    "pointers": { "files": [], "seam": [], "depends": [], "trap": [], "how": [], "check": [] },
    "detail": "docs/goalsDetails/x.md", "related": ["velora-backend:one-device"],
    "created": "2026-10-12", "updated": "2026-10-12", "note": "done note or drop reason"
  }]
}
```

## Steps

Steps 1 to 6 run without asking (they only write into `upgo\` and `backup\`; the Velora files are only read and copied). Steps 7 to 10 each wait for Jenny's ok.

1. **Backup** (copy only) `~/.claude/CLAUDE.md`, Velora frontend `CLAUDE.md` + `goals.md` + `goals-completed.md`, vault `INDEX.md` + `coding/preferences/working-style.md` into `E:\Downloads\claude\backup\2026-10-12\`.
2. **Core** (schema, store, mutate, check, render) + its tests.
3. **CLI** + shim. `init` creates `goals.json`, registers the project, installs the git pre-commit hook (if `.git` exists) and merges the Claude hook into `.claude/settings.json` (`upgo hook` reads the tool call from stdin, exits 2 with "use the upgo CLI" for `goals.json`/`goals.md`).
4. **Server**: 127.0.0.1 only; mutations require a custom header + JSON body and a matching `Origin`, so no other web page can write to disk through it; projects addressed by registry id, never by a client-supplied path.
5. **Web**: copy Velora's `index.css` tokens, Outfit font and the needed primitives (Button, SearchInput, Dropdown, confirm dialog, toast, Tabs), stripped of music-specific imports. Views: project sidebar; filter bar; section-grouped list with native HTML5 drag-reorder; expandable rows (body, pointers, detail file as pre-wrapped text); add/edit modal; drop asks a reason; delete confirms; multi-select + copy. Live refresh over SSE when an agent changes a file.
6. **Migration dry run, read-only**: `upgo import <path-to-goals.md> --out <file>` converts a goals.md (+ goals-completed.md) into a goals.json *outside* the repo. Run against the Velora files into `upgo\tests\fixtures\` so the converter is tested on real data without touching Velora.
7. *(ask first)* **Skill** `upgo` in `~/.claude/skills/`: agent rules (never hand-edit, `show` before working, `done <id> --note` when finished, `list` for any slice) + "migrate goals" procedure (run `import`, review, `init`, `check`, delete the old `goals-completed.md`, replace the repo's roadmap rules in CLAUDE.md).
8. *(ask first)* **Rules**: global CLAUDE.md `/init` block and goals lines; vault project note + INDEX line.
9. *(ask first)* **upex + PATH**: shortcut to the folder, a `start` shortcut running `upgo ui`, and the folder added to the user PATH so `upgo.cmd` works from any repo.
10. *(ask first)* **Pilot**: migrate Velora frontend with the skill and rewrite its "Roadmap files" rules.

## Tests

Everything gets tests; `npm test` runs them all and must be green before I report done. Every test works in a fresh temp dir with its own registry (an env var points upgo at it), so tests never read or write real projects.

- **schema**: every field's valid and invalid values, bad slugs, unknown keys, missing required fields; the emitted `goals.schema.json` matches the zod schema.
- **store**: finds the project walking up from a nested cwd; atomic save leaves no partial file on a thrown write; a held lock blocks a second writer and a stale lock (>10s) is taken over; every save re-renders `goals.md`.
- **mutate**: add/edit/move/reorder/setPhase/setStatus/done/drop/delete and section add/rename/reorder/delete each produce a file that passes `check`; duplicate id, unknown section, deleting a non-empty section all rejected; `updated` date bumps.
- **check**: one test per rule (duplicate id, missing section, unresolved `related`, missing detail file, md out of sync) plus a clean pass.
- **render**: exact md for a fixture (traps first, now/next/later lines, wayLater/maybe counts, closed sections, no done/dropped); no U+2014 in the output.
- **import**: converts each dialect fixture (Velora `[ ]`+`↳`, `✅/🚧/📋`, narrative Last updated) and the copied real Velora files; open item count equals the source's.
- **CLI**: spawn every command against a temp project; exit codes and output; `list` filters (`--phase`, `--status`, `--section`, `--search`); `init` registers, writes the git hook and merges `.claude/settings.json` without clobbering existing keys.
- **hooks**: `upgo hook` exits 2 for Edit/Write on `goals.json`/`goals.md` and 0 for other files; the installed pre-commit refuses a commit with a corrupt `goals.json` in a temp git repo.
- **server**: REST read and every mutation; rejected without the custom header, with a foreign `Origin`, or with an unregistered project id; a path in the request is never used; an external file change pushes an SSE event; binds 127.0.0.1 only.
- **web** (jsdom + Testing Library): project switch, each filter, search, show done/dropped toggle, add/edit modal, phase/status change, drop asks a reason, delete confirms, keyboard reorder, multi-select copy puts the exact text on the clipboard, SSE update re-renders.

## Verification

- `npm test` green, `tsc` + `vite build` + lint clean, results reported with output.
- Jenny checks the UI herself (no dev server or screenshots from me).
- Final grep for U+2014 over everything written.
