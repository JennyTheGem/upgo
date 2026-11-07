#!/usr/bin/env node
import { parseArgs, type ParseArgsConfig } from "node:util"
import { execFileSync, spawn } from "node:child_process"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import fsp from "node:fs/promises"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { ARCHIVE, archiveDone, DEFAULT_ARCHIVE_MONTHS, monthsBefore, readArchive } from "./src/core/archive.ts"
import { checkProject, fixProject, refChecker } from "./src/core/check.ts"
import * as m from "./src/core/mutate.ts"
import { checkRegistrable, findEntry, forget, readRegistry, register } from "./src/core/registry.ts"
import { isManaged, isOpen, PHASE_LABEL, PHASES, POINTER_KEYS, SIZES, STATUSES, type GoalsFile, type Item, type Pointers } from "./src/core/schema.ts"
import { renameProject } from "./src/core/rename.ts"
import { resolveId } from "./src/core/similar.ts"
import { readSettings, writeSettings } from "./src/core/settings.ts"
import { findProjectDir, GOALS, MD, readGoals, saveGoals, serialize, updateGoals, writeAtomic } from "./src/core/store.ts"
import {
    addSuggestion,
    contextText,
    duplicatesOf,
    editSuggestion,
    readSuggestions,
    removeSuggestions,
    SUGGESTIONS,
    updateSuggestions,
    type SuggestionPatch,
} from "./src/core/suggestions.ts"
import { slugify, today, UpgoError } from "./src/core/util.ts"
import * as ui from "./src/ui.ts"

const CLI = fileURLToPath(import.meta.url).replace(/\\/g, "/")
const HOOK_MARK = "upgo"
const NO_PROJECTS = "no projects yet, run `upgo init` in a project folder"
// A shebang naming a POSIX-ish shell, directly or through env.
const SHELL = /^#!\s*(?:\S*\/)?(?:env\s+(?:-\S+\s+)*)?(?:\S*\/)?(?:sh|bash|dash|zsh|ksh)(?:\s|$)/

const HELP = `upgo: structured goals for this project. Never edit goals.json or goals.md by hand.

Reading
  upgo list [--phase now,next] [--status done] [--all] [--section N] [--search text]
  upgo show <id | project:id>         also finds archived items
  upgo next                           the first now item (else first next) in full, to pick up work
  upgo projects                       registered projects with open counts

Writing (each command validates and regenerates goals.md)
  upgo add "<title>" --section N [--phase later] [--status planned] [--size S|M|L] [--scope a,b]
           [--body text] [--id slug] [--detail path] [--related project:id,...] [--note text]
           [--files x --files y] [--seam ..] [--depends ..] [--trap ..] [--how ..] [--check ..] [--options ..] [--where ..]
  upgo edit <id> [same fields as add] [--clear body,size,scope,pointers,detail,related,note]
  upgo done <id> [--note text]        upgo drop <id> --reason text
  upgo reopen <id>                    upgo delete <id>
  upgo move <id> [--section N] [--before id | --after id | --up | --down]
  upgo section list | add "<title>" [--n N] | rename N "<title>" | move N [--before M] | delete N
  upgo trap list | add "<title>" [--body text] [--id slug] | edit <id> [--title t] [--body text] | delete <id>
  upgo purpose ["<text>" | --clear]
  upgo archive [--months ${DEFAULT_ARCHIVE_MONTHS}]           move done items not updated for N months to ${ARCHIVE}
  upgo suggestion context              sections, every goal title, dropped reasons and pending ideas; skim it before suggesting
  upgo suggestion list | add "<title>" [--body text] [--section N] [--size S|M|L] [--related project:id,...] [--force] | delete <id...>
           ideas for the user, only when asked; add refuses one that repeats a goal or suggestion unless --force
  upgo suggestion edit <id> [--title t] [--body text] [--section N] [--size S|M|L] [--related ..] [--clear body,section,size,related]
  upgo suggestion promote <id> [--section N] [--size S|M|L] [--phase later]   turn a suggestion into a goal and remove it (section and size default to its own, related refs carry over)
  upgo suggestion drop <id...> --reason text [--section N]   save as dropped goals so nobody suggests them again (hinted section, else the first)

Setup and checks
  upgo init [--id slug] [--purpose text] [--no-hooks]   register this folder, install git + Claude hooks
  upgo check [--all] [--fix]          validate (schema, rules, related, detail files, suggestions.json, ${ARCHIVE}, goals.md in sync)
                                      --fix first repairs missing item dates and a missing or stale goals.md,
                                      only when goals.json is otherwise valid
  upgo render                         rewrite goals.md from goals.json
  upgo import <goals.md> [--completed path] [--out file] [--id slug] [--force]
  upgo rename <id> <new-id>           change a project's id, in the registry, its files and every related ref to it
  upgo forget <id>                    drop a project from the registry
  upgo ui [--port 4141] [--no-open] [--tray | --no-tray]   start the dashboard; --tray (Windows) runs it hidden with a tray icon
  upgo config [tray on|off]           show or change settings; tray on makes \`upgo ui\` go to the tray by default

Every command takes --dir <path> or --project <id> to target another project.
show, edit, done, drop and reopen take a unique id prefix too; a typo suggests the closest id.
Phases: ${PHASES.join(", ")}. Statuses: ${STATUSES.join(", ")}.
`

// tty: stdout is a terminal, so print the upex-style layout; agents get plain text.
type Io = { out: (s: string) => void; err: (s: string) => void; stdin: () => Promise<string>; tty?: boolean }
type Options = NonNullable<ParseArgsConfig["options"]>

const TARGET = { dir: { type: "string" }, project: { type: "string" } } as const satisfies Options
const POINTER_OPTS = Object.fromEntries(POINTER_KEYS.map((k) => [k, { type: "string", multiple: true }])) as Record<
    (typeof POINTER_KEYS)[number],
    { type: "string"; multiple: true }
