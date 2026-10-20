import type { Item } from "../src/core/schema.ts"
import { percentDone } from "../src/core/summary.ts"
import { D } from "./helpers.ts"

const item = (status: Item["status"], size?: Item["size"]): Item => ({ id: "x", section: 1, title: "X", phase: "now", status, created: D, updated: D, ...(size ? { size } : {}) })

describe("percentDone", () => {
    it("weighs by size, unsized as M, ignoring dropped", () => {
        // done L=4 of 4 + S=1 + unsized=2
        expect(percentDone([item("done", "L"), item("planned", "S"), item("partial"), item("dropped", "L")])).toBe(57)
        expect(percentDone([])).toBe(0)
    })
})
