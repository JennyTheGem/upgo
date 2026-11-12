import type { Item } from "../src/core/schema.ts"
import { burnUp, percentDone, summarize, weeklyDone } from "../src/core/summary.ts"
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

    it("counts archived items as done", () => {
        const s = summarize({ version: 1, project: "p", sections: [], traps: [], items: [item("planned", "S")] }, [item("done", "L"), item("done", "L")])
        expect([s.done, s.open, s.percent, s.recent]).toEqual([2, 1, 89, []])
        // A crashed archive run leaves the same item in both files: count it once.
        expect(summarize({ version: 1, project: "p", sections: [], traps: [], items: [item("done", "L")] }, [item("done", "L")]).done).toBe(1)
    })
})

describe("weeklyDone", () => {
    it("buckets done items into 7-day windows ending today, oldest first", () => {
        const done = (updated: string, status: Item["status"] = "done"): Item => ({ ...item(status), updated })
        const now = new Date(2026, 10, 7)
        const items = [done("2026-11-07"), done("2026-11-01"), done("2026-10-31"), done("2026-09-13"), done("2026-09-12"), done("2026-11-07", "planned")]
        expect(weeklyDone(items, now)).toEqual([1, 0, 0, 0, 0, 0, 1, 2])
        expect(summarize({ version: 1, project: "p", sections: [], traps: [], items: [] }, [done("2026-11-06")], now).weekly).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
    })
})

describe("burnUp", () => {
    it("steps done and total on each item date, drops leave scope, maybes count once done, ends today", () => {
        const at = (created: string, updated: string, status: Item["status"], phase: Item["phase"] = "now"): Item => ({ ...item(status, undefined, phase), created, updated })
        const items = [
            at("2026-11-01", "2026-11-03", "done"),
            at("2026-11-01", "2026-11-04", "dropped"),
            at("2026-11-02", "2026-11-02", "planned"),
            at("2026-11-02", "2026-11-02", "planned", "maybe"),
            at("2026-11-01", "2026-11-04", "dropped", "maybe"),
        ]
        expect(burnUp(items, new Date(2026, 10, 7))).toEqual([
            { day: "2026-11-01", done: 0, total: 2 },
            { day: "2026-11-02", done: 0, total: 3 },
            { day: "2026-11-03", done: 1, total: 3 },
            { day: "2026-11-04", done: 1, total: 2 },
            { day: "2026-11-07", done: 1, total: 2 },
        ])
        expect(burnUp([])).toEqual([])
    })
})