>
const FIELDS = {
    ...TARGET,
    ...POINTER_OPTS,
    title: { type: "string" },
    body: { type: "string" },
    phase: { type: "string" },
    status: { type: "string" },
    size: { type: "string" },
    scope: { type: "string" },
    section: { type: "string" },
    detail: { type: "string" },
    related: { type: "string" },
    note: { type: "string" },
    id: { type: "string" },
} as const satisfies Options

function parse<O extends Options>(args: string[], options: O) {
    try {
        return parseArgs({ args, options, allowPositionals: true, strict: true })
    } catch (e) {
        throw new UpgoError(`${(e as Error).message} (see \`upgo help\`)`)
    }
}

function oneOf<T extends string>(name: string, value: string | undefined, allowed: readonly T[]): T | undefined {
    if (value === undefined) return undefined
    if (!(allowed as readonly string[]).includes(value)) throw new UpgoError(`--${name} must be one of: ${allowed.join(", ")}`)
    return value as T
}

function int(name: string, value: string | undefined): number | undefined {
    if (value === undefined) return undefined
    if (!/^\d+$/.test(value)) throw new UpgoError(`--${name} must be a whole number`)
    return Number(value)
}

const csv = (value: string | undefined) => value?.split(",").map((v) => v.trim()).filter(Boolean)

// Values only, so searching for a field name like `status` does not match every item.
const valuesText = (v: unknown): string => (v && typeof v === "object" ? Object.values(v).map(valuesText).join("\n") : String(v))

function need<T>(value: T | undefined, what: string): T {
    if (value === undefined || value === "") throw new UpgoError(`missing ${what} (see \`upgo help\`)`)
    return value
}

function projectDir(values: { dir?: string; project?: string }): string {
    if (values.project) {
        const entry = findEntry(values.project)
        if (!entry) throw new UpgoError(`no registered project \`${values.project}\` (see \`upgo projects\`)`)
        return entry.path
    }
    const start = resolve(values.dir ?? process.cwd())
    const dir = findProjectDir(start)
    if (!dir) throw new UpgoError(`no goals.json in ${start} or above (run \`upgo init\` in the project folder)`)
    return dir
}

function pointersFrom(values: Record<string, unknown>): Pointers | undefined {
    const entries = POINTER_KEYS.flatMap((k) => (Array.isArray(values[k]) ? [[k, values[k] as string[]] as const] : []))
    return entries.length ? (Object.fromEntries(entries) as Pointers) : undefined
}

function fieldsFrom(values: Record<string, string | string[] | boolean | undefined>) {
    const str = (k: string) => values[k] as string | undefined
    return {
        title: str("title"),
        body: str("body"),
        phase: oneOf("phase", str("phase"), PHASES),
        status: oneOf("status", str("status"), STATUSES),
        size: oneOf("size", str("size"), SIZES),
        scope: csv(str("scope")),
        section: int("section", str("section")),
        detail: str("detail"),
        related: csv(str("related")),
        note: str("note"),
        pointers: pointersFrom(values),
    }
}

function itemText(item: Item, file: GoalsFile): string {
    const section = file.sections.find((s) => s.n === item.section)
    const meta = [
        `§${item.section} ${section?.title ?? ""}`.trim(),
        PHASE_LABEL[item.phase],
        item.status,
        item.size,
        item.scope?.join(", "),
    ].filter(Boolean)
    const lines = [`\`${item.id}\` ${item.title}`, meta.join(" · ")]
    if (item.body?.trim()) lines.push("", item.body.trim())
    const pointers = POINTER_KEYS.filter((k) => item.pointers?.[k]?.length)
    if (pointers.length) lines.push("", ...pointers.flatMap((k) => item.pointers![k]!.map((v) => `${k}: ${v}`)))
    if (item.detail) lines.push(`detail: ${item.detail}`)
    if (item.related?.length) lines.push(`related: ${item.related.join(", ")}`)
    if (item.note?.trim()) lines.push(`note: ${item.note.trim()}`)
    lines.push(`created ${item.created}, updated ${item.updated}`)
    return lines.join("\n") + "\n"
}

function listText(file: GoalsFile, items: Item[]): string {
    if (!items.length) return "no matching items\n"
    const out: string[] = []
    for (const s of file.sections) {
        const mine = items.filter((i) => i.section === s.n)
        if (!mine.length) continue
        out.push(`## ${s.n}. ${s.title}`)
        for (const i of mine) {
            const tags = [PHASE_LABEL[i.phase], i.status === "planned" ? "" : i.status].filter(Boolean).join(", ")
            out.push(`- \`${i.id}\` ${i.title} (${tags})`)
        }
        out.push("")
    }
    out.push(`${items.length} item${items.length === 1 ? "" : "s"}`)
    return out.join("\n") + "\n"
}

const STATUS_STYLE: Partial<Record<Item["status"], (s: string) => string>> = { partial: ui.yellow, done: ui.green }
const phaseCell = (i: Item) => (i.phase === "now" ? ui.bold(PHASE_LABEL.now) : ui.dim(PHASE_LABEL[i.phase]))
const statusCell = (i: Item) => (STATUS_STYLE[i.status] ?? ui.dim)(i.status)

