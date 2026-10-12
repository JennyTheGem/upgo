// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react"
import type { GoalsFile } from "../../src/core/schema.ts"
import { item, row, rowIds, setup } from "./helpers.tsx"

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
})

const COUNT = 400
const ROW = 48

function big(): GoalsFile {
    return {
        version: 1,
        project: "big",
        sections: [{ n: 1, title: "Everything" }],
        traps: [],
        items: Array.from({ length: COUNT }, (_, i) => item(`item-${i}`, 1, `Item ${i}`)),
    }
}

const list = () => document.querySelector<HTMLElement>(".itemList")!
const index = (id: string | null) => Number(id?.slice(5))

// jsdom has no layout: fake the list sitting `scrolled` px above the viewport, then fire a scroll.
function scrollTo(scrolled: number) {
    vi.spyOn(HTMLUListElement.prototype, "getBoundingClientRect").mockReturnValue({ top: -scrolled } as DOMRect)
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(COUNT * ROW)
    act(() => {
        window.dispatchEvent(new Event("scroll"))
    })
}

async function open() {
    const view = await setup({ big: { path: "E:/work/big", file: big() } })
    await screen.findByRole("heading", { name: "Everything" })
    return view
}

describe("virtualized rows", () => {
    it("mounts only the rows near the viewport and pads for the rest", async () => {
        await open()
        const ids = rowIds()
        expect(ids[0]).toBe("item-0")
        expect(ids.length).toBeGreaterThan(10)
        expect(ids.length).toBeLessThan(60)
        expect(list().style.paddingTop).toBe("0px")
        expect(list().style.paddingBottom).toBe(`${(COUNT - ids.length) * ROW}px`)
    })

    it("follows the scroll", async () => {
        await open()
        scrollTo(10_000)
        const ids = rowIds()
        expect(ids.length).toBeLessThan(60)
        const first = index(ids[0])
        expect(first).toBeGreaterThan(150)
        expect(first).toBeLessThan(10_000 / ROW)
        expect(index(ids.at(-1)!)).toBeGreaterThan(10_000 / ROW + 768 / ROW)
        expect(list().style.paddingTop).toBe(`${first * ROW}px`)

        scrollTo(COUNT * ROW)
        expect(rowIds().at(-1)).toBe("item-399")
        expect(list().style.paddingBottom).toBe("0px")
    })

    it("keeps a dragged row in the DOM, hidden, after it scrolls away", async () => {
        await open()
        fireEvent.dragStart(row("item-0").querySelector(".itemDrag")!)
        scrollTo(10_000)
        expect(row("item-0")).toBeInTheDocument()
        expect(row("item-0")).not.toBeVisible()
        expect(rowIds().length).toBeLessThan(60)
        fireEvent.dragEnd(row("item-0").querySelector(".itemDrag")!)
        expect(document.querySelector('[data-item-id="item-0"]')).toBeNull()
    })

    it("search reaches rows that were never mounted", async () => {
        const { user } = await open()
        expect(document.querySelector('[data-item-id="item-399"]')).toBeNull()
        await user.type(screen.getByRole("textbox", { name: "Search items" }), "Item 399")
        expect(rowIds()).toEqual(["item-399"])
    })
})
