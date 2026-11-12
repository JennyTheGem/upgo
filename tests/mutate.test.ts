import * as m from "../src/core/mutate.ts"
import { applyOp, opSchema } from "../src/core/ops.ts"
import { localIssues } from "../src/core/rules.ts"
import { goalsFileSchema, type GoalsFile } from "../src/core/schema.ts"
import { D, fixture } from "./helpers.ts"

const DAY = "2026-10-12"
const ids = (f: GoalsFile) => f.items.map((i) => i.id)
const get = (f: GoalsFile, id: string) => f.items.find((i) => i.id === id)!
const valid = (f: GoalsFile) => {
    expect(goalsFileSchema.safeParse(f).success).toBe(true)
    expect(localIssues(f)).toEqual([])
    return f
}

describe("items", () => {
    it("adds at the end of its section with a slug id and today's dates", () => {
        const { file, id } = m.addItem(fixture(), { section: 1, title: "New thing", phase: "now" }, DAY)
        valid(file)
        expect(id).toBe("new-thing")
        expect(ids(file).slice(0, 4)).toEqual(["alpha", "beta", "gamma", "new-thing"])
        expect(get(file, id)).toMatchObject({ status: "planned", created: DAY, updated: DAY })
    })

    it("dedupes generated ids and rejects a taken explicit one", () => {
        const a = m.addItem(fixture(), { section: 1, title: "Alpha", phase: "now" }, DAY)
        expect(a.id).toBe("alpha-2")
        expect(() => m.addItem(fixture(), { id: "beta", section: 1, title: "X", phase: "now" }, DAY)).toThrow(/already exists/)
    })

    it("rejects an unknown section", () => {
        expect(() => m.addItem(fixture(), { section: 9, title: "X", phase: "now" }, DAY)).toThrow(/no section 9/)
    })

    it("edits, clears with null, bumps updated and keeps created", () => {
        const f = valid(m.editItem(fixture(), "alpha", { title: "A2", phase: "later", size: null, body: null, scope: ["web"] }, DAY))
        const a = get(f, "alpha")
        expect(a).toMatchObject({ title: "A2", phase: "later", scope: ["web"], created: D, updated: DAY })
        expect(a).not.toHaveProperty("size")
        expect(a).not.toHaveProperty("body")
    })

    it("moving an item to another section by edit puts it at that section's end", () => {
        const f = valid(m.editItem(fixture(), "alpha", { section: 2 }, DAY))
        expect(ids(f)).toEqual(["beta", "gamma", "delta", "epsilon", "zeta", "alpha", "eta"])
        expect(() => m.editItem(fixture(), "alpha", { section: 9 }, DAY)).toThrow(/no section 9/)
    })

    it("does not mutate its input", () => {
        const f = fixture()
        const snapshot = JSON.stringify(f)
        m.editItem(f, "alpha", { title: "X" }, DAY)
        m.moveItem(f, "alpha", { section: 2 }, DAY)
        m.deleteItem(f, "alpha")
        expect(JSON.stringify(f)).toBe(snapshot)
    })

    it("sets status: done with a note, drop needs a reason, reopen clears the note", () => {
        const done = valid(m.setStatus(fixture(), "alpha", "done", "shipped it", DAY))
        expect(get(done, "alpha")).toMatchObject({ status: "done", note: "shipped it" })
        expect(() => m.setStatus(fixture(), "alpha", "dropped", "  ", DAY)).toThrow(/reason/)
        const dropped = valid(m.setStatus(fixture(), "alpha", "dropped", "no longer needed", DAY))
        expect(get(dropped, "alpha").note).toBe("no longer needed")
        const reopened = valid(m.setStatus(dropped, "alpha", "planned", undefined, DAY))
        expect(get(reopened, "alpha").status).toBe("planned")
        expect(get(reopened, "alpha")).not.toHaveProperty("note")
    })

    it("deletes, and errors on unknown ids", () => {
        expect(ids(valid(m.deleteItem(fixture(), "beta")))).not.toContain("beta")
        expect(() => m.deleteItem(fixture(), "nope")).toThrow(/no item `nope`/)
        expect(() => m.editItem(fixture(), "nope", {}, DAY)).toThrow(/no item/)
    })
})

