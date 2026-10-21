// @vitest-environment jsdom
import { isFinished } from "../../web/src/goals/counts.ts"
import { formatForAgent } from "../../web/src/goals/format.ts"
import { NO_FILTERS, groupItems } from "../../web/src/goals/filters.ts"
import { diffPatch, fromForm, toForm } from "../../web/src/goals/itemForm.ts"
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
