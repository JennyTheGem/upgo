import type { Item } from "../src/core/schema.ts"
import { percentDone, summarize } from "../src/core/summary.ts"
import { D } from "./helpers.ts"

const item = (status: Item["status"], size?: Item["size"], phase: Item["phase"] = "now"): Item => ({ id: "x", section: 1, title: "X", phase, status, created: D, updated: D, ...(size ? { size } : {}) })

describe("percentDone", () => {
    it("weighs by size, unsized as M, ignoring dropped", () => {
        // done L=4 of 4 + S=1 + unsized=2
        expect(percentDone([item("done", "L"), item("planned", "S"), item("partial"), item("dropped", "L")])).toBe(57)
        expect(percentDone([])).toBe(0)
    })

    it("skips open maybes, keeps done ones", () => {
        expect(percentDone([item("done", "S"), item("planned", "L", "maybe")])).toBe(100)
        expect(percentDone([item("done", "S", "maybe"), item("planned", "S")])).toBe(50)
    })
})

describe("summarize", () => {
    it("lists next items with size, the newest date and the latest done items first", () => {
        const at = (id: string, updated: string, rest: Partial<Item>): Item => ({ ...item("planned"), id, updated, ...rest })
        const items = [
            at("a", "2026-01-01", { status: "done", note: "old" }),
            at("b", "2026-03-01", { phase: "next", size: "S" }),
            at("c", "2026-02-01", { status: "done" }),
            ...Array.from({ length: 6 }, (_, n) => at(`d${n}`, "2025-01-01", { status: "done" })),
        ]
        const s = summarize({ version: 1, project: "p", sections: [], traps: [], items })
        expect(s.next).toEqual([{ id: "b", title: "X", status: "planned", size: "S" }])
        expect(s.updated).toBe("2026-03-01")
        expect(s.recent.map((r) => r.id)).toEqual(["c", "a", "d0", "d1", "d2"])
        expect(s.recent[1]).toEqual({ id: "a", title: "X", note: "old", updated: "2026-01-01" })
        expect(summarize({ version: 1, project: "p", sections: [], traps: [], items: [] }).updated).toBeUndefined()
    })
})
