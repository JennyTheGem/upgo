import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { readRegistry } from "../src/core/registry.ts"
import { render } from "../src/core/render.ts"
import { GOALS, MD, readGoals } from "../src/core/store.ts"
import { cli } from "./cliHarness.ts"
import { fixture, isolateRegistry, makeProject, tempDir } from "./helpers.ts"

beforeEach(() => isolateRegistry())

const ok = (r: ReturnType<typeof cli>) => {
    expect(r.err).toBe("")
    expect(r.code).toBe(0)
    return r.out
}
const fails = (r: ReturnType<typeof cli>, message: RegExp) => {
    expect(r.code).toBe(1)
    expect(r.err).toMatch(message)
}
const gitInit = (dir: string) => execFileSync("git", ["init", "-q", "."], { cwd: dir })
const items = (dir: string) => readGoals(dir).items
const item = (dir: string, id: string) => items(dir).find((i) => i.id === id)

async function registered(file = fixture()) {
    const dir = await makeProject(file)
    ok(cli(["init", "--no-hooks"], { cwd: dir }))
    return dir
}

describe("help and errors", () => {
    it("prints help", () => {
        expect(ok(cli(["help"], { cwd: tempDir() }))).toMatch(/^upgo: structured goals/)
        expect(ok(cli([], { cwd: tempDir() }))).toMatch(/upgo list/)
    })

    it("rejects unknown commands and flags", () => {
        fails(cli(["nope"], { cwd: tempDir() }), /unknown command `nope`/)
        fails(cli(["list", "--bogus"], { cwd: tempDir() }), /bogus/)
    })

    it("explains a folder without a project", () => {
        fails(cli(["list"], { cwd: tempDir() }), /no goals.json in .* \(run `upgo init`/)
    })
})

describe("init", () => {
    it("creates, registers and installs both hooks in a git repo", () => {
        const dir = join(tempDir(), "My Repo")
        mkdirSync(dir)
        gitInit(dir)
        const out = ok(cli(["init", "--purpose", "Ship it"], { cwd: dir }))
        expect(out).toMatch(/registered `my-repo`/)
        expect(out).toMatch(/git hook: installed/)
        expect(out).toMatch(/Claude hook: installed/)
        expect(readGoals(dir)).toMatchObject({ project: "my-repo", purpose: "Ship it", items: [] })
        expect(readFileSync(join(dir, MD), "utf8")).toBe(render(readGoals(dir)))
        expect(readRegistry()).toEqual([{ id: "my-repo", path: dir }])
        const hook = readFileSync(join(dir, ".git", "hooks", "pre-commit"), "utf8")
        expect(hook).toMatch(/^#!\/bin\/sh\n# upgo:/)
        expect(hook).toContain('check --dir "." || exit 1')
        const settings = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"))
        expect(settings.hooks.PreToolUse[0].matcher).toBe("Edit|Write|MultiEdit|NotebookEdit")
        expect(settings.hooks.PreToolUse[0].hooks[0].command).toMatch(/cli\.ts" hook$/)
        expect(out).toMatch(/\.gitignore: added \/suggestions\.json/)
        expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe("/suggestions.json\n")
    })

    it("is idempotent", () => {
        const dir = tempDir()
        gitInit(dir)
        writeFileSync(join(dir, ".gitignore"), "node_modules")
        // Tracked before init: git skips ignore rules for it unless asked not to.
        writeFileSync(join(dir, "suggestions.json"), "{}")
        execFileSync("git", ["add", "suggestions.json"], { cwd: dir })
        ok(cli(["init"], { cwd: dir }))
        const out = ok(cli(["init"], { cwd: dir }))
        expect(out).not.toMatch(/gitignore/)
        expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe("node_modules\n/suggestions.json\n")
        expect(out).toMatch(/git hook: already installed/)
        expect(out).toMatch(/Claude hook: already installed/)
        expect(JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8")).hooks.PreToolUse).toHaveLength(1)
        expect(readRegistry()).toHaveLength(1)
    })

    it("keeps existing settings and an existing pre-commit hook", () => {
        const dir = tempDir()
        gitInit(dir)
        mkdirSync(join(dir, ".claude"))
        writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [] }], Stop: [] } }))
        writeFileSync(join(dir, ".git", "hooks", "pre-commit"), "#!/bin/sh\necho mine\nexit 0\n")
        ok(cli(["init"], { cwd: dir }))
        const settings = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"))
        expect(settings.permissions).toEqual({ allow: ["Bash(ls)"] })
        expect(settings.hooks.Stop).toEqual([])
        expect(settings.hooks.PreToolUse.map((e: { matcher: string }) => e.matcher)).toEqual(["Bash", "Edit|Write|MultiEdit|NotebookEdit"])
        const hook = readFileSync(join(dir, ".git", "hooks", "pre-commit"), "utf8")
        expect(hook.indexOf("# upgo:")).toBeLessThan(hook.indexOf("exit 0"))
        expect(hook).toContain("echo mine")
    })

    it("refuses to clobber broken settings, skips git outside a repo, honors --no-hooks", () => {
        const broken = tempDir()
        mkdirSync(join(broken, ".claude"))
        writeFileSync(join(broken, ".claude", "settings.json"), "{ nope")
        fails(cli(["init"], { cwd: broken }), /settings.json is not valid JSON/)
        expect(readFileSync(join(broken, ".claude", "settings.json"), "utf8")).toBe("{ nope")

        const plain = tempDir()
        expect(ok(cli(["init"], { cwd: plain }))).toMatch(/git hook: skipped \(not a git repo\)/)

        const bare = tempDir()
        expect(ok(cli(["init", "--no-hooks"], { cwd: bare }))).not.toMatch(/hook/)
        expect(existsSync(join(bare, ".claude"))).toBe(false)
        expect(existsSync(join(bare, ".gitignore"))).toBe(false)
    })

    it("uses the existing goals.json id and refuses a different one or a taken id", async () => {
        const dir = await makeProject()
        expect(ok(cli(["init", "--no-hooks"], { cwd: dir }))).toMatch(/registered `demo`/)
        fails(cli(["init", "--no-hooks", "--id", "other"], { cwd: dir }), /already names this project `demo`/)
        const clash = await makeProject()
        fails(cli(["init", "--no-hooks"], { cwd: clash }), /`demo` is already registered/)
    })

    it("creates nothing when the new project's id is taken, so a second try with --id works", async () => {
        await registered()
        const dir = tempDir()
        fails(cli(["init", "--no-hooks", "--id", "demo"], { cwd: dir }), /`demo` is already registered/)
        expect(existsSync(join(dir, GOALS))).toBe(false)
        expect(ok(cli(["init", "--no-hooks", "--id", "other"], { cwd: dir }))).toMatch(/registered `other`/)
    })

    it("sets the purpose of an existing project under the lock", async () => {
        const dir = await makeProject()
        writeFileSync(join(dir, `${GOALS}.lock`), "someone")
        fails(cli(["init", "--no-hooks", "--purpose", "New"], { cwd: dir }), /locked by another writer/)
        expect(readGoals(dir).purpose).toBe("Demo project")
    })
})