describe("moving", () => {
    it("moves before and after an anchor", () => {
        expect(ids(valid(m.moveItem(fixture(), "gamma", { before: "alpha" }, DAY))).slice(0, 3)).toEqual(["gamma", "alpha", "beta"])
        expect(ids(valid(m.moveItem(fixture(), "alpha", { after: "beta" }, DAY))).slice(0, 3)).toEqual(["beta", "alpha", "gamma"])
    })

    it("moves into another section, taking the anchor's section", () => {
        const f = valid(m.moveItem(fixture(), "alpha", { before: "delta" }, DAY))
        expect(get(f, "alpha")).toMatchObject({ section: 2, updated: DAY })
        expect(ids(f)).toEqual(["beta", "gamma", "alpha", "delta", "epsilon", "zeta", "eta"])
    })

    it("moves to the end of a section, also an empty one", () => {
        const f = valid(m.moveItem(fixture(), "alpha", { section: 3 }, DAY))
        expect(ids(f).at(-1)).toBe("alpha")
        const empty = valid(m.addSection(fixture(), "Fresh").file)
        expect(get(valid(m.moveItem(empty, "beta", { section: 4 }, DAY)), "beta").section).toBe(4)
    })

    it("keeps updated when the section does not change", () => {
        expect(get(m.moveItem(fixture(), "gamma", { before: "alpha" }, DAY), "gamma").updated).toBe(D)
    })

    it("rejects contradictory or self-referencing moves", () => {
        expect(() => m.moveItem(fixture(), "alpha", { before: "beta", after: "gamma" }, DAY)).toThrow(/either/)
        expect(() => m.moveItem(fixture(), "alpha", { before: "alpha" }, DAY)).toThrow(/itself/)
        expect(() => m.moveItem(fixture(), "alpha", { section: 1, before: "delta" }, DAY)).toThrow(/section 2, not 1/)
        expect(() => m.moveItem(fixture(), "alpha", { before: "nope" }, DAY)).toThrow(/no item/)
        expect(() => m.moveItem(fixture(), "alpha", { section: 9 }, DAY)).toThrow(/no section/)
    })

    it("nudges up and down within the section, optionally over visible items only", () => {
        expect(ids(m.nudgeItem(fixture(), "beta", "up")).slice(0, 3)).toEqual(["beta", "alpha", "gamma"])
        expect(ids(m.nudgeItem(fixture(), "beta", "down")).slice(0, 3)).toEqual(["alpha", "gamma", "beta"])
        expect(m.nudgeItem(fixture(), "alpha", "up")).toEqual(fixture())
        expect(m.nudgeItem(fixture(), "gamma", "down")).toEqual(fixture())
        const visible = new Set(["alpha", "gamma"])
        expect(ids(m.nudgeItem(fixture(), "gamma", "up", visible)).slice(0, 3)).toEqual(["gamma", "alpha", "beta"])
    })
})