function itemView(item: Item, file: GoalsFile, note = ""): string {
    const section = file.sections.find((s) => s.n === item.section)
    const meta = [ui.dim(`§${item.section} ${section?.title ?? ""}`.trim()), phaseCell(item), statusCell(item), item.size, item.scope?.join(", ")]
    const out = [ui.heading(item.title, note), ui.line(`${ui.bold(item.id)}   ${meta.filter(Boolean).join(ui.dim(" · "))}`)]
    if (item.body?.trim()) out.push("\n", ui.prose(item.body.trim()))
    const facts: [string, string][] = POINTER_KEYS.flatMap((k) => (item.pointers?.[k] ?? []).map((v, n): [string, string] => [n ? "" : k, v]))
    if (item.detail) facts.push(["detail", item.detail])
    if (item.related?.length) facts.push(["related", item.related.join(", ")])
    if (item.note?.trim()) facts.push(["note", item.note.trim()])
    if (facts.length) out.push("\n", ui.defList(facts.map(([k, v]) => ({ term: [[k, ui.dim]], text: [[v]] }))).join("\n") + "\n")
    out.push("\n", ui.line(ui.dim(`created ${item.created} · updated ${item.updated}`)), "\n")
    return out.join("")
}

function listView(file: GoalsFile, items: Item[]): string {
    if (!items.length) return ui.empty("no matching items")
    // Long ids are clipped so titles keep room; a unique id prefix still works for show, edit, done.
    const idW = Math.floor(ui.cols() * 0.3)
    const rows = items.map((i) => [ui.dim(ui.clip(i.id, idW)), i.title, phaseCell(i), i.status === "planned" ? "" : statusCell(i)])
    const lines = ui.table(rows, { indent: 4, flex: 1 })
    const out = [ui.heading("Goals", file.project)]
    for (const s of file.sections) {
        const mine = items.flatMap((i, n) => (i.section === s.n ? [lines[n]] : []))
        if (mine.length) out.push(ui.line(`${ui.dim(String(s.n))}  ${ui.bold(s.title)}`), ...mine.map((l) => l + "\n"), "\n")
    }
    out.push(ui.footer(`${items.length} item${items.length === 1 ? "" : "s"}`))
    return out.join("")
}

// Rows under a heading, or a quiet line when there are none.
const tableView = (title: string, note: string, rows: string[][], none: string, flex = 1) =>
    rows.length ? ui.heading(title, note) + ui.table(rows, { flex }).map((l) => l + "\n").join("") + "\n" : ui.empty(none)

async function installGitHook(dir: string): Promise<string> {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
    let hooks: string, top: string
    try {
        hooks = git("rev-parse", "--git-path", "hooks")
        top = git("rev-parse", "--show-toplevel")
    } catch {
        return "git hook: skipped (not a git repo)"
    }
    const hooksDir = resolve(dir, hooks)
    const path = join(hooksDir, "pre-commit")
    // Hooks run from the repo root, so a relative dir survives the repo moving.
    const rel = relative(resolve(top), dir).replace(/\\/g, "/") || "."
    const line = `node "${CLI}" check --dir "${rel}" || exit 1`
    const block = `# ${HOOK_MARK}: refuse a commit with an invalid goals.json\n${line}\n`
    const existing = existsSync(path) ? readFileSync(path, "utf8") : null
    // Per project dir, so a second project in the same repo gets its own check.
    if (existing?.includes(line)) return `git hook: already installed (${path})`
    // Same check through an older CLI path (upgo moved or reinstalled): repoint it.
    const stale = existing?.split("\n").find((l) => l.startsWith('node "') && l.endsWith(`" check --dir "${rel}" || exit 1`))
    let next: string
    if (stale) next = existing!.replace(stale, () => line)
    else if (existing === null) next = `#!/bin/sh\n${block}`
    else if (existing.startsWith("#!")) {
        const nl = existing.indexOf("\n")
        if (!SHELL.test(nl < 0 ? existing : existing.slice(0, nl))) return `git hook: skipped (${path} is not a shell script; make it run \`${line}\`)`
        next = nl < 0 ? `${existing}\n${block}` : `${existing.slice(0, nl + 1)}${block}${existing.slice(nl + 1)}`
    } else next = `#!/bin/sh\n${block}${existing}`
    await fsp.mkdir(hooksDir, { recursive: true })
    await fsp.writeFile(path, next, { mode: 0o755 })
    return `git hook: ${stale ? "updated" : "installed"} (${path})`
}

// Suggestions are scratch for the user, not project history.
async function ignoreSuggestions(dir: string): Promise<string | null> {
    try {
        // --no-index: a tracked file still counts as ignored once the pattern is in, so a re-init adds no duplicate.
        execFileSync("git", ["check-ignore", "-q", "--no-index", SUGGESTIONS], { cwd: dir, stdio: "ignore" })
        return null
    } catch (e) {
        // 1: not ignored yet. Anything else: not a git repo.
        if ((e as { status?: number }).status !== 1) return null
    }
    const path = join(dir, ".gitignore")
    const existing = existsSync(path) ? readFileSync(path, "utf8") : ""
    await fsp.writeFile(path, `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}/${SUGGESTIONS}\n`)
    return `.gitignore: added /${SUGGESTIONS}`
}

async function installClaudeHook(dir: string): Promise<string> {
    const path = join(dir, ".claude", "settings.json")
    let settings: Record<string, unknown> = {}
    if (existsSync(path)) {
        try {
            settings = JSON.parse(readFileSync(path, "utf8"))
        } catch {
            throw new UpgoError(`${path} is not valid JSON; fix it, then run \`upgo init\` again`)
        }
    }
    const hooks = (settings.hooks ??= {}) as Record<string, unknown[]>
    const pre = (hooks.PreToolUse ??= []) as { matcher?: string; hooks?: { type?: string; command?: string }[] }[]
    const all = pre.flatMap((e) => e.hooks ?? [])
    if (all.some((h) => h.command?.includes(`${CLI}" hook`))) return `Claude hook: already installed (${path})`
    const command = `node "${CLI}" hook`
    // Older CLI path (upgo moved or reinstalled): repoint it.
    const stale = all.find((h) => /^node "[^"]*\/cli\.[jt]s" hook$/.test(h.command ?? ""))
    if (stale) stale.command = command
    else pre.push({ matcher: "Edit|Write|MultiEdit|NotebookEdit", hooks: [{ type: "command", command }] })
    await fsp.mkdir(dirname(path), { recursive: true })
    await writeAtomic(path, JSON.stringify(settings, null, 2) + "\n")
    return `Claude hook: ${stale ? "updated" : "installed"} (${path})`
}

