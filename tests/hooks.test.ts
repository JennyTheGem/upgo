import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { cli } from "./cliHarness.ts"
import { fixture, isolateRegistry, makeProject, tempDir } from "./helpers.ts"

beforeEach(() => isolateRegistry())

const hookInput = (tool: string, input: Record<string, unknown>, cwd?: string) => JSON.stringify({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: input, ...(cwd ? { cwd } : {}) })

describe("Claude PreToolUse hook", () => {
    it("blocks Edit, Write and MultiEdit on an upgo-managed goals.json or goals.md", async () => {
        const dir = await makeProject()
        for (const [tool, file] of [
            ["Edit", "goals.json"],
            ["Write", "goals.md"],
            ["MultiEdit", "goals.json"],
            ["Edit", "GOALS.MD"],
        ]) {
            const r = cli(["hook"], { cwd: tempDir(), input: hookInput(tool, { file_path: join(dir, file) }) })
            expect(r.code, `${tool} ${file}`).toBe(2)
            expect(r.err).toMatch(/managed by upgo and must not be edited directly/)
        }
    })

    it("resolves a relative path against the hook's cwd", async () => {
        const dir = await makeProject()
        expect(cli(["hook"], { cwd: tempDir(), input: hookInput("Edit", { file_path: "goals.json" }, dir) }).code).toBe(2)
    })

    it("allows everything else", async () => {
        const dir = await makeProject()
        const legacy = tempDir()
        writeFileSync(join(legacy, "goals.md"), "# not migrated yet")
        const foreign = tempDir()
        writeFileSync(join(foreign, "goals.json"), JSON.stringify({ goals: ["run a marathon"] }))
        for (const input of [
            hookInput("Edit", { file_path: join(dir, "src", "app.ts") }),
            hookInput("Edit", { file_path: join(dir, "goals-completed.md") }),
            hookInput("Write", { file_path: join(legacy, "goals.md") }),
            hookInput("Edit", { file_path: join(foreign, "goals.json") }),
            hookInput("Write", { file_path: join(foreign, "goals.md") }),
            hookInput("NotebookEdit", { notebook_path: join(dir, "n.ipynb") }),
            hookInput("Bash", { command: "ls" }),
            "not json",
            "",
        ]) {
            const r = cli(["hook"], { cwd: tempDir(), input })
            expect(r.code, input).toBe(0)
            expect(r.err).toBe("")
        }
    })
})

describe("git pre-commit hook", () => {
    const git = (cwd: string, ...args: string[]) =>
        spawnSync("git", ["-c", "user.name=upgo", "-c", "user.email=upgo@test", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: process.env })

    it("refuses a commit while goals.json is invalid", async () => {
        const dir = tempDir()
        execFileSync("git", ["init", "-q", "."], { cwd: dir })
        expect(cli(["init"], { cwd: dir }).code).toBe(0)
        expect(cli(["section", "add", "Core"], { cwd: dir }).code).toBe(0)
        git(dir, "add", "-A")
        expect(git(dir, "commit", "-q", "-m", "clean").status).toBe(0)

        writeFileSync(join(dir, "goals.md"), "# hand edit\n")
        git(dir, "add", "-A")
        const refused = git(dir, "commit", "-q", "-m", "dirty")
        expect(refused.status).not.toBe(0)
        expect(refused.stderr).toMatch(/goals.md is out of date/)

        expect(cli(["render"], { cwd: dir }).code).toBe(0)
        expect(cli(["add", "Real change", "--section", "1"], { cwd: dir }).code).toBe(0)
        git(dir, "add", "-A")
        expect(git(dir, "commit", "-q", "-m", "fixed").status).toBe(0)
    })

    it("checks a project that lives in a subfolder of the repo", async () => {
        const repo = tempDir()
        execFileSync("git", ["init", "-q", "."], { cwd: repo })
        const sub = join(repo, "packages", "app")
        mkdirSync(sub, { recursive: true })
        await makeProject(undefined, sub)
        expect(cli(["init"], { cwd: sub }).code).toBe(0)
        git(repo, "add", "-A")
        expect(git(repo, "commit", "-q", "-m", "ok").status).toBe(0)
        writeFileSync(join(sub, "goals.json"), "{")
        git(repo, "add", "-A")
        expect(git(repo, "commit", "-q", "-m", "broken").status).not.toBe(0)
    })

    it("checks every project of a repo that holds several", async () => {
        const repo = tempDir()
        execFileSync("git", ["init", "-q", "."], { cwd: repo })
        const [a, b] = ["a", "b"].map((name) => join(repo, "packages", name))
        await makeProject({ ...fixture(), project: "pkg-a" }, (mkdirSync(a, { recursive: true }), a))
        await makeProject({ ...fixture(), project: "pkg-b" }, (mkdirSync(b, { recursive: true }), b))
        expect(cli(["init"], { cwd: a }).code).toBe(0)
        expect(cli(["init"], { cwd: b }).out).toMatch(/git hook: installed/)
        writeFileSync(join(b, "goals.json"), "{")
        git(repo, "add", "-A")
        expect(git(repo, "commit", "-q", "-m", "broken").status).not.toBe(0)
    })

    it("leaves a pre-commit hook in another language alone", () => {
        const dir = tempDir()
        execFileSync("git", ["init", "-q", "."], { cwd: dir })
        const path = join(dir, ".git", "hooks", "pre-commit")
        const mine = "#!/usr/bin/env node\nconsole.log('mine')\n"
        writeFileSync(path, mine)
        const r = cli(["init"], { cwd: dir })
        expect(r.code).toBe(0)
        expect(r.out).toMatch(/git hook: skipped .*not a shell script/)
        expect(readFileSync(path, "utf8")).toBe(mine)
    })
})
