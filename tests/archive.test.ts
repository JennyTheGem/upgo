import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ARCHIVE, monthsBefore, readArchive, splitOld } from "../src/core/archive.ts"
import { readGoals } from "../src/core/store.ts"
import { cli } from "./cliHarness.ts"
import { fixture, isolateRegistry, makeProject } from "./helpers.ts"

beforeEach(() => isolateRegistry())

const ok = (r: ReturnType<typeof cli>) => {
    expect(r.err).toBe("")
    expect(r.code).toBe(0)
    return r.out
}

async function registered(file = fixture()) {
    const dir = await makeProject(file)
    ok(cli(["init", "--no-hooks"], { cwd: dir }))
    return dir
}

describe("archive", () => {
    it("computes the cutoff and splits only old done items", () => {
        expect(monthsBefore("2026-11-07", 6)).toBe("2026-05-07")
        expect(monthsBefore("2026-02-15", 3)).toBe("2025-11-15")
        expect(monthsBefore("2026-08-31", 6)).toBe("2026-02-28")
        expect(monthsBefore("2024-03-31", 1)).toBe("2024-02-29")
        expect(monthsBefore("2026-11-07", 1e20)).toBe("0000-01-01")
        expect(splitOld(fixture(), "2026-10-01").old).toEqual([])
        const { keep, old } = splitOld(fixture(), "2026-10-02")
        expect(old.map((i) => i.id)).toEqual(["zeta"])
        expect(keep.items.map((i) => i.id)).not.toContain("zeta")
        expect(keep.items.map((i) => i.id)).toContain("eta")
    })

    it("moves done items out, keeps refs, show and duplicate checks working", async () => {
        const dir = await registered()
        const other = await registered(fixture({ project: "other" }))
        for (const cwd of [dir, other]) ok(cli(["edit", "delta", "--related", "demo:zeta"], { cwd }))
        expect(ok(cli(["archive"], { cwd: dir }))).toMatch(/no done items older than 6 months/)
        expect(ok(cli(["archive", "--months", "0"], { cwd: dir }))).toBe("archived 1: zeta\n")
        expect(readGoals(dir).items.map((i) => i.id)).not.toContain("zeta")
        expect(readArchive(dir).map((i) => i.id)).toEqual(["zeta"])
        expect(ok(cli(["check", "--all"], { cwd: dir }))).toBe("ok: demo\nok: other\n")
        expect(ok(cli(["show", "zeta"], { cwd: dir }))).toMatch(/^archived in goals-archive\.json\n`zeta` Zeta/)
        expect(ok(cli(["show", "demo:zeta"], { cwd: other }))).toMatch(/^archived in/)
        const dupe = cli(["suggestion", "add", "Zeta"], { cwd: dir })
        expect(dupe.code).toBe(1)
        expect(dupe.err).toMatch(/goal `zeta`/)
        expect(ok(cli(["archive", "--months", "0"], { cwd: dir }))).toMatch(/no done items/)
        expect(readArchive(dir)).toHaveLength(1)
    })

    it("check reports a broken archive and the hook guards it", async () => {
        const dir = await registered()
        writeFileSync(join(dir, ARCHIVE), "{ nope")
        const r = cli(["check"], { cwd: dir })
        expect(r.code).toBe(1)
        expect(r.err).toMatch(/goals-archive\.json is not valid JSON/)
        const hook = cli(["hook"], { cwd: dir, input: JSON.stringify({ cwd: dir, tool_input: { file_path: ARCHIVE } }) })
        expect(hook.code).toBe(2)
        expect(readFileSync(join(dir, ARCHIVE), "utf8")).toBe("{ nope")
    })
})

describe("next", () => {
    it("prints the first now item, else the first next one", async () => {
        const dir = await registered()
        expect(ok(cli(["next"], { cwd: dir }))).toMatch(/^`alpha` Alpha\n.*\n\nAlpha body/)
        ok(cli(["done", "alpha"], { cwd: dir }))
        expect(ok(cli(["next"], { cwd: dir }))).toMatch(/^`beta` Beta/)
        // Section order wins over item order, like goals.md.
        ok(cli(["edit", "delta", "--phase", "next"], { cwd: dir }))
        ok(cli(["section", "move", "2", "--before", "1"], { cwd: dir }))
        expect(ok(cli(["next"], { cwd: dir }))).toMatch(/^`delta` Delta/)
        ok(cli(["edit", "delta", "--phase", "later"], { cwd: dir }))
        ok(cli(["done", "beta"], { cwd: dir }))
        expect(ok(cli(["next"], { cwd: dir }))).toMatch(/nothing in now or next/)
    })
})