describe("reading", () => {
    it("lists open items by default, grouped by section", async () => {
        const out = ok(cli(["list"], { cwd: await registered() }))
        expect(out).toBe(
            ["## 1. Core", "- `alpha` Alpha (now)", "- `beta` Beta (next, partial)", "- `gamma` Gamma (way later)", "", "## 2. UI", "- `delta` Delta (later)", "- `epsilon` Epsilon (maybe)", "", "5 items", ""].join("\n"),
        )
    })

    it("filters by phase, status, section, search and --all", async () => {
        const cwd = await registered()
        const idsOf = (out: string) => [...out.matchAll(/`([a-z-]+)`/g)].map((m) => m[1])
        expect(idsOf(ok(cli(["list", "--phase", "wayLater,maybe"], { cwd })))).toEqual(["gamma", "epsilon"])
        expect(idsOf(ok(cli(["list", "--status", "done,dropped"], { cwd })))).toEqual(["zeta", "eta"])
        expect(idsOf(ok(cli(["list", "--all", "--section", "2"], { cwd })))).toEqual(["delta", "epsilon", "zeta"])
        expect(idsOf(ok(cli(["list", "--search", "ALPHA BODY"], { cwd })))).toEqual(["alpha"])
        expect(idsOf(ok(cli(["list", "--search", "src/a.ts"], { cwd })))).toEqual(["alpha"])
        expect(ok(cli(["list", "--search", "zzz"], { cwd }))).toBe("no matching items\n")
        // Field names are not content: every item has a `status` key.
        expect(ok(cli(["list", "--search", "status"], { cwd }))).toBe("no matching items\n")
        expect(ok(cli(["list", "--search", "files"], { cwd }))).toBe("no matching items\n")
        fails(cli(["list", "--phase", "soon"], { cwd }), /--phase must be one of/)
        fails(cli(["list", "--section", "x"], { cwd }), /whole number/)
    })

    it("shows an item, a trap, and an item of another project", async () => {
        const cwd = await registered()
        expect(ok(cli(["show", "alpha"], { cwd }))).toBe(
            ["`alpha` Alpha", "§1 Core · now · planned · S · all", "", "Alpha body", "", "files: src/a.ts", "created 2026-10-01, updated 2026-10-01", ""].join("\n"),
        )
        expect(ok(cli(["show", "lock-trap"], { cwd }))).toMatch(/^trap `lock-trap` Locks are per file\n\nNever hold two/)
        expect(ok(cli(["show", "demo:beta"], { cwd: tempDir() }))).toMatch(/^`beta` Beta/)
        fails(cli(["show", "nope"], { cwd }), /no item `nope`/)
        fails(cli(["show", "ghost:x"], { cwd }), /no registered project `ghost`/)
    })

    it("lists projects, including unreadable ones", async () => {
        const cwd = await registered()
        expect(ok(cli(["projects"], { cwd }))).toMatch(/^demo {2}5 open {2}/)
        writeFileSync(join(cwd, GOALS), "{")
        expect(ok(cli(["projects"], { cwd }))).toMatch(/^demo {2}unreadable: goals.json is not valid JSON/)
    })
})

