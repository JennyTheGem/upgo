# upgo

Structured goals for every project. Each project keeps a `goals.json` that agents only touch through the validating `upgo` CLI, a slim generated `goals.md` for agent context, and a local dashboard over every registered project.

## Install

```
npm i -g @uplift-beyond/upgo
```

Then `upgo help`. The agent skill ships in the package: copy `$(npm root -g)/@uplift-beyond/upgo/skill/SKILL.md` to `~/.claude/skills/upgo/SKILL.md`.

## Setup from source

- Node 22.18+ (it runs the `.ts` files directly). `npm install` in this folder.
- Put this folder on your PATH: `upgo.cmd` serves cmd/PowerShell, `upgo` serves Git Bash and other shells. Without PATH: `node <upgo folder>/cli.ts`.
- `npm run build` builds the dashboard into `web/dist` (`start.bat` does it when missing).
- The agent skill is `skill/SKILL.md`. Link it into `~/.claude/skills/upgo` (a symlink or junction), so editing it here is what Claude loads.

## The dashboard

`upgo ui` serves `http://127.0.0.1:4141` and opens it. It only listens on this machine.

On Windows, `upgo config tray on` makes `upgo ui` run hidden with a tray icon instead of a console window: click it to open the dashboard, right-click for Quit. `upgo ui --tray` / `--no-tray` overrides it once. Settings live in `~/.upgo/settings.json`.

- **Projects**: pick one in the left sidebar. Every registered project shows with its open count; finished ones sit in their own Finished list below.
- **Tour**: full cards for favorites and projects with now items (counts, setlist, a small bar strip of done items per week over the last 8 weeks), one row per idle project with its first next item, one strip for finished projects, then recently done.
- **Favorites**: star a project in its header (or its right-click menu) to keep it on top of the list and always a full card in the Tour (saved in this browser).
- **Project menu**: right-click a project in the sidebar or the Tour to open it, favorite it, copy its now items or path, or remove it.
- **Filters** (inside the project): search (id, title, body, pointers), Phase, Status, Section, Size, Scope. Done and dropped items stay hidden until **Show done/dropped** is on. **Clear filters** resets.
- **Read**: click an item's title to expand its body, pointers and related refs; a button loads its detail file.
- **Change**: right-click a row or use its ⋮ menu: edit, phase, status, done (optional note), drop (asks a reason, with presets), reopen, move up/down, copy, delete.
- **Reorder**: drag a row by its handle, also into another section; dropping on a section header puts it at the end. Keyboard: Alt+Up / Alt+Down.
- **Sections**: **Add section** in the header; a section's ⋮ menu renames, moves, adds an item to it or deletes it (only when it holds no items at all). A section with no open items shows as closed.
- **Copy for an agent**: tick items (shift-click for a range), press **Copy** in the bar at the bottom, paste into Claude. It gets `id: title` plus the body and reads the rest itself with `upgo show <id>`.
- **Suggestions**: ask an agent for ideas and it adds them with `upgo suggestion add`, with the section and size it would pick. `add` refuses an idea that repeats a goal (open, done or dropped) or another suggestion unless `--force`. They show in the project's **Suggestions** tab (next to **Goals**), grouped by section like the goals screen (no section last) or, with **Newest**, newest first in batches (Today, Yesterday, This week, This month, Older; remembered), as rows like goal rows: click to expand (body and related chips), a size chip, and four buttons on each row: **Add to goals** (opens a filled-in Add item form, saved ones disappear; Shift+click skips the form and adds it to Later in its hinted section), **Copy** (for an agent), **Drop** (saved as a dropped goal with your reason, pick a preset like Out of scope or type one, so agents never suggest it again) and **Delete** (just removes it). Drop, Delete and Shift+add show an **Undo** toast. A suggestion that repeats a dropped goal shows that goal and its reason right on the row. Tick several for the same actions in the bottom bar.
- **Live**: when an agent changes a `goals.json` or `suggestions.json`, the page updates by itself.

## Working with agents

Agents follow the `upgo` skill. In practice:

- "work on `random-logouts`": the agent runs `upgo show`, does the work, then `upgo done <id> --note "..."`.
- "pick up the next thing": `upgo next` prints the top now item (else the first next one) in full.
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
upgo show <id>                                 one item in full (also project:id, also archived ones)
upgo next                                      the first now item (else first next) in full
upgo add "Title" --section 5 --phase next --body "why" --files src/x.ts --size S
upgo edit <id> --phase later --status partial  same fields as add; --clear body,size,...
upgo done <id> --note "what shipped"           upgo drop <id> --reason "why not"
upgo reopen <id>                               upgo delete <id>   (mistakes and duplicates only)
upgo move <id> --section 3 | --before <id> | --after <id> | --up | --down
upgo section list | add "Title" | rename 3 "Title" | move 3 --before 1 | delete 3
upgo trap list | add "Title" --body "..." | edit <id> | delete <id>
upgo suggestion context                        sections, every goal title and dropped reason, for agents to skim before suggesting
upgo suggestion list | add "Title" --body "..." [--section 1] [--size M] [--related demo:id] [--force] | delete <id...>
upgo suggestion edit <id> [--title t] [--body ..] [--section 1] [--size M] [--related ..] [--clear body,section,size,related]
upgo suggestion promote <id> [--section 1] [--size M] [--phase next]   add it as a goal (its own section, size and related by default), remove the suggestion
upgo suggestion drop <id...> --reason "..." [--section 1]   save as dropped goals, like the dashboard Drop
upgo check [--all] [--fix]                     validate one or every project; --fix repairs missing dates and a stale goals.md if goals.json is otherwise valid
upgo render                                    rewrite goals.md from goals.json
upgo archive [--months 6]                      move done items not updated for N months to goals-archive.json
upgo ui [--port 4141] [--no-open] [--tray | --no-tray]
upgo config [tray on|off]                      show or change settings
```

Every command works from inside the project folder, or anywhere with `--dir <path>` / `--project <id>`. `show`, `edit`, `done`, `drop` and `reopen` also take a unique id prefix, and a typo suggests the closest id.

## What a project holds

- **`goals.json`** (committed with the repo): the source of truth. Sections (`n` is the § number, array order is display order), traps, and items. An item has an `id` (slug, unique per project), `section`, `title`, optional `body`, `phase` (`now`, `next`, `later`, `wayLater`, `maybe`), `status` (`planned`, `partial`, `done`, `dropped`), `size` (`S`/`M`/`L`), `scope`, `pointers` (`files`, `seam`, `depends`, `trap`, `how`, `check`, `options`, `where`), `detail` (a `.md` file in the repo), `related` (`project:id` refs, also across projects), dates, and `note` (done note or drop reason). Done and dropped items stay in the file until `upgo archive` moves done ones older than N months (default 6) to `goals-archive.json` (committed too). Archived items still resolve as `related` refs, show with `upgo show`, block repeat suggestions and still count toward the dashboard's done and %; dropped ones always stay.
- **`goals.md`** (committed, generated): what CLAUDE.md auto-loads with `@goals.md`. Traps, then the open now/next/later items one line each; way later and maybe show as counts; done and dropped never appear.
- **`suggestions.json`** (gitignored by `upgo init` in a git repo): ideas an agent left for the user, managed with `upgo suggestion`, never in `goals.md`.
- **`docs/goalsDetails/*.md`**: long-form detail for an open item, linked through `detail`.
- **Hooks** installed by `upgo init`: a git pre-commit that runs `upgo check` (a broken `goals.json`, `goals-archive.json` or `suggestions.json`, or a stale `goals.md`, blocks the commit), and a PreToolUse hook in the repo's `.claude/settings.json` that stops agents from editing `goals.json`, `goals.md`, `goals-archive.json` and `suggestions.json` by hand.

Outside the projects: `~/.upgo/registry.json` (which projects exist; `UPGO_REGISTRY` overrides the path, tests use it). An older `registry.json` in the upgo folder is copied there once.

## When something goes wrong

- **Commit blocked by the pre-commit hook**: run `upgo check` to see why. "goals.md is out of date" is fixed by `upgo render` (or `upgo check --fix`).
- **"goals.json was saved, but goals.md could not be written"**: the change is in; run `upgo render`. Do not repeat the command.
- **A write waits or says the file is locked**: another write holds `goals.json.lock`. A lock older than 10s is taken over automatically.
- **Dashboard says it is not built**: `npm run build` here.
- **This folder moved, or upgo was reinstalled somewhere else**: the installed hooks point at the old path and fail. Run `upgo init` again in each project.
- **Remove a project from the dashboard**: its Remove button, or `upgo forget <id>`. Its files stay where they are.
- **Rename a project**: Rename in its right-click menu, or `upgo rename <id> <new-id>`. Refs to it from other registered projects follow; the folder stays put.

## Pieces

- `src/core/`: zod schema, store (lock + atomic writes), mutations, ops, rules, checks, md renderer, importer.
- `cli.ts`: the CLI. `server.ts`: REST + SSE for the dashboard, 127.0.0.1 only.
- `web/`: React dashboard (Velora design system), virtualized item list.
- `goals.schema.json`: generated by `npm run schema`, gives VS Code autocomplete through `$schema`.
- `skill/SKILL.md`: the agent skill.

## License

MIT, see `LICENSE`.

## Develop

```
npm test          # everything (vitest)
npm run typecheck
npm run lint
npm run build     # dashboard into web/dist
npm run dev       # dashboard dev server, with `UPGO_DEV=1 upgo ui --no-open` running for the API
```
