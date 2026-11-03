---
name: upgo
description: Use whenever a project's goals or roadmap come up in a folder managed by upgo (it has a goals.json), to read, pick up, add, finish, drop or reorder goals, and when the user says "migrate goals" in a repo that still has a hand-written goals.md. Never edit goals.json or goals.md by hand.
---

# upgo

Goals live in `goals.json`, managed by the `upgo` CLI. `goals.md` is generated from it and is what CLAUDE.md auto-loads: open items only, one line each. Run `upgo help` for every command. If `upgo` is not on PATH, use `node <upgo folder>/cli.ts`.

## Rules

- Never Edit, Write or sed `goals.json` or `goals.md`. A hook blocks it; the CLI validates every write and regenerates `goals.md`.
- Before working on an item, read it in full: `upgo show <id>`.
- Anything not in `goals.md`: `upgo list --phase later,wayLater,maybe`, `--status done,dropped`, `--section N`, `--search text`, `--all`.
- Finished: `upgo done <id> --note "<one line on what shipped>"`. Half done: `upgo edit <id> --status partial`.
- Found a new bug or gap: `upgo add "<title>" --section N --phase now|next|later --body "<why>" --files <path>` (also `--seam`, `--depends`, `--trap`, `--how`, `--check`, `--size S|M|L`, `--scope a,b`, `--detail docs/goalsDetails/x.md`).
- Not doing it: `upgo drop <id> --reason "<why>"`, kept so nobody proposes it again. `upgo delete <id>` only for mistakes and duplicates.
- Only when the user asks for suggestions or ideas: `upgo suggestion add "<title>" --body "<why>"` (one per idea). They land in `suggestions.json` and the dashboard's Suggestions panel, where the user copies them back to an agent or adds them to goals. `upgo suggestion list | delete <id...>`. When the user picks one to do: `upgo suggestion promote <id> --section N [--phase next]` adds it as a goal and removes the suggestion.
- Something every agent must know before touching an area: `upgo trap add "<title>" --body "<detail>"`.
- Long-form detail for an open item stays in `docs/goalsDetails/*.md`, linked with `--detail`.
- `upgo check` must pass; the git pre-commit hook runs it. Commit `goals.json` and `goals.md` together.

## Migrate goals

When the user says "migrate goals" in a repo with a hand-written `goals.md`:

1. Read `goals.md`, `goals-completed.md` and the repo's CLAUDE.md roadmap rules.
2. Dry run outside the repo: `upgo import goals.md --out <scratchpad>/goals.json`. Read the report: open count matches the old file, sections and traps look right, nothing important in `skipped`.
3. Ask the user about anything skipped or ambiguous before writing into the repo.
4. In the repo: `upgo import goals.md`, then `upgo init` (registers it, installs the git and Claude hooks), `upgo render` (replaces `goals.md` with the generated one), `upgo check`.
5. Delete `goals-completed.md` (its entries are now done and dropped items in `goals.json`) and reword references to "`goals-completed.md` §N" in docs, comments and open goals as "done goals §N". Keep `docs/goalsDetails/`.
6. Replace the repo's roadmap rules in CLAUDE.md with one line: "Goals live in goals.json, managed by upgo; goals.md is generated and auto-loaded. Use the upgo CLI (see the upgo skill), never edit either file." Keep the `@goals.md` import.
7. Summarize what changed. Commit only when asked.