describe("writing", () => {
    it("adds with every field", async () => {
        const cwd = await registered()
        const args = ["add", "Brand new", "--section", "2", "--phase", "next", "--status", "partial", "--size", "M", "--scope", "web, desktop", "--body", "Why", "--detail", "docs/x.md"]
        expect(ok(cli([...args, "--related", "demo:alpha", "--files", "a.ts", "--files", "b.ts", "--trap", "careful"], { cwd }))).toBe("added brand-new\n")
        expect(item(cwd, "brand-new")).toMatchObject({
            section: 2,
            phase: "next",
            status: "partial",
            size: "M",
            scope: ["web", "desktop"],
            body: "Why",
            detail: "docs/x.md",
            related: ["demo:alpha"],
            pointers: { files: ["a.ts", "b.ts"], trap: ["careful"] },
        })
        expect(readFileSync(join(cwd, MD), "utf8")).toContain("`brand-new` Brand new (next, partial)")
    })

    it("adds with defaults and an explicit id, rejecting bad input", async () => {
        const cwd = await registered()
        ok(cli(["add", "Plain", "--section", "1", "--id", "custom-id"], { cwd }))
        expect(item(cwd, "custom-id")).toMatchObject({ phase: "later", status: "planned" })
        fails(cli(["add", "--section", "1"], { cwd }), /missing title/)
        fails(cli(["add", "X", "--section", "1", "--size", "XL"], { cwd }), /--size must be one of: S, M, L/)
        fails(cli(["add", "X", "--section", "9"], { cwd }), /no section 9/)
        fails(cli(["add", "X", "--section", "1", "--id", "alpha"], { cwd }), /already exists/)
        fails(cli(["add", "X", "--section", "1", "--id", "Bad Id"], { cwd }), /lowercase slug/)
        fails(cli(["add", "Dash \u2014 here", "--section", "1"], { cwd }), /em dash/)
    })

    it("edits fields, replaces one pointer key, clears fields", async () => {
        const cwd = await registered()
        ok(cli(["edit", "alpha", "--title", "Alpha 2", "--phase", "next", "--how", "carefully"], { cwd }))
        expect(item(cwd, "alpha")).toMatchObject({ title: "Alpha 2", phase: "next", pointers: { files: ["src/a.ts"], how: ["carefully"] } })
        ok(cli(["edit", "alpha", "--files", "src/z.ts"], { cwd }))
        expect(item(cwd, "alpha")?.pointers).toEqual({ files: ["src/z.ts"], how: ["carefully"] })
        ok(cli(["edit", "alpha", "--clear", "size,body,pointers"], { cwd }))
        const a = item(cwd, "alpha")!
        expect(a.size).toBeUndefined()
        expect(a.body).toBeUndefined()
        expect(a.pointers).toBeUndefined()
        fails(cli(["edit", "alpha"], { cwd }), /nothing to change/)
        fails(cli(["edit", "alpha", "--id", "x"], { cwd }), /ids cannot be changed/)
        fails(cli(["edit", "alpha", "--clear", "title"], { cwd }), /--clear must be one of/)
        fails(cli(["edit", "nope", "--title", "x"], { cwd }), /no item `nope`/)
    })

    it("marks done, drops with a reason, reopens and deletes", async () => {
        const cwd = await registered()
        expect(ok(cli(["done", "alpha", "--note", "shipped"], { cwd }))).toBe("done alpha\n")
        expect(item(cwd, "alpha")).toMatchObject({ status: "done", note: "shipped" })
        fails(cli(["drop", "beta"], { cwd }), /missing --reason/)
        expect(ok(cli(["drop", "beta", "--reason", "not worth it"], { cwd }))).toBe("dropped beta\n")
        expect(item(cwd, "beta")).toMatchObject({ status: "dropped", note: "not worth it" })
        expect(ok(cli(["reopen", "beta"], { cwd }))).toBe("reopened beta\n")
        expect(item(cwd, "beta")?.status).toBe("planned")
        expect(ok(cli(["delete", "beta"], { cwd }))).toBe("deleted beta\n")
        expect(item(cwd, "beta")).toBeUndefined()
        const md = readFileSync(join(cwd, MD), "utf8")
        expect(md).not.toContain("`alpha`")
        expect(md).not.toContain("`beta`")
    })

    it("moves items every way", async () => {
        const cwd = await registered()
        const order = () => items(cwd).map((i) => i.id)
        ok(cli(["move", "gamma", "--up"], { cwd }))
        expect(order().slice(0, 3)).toEqual(["alpha", "gamma", "beta"])
        ok(cli(["move", "alpha", "--down"], { cwd }))
        expect(order().slice(0, 3)).toEqual(["gamma", "alpha", "beta"])
        ok(cli(["move", "beta", "--before", "gamma"], { cwd }))
        expect(order().slice(0, 3)).toEqual(["beta", "gamma", "alpha"])
        ok(cli(["move", "beta", "--after", "delta"], { cwd }))
        expect(item(cwd, "beta")?.section).toBe(2)
        ok(cli(["move", "beta", "--section", "3"], { cwd }))
        expect(order().at(-1)).toBe("beta")
        fails(cli(["move", "beta"], { cwd }), /give --section/)
        fails(cli(["move", "beta", "--up", "--down"], { cwd }), /either --up or --down/)
    })

    it("manages sections", async () => {
        const cwd = await registered()
        expect(ok(cli(["section", "list"], { cwd }))).toBe("1. Core (3 open)\n2. UI (2 open)\n3. Empty (0 open)\n")
        expect(ok(cli(["section", "add", "Later stuff"], { cwd }))).toBe("added section 4\n")
        ok(cli(["section", "add", "Ten", "--n", "10"], { cwd }))
        ok(cli(["section", "rename", "4", "Soon"], { cwd }))
        ok(cli(["section", "move", "10", "--before", "1"], { cwd }))
        expect(readGoals(cwd).sections.map((s) => `${s.n}:${s.title}`)).toEqual(["10:Ten", "1:Core", "2:UI", "3:Empty", "4:Soon"])
        ok(cli(["section", "move", "10"], { cwd }))
        expect(readGoals(cwd).sections.at(-1)?.n).toBe(10)
        ok(cli(["section", "delete", "4"], { cwd }))
        fails(cli(["section", "delete", "1"], { cwd }), /still holds 3 items/)
        fails(cli(["section", "rename", "x", "y"], { cwd }), /whole number/)
        fails(cli(["section", "explode"], { cwd }), /usage: upgo section/)
    })

    it("manages traps and the purpose", async () => {
        const cwd = await registered()
        expect(ok(cli(["trap", "add", "Mind the gap", "--body", "Really"], { cwd }))).toBe("added trap mind-the-gap\n")
        ok(cli(["trap", "edit", "mind-the-gap", "--title", "Gap", "--body", ""], { cwd }))
        expect(readGoals(cwd).traps[1]).toEqual({ id: "mind-the-gap", title: "Gap" })
        expect(ok(cli(["trap", "list"], { cwd }))).toBe("`lock-trap` Locks are per file\n`mind-the-gap` Gap\n")
        ok(cli(["trap", "delete", "mind-the-gap"], { cwd }))
        expect(readGoals(cwd).traps).toHaveLength(1)
        ok(cli(["purpose", "New aim"], { cwd }))
        expect(readGoals(cwd).purpose).toBe("New aim")
        ok(cli(["purpose", "--clear"], { cwd }))
        expect(readGoals(cwd).purpose).toBeUndefined()
    })

    it("manages suggestions in suggestions.json, never goals.json", async () => {
        const cwd = await registered()
        const goals = readFileSync(join(cwd, GOALS), "utf8")
        expect(ok(cli(["suggestion", "list"], { cwd }))).toBe("no suggestions\n")
        expect(ok(cli(["suggestion", "add", "Dark mode", "--body", "Users asked"], { cwd }))).toBe("suggested dark-mode\n")
        expect(ok(cli(["suggestion", "add", "Dark mode"], { cwd }))).toBe("suggested dark-mode-2\n")
        expect(ok(cli(["suggestion", "list"], { cwd }))).toBe("`dark-mode` Dark mode\n`dark-mode-2` Dark mode\n")
        expect(JSON.parse(readFileSync(join(cwd, "suggestions.json"), "utf8")).suggestions[0]).toMatchObject({ id: "dark-mode", title: "Dark mode", body: "Users asked" })
        fails(cli(["suggestion", "add", "Bad \u2014 dash"], { cwd }), /em dash/)
        fails(cli(["suggestion", "add", "x".repeat(201)], { cwd }), /refusing to save an invalid suggestions\.json/)
        fails(cli(["suggestion", "delete", "ghost"], { cwd }), /no suggestion `ghost`/)
        expect(ok(cli(["suggestion", "delete", "dark-mode", "dark-mode-2"], { cwd }))).toBe("deleted dark-mode, dark-mode-2\n")
        expect(ok(cli(["suggestion", "list"], { cwd }))).toBe("no suggestions\n")
        fails(cli(["suggestion", "nope"], { cwd }), /usage: upgo suggestion/)
        expect(readFileSync(join(cwd, GOALS), "utf8")).toBe(goals)
    })

    it("promotes a suggestion to a goal and removes it", async () => {
        const cwd = await registered()
        ok(cli(["suggestion", "add", "Dark mode", "--body", "Users asked"], { cwd }))
        fails(cli(["suggestion", "promote", "dark-mode"], { cwd }), /missing --section/)
        fails(cli(["suggestion", "promote", "ghost", "--section", "1"], { cwd }), /no suggestion `ghost`/)
        expect(ok(cli(["suggestion", "promote", "dark-mode", "--section", "1", "--phase", "next"], { cwd }))).toBe("promoted dark-mode to dark-mode\n")
        expect(items(cwd).find((i) => i.id === "dark-mode")).toMatchObject({ title: "Dark mode", body: "Users asked", section: 1, phase: "next", status: "planned" })
        expect(ok(cli(["suggestion", "list"], { cwd }))).toBe("no suggestions\n")
    })

    it("targets another project with --dir and --project", async () => {
        const target = await registered()
        const nested = join(target, "deep", "er")
        mkdirSync(nested, { recursive: true })
        ok(cli(["done", "alpha"], { cwd: nested }))
        ok(cli(["done", "beta", "--dir", target], { cwd: tempDir() }))
        ok(cli(["done", "delta", "--project", "demo"], { cwd: tempDir() }))
        expect(items(target).filter((i) => i.status === "done").map((i) => i.id)).toEqual(["alpha", "beta", "delta", "zeta"])
        fails(cli(["list", "--project", "ghost"], { cwd: tempDir() }), /no registered project `ghost`/)
    })
})