// PreToolUse hook: blocks an agent's direct Edit/Write of an upgo-managed goals.json or goals.md.
async function hook(io: Io): Promise<number> {
    let input: { cwd?: string; tool_input?: { file_path?: unknown; notebook_path?: unknown } }
    try {
        input = JSON.parse(await io.stdin())
    } catch {
        return 0
    }
    const raw = input.tool_input?.file_path ?? input.tool_input?.notebook_path
    if (typeof raw !== "string") return 0
    const path = resolve(input.cwd ?? process.cwd(), raw)
    const name = basename(path).toLowerCase()
    const goals = join(dirname(path), GOALS)
    // Managed means upgo wrote that goals.json; another tool's file of the same name is not ours to guard.
    if ((name === GOALS || name === MD || name === SUGGESTIONS || name === ARCHIVE) && existsSync(goals) && isManaged(readFileSync(goals, "utf8"))) {
        io.err(`${name} is managed by upgo and must not be edited directly. Use the CLI: \`upgo add|edit|done|drop|move|suggestion ...\` (\`upgo help\`).\n`)
        return 2
    }
    return 0
}

async function run(argv: string[], io: Io): Promise<number> {
    const [cmd = "help", ...rest] = argv
    const day = today()
    const pretty = !!io.tty
    // A confirmation: first line green, the rest dim.
    const say = (msg: string) => io.out(pretty ? msg.split("\n").map((l, i) => ui.line(i ? ui.dim(l) : ui.green(l))).join("") : msg + "\n")

    switch (cmd) {
        case "help":
        case "--help":
        case "-h":
            io.out(pretty ? ui.helpView(HELP) : HELP)
            return 0

        case "hook":
            return hook(io)

        case "init": {
            const { values } = parse(rest, { dir: { type: "string" }, id: { type: "string" }, purpose: { type: "string" }, "no-hooks": { type: "boolean" } })
            const dir = resolve(values.dir ?? process.cwd())
            let file: GoalsFile
            if (existsSync(join(dir, GOALS))) {
                file = readGoals(dir)
                if (values.id && values.id !== file.project) throw new UpgoError(`goals.json already names this project \`${file.project}\``)
                if (values.purpose) file = await updateGoals(dir, (f) => m.setPurpose(f, values.purpose!))
            } else {
                const id = values.id ?? slugify(basename(dir))
                // Before anything is written, or a taken id leaves a goals.json that blocks the retry with --id.
                checkRegistrable(id, dir)
                file = await saveGoals(dir, { version: 1, project: id, ...(values.purpose ? { purpose: values.purpose } : {}), sections: [], traps: [], items: [] })
            }
            await register(file.project, dir)
            const lines = [`registered \`${file.project}\` at ${dir}`]
            if (!values["no-hooks"]) lines.push(await installGitHook(dir), await installClaudeHook(dir))
            const ignored = await ignoreSuggestions(dir)
            if (ignored) lines.push(ignored)
            // Only the "git hook: skipped (...)" style status, never a word in the folder path.
            const mark = (l: string) => (/^[\w. ]+: skipped/.test(l) ? ui.tag.warn : /^[\w. ]+: already/.test(l) ? ui.tag.skip : ui.tag.ok)
            io.out(pretty ? ui.heading("Init", file.project) + lines.map((l) => ui.line(`${mark(l)}  ${l}`)).join("") + "\n" : lines.join("\n") + "\n")
            return 0
        }

        case "list": {
            const { values } = parse(rest, { ...TARGET, phase: { type: "string" }, status: { type: "string" }, section: { type: "string" }, search: { type: "string" }, all: { type: "boolean" } })
            const file = readGoals(projectDir(values))
            const phases = csv(values.phase)?.map((p) => oneOf("phase", p, PHASES)!)
            const statuses = csv(values.status)?.map((s) => oneOf("status", s, STATUSES)!)
            const section = int("section", values.section)
            const q = values.search?.toLowerCase()
            const items = file.items.filter(
                (i) =>
                    (statuses ? statuses.includes(i.status) : values.all || isOpen(i)) &&
                    (!phases || phases.includes(i.phase)) &&
                    (section === undefined || i.section === section) &&
                    (!q || valuesText(i).toLowerCase().includes(q)),
            )
            io.out((pretty ? listView : listText)(file, items))
            return 0
        }

        case "show": {
            const { values, positionals } = parse(rest, TARGET)
            const target = need(positionals[0], "item id")
            const [project, given] = target.includes(":") ? target.split(":") : [undefined, target]
            const dir = projectDir(project ? { project } : values)
            const file = readGoals(dir)
            const live = [...file.items, ...file.traps].map((x) => x.id)
            // An exact live id never needs the archive, so a broken one cannot block it.
            const archive = live.includes(given) ? [] : readArchive(dir)
            const id = resolveId(given, [...live, ...archive.map((i) => i.id)], `no item \`${given}\` in ${file.project}`)
            const item = file.items.find((i) => i.id === id)
            const trap = file.traps.find((t) => t.id === id)
            if (item) io.out(pretty ? itemView(item, file) : itemText(item, file))
            else if (trap && pretty) io.out(ui.heading(trap.title, "trap") + ui.line(ui.bold(trap.id)) + (trap.body ? "\n" + ui.prose(trap.body.trim()) : "") + "\n")
            else if (trap) io.out(`trap \`${trap.id}\` ${trap.title}\n${trap.body ? `\n${trap.body.trim()}\n` : ""}`)
            else {
                const old = archive.findLast((i) => i.id === id)!
                io.out(pretty ? itemView(old, file, `archived in ${ARCHIVE}`) : `archived in ${ARCHIVE}\n${itemText(old, file)}`)
            }
            return 0
        }

        case "next": {
            const { values } = parse(rest, TARGET)
            const file = readGoals(projectDir(values))
            // goals.md order: sections as listed, then items within each.
            const rank = (i: Item) => file.sections.findIndex((s) => s.n === i.section)
            const open = file.items.filter(isOpen).sort((a, b) => rank(a) - rank(b))
            const item = open.find((i) => i.phase === "now") ?? open.find((i) => i.phase === "next")
            const none = "nothing in now or next (see `upgo list`)"
            if (pretty) io.out(item ? itemView(item, file) : ui.empty(none))
            else io.out(item ? itemText(item, file) : none + "\n")
            return 0
        }

        case "archive": {
            const { values } = parse(rest, { ...TARGET, months: { type: "string" } })
            const months = int("months", values.months) ?? DEFAULT_ARCHIVE_MONTHS
            const moved = await archiveDone(projectDir(values), monthsBefore(day, months))
            say(moved.length ? `archived ${moved.length}: ${moved.map((i) => i.id).join(", ")}` : `no done items older than ${months} months`)
            return 0
        }

        case "projects": {
            const rows = readRegistry().map((e): typeof e & { open?: number; bad?: string } => {
                try {
                    return { ...e, open: readGoals(e.path).items.filter(isOpen).length }
                } catch (err) {
                    return { ...e, bad: `unreadable: ${(err as Error).message.split("\n")[0]}` }
                }
            })
            if (!pretty) io.out(rows.length ? rows.map((r) => `${r.id}  ${r.bad ?? `${r.open} open`}  ${r.path}\n`).join("") : NO_PROJECTS + "\n")
            else if (!rows.length) io.out(ui.empty(NO_PROJECTS))
            else {
                const cells = rows.map((r) => [ui.bold(r.id), r.bad ? ui.red(r.bad) : r.open ? `${r.open} open` : ui.dim("0 open"), ui.dimParent(r.path)])
                io.out(ui.heading("Projects") + ui.table(cells).map((l) => l + "\n").join("") + ui.footer(`${rows.length} project${rows.length === 1 ? "" : "s"}`))
            }
            return 0
        }

        case "add": {
            const { values, positionals } = parse(rest, FIELDS)
            const f = fieldsFrom(values)
            const title = need(positionals[0] ?? f.title, "title")
            const section = need(f.section, "--section")
            const dir = projectDir(values)
            let added = ""
            await updateGoals(dir, (file) => {
                const { pointers, scope, related, ...plain } = f
                const r = m.addItem(
                    file,
                    {
                        ...Object.fromEntries(Object.entries(plain).filter(([, v]) => v !== undefined)),
                        title,
                        section,
                        phase: f.phase ?? "later",
                        ...(pointers ? { pointers } : {}),
                        ...(scope?.length ? { scope } : {}),
                        ...(related?.length ? { related } : {}),
                        ...(values.id ? { id: values.id } : {}),
                    } as m.ItemInput,
                    day,
                )
                added = r.id
                return r.file
            })
            say(`added ${added}`)
            return 0
        }

        case "edit": {
            const { values, positionals } = parse(rest, { ...FIELDS, clear: { type: "string" } })
            let id = need(positionals[0], "item id")
            if (values.id) throw new UpgoError("ids cannot be changed")
            const f = fieldsFrom(values)
            const clearable = ["body", "size", "scope", "pointers", "detail", "related", "note"] as const
            const clear = (csv(values.clear) ?? []).map((c) => oneOf("clear", c, clearable)!)
            await updateGoals(projectDir(values), (file) => {
                id = m.resolveItem(file, id)
                const current = file.items.find((i) => i.id === id)
                const patch: m.ItemPatch = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined))
                if (f.pointers && current) patch.pointers = { ...current.pointers, ...f.pointers }
                for (const c of clear) patch[c] = null
                if (!Object.keys(patch).length) throw new UpgoError("nothing to change")
                return m.editItem(file, id, patch, day)
            })
            say(`edited ${id}`)
            return 0
        }

        case "done":
        case "drop":
        case "reopen": {
            const { values, positionals } = parse(rest, { ...TARGET, note: { type: "string" }, reason: { type: "string" } })
            let id = need(positionals[0], "item id")
            const status = cmd === "done" ? "done" : cmd === "drop" ? "dropped" : "planned"
            const note = cmd === "drop" ? need(values.reason, "--reason") : values.note
            await updateGoals(projectDir(values), (file) => m.setStatus(file, (id = m.resolveItem(file, id)), status, note, day))
            say(`${cmd === "reopen" ? "reopened" : status} ${id}`)
            return 0
        }

        case "delete": {
            const { values, positionals } = parse(rest, TARGET)
            const id = need(positionals[0], "item id")
            await updateGoals(projectDir(values), (file) => m.deleteItem(file, id))
            say(`deleted ${id}`)
            return 0
        }

        case "move": {
            const { values, positionals } = parse(rest, { ...TARGET, section: { type: "string" }, before: { type: "string" }, after: { type: "string" }, up: { type: "boolean" }, down: { type: "boolean" } })
            const id = need(positionals[0], "item id")
            const section = int("section", values.section)
            if (values.up || values.down) {
                if (values.up && values.down) throw new UpgoError("give either --up or --down")
                await updateGoals(projectDir(values), (file) => m.nudgeItem(file, id, values.up ? "up" : "down"))
            } else {
                if (section === undefined && !values.before && !values.after) throw new UpgoError("give --section, --before, --after, --up or --down")
                await updateGoals(projectDir(values), (file) => m.moveItem(file, id, { section, before: values.before, after: values.after }, day))
            }
            say(`moved ${id}`)
            return 0
        }

        case "section": {
            const [sub, ...args] = rest
            const { values, positionals } = parse(args, { ...TARGET, n: { type: "string" }, before: { type: "string" } })
            const dir = projectDir(values)
            const num = () => need(int("section number", positionals[0]), "section number")
            if (sub === "list") {
                const file = readGoals(dir)
                const open = (n: number) => file.items.filter((i) => i.section === n && isOpen(i)).length
                if (pretty) io.out(tableView("Sections", file.project, file.sections.map((s) => [ui.dim(String(s.n)), s.title, ui.dim(`${open(s.n)} open`)]), "no sections"))
                else for (const s of file.sections) io.out(`${s.n}. ${s.title} (${open(s.n)} open)\n`)
            } else if (sub === "add") {
                let n = 0
                await updateGoals(dir, (file) => {
                    const r = m.addSection(file, need(positionals[0], "section title"), int("n", values.n))
                    n = r.n
                    return r.file
                })
                say(`added section ${n}`)
            } else if (sub === "rename") {
                await updateGoals(dir, (file) => m.renameSection(file, num(), need(positionals[1], "section title")))
                say(`renamed section ${positionals[0]}`)
            } else if (sub === "move") {
                await updateGoals(dir, (file) => m.moveSection(file, num(), int("before", values.before) ?? null))
                say(`moved section ${positionals[0]}`)
            } else if (sub === "delete") {
                await updateGoals(dir, (file) => m.deleteSection(file, num()))
                say(`deleted section ${positionals[0]}`)
            } else throw new UpgoError("usage: upgo section list | add | rename | move | delete")
            return 0
        }

        case "trap": {
            const [sub, ...args] = rest
            const { values, positionals } = parse(args, { ...TARGET, title: { type: "string" }, body: { type: "string" }, id: { type: "string" } })
            const dir = projectDir(values)
            if (sub === "list") {
                const file = readGoals(dir)
                if (pretty) io.out(tableView("Traps", file.project, file.traps.map((t) => [ui.dim(t.id), t.title]), "no traps"))
                else for (const t of file.traps) io.out(`\`${t.id}\` ${t.title}\n`)
            } else if (sub === "add") {
                let id = ""
                await updateGoals(dir, (file) => {
                    const r = m.addTrap(file, { title: need(positionals[0] ?? values.title, "trap title"), ...(values.body ? { body: values.body } : {}), ...(values.id ? { id: values.id } : {}) })
                    id = r.id
                    return r.file
                })
                say(`added trap ${id}`)
            } else if (sub === "edit") {
                const id = need(positionals[0], "trap id")
                await updateGoals(dir, (file) => m.editTrap(file, id, { title: values.title, body: values.body === "" ? null : values.body }))
                say(`edited trap ${id}`)
            } else if (sub === "delete") {
                const id = need(positionals[0], "trap id")
                await updateGoals(dir, (file) => m.deleteTrap(file, id))
                say(`deleted trap ${id}`)
            } else throw new UpgoError("usage: upgo trap list | add | edit | delete")
            return 0
        }

        case "suggestion": {
            const [sub, ...args] = rest
            const { values, positionals } = parse(args, {
                ...TARGET,
                title: { type: "string" },
                body: { type: "string" },
                section: { type: "string" },
                phase: { type: "string" },
                size: { type: "string" },
                related: { type: "string" },
                reason: { type: "string" },
                clear: { type: "string" },
                force: { type: "boolean" },
            })
            const dir = projectDir(values)
            const section = int("section", values.section)
            const size = oneOf("size", values.size, SIZES)
            const related = csv(values.related)
            // Hints are checked now; refs must resolve, or adopting the suggestion later fails `upgo check`.
            const checkedGoals = () => {
                const file = readGoals(dir)
                if (section !== undefined) m.requireSection(file, section)
                if (related?.length) {
                    const bad = related.map(refChecker(file, dir)).filter((p) => p !== null)
                    if (bad.length) throw new UpgoError("bad --related:", bad)
                }
                return file
            }
            const pick = (ids: string[]) => {
                const all = readSuggestions(dir)
                return ids.map((sid) => {
                    const s = all.find((x) => x.id === sid)
                    if (!s) throw new UpgoError(`no suggestion \`${sid}\``)
                    return s
                })
            }
            // Goals are saved by now: one dismissed meanwhile is fine, a failure must say so or a retry adds them twice.
            const unlist = async (ids: string[], done: string) => {
                try {
                    await updateSuggestions(dir, (all) => all.filter((x) => !ids.includes(x.id)))
                } catch (e) {
                    throw new UpgoError(`${done}, but ${SUGGESTIONS} could not be updated (${(e as Error).message.split("\n")[0]}): run \`upgo suggestion delete ${ids.join(" ")}\``)
                }
                say(done)
            }
            if (sub === "promote") {
                const sid = need(positionals[0], "suggestion id")
                const phase = oneOf("phase", values.phase, PHASES) ?? "later"
                const [s] = pick([sid])
                const into = need(section ?? s.section, "--section")
                let added = ""
                await updateGoals(dir, (file) => {
                    const r = m.addItem(file, m.fromSuggestion(s, { section: into, phase, size }), day)
                    added = r.id
                    return r.file
                })
                await unlist([sid], `promoted ${sid} to ${added}`)
            } else if (sub === "drop") {
                // Like the dashboard Drop: saved as dropped goals so nobody suggests them again.
                need(positionals[0], "suggestion id")
                const reason = need(values.reason?.trim(), "--reason")
                const ids = [...new Set(positionals)]
                const list = pick(ids)
                const added: string[] = []
                await updateGoals(dir, (file) => {
                    if (!file.sections.length) throw new UpgoError("no sections yet (add one with `upgo section add`)")
                    return list.reduce((f, s) => {
                        const into = section ?? m.hintedSection(f, s) ?? f.sections[0].n
                        const r = m.addItem(f, m.fromSuggestion(s, { section: into, phase: "later", status: "dropped", note: reason }), day)
                        added.push(r.id)
                        return r.file
                    }, file)
                })
                await unlist(ids, `dropped ${added.join(", ")}`)
            } else if (sub === "list") {
                const list = readSuggestions(dir)
                const hintsOf = (s: (typeof list)[number]) => [s.section !== undefined && `§${s.section}`, s.size].filter(Boolean).join(", ")
                if (pretty) io.out(tableView("Suggestions", readGoals(dir).project, list.map((s) => [ui.dim(s.id), s.title, ui.dim(hintsOf(s))]), "no suggestions"))
                else if (!list.length) io.out("no suggestions\n")
                else for (const s of list) io.out(`\`${s.id}\` ${s.title}${hintsOf(s) ? ` (${hintsOf(s)})` : ""}\n`)
            } else if (sub === "context") {
                io.out(contextText(readGoals(dir), readSuggestions(dir)))
            } else if (sub === "add") {
                const title = need(positionals[0], "suggestion title")
                const goals = checkedGoals()
                // Archived done work counts too, or it gets suggested again.
                const file = { ...goals, items: [...goals.items, ...readArchive(dir)] }
                let id = ""
                await updateSuggestions(dir, (list) => {
                    const dupes = values.force ? [] : duplicatesOf(title, file, list)
                    if (dupes.length) throw new UpgoError("this looks like something already there (pass --force to add anyway):", dupes)
                    const r = addSuggestion(list, { title, body: values.body, section, size, related }, day)
                    id = r.id
                    return r.list
                })
                say(`suggested ${id}`)
            } else if (sub === "edit") {
                const sid = need(positionals[0], "suggestion id")
                const clearable = ["body", "section", "size", "related"] as const
                const clear = (csv(values.clear) ?? []).map((c) => oneOf("clear", c, clearable)!)
                checkedGoals()
                const patch: SuggestionPatch = Object.fromEntries(
                    Object.entries({ title: values.title, body: values.body, section, size, related }).filter(([, v]) => v !== undefined),
                )
                for (const c of clear) patch[c] = null
                if (!Object.keys(patch).length) throw new UpgoError("nothing to change")
                await updateSuggestions(dir, (list) => editSuggestion(list, sid, patch))
                say(`edited ${sid}`)
            } else if (sub === "delete") {
                need(positionals[0], "suggestion id")
                await updateSuggestions(dir, (list) => removeSuggestions(list, positionals))
                say(`deleted ${positionals.join(", ")}`)
            } else throw new UpgoError("usage: upgo suggestion list | context | add | edit | delete | promote | drop")
            return 0
        }

        case "purpose": {
            const { values, positionals } = parse(rest, { ...TARGET, clear: { type: "boolean" } })
            const text = values.clear ? null : need(positionals[0], "purpose text")
            await updateGoals(projectDir(values), (file) => m.setPurpose(file, text))
            say(text ? "purpose set" : "purpose cleared")
            return 0
        }

        case "check": {
            const { values } = parse(rest, { ...TARGET, all: { type: "boolean" }, fix: { type: "boolean" } })
            const registry = readRegistry()
            const targets = values.all ? registry.map((e) => ({ id: e.id, path: e.path })) : [{ id: "", path: projectDir(values) }]
            let failed = 0
            const count = (n: number) => `${n} issue${n === 1 ? "" : "s"}`
            if (pretty) io.out(targets.length ? ui.heading("Check") : ui.empty(NO_PROJECTS))
            for (const t of targets) {
                const name = t.id || basename(t.path)
                if (values.fix)
                    for (const f of await fixProject(t.path, day)) io.out(pretty ? ui.line(`${ui.dim("[FIX ]")}  ${name}  ${ui.dim(f)}`) : `fixed ${name}: ${f}\n`)
                const issues = checkProject(t.path, registry)
                if (issues.length) {
                    failed++
                    if (pretty) io.err(ui.line(`${ui.tag.fail}  ${ui.bold(name)}  ${ui.dim(count(issues.length))}`) + issues.map((i) => ui.prose(`- ${i}`, undefined, 10)).join(""))
                    else io.err(`${name}: ${count(issues.length)}\n${issues.map((i) => `  - ${i}`).join("\n")}\n`)
                } else io.out(pretty ? ui.line(`${ui.tag.ok}  ${name}`) : `ok: ${name}\n`)
            }
            if (pretty && targets.length > 1)
                io.out(ui.rule() + ui.line(failed ? ui.yellow(`${failed} of ${targets.length} projects have issues.`) : ui.green(`All ${targets.length} projects valid.`)))
            if (pretty && targets.length) io.out("\n")
            return failed ? 1 : 0
        }

        case "render": {
            const { values } = parse(rest, TARGET)
            const dir = projectDir(values)
            await updateGoals(dir, (file) => file)
            say(`rendered ${join(dir, MD)}`)
            return 0
        }

        case "import": {
            const { values, positionals } = parse(rest, { completed: { type: "string" }, out: { type: "string" }, id: { type: "string" }, force: { type: "boolean" } })
            const md = resolve(need(positionals[0], "path to goals.md"))
            if (!existsSync(md)) throw new UpgoError(`${md} does not exist`)
            const sibling = join(dirname(md), "goals-completed.md")
            const completed = values.completed ? resolve(values.completed) : existsSync(sibling) ? sibling : undefined
            const out = resolve(values.out ?? join(dirname(md), GOALS))
            if (existsSync(out) && !values.force) throw new UpgoError(`${out} already exists (pass --force to overwrite)`)
            const { importMarkdown } = await import("./src/core/import.ts")
            const { file, report } = importMarkdown(readFileSync(md, "utf8"), {
                project: values.id ?? slugify(basename(dirname(md))),
                today: day,
                ...(completed ? { completedMd: readFileSync(completed, "utf8") } : {}),
            })
            await fsp.mkdir(dirname(out), { recursive: true })
            await writeAtomic(out, serialize(file))
            const lines = [
                `wrote ${out}`,
                `${report.sections} sections, ${report.open} open, ${report.done} done, ${report.dropped} dropped, ${report.traps} traps`,
            ]
            if (report.skipped.length) lines.push(`skipped ${report.skipped.length}:`, ...report.skipped.map((s) => `  - ${s}`))
            say(lines.join("\n"))
            return 0
        }

        case "rename": {
            const { positionals } = parse(rest, {})
            const from = need(positionals[0], "project id")
            const to = need(positionals[1], "new project id")
            const { updated, failed } = await renameProject(from, to)
            say(`renamed ${from} to ${to}${updated.length ? `\nupdated refs in: ${updated.join(", ")}` : ""}`)
            if (!failed.length) return 0
            io.err(`these projects could not be updated and may still point at \`${from}:\`, fix them and run \`upgo check --all\`:\n${failed.map((f) => `  - ${f}`).join("\n")}\n`)
            return 1
        }

        case "forget": {
            const { positionals } = parse(rest, {})
            const id = need(positionals[0], "project id")
            await forget(id)
            say(`forgot ${id}`)
            return 0
        }

        case "config": {
            const { positionals } = parse(rest, {})
            const [key, value] = positionals
            if (key !== undefined && key !== "tray") throw new UpgoError(`unknown setting \`${key}\` (known: tray)`)
            if (value !== undefined && value !== "on" && value !== "off") throw new UpgoError("tray must be on or off")
            const settings = value ? await writeSettings({ tray: value === "on" }) : readSettings()
            const state = settings.tray ? "on" : "off"
            const where = process.platform === "win32" ? "" : " (only used on Windows)"
            if (!pretty) io.out(`tray ${state}${where}\n`)
            else if (value) say(`tray ${state}${where}`)
            else io.out(ui.heading("Config") + ui.line(`${ui.dim("tray")}  ${state}${ui.dim(where)}`) + "\n")
            return 0
        }

        case "ui": {
            const { values } = parse(rest, {
                port: { type: "string" },
                "no-open": { type: "boolean" },
                tray: { type: "boolean" },
                "no-tray": { type: "boolean" },
            })
            const port = int("port", values.port) ?? 4141
            const hidden = process.env.UPGO_TRAY_CHILD === "1"
            delete process.env.UPGO_TRAY_CHILD
            const tray = process.platform === "win32" && !values["no-tray"] && (values.tray || readSettings().tray === true)
            if (tray && !hidden) return launchHidden(rest, io)
            const { startServer } = await import("./server.ts")
            let url: string
            try {
                ;({ url } = await startServer({ port }))
            } catch (e) {
                throw new UpgoError(`could not start the dashboard: ${(e as Error).message}`)
            }
            if (hidden) {
                process.send?.({ url })
                process.disconnect?.()
                const { showTray } = await import("./src/tray.ts")
                showTray(url, () => process.exit(0))
            } else io.out(pretty ? ui.empty(`dashboard on ${ui.bold(url)}   ${ui.dim("Ctrl+C to stop")}`) : `upgo dashboard on ${url} (Ctrl+C to stop)\n`)
            if (!values["no-open"]) openBrowser(url)
            await new Promise(() => {})
            return 0
        }

        default:
            throw new UpgoError(`unknown command \`${cmd}\` (see \`upgo help\`)`)
    }
}