describe("sections and traps", () => {
    it("adds with the next number or a given one, rejecting duplicates", () => {
        const { file, n } = m.addSection(fixture(), "Fourth")
        expect(n).toBe(4)
        valid(file)
        expect(m.addSection(fixture(), "Ten", 10).n).toBe(10)
        expect(() => m.addSection(fixture(), "Dup", 2)).toThrow(/already exists/)
        expect(m.addSection({ ...fixture(), sections: [], items: [] }, "First").n).toBe(1)
    })

    it("renames, reorders and deletes only empty sections", () => {
        expect(valid(m.renameSection(fixture(), 2, "Interface")).sections[1].title).toBe("Interface")
        expect(valid(m.moveSection(fixture(), 3, 1)).sections.map((s) => s.n)).toEqual([3, 1, 2])
        expect(valid(m.moveSection(fixture(), 1, null)).sections.map((s) => s.n)).toEqual([2, 3, 1])
        expect(() => m.moveSection(fixture(), 1, 1)).toThrow(/itself/)
        expect(() => m.deleteSection(fixture(), 3)).toThrow(/still holds 1 item \(done and dropped/)
        const emptied = m.deleteItem(fixture(), "eta")
        expect(valid(m.deleteSection(emptied, 3)).sections.map((s) => s.n)).toEqual([1, 2])
        expect(() => m.renameSection(fixture(), 9, "x")).toThrow(/no section 9/)
    })

    it("adds, edits and deletes traps", () => {
        const { file, id } = m.addTrap(fixture(), { title: "Watch out", body: "Really" })
        expect(id).toBe("watch-out")
        valid(file)
        const edited = valid(m.editTrap(file, id, { body: null, title: "Careful" }))
        expect(edited.traps[1]).toEqual({ id, title: "Careful" })
        expect(valid(m.deleteTrap(edited, id)).traps).toHaveLength(1)
        expect(() => m.addTrap(fixture(), { id: "lock-trap", title: "x" })).toThrow(/already exists/)
        expect(() => m.deleteTrap(fixture(), "nope")).toThrow(/no trap/)
    })

    it("sets and clears the purpose", () => {
        expect(m.setPurpose(fixture(), "  New aim ").purpose).toBe("New aim")
        expect(m.setPurpose(fixture(), null)).not.toHaveProperty("purpose")
    })
})

describe("ops", () => {
    const run = (op: unknown) => applyOp(fixture(), opSchema.parse(op), DAY)

    it("parses and applies every op", () => {
        expect(ids(run({ op: "add", item: { section: 2, title: "Op add", phase: "next" } }))).toContain("op-add")
        expect(get(run({ op: "edit", id: "alpha", patch: { size: null, phase: "maybe" } }), "alpha")).not.toHaveProperty("size")
        expect(get(run({ op: "done", id: "alpha", note: "yay" }), "alpha").status).toBe("done")
        expect(get(run({ op: "drop", id: "alpha", reason: "meh" }), "alpha").note).toBe("meh")
        expect(get(run({ op: "reopen", id: "zeta" }), "zeta").status).toBe("planned")
        expect(ids(run({ op: "delete", id: "alpha" }))).not.toContain("alpha")
        expect(ids(run({ op: "move", id: "gamma", before: "alpha" }))[0]).toBe("gamma")
        expect(run({ op: "addSection", title: "New" }).sections).toHaveLength(4)
        expect(run({ op: "renameSection", n: 1, title: "Kernel" }).sections[0].title).toBe("Kernel")
        expect(run({ op: "moveSection", n: 2, before: 1 }).sections[0].n).toBe(2)
        expect(() => run({ op: "deleteSection", n: 3 })).toThrow(/still holds/)
        expect(applyOp(m.deleteItem(fixture(), "eta"), { op: "deleteSection", n: 3 }, DAY).sections).toHaveLength(2)
        const trapped = run({ op: "addTrap", trap: { title: "Op trap", body: "b" }, at: 0 })
        expect(trapped.traps[0]).toEqual({ id: "op-trap", title: "Op trap", body: "b" })
        expect(applyOp(trapped, opSchema.parse({ op: "editTrap", id: "op-trap", patch: { title: "T", body: null } }), DAY).traps[0]).toEqual({ id: "op-trap", title: "T" })
        expect(applyOp(trapped, opSchema.parse({ op: "deleteTrap", id: "op-trap" }), DAY).traps).toEqual(fixture().traps)
    })

    it("rejects malformed ops before they reach the file", () => {
        for (const bad of [
            { op: "nuke" },
            { op: "drop", id: "alpha", reason: " " },
            { op: "edit", id: "alpha", patch: { id: "x" } },
            { op: "edit", id: "alpha", patch: { phase: "soon" } },
            { op: "add", item: { section: 1, title: "x", phase: "now", updated: DAY } },
            { op: "add", item: { section: 1, title: "x", phase: "now", created: "soon" } },
            { op: "move", id: "../etc" },
            { op: "addTrap", trap: { title: " " } },
            { op: "editTrap", id: "x", patch: { title: "a\nb" } },
        ]) {
            expect(opSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
        }
    })
})
