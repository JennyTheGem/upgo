import { parseArgs, type ParseArgsConfig } from "node:util"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import fsp from "node:fs/promises"
import { basename, dirname, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { checkProject } from "./src/core/check.ts"
import * as m from "./src/core/mutate.ts"
import { checkRegistrable, findEntry, forget, readRegistry, register, UPGO_DIR } from "./src/core/registry.ts"
import { isOpen, PHASE_LABEL, PHASES, POINTER_KEYS, SCHEMA_URL, SIZES, STATUSES, type GoalsFile, type Item, type Pointers } from "./src/core/schema.ts"
import { findProjectDir, GOALS, MD, readGoals, saveGoals, serialize, updateGoals, writeAtomic } from "./src/core/store.ts"
import { addSuggestion, readSuggestions, removeSuggestions, SUGGESTIONS, updateSuggestions } from "./src/core/suggestions.ts"
import { slugify, today, UpgoError } from "./src/core/util.ts"

const CLI = `${UPGO_DIR.replace(/\\/g, "/")}/cli.ts`
const HOOK_MARK = "upgo"
// A shebang naming a POSIX-ish shell, directly or through env.
const SHELL = /^#!\s*(?:\S*\/)?(?:env\s+(?:-\S+\s+)*)?(?:\S*\/)?(?:sh|bash|dash|zsh|ksh)(?:\s|$)/

const HELP = `upgo: structured goals for this project. Never edit goals.json or goals.md by hand.

Reading
  upgo list [--phase now,next] [--status done] [--all] [--section N] [--search text]
  upgo show <id | project:id>
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
  upgo suggestion list | add "<title>" [--body text] | delete <id...>   ideas for the user, only when asked
  upgo suggestion promote <id> --section N [--phase later]   turn a suggestion into a goal and remove it

Setup and checks
  upgo init [--id slug] [--purpose text] [--no-hooks]   register this folder, install git + Claude hooks
  upgo check [--all]                  validate (schema, rules, related, detail files, suggestions.json, goals.md in sync)
  upgo render                         rewrite goals.md from goals.json
  upgo import <goals.md> [--completed path] [--out file] [--id slug] [--force]
  upgo forget <id>                    drop a project from the registry
  upgo ui [--port 4141] [--no-open]   start the dashboard

Every command takes --dir <path> or --project <id> to target another project.
Phases: ${PHASES.join(", ")}. Statuses: ${STATUSES.join(", ")}.
`

type Io = { out: (s: string) => void; err: (s: string) => void; stdin: () => Promise<string> }
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
    let next: string
    if (existing === null) next = `#!/bin/sh\n${block}`
    else if (existing.startsWith("#!")) {
        const nl = existing.indexOf("\n")
        if (!SHELL.test(nl < 0 ? existing : existing.slice(0, nl))) return `git hook: skipped (${path} is not a shell script; make it run \`${line}\`)`
        next = nl < 0 ? `${existing}\n${block}` : `${existing.slice(0, nl + 1)}${block}${existing.slice(nl + 1)}`
    } else next = `#!/bin/sh\n${block}${existing}`
    await fsp.mkdir(hooksDir, { recursive: true })
    await fsp.writeFile(path, next, { mode: 0o755 })
    return `git hook: installed (${path})`
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
    if (pre.some((e) => e.hooks?.some((h) => h.command?.includes(`${CLI}" hook`)))) return `Claude hook: already installed (${path})`
    pre.push({ matcher: "Edit|Write|MultiEdit|NotebookEdit", hooks: [{ type: "command", command: `node "${CLI}" hook` }] })
    await fsp.mkdir(dirname(path), { recursive: true })
    await writeAtomic(path, JSON.stringify(settings, null, 2) + "\n")
    return `Claude hook: installed (${path})`
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
    if ((name === GOALS || name === MD || name === SUGGESTIONS) && existsSync(goals) && readFileSync(goals, "utf8").includes(SCHEMA_URL)) {
        io.err(`${name} is managed by upgo and must not be edited directly. Use the CLI: \`upgo add|edit|done|drop|move|suggestion ...\` (\`upgo help\`).\n`)
        return 2
    }
    return 0
}

