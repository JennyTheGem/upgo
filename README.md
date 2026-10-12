# upgo

Structured goals for every project. Each project keeps a `goals.json` that agents only touch through the validating `upgo` CLI, a slim generated `goals.md` for agent context, and a local dashboard over every registered project.

## Setup (once per machine)

- Node 22.18+ (it runs the `.ts` files directly). `npm install` in this folder.
- This folder is on the user PATH: `upgo.cmd` serves cmd/PowerShell, `upgo` serves Git Bash. Without PATH: `node E:/Downloads/Projects/Assets/upgo/cli.ts`.
- `npm run build` builds the dashboard into `web/dist` (`start.bat` does it when missing).
- The agent skill is `skill/SKILL.md`, linked into `~/.claude/skills/upgo` as a junction, so editing it here is what Claude loads.
- upex: `upex upgo` opens this folder, `upex startUpgo` starts the dashboard.

## The dashboard

`upgo ui` (or `upex startUpgo`) serves `http://127.0.0.1:4141` and opens it. It only listens on this machine.

- **Projects**: pick one in the left sidebar. Every registered project shows with its open count.
- **Filters** (inside the project): search (id, title, body, pointers), Phase, Status, Section, Size, Scope. Done and dropped items stay hidden until **Show done/dropped** is on. **Clear filters** resets.
- **Read**: click an item's title to expand its body, pointers and related refs; a button loads its detail file.
- **Change**: right-click a row or use its ⋮ menu: edit, phase, status, done (optional note), drop (asks a reason), reopen, move up/down, copy, delete.
- **Reorder**: drag a row by its handle, also into another section; dropping on a section header puts it at the end. Keyboard: Alt+Up / Alt+Down.
- **Sections**: **Add section** in the header; a section's ⋮ menu renames, moves, adds an item to it or deletes it (only when it holds no items at all). A section with no open items shows as closed.
- **Copy for an agent**: tick items (shift-click for a range), press **Copy** in the bar at the bottom, paste into Claude. It gets `id: title` plus the body and reads the rest itself with `upgo show <id>`.
- **Live**: when an agent changes a `goals.json`, the page updates by itself.

## Working with agents

Agents follow the `upgo` skill. In practice:

- "work on `random-logouts`": the agent runs `upgo show`, does the work, then `upgo done <id> --note "..."`.
- "what's in way later?": `upgo list --phase wayLater`. Done work: `upgo list --status done --section 5`.
- Bugs or gaps they find are added with `upgo add`; things everyone must know before touching an area become traps (`upgo trap add`).
- They cannot hand-edit `goals.json` or `goals.md`: a Claude hook blocks it.

## Adding a project

- **New repo**: `/init` in Claude runs `upgo init --purpose "..."`, seeds sections and items, and puts `@goals.md` at the top of CLAUDE.md. By hand: `upgo init --purpose "one line"` in the folder.
- **Repo with an old hand-written goals.md**: tell Claude "migrate goals". It does a dry run first (`upgo import goals.md --out <scratch>`), asks about anything unclear, then imports, runs `upgo init`, deletes `goals-completed.md` and rewrites the repo's roadmap rules.
- Any folder can be a project, git or not. Only `upgo init` registers one; nothing is scanned.

## CLI

`upgo help` lists everything. The common ones:

```
upgo projects                                  registered projects, open counts
upgo list [--phase later,wayLater] [--status done] [--section 5] [--search text] [--all]
upgo show <id>                                 one item in full (also project:id)
upgo add "Title" --section 5 --phase next --body "why" --files src/x.ts --size S
upgo edit <id> --phase later --status partial  same fields as add; --clear body,size,...
upgo done <id> --note "what shipped"           upgo drop <id> --reason "why not"
upgo reopen <id>                               upgo delete <id>   (mistakes and duplicates only)
upgo move <id> --section 3 | --before <id> | --after <id> | --up | --down
upgo section list | add "Title" | rename 3 "Title" | move 3 --before 1 | delete 3
upgo trap list | add "Title" --body "..." | edit <id> | delete <id>
upgo check [--all]                             validate one or every project
upgo render                                    rewrite goals.md from goals.json
upgo ui [--port 4141] [--no-open]
```

Every command works from inside the project folder, or anywhere with `--dir <path>` / `--project <id>`.

## What a project holds

- **`goals.json`** (committed with the repo): the source of truth. Sections (`n` is the § number, array order is display order), traps, and items. An item has an `id` (slug, unique per project), `section`, `title`, optional `body`, `phase` (`now`, `next`, `later`, `wayLater`, `maybe`), `status` (`planned`, `partial`, `done`, `dropped`), `size` (`S`/`M`/`L`), `scope`, `pointers` (`files`, `seam`, `depends`, `trap`, `how`, `check`, `options`, `where`), `detail` (a `.md` file in the repo), `related` (`project:id` refs, also across projects), dates, and `note` (done note or drop reason). Done and dropped items stay in the file: that is the archive.
- **`goals.md`** (committed, generated): what CLAUDE.md auto-loads with `@goals.md`. Traps, then the open now/next/later items one line each; way later and maybe show as counts; done and dropped never appear.
- **`docs/goalsDetails/*.md`**: long-form detail for an open item, linked through `detail`.
- **Hooks** installed by `upgo init`: a git pre-commit that runs `upgo check` (a broken `goals.json` or a stale `goals.md` blocks the commit), and a PreToolUse hook in the repo's `.claude/settings.json` that stops agents from editing the two files by hand.

Outside the projects, in this folder: `registry.json` (which projects exist; `UPGO_REGISTRY` overrides the path, tests use it) and the dashboard.

## When something goes wrong

- **Commit blocked by the pre-commit hook**: run `upgo check` to see why. "goals.md is out of date" is fixed by `upgo render`.
- **"goals.json was saved, but goals.md could not be written"**: the change is in; run `upgo render`. Do not repeat the command.
- **A write waits or says the file is locked**: another write holds `goals.json.lock`. A lock older than 10s is taken over automatically.
- **Dashboard says it is not built**: `npm run build` here.
- **This folder moved**: the installed hooks point at the old path and fail. Run `upgo init` again in each project.
- **Remove a project from the dashboard**: `upgo forget <id>`. Its files stay where they are.

## Pieces

- `src/core/`: zod schema, store (lock + atomic writes), mutations, ops, rules, checks, md renderer, importer.
- `cli.ts`: the CLI. `server.ts`: REST + SSE for the dashboard, 127.0.0.1 only.
- `web/`: React dashboard (Velora design system), virtualized item list.
- `goals.schema.json`: generated by `npm run schema`, gives VS Code autocomplete through `$schema`.
- `skill/SKILL.md`: the agent skill.

## Develop

```
npm test          # everything (vitest)
npm run typecheck
npm run lint
npm run build     # dashboard into web/dist
npm run dev       # dashboard dev server, with `UPGO_DEV=1 upgo ui --no-open` running for the API
```
