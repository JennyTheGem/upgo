// @vitest-environment jsdom
import { ago, daysSince, isFinished } from "../../web/src/goals/counts.ts"
import { formatForAgent } from "../../web/src/goals/format.ts"
import { NO_FILTERS, groupItems } from "../../web/src/goals/filters.ts"
import { diffPatch, fromForm, toForm } from "../../web/src/goals/itemForm.ts"
import { undoFor } from "../../web/src/goals/undo.ts"
import { applyOp, type Op } from "../../src/core/ops.ts"
import type { GoalsFile } from "../../src/core/schema.ts"
import { alpha, item } from "./helpers.tsx"

describe("formatForAgent", () => {
    it("writes id: title, then the body, items split by a blank line", () => {
        const items = [item("a", 1, "First", { body: "Line one\nLine two" }), item("b", 1, "Second"), item("c", 1, "Third", { body: "" })]
        expect(formatForAgent(items)).toBe("a: First\nLine one\nLine two\n\nb: Second\n\nc: Third")
        expect(formatForAgent([])).toBe("")
    })
})

describe("groupItems", () => {
    it("keeps file order and marks sections without open items closed", () => {
        const groups = groupItems(alpha(), NO_FILTERS)
        expect(groups.map((g) => [g.section.n, g.items.map((i) => i.id), g.closed])).toEqual([
            [1, ["one-device", "audio-profiles", "queue-snapshots"], false],
            [2, ["smart-playlists"], false],
            [3, [], true],
            [4, [], true],
        ])
    })
})

describe("item form", () => {
    it("round-trips an item without a diff", () => {
        const one = alpha().items[0]
        expect(diffPatch(one, toForm(one, 1))).toEqual({})
    })

    it("drops empty optional fields from a new item", () => {
        const form = { ...toForm(undefined, 2), title: " New " }
        expect(fromForm(form)).toEqual({ title: "New", section: 2, phase: "next", status: "planned" })
    })
})

describe("isFinished", () => {
    it("needs something done and nothing committed open, ignores maybes, never on error", () => {
        expect(isFinished({ done: 3, open: 0, phases: {} })).toBe(true)
        expect(isFinished({ done: 3, open: 2, phases: { maybe: 2 } })).toBe(true)
        expect(isFinished({ done: 3, open: 1, phases: { later: 1 } })).toBe(false)
        expect(isFinished({ done: 0, open: 0, phases: {} })).toBe(false)
        expect(isFinished({ done: 3, open: 0, phases: {}, error: "bad json" })).toBe(false)
    })
})

describe("ago", () => {
    it("counts local days and rounds to days, weeks, then months", () => {
        const now = new Date(2026, 10, 2, 23, 30)
        expect(daysSince("2026-11-02", now)).toBe(0)
        expect(daysSince("2026-11-09", now)).toBe(0)
        expect(["2026-11-02", "2026-11-01", "2026-10-26", "2026-10-19", "2026-08-01"].map((d) => ago(d, now))).toEqual([
            "today",
            "yesterday",
            "7d ago",
            "2w ago",
            "3mo ago",
        ])
    })
})

describe("undoFor", () => {
    const strip = (f: GoalsFile) => f.items.map(({ updated: _, ...rest }) => rest)
    const ops: Op[] = [
        { op: "done", id: "audio-profiles", note: "ok" },
        { op: "drop", id: "one-device", reason: "nah" },
        { op: "reopen", id: "folder-browse" },
        { op: "edit", id: "smart-playlists", patch: { phase: "now", size: null } },
        { op: "edit", id: "one-device", patch: { section: 2 } },
        { op: "move", id: "audio-profiles", after: "queue-snapshots" },
        { op: "move", id: "one-device", before: "folder-browse" },
        { op: "delete", id: "audio-profiles" },
        { op: "delete", id: "one-device" },
    ]
    const undone = (before: GoalsFile, op: Op) => undoFor(before, op)!.ops.reduce((f, o) => applyOp(f, o, "2030-01-01"), applyOp(before, op, "2030-01-01"))
    it.each(ops)("restores the file after $op $id", (op) => {
        const before = alpha()
        expect(strip(undone(before, op))).toEqual(strip(before))
    })

    it("puts an item that was alone in its section back before the next section", () => {
        const before = alpha()
        before.items = before.items.filter((i) => i.id !== "folder-browse")
        for (const op of [{ op: "delete", id: "smart-playlists" }, { op: "move", id: "smart-playlists", section: 1 }] as Op[]) {
            expect(strip(undone(before, op))).toEqual(strip(before))
        }
    })

    it("skips section ops and unknown items", () => {
        expect(undoFor(alpha(), { op: "addSection", title: "x" })).toBeNull()
        expect(undoFor(alpha(), { op: "delete", id: "ghost" })).toBeNull()
    })
})