// Reruns `upgo ui` detached and windowless, so the console that started it can close.
async function launchHidden(args: string[], io: Io): Promise<number> {
    const child = spawn(process.execPath, [...process.execArgv, CLI, "ui", ...args], {
        detached: true,
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe", "ipc"],
        env: { ...process.env, UPGO_TRAY_CHILD: "1" },
    })
    let stderr = ""
    child.stderr!.on("data", (c: Buffer) => (stderr += c.toString()))
    const url = await new Promise<string | undefined>((ok) => {
        child.once("message", (m) => ok((m as { url: string }).url))
        // close, not exit: stderr may still be unread at exit.
        child.once("close", () => ok(undefined))
        child.once("error", (e) => {
            stderr += `upgo: ${e.message}\n`
            ok(undefined)
        })
    })
    if (!url) {
        io.err(stderr || "upgo: the tray dashboard stopped while starting, try `upgo ui --no-tray`\n")
        return 1
    }
    child.stderr!.destroy()
    if (child.connected) child.disconnect()
    child.unref()
    const where = "in the tray (right-click its icon to quit)"
    io.out(io.tty ? ui.empty(`dashboard on ${ui.bold(url)}   ${ui.dim(where)}`) : `upgo dashboard on ${url}, ${where}\n`)
    return 0
}

function openBrowser(url: string): void {
    const [bin, args] =
        process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]]
    try {
        execFileSync(bin, args as string[], { stdio: "ignore", windowsHide: true })
    } catch {
        // The url is printed either way.
    }
}

export async function main(argv: string[], io: Io): Promise<number> {
    try {
        return await run(argv, io)
    } catch (e) {
        if (e instanceof UpgoError) {
            const [first, ...more] = e.message.split("\n")
            io.err(io.tty ? `\n  ${ui.errRed(`upgo: ${first}`)}\n${more.map((l) => `  ${l}\n`).join("")}\n` : `upgo: ${e.message}\n`)
            return 1
        }
        throw e
    }
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks).toString("utf8")
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
    const code = await main(process.argv.slice(2), {
        out: (s) => process.stdout.write(s),
        err: (s) => process.stderr.write(s),
        stdin: readStdin,
        tty: process.stdout.isTTY,
    })
    process.exitCode = code
}
