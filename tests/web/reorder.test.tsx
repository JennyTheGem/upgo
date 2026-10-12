// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { openMenu, pick, row, rowIds, setup, toggleOf, waitForRows } from "./helpers.tsx"

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

// jsdom has no DataTransfer; own properties are what testing-library copies onto the event.
function dataTransfer() {
    const data: Record<string, string> = {}
    return {
        dropEffect: "none",
        effectAllowed: "all",
        setData: (type: string, value: string) => {
            data[type] = value
        },
        getData: (type: string) => data[type] ?? "",
        setDragImage: () => {},
    }
}

function drag(id: string, target: Element) {
    const dt = dataTransfer()
    fireEvent.dragStart(row(id).querySelector(".itemDrag")!, { dataTransfer: dt })
    fireEvent.dragOver(target, { dataTransfer: dt })
    fireEvent.drop(target, { dataTransfer: dt })
    fireEvent.dragEnd(row(id).querySelector(".itemDrag")!, { dataTransfer: dt })
}

describe("keyboard reorder", () => {
    it("moves with Alt+ArrowUp and Alt+ArrowDown and keeps focus on the row", async () => {
        const { user, server } = await setup()
        await waitForRows()
        toggleOf("one-device").focus()
        await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
        expect(server.ops).toEqual([{ op: "move", id: "one-device", after: "audio-profiles" }])
        await waitFor(() => expect(rowIds().slice(0, 3)).toEqual(["audio-profiles", "one-device", "queue-snapshots"]))
        await waitFor(() => expect(toggleOf("one-device")).toHaveFocus())

        await user.keyboard("{Alt>}{ArrowUp}{/Alt}")
        expect(server.ops[1]).toEqual({ op: "move", id: "one-device", before: "audio-profiles" })
    })

    it("stops at the edge of the section", async () => {
        const { user, server } = await setup()
        await waitForRows()
        toggleOf("one-device").focus()
        await user.keyboard("{Alt>}{ArrowUp}{/Alt}")
        toggleOf("smart-playlists").focus()
        await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
        expect(server.ops).toEqual([])
    })

    it("skips neighbors the filters hide", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: /^Phase/ }))
        await user.click(await screen.findByRole("menuitemcheckbox", { name: "later" }))
        await user.click(screen.getByRole("menuitemcheckbox", { name: "way later" }))
        await user.keyboard("{Escape}")
        expect(rowIds()).toEqual(["one-device", "queue-snapshots"])
        toggleOf("one-device").focus()
        await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
        expect(server.ops).toEqual([{ op: "move", id: "one-device", after: "queue-snapshots" }])
    })

    it("offers move up and move down in the menu", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "One playing device")
        expect(screen.getByRole("menuitem", { name: "Move up" })).toBeDisabled()
        await pick(user, "Move down")
        expect(server.ops).toEqual([{ op: "move", id: "one-device", after: "audio-profiles" }])

        await openMenu(user, "Queue snapshots")
        await pick(user, "Move up")
        expect(server.ops[1]).toEqual({ op: "move", id: "queue-snapshots", before: "one-device" })
    })
})

describe("drag and drop", () => {
    it("drops before the row it lands on, across sections too", async () => {
        const { server } = await setup()
        await waitForRows()
        drag("queue-snapshots", row("one-device"))
        expect(server.ops).toEqual([{ op: "move", id: "queue-snapshots", before: "one-device" }])
        await waitFor(() => expect(rowIds()[0]).toBe("queue-snapshots"))

        drag("one-device", row("smart-playlists"))
        expect(server.ops[1]).toEqual({ op: "move", id: "one-device", before: "smart-playlists" })
    })

    it("drops at the end of a section from its header", async () => {
        const { server } = await setup()
        await waitForRows()
        drag("one-device", screen.getByRole("heading", { name: "Library" }))
        expect(server.ops).toEqual([{ op: "move", id: "one-device", section: 2 }])
        await waitFor(() => expect(rowIds()).toEqual(["audio-profiles", "queue-snapshots", "smart-playlists", "one-device"]))
    })

    it("drops into an empty section", async () => {
        const { server } = await setup()
        await waitForRows()
        drag("smart-playlists", screen.getByRole("region", { name: "Section 4: Empty" }))
        expect(server.ops).toEqual([{ op: "move", id: "smart-playlists", section: 4 }])
    })

    it("ignores a drop on the dragged row itself", async () => {
        const { server } = await setup()
        await waitForRows()
        drag("one-device", row("one-device"))
        expect(server.ops).toEqual([])
    })
})