async function run(argv: string[], io: Io): Promise<number> {
    const [cmd = "help", ...rest] = argv
    const day = today()

    switch (cmd) {
        case "help":
        case "--help":
        case "-h":
            io.out(HELP)
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
            io.out(lines.join("\n") + "\n")
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
            io.out(listText(file, items))
            return 0
        }

        case "show": {
            const { values, positionals } = parse(rest, TARGET)
            const target = need(positionals[0], "item id")
            const [project, id] = target.includes(":") ? target.split(":") : [undefined, target]
            const file = readGoals(projectDir(project ? { project } : values))
            const item = file.items.find((i) => i.id === id)
            const trap = file.traps.find((t) => t.id === id)
            if (item) io.out(itemText(item, file))
            else if (trap) io.out(`trap \`${trap.id}\` ${trap.title}\n${trap.body ? `\n${trap.body.trim()}\n` : ""}`)
            else throw new UpgoError(`no item \`${id}\` in ${file.project}`)
            return 0
        }

        case "projects": {
            const entries = readRegistry()
            if (!entries.length) io.out("no projects yet, run `upgo init` in a project folder\n")
            for (const e of entries) {
                try {
                    const f = readGoals(e.path)
                    io.out(`${e.id}  ${f.items.filter(isOpen).length} open  ${e.path}\n`)
                } catch (err) {
                    io.out(`${e.id}  unreadable: ${(err as Error).message.split("\n")[0]}  ${e.path}\n`)
                }
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
            io.out(`added ${added}\n`)
            return 0
        }

        case "edit": {
            const { values, positionals } = parse(rest, { ...FIELDS, clear: { type: "string" } })
            const id = need(positionals[0], "item id")
            if (values.id) throw new UpgoError("ids cannot be changed")
            const f = fieldsFrom(values)
            const clearable = ["body", "size", "scope", "pointers", "detail", "related", "note"] as const
            const clear = (csv(values.clear) ?? []).map((c) => oneOf("clear", c, clearable)!)
            await updateGoals(projectDir(values), (file) => {
                const current = file.items.find((i) => i.id === id)
                const patch: m.ItemPatch = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined))
                if (f.pointers && current) patch.pointers = { ...current.pointers, ...f.pointers }
                for (const c of clear) patch[c] = null
                if (!Object.keys(patch).length) throw new UpgoError("nothing to change")
                return m.editItem(file, id, patch, day)
            })
            io.out(`edited ${id}\n`)
            return 0
        }

        case "done":
        case "drop":
        case "reopen": {
            const { values, positionals } = parse(rest, { ...TARGET, note: { type: "string" }, reason: { type: "string" } })
            const id = need(positionals[0], "item id")
            const status = cmd === "done" ? "done" : cmd === "drop" ? "dropped" : "planned"
            const note = cmd === "drop" ? need(values.reason, "--reason") : values.note
            await updateGoals(projectDir(values), (file) => m.setStatus(file, id, status, note, day))
            io.out(`${cmd === "reopen" ? "reopened" : status} ${id}\n`)
            return 0
        }

        case "delete": {
            const { values, positionals } = parse(rest, TARGET)
            const id = need(positionals[0], "item id")
            await updateGoals(projectDir(values), (file) => m.deleteItem(file, id))
            io.out(`deleted ${id}\n`)
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
            io.out(`moved ${id}\n`)
            return 0
        }

        case "section": {
            const [sub, ...args] = rest
            const { values, positionals } = parse(args, { ...TARGET, n: { type: "string" }, before: { type: "string" } })
            const dir = projectDir(values)
            const num = () => need(int("section number", positionals[0]), "section number")
            if (sub === "list") {
                const file = readGoals(dir)
                for (const s of file.sections) io.out(`${s.n}. ${s.title} (${file.items.filter((i) => i.section === s.n && isOpen(i)).length} open)\n`)
            } else if (sub === "add") {
                let n = 0
                await updateGoals(dir, (file) => {
                    const r = m.addSection(file, need(positionals[0], "section title"), int("n", values.n))
                    n = r.n
                    return r.file
                })
                io.out(`added section ${n}\n`)
            } else if (sub === "rename") {
                await updateGoals(dir, (file) => m.renameSection(file, num(), need(positionals[1], "section title")))
                io.out(`renamed section ${positionals[0]}\n`)
            } else if (sub === "move") {
                await updateGoals(dir, (file) => m.moveSection(file, num(), int("before", values.before) ?? null))
                io.out(`moved section ${positionals[0]}\n`)
            } else if (sub === "delete") {
                await updateGoals(dir, (file) => m.deleteSection(file, num()))
                io.out(`deleted section ${positionals[0]}\n`)
            } else throw new UpgoError("usage: upgo section list | add | rename | move | delete")
            return 0
        }

        case "trap": {
            const [sub, ...args] = rest
            const { values, positionals } = parse(args, { ...TARGET, title: { type: "string" }, body: { type: "string" }, id: { type: "string" } })
            const dir = projectDir(values)
            if (sub === "list") {
                for (const t of readGoals(dir).traps) io.out(`\`${t.id}\` ${t.title}\n`)
            } else if (sub === "add") {
                let id = ""
                await updateGoals(dir, (file) => {
                    const r = m.addTrap(file, { title: need(positionals[0] ?? values.title, "trap title"), ...(values.body ? { body: values.body } : {}), ...(values.id ? { id: values.id } : {}) })
                    id = r.id
                    return r.file
                })
                io.out(`added trap ${id}\n`)
            } else if (sub === "edit") {
                const id = need(positionals[0], "trap id")
                await updateGoals(dir, (file) => m.editTrap(file, id, { title: values.title, body: values.body === "" ? null : values.body }))
                io.out(`edited trap ${id}\n`)
            } else if (sub === "delete") {
                const id = need(positionals[0], "trap id")
                await updateGoals(dir, (file) => m.deleteTrap(file, id))
                io.out(`deleted trap ${id}\n`)
            } else throw new UpgoError("usage: upgo trap list | add | edit | delete")
            return 0
        }

        case "suggestion": {
            const [sub, ...args] = rest
            const { values, positionals } = parse(args, { ...TARGET, body: { type: "string" }, section: { type: "string" }, phase: { type: "string" } })
            const dir = projectDir(values)
            if (sub === "promote") {
                const sid = need(positionals[0], "suggestion id")
                const section = need(int("section", values.section), "--section")
                const phase = oneOf("phase", values.phase, PHASES) ?? "later"
                const s = readSuggestions(dir).find((x) => x.id === sid)
                if (!s) throw new UpgoError(`no suggestion \`${sid}\``)
                let added = ""
                await updateGoals(dir, (file) => {
                    const r = m.addItem(file, { title: s.title, section, phase, ...(s.body ? { body: s.body } : {}) }, day)
                    added = r.id
                    return r.file
                })
                // The goal is saved: one dismissed meanwhile must not turn this into an error.
                await updateSuggestions(dir, (list) => list.filter((x) => x.id !== sid))
                io.out(`promoted ${sid} to ${added}\n`)
            } else if (sub === "list") {
                const list = readSuggestions(dir)
                if (!list.length) io.out("no suggestions\n")
                for (const s of list) io.out(`\`${s.id}\` ${s.title}\n`)
            } else if (sub === "add") {
                const title = need(positionals[0], "suggestion title")
                let id = ""
                await updateSuggestions(dir, (list) => {
                    const r = addSuggestion(list, { title, body: values.body }, day)
                    id = r.id
                    return r.list
                })
                io.out(`suggested ${id}\n`)
            } else if (sub === "delete") {
                need(positionals[0], "suggestion id")
                await updateSuggestions(dir, (list) => removeSuggestions(list, positionals))
                io.out(`deleted ${positionals.join(", ")}\n`)
            } else throw new UpgoError("usage: upgo suggestion list | add | delete | promote")
            return 0
        }

        case "purpose": {
            const { values, positionals } = parse(rest, { ...TARGET, clear: { type: "boolean" } })
            const text = values.clear ? null : need(positionals[0], "purpose text")
            await updateGoals(projectDir(values), (file) => m.setPurpose(file, text))
            io.out(text ? "purpose set\n" : "purpose cleared\n")
            return 0
        }

        case "check": {
            const { values } = parse(rest, { ...TARGET, all: { type: "boolean" } })
            const registry = readRegistry()
            const targets = values.all ? registry.map((e) => ({ id: e.id, path: e.path })) : [{ id: "", path: projectDir(values) }]
            let failed = 0
            for (const t of targets) {
                const issues = checkProject(t.path, registry)
                const name = t.id || basename(t.path)
                if (issues.length) {
                    failed++
                    io.err(`${name}: ${issues.length} issue${issues.length === 1 ? "" : "s"}\n${issues.map((i) => `  - ${i}`).join("\n")}\n`)
                } else io.out(`ok: ${name}\n`)
            }
            return failed ? 1 : 0
        }

        case "render": {
            const { values } = parse(rest, TARGET)
            const dir = projectDir(values)
            await updateGoals(dir, (file) => file)
            io.out(`rendered ${join(dir, MD)}\n`)
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
            io.out(lines.join("\n") + "\n")
            return 0
        }

        case "forget": {
            const { positionals } = parse(rest, {})
            const id = need(positionals[0], "project id")
            await forget(id)
            io.out(`forgot ${id}\n`)
            return 0
        }

        case "ui": {
            const { values } = parse(rest, { port: { type: "string" }, "no-open": { type: "boolean" } })
            const { startServer } = await import("./server.ts")
            const { url } = await startServer({ port: int("port", values.port) ?? 4141 })
            io.out(`upgo dashboard on ${url} (Ctrl+C to stop)\n`)
            if (!values["no-open"]) openBrowser(url)
            await new Promise(() => {})
            return 0
        }

        default:
            throw new UpgoError(`unknown command \`${cmd}\` (see \`upgo help\`)`)
    }
}

function openBrowser(url: string): void {
    const [bin, args] =
        process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]]
    try {
        execFileSync(bin, args as string[], { stdio: "ignore" })
    } catch {
        // The url is printed either way.
    }
}

export async function main(argv: string[], io: Io): Promise<number> {
    try {
        return await run(argv, io)
    } catch (e) {
        if (e instanceof UpgoError) {
            io.err(`upgo: ${e.message}\n`)
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const code = await main(process.argv.slice(2), {
        out: (s) => process.stdout.write(s),
        err: (s) => process.stderr.write(s),
        stdin: readStdin,
    })
    process.exitCode = code
}
