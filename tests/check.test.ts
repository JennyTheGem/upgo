import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { checkProject } from "../src/core/check.ts"
import { register } from "../src/core/registry.ts"
import { localIssues } from "../src/core/rules.ts"
import { GOALS, MD, serialize } from "../src/core/store.ts"
import type { GoalsFile } from "../src/core/schema.ts"
import { fixture, isolateRegistry, makeProject, tempDir } from "./helpers.ts"

beforeEach(() => isolateRegistry())

// Writes a file that skips save-time validation, the way a hand edit would.
function handWritten(f: GoalsFile, dir = tempDir()): string {
    writeFileSync(join(dir, GOALS), JSON.stringify(f, null, 2))
    return dir
}

const withItem = (patch: Record<string, unknown>) => {
    const f = fixture()
    f.items[0] = { ...f.items[0], ...patch }
    return f
}

describe("local rules", () => {
    it("passes the fixture", () => expect(localIssues(fixture())).toEqual([]))

    it("flags duplicate ids, sections and traps", () => {
        const f = fixture()
        f.items.push({ ...f.items[1] })
        f.traps.push({ ...f.traps[0] })
        f.sections.push({ n: 1, title: "Again" })
        expect(localIssues(f)).toEqual(["duplicate item id `beta`", "duplicate trap id `lock-trap`", "duplicate section number 1"])
    })

    it("flags a missing section, a reasonless drop and a self reference", () => {
        expect(localIssues(withItem({ section: 7 }))).toEqual(["item `alpha` is in section 7, which does not exist"])
        expect(localIssues(withItem({ status: "dropped", note: " " }))).toEqual(["dropped item `alpha` needs a reason in `note`"])
        expect(localIssues(withItem({ related: ["demo:alpha"] }))).toEqual(["item `alpha` relates to itself"])
    })

    it("flags em dashes anywhere", () => {
        const f = withItem({ body: "a \u2014 b" })
        f.traps[0].title = "x \u2014 y"
        f.sections[1].title = "UI \u2014 shell"
        f.purpose = "p\u2014q"
        expect(localIssues(f)).toEqual([
            "item `alpha` contains an em dash (U+2014); use a comma, colon or hyphen",
            "trap `lock-trap` contains an em dash (U+2014); use a comma, colon or hyphen",
            "section 2 contains an em dash (U+2014); use a comma, colon or hyphen",
            "purpose contains an em dash (U+2014); use a comma, colon or hyphen",
        ])
    })
})

describe("checkProject", () => {
    it("passes a clean project", async () => {
        expect(checkProject(await makeProject(), [])).toEqual([])
    })

    it("reports a broken or invalid goals.json", () => {
        const dir = tempDir()
        writeFileSync(join(dir, GOALS), "{")
        expect(checkProject(dir, [])[0]).toMatch(/not valid JSON/)
        handWritten({ ...fixture(), items: [{ ...fixture().items[0], phase: "soon" as never }] }, dir)
        expect(checkProject(dir, [])[0]).toMatch(/^items\.0\.phase:/)
    })

    it("reports local rule breaks", () => {
        const f = fixture()
        f.items.push({ ...f.items[0] })
        expect(checkProject(handWritten(f), [])).toContain("duplicate item id `alpha`")
    })

    it("resolves related refs in this project and in registered ones", async () => {
        const other = await makeProject({ ...fixture(), project: "other" })
        await register("other", other)
        const dir = await makeProject(withItem({ related: ["demo:beta", "other:delta"] }))
        expect(checkProject(dir)).toEqual([])
    })

    it("reports unresolved related refs", async () => {
        const other = await makeProject({ ...fixture(), project: "other" })
        await register("other", other)
        const dir = await makeProject(withItem({ related: ["demo:nope", "other:nope", "ghost:x"] }))
        expect(checkProject(dir)).toEqual([
            "item `alpha`: related `demo:nope` does not exist",
            "item `alpha`: related `other:nope` does not exist",
            "item `alpha`: related `ghost:x` points at a project that is not registered or not readable",
        ])
    })

    it("reports a missing detail file and accepts an existing one", async () => {
        const dir = await makeProject(withItem({ detail: "docs/goalsDetails/a.md" }))
        expect(checkProject(dir, [])).toEqual(["item `alpha`: detail file docs/goalsDetails/a.md does not exist"])
        mkdirSync(join(dir, "docs", "goalsDetails"), { recursive: true })
        writeFileSync(join(dir, "docs", "goalsDetails", "a.md"), "# A")
        expect(checkProject(dir, [])).toEqual([])
    })

    it("reports goals.md missing or out of sync, ignoring CRLF", async () => {
        const dir = await makeProject()
        writeFileSync(join(dir, MD), "# hand edited\n")
        expect(checkProject(dir, [])).toEqual(["goals.md is out of date with goals.json, run `upgo render`"])
        const f = fixture()
        writeFileSync(join(dir, GOALS), serialize({ ...f, purpose: "changed" }))
        expect(checkProject(dir, [])).toHaveLength(1)
        const clean = await makeProject()
        const { readFileSync } = await import("node:fs")
        writeFileSync(join(clean, MD), readFileSync(join(clean, MD), "utf8").replace(/\n/g, "\r\n"))
        expect(checkProject(clean, [])).toEqual([])
        const { rmSync } = await import("node:fs")
        rmSync(join(clean, MD))
        expect(checkProject(clean, [])).toEqual(["goals.md is missing, run `upgo render`"])
    })

    it("stays in sync when the purpose was given with CRLF line breaks", async () => {
        const dir = await makeProject({ ...fixture(), purpose: "First line\r\nsecond line" })
        expect(checkProject(dir, [])).toEqual([])
    })
})