describe("check, render, forget", () => {
    it("passes a clean project and fails a hand-edited one, then render fixes it", async () => {
        const cwd = await registered()
        expect(ok(cli(["check"], { cwd }))).toBe(`ok: ${cwd.split(/[\\/]/).pop()}\n`)
        writeFileSync(join(cwd, MD), "# edited by hand\n")
        const r = cli(["check"], { cwd })
        expect(r.code).toBe(1)
        expect(r.err).toMatch(/1 issue\n {2}- goals.md is out of date/)
        ok(cli(["render"], { cwd }))
        ok(cli(["check"], { cwd }))
    })

    it("checks every registered project with --all", async () => {
        const good = await registered()
        const bad = await makeProject({ ...fixture(), project: "bad" })
        ok(cli(["init", "--no-hooks"], { cwd: bad }))
        writeFileSync(join(bad, GOALS), "{")
        const r = cli(["check", "--all"], { cwd: good })
        expect(r.code).toBe(1)
        expect(r.out).toBe("ok: demo\n")
        expect(r.err).toMatch(/^bad: 1 issue/)
    })

    it("forgets a project", async () => {
        const cwd = await registered()
        ok(cli(["forget", "demo"], { cwd }))
        expect(readRegistry()).toEqual([])
        fails(cli(["forget", "demo"], { cwd }), /no registered project/)
    })
})

