import { readFileSync } from "node:fs"
import { join } from "node:path"
import { UPGO_DIR } from "../src/core/registry.ts"
import { goalsFileSchema, isManaged, itemSchema, jsonSchema, POINTER_KEYS, SCHEMA_URL } from "../src/core/schema.ts"
import { parseGoals } from "../src/core/store.ts"
import { slugify, uniqueSlug } from "../src/core/util.ts"
import { D, fixture } from "./helpers.ts"

const base = fixture().items[0]
const valid = (patch: Record<string, unknown>) => itemSchema.safeParse({ ...base, ...patch }).success

describe("schema", () => {
    it("knows upgo files by the current and the old local schema url", () => {
        expect(isManaged(JSON.stringify({ $schema: SCHEMA_URL }))).toBe(true)
        expect(isManaged(`{
  "$schema": "file:///C:/tools/upgo/goals.schema.json"`)).toBe(true)
        expect(isManaged(`{ "$schema" :\r\n "${SCHEMA_URL}" }`)).toBe(true)
        expect(isManaged('{ "$schema": "https://example.com/other/goals.schema.json" }')).toBe(false)
    })

    it("accepts the fixture", () => {
        expect(goalsFileSchema.safeParse(fixture()).success).toBe(true)
    })

    it("validates ids as slugs", () => {
        expect(valid({ id: "random-logouts" })).toBe(true)
        expect(valid({ id: "a1-b2" })).toBe(true)
        for (const id of ["Random", "has space", "-lead", "trail-", "double--dash", "", "x".repeat(61), "ümlaut"]) expect(valid({ id })).toBe(false)
    })

    it("validates every enum field", () => {
        for (const phase of ["now", "next", "later", "wayLater", "maybe"]) expect(valid({ phase })).toBe(true)
        expect(valid({ phase: "soon" })).toBe(false)
        for (const status of ["planned", "partial", "done", "dropped"]) expect(valid({ status })).toBe(true)
        expect(valid({ status: "open" })).toBe(false)
        for (const size of ["S", "M", "L"]) expect(valid({ size })).toBe(true)
        expect(valid({ size: "XL" })).toBe(false)
    })

    it("validates titles, dates, sections and lists", () => {
        expect(valid({ title: "" })).toBe(false)
        expect(valid({ title: "   " })).toBe(false)
        expect(valid({ title: "two\nlines" })).toBe(false)
        expect(valid({ title: "x".repeat(201) })).toBe(false)
        expect(valid({ created: "2026-1-1" })).toBe(false)
        expect(valid({ updated: D })).toBe(true)
        expect(valid({ section: -1 })).toBe(false)
        expect(valid({ section: 1.5 })).toBe(false)
        expect(valid({ scope: [] })).toBe(false)
        expect(valid({ scope: [""] })).toBe(false)
        expect(valid({ related: ["other:item"] })).toBe(true)
        expect(valid({ related: ["no-colon"] })).toBe(false)
        expect(valid({ related: ["a:b:c"] })).toBe(false)
    })

    it("accepts every pointer key and rejects unknown ones", () => {
        for (const k of POINTER_KEYS) expect(valid({ pointers: { [k]: ["x"] } })).toBe(true)
        expect(valid({ pointers: { nope: ["x"] } })).toBe(false)
        expect(valid({ pointers: { files: [] } })).toBe(false)
    })

    it("rejects unknown keys and missing required fields", () => {
        expect(valid({ extra: 1 })).toBe(false)
        for (const key of ["id", "section", "title", "phase", "status", "created", "updated"]) {
            const { [key as keyof typeof base]: _gone, ...rest } = base
            expect(itemSchema.safeParse(rest).success).toBe(false)
        }
        expect(goalsFileSchema.safeParse({ ...fixture(), version: 2 }).success).toBe(false)
        expect(goalsFileSchema.safeParse({ ...fixture(), extra: true }).success).toBe(false)
        const { traps: _t, ...noTraps } = fixture()
        expect(goalsFileSchema.safeParse(noTraps).success).toBe(false)
    })

    it("reports issues with readable paths", () => {
        expect(() => parseGoals({ ...fixture(), items: [{ ...base, phase: "soon" }] })).toThrow(/items\.0\.phase/)
    })

    it("keeps goals.schema.json in sync with the zod schema", () => {
        const onDisk = JSON.parse(readFileSync(join(UPGO_DIR, "goals.schema.json"), "utf8"))
        expect(onDisk).toEqual(JSON.parse(JSON.stringify(jsonSchema())))
    })
})

describe("slugs", () => {
    it("slugifies titles", () => {
        expect(slugify("Random logouts")).toBe("random-logouts")
        expect(slugify("  Beyoncé & Jay-Z!! ")).toBe("beyonce-jay-z")
        expect(slugify("!!!")).toBe("item")
        const long = slugify("one two three four five six seven eight nine ten eleven twelve")
        expect(long.length).toBeLessThanOrEqual(48)
        expect(long.endsWith("-")).toBe(false)
    })

    it("dedupes against taken ids", () => {
        expect(uniqueSlug("a", new Set())).toBe("a")
        expect(uniqueSlug("a", new Set(["a"]))).toBe("a-2")
        expect(uniqueSlug("a", new Set(["a", "a-2"]))).toBe("a-3")
    })
})