describe("ui", () => {
    it("starts the dashboard server on the given port without opening a browser", async () => {
        const { spawn } = await import("node:child_process")
        const { UPGO_DIR } = await import("../src/core/registry.ts")
        const cwd = await registered()
        const child = spawn(process.execPath, [join(UPGO_DIR, "cli.ts"), "ui", "--port", "0", "--no-open"], { cwd, env: process.env })
        try {
            const url = await new Promise<string>((ok, no) => {
                let out = ""
                child.stdout.on("data", (c: Buffer) => {
                    out += c.toString()
                    const m = out.match(/upgo dashboard on (http:\/\/127\.0\.0\.1:\d+)/)
                    if (m) ok(m[1])
                })
                child.on("exit", (code) => no(new Error(`exited ${code}`)))
            })
            const { projects } = await (await fetch(`${url}/api/projects`)).json()
            expect(projects.map((p: { id: string }) => p.id)).toEqual(["demo"])
        } finally {
            child.kill()
        }
    })
})

describe("import", () => {
    const md = "# Demo\n\n## 1. Core\n\n- [ ] **(Next)** **First goal** (S, all). Body text.\n  - ↳ files: `src/a.ts`\n- [ ] **(Later)** **Second goal**\n"
    const done = "# Done\n\n## 1. Core\n- **Shipped thing (2026-09-01).** It works.\n"

    it("writes a valid goals.json next to the md, then init + render make it a project", () => {
        const dir = tempDir()
        writeFileSync(join(dir, "goals.md"), md)
        writeFileSync(join(dir, "goals-completed.md"), done)
        const out = ok(cli(["import", "goals.md", "--id", "demo"], { cwd: dir }))
        expect(out).toMatch(/1 sections, 2 open, 1 done, 0 dropped, 0 traps/)
        expect(items(dir).map((i) => [i.id, i.phase, i.status])).toEqual([
            ["first-goal", "next", "planned"],
            ["second-goal", "later", "planned"],
            ["shipped-thing", "later", "done"],
        ])
        expect(item(dir, "first-goal")).toMatchObject({ size: "S", scope: ["all"], pointers: { files: ["`src/a.ts`"] } })
        ok(cli(["init", "--no-hooks"], { cwd: dir }))
        ok(cli(["render"], { cwd: dir }))
        ok(cli(["check"], { cwd: dir }))
        expect(readFileSync(join(dir, "goals.md"), "utf8")).toContain("`first-goal` First goal (next)")
    })

    it("writes a dry run elsewhere and refuses to overwrite without --force", () => {
        const dir = tempDir()
        writeFileSync(join(dir, "goals.md"), md)
        const out = join(tempDir(), "dry", "goals.json")
        ok(cli(["import", join(dir, "goals.md"), "--out", out], { cwd: tempDir() }))
        expect(existsSync(out)).toBe(true)
        expect(existsSync(join(dir, "goals.json"))).toBe(false)
        fails(cli(["import", join(dir, "goals.md"), "--out", out], { cwd: dir }), /already exists \(pass --force/)
        ok(cli(["import", join(dir, "goals.md"), "--out", out, "--force"], { cwd: dir }))
        fails(cli(["import", "missing.md"], { cwd: dir }), /does not exist/)
    })
})
