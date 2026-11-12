// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react"
import { openMenu, pick, row, setup, waitForRows } from "./helpers.tsx"

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

const check = (id: string) => within(row(id)).getByRole("checkbox")

describe("copy to agent", () => {
    it("copies the selected items in file order", async () => {
        const { user } = await setup()
        await waitForRows()
        const writeText = vi.spyOn(navigator.clipboard, "writeText")
        await user.click(check("smart-playlists"))
        await user.click(check("one-device"))
        const bar = screen.getByRole("toolbar", { name: "Selection" })
        expect(within(bar).getByText("2 selected")).toBeInTheDocument()

        await user.click(within(bar).getByRole("button", { name: "Copy" }))
        expect(writeText).toHaveBeenCalledWith("one-device: One playing device\nOnly one device plays at a time.\n\nsmart-playlists: Smart playlists\nVariety caps.\nTemplates.")
        expect(await screen.findByRole("status")).toHaveTextContent("Copied 2 items")

        await user.click(within(bar).getByRole("button", { name: "Clear selection" }))
        expect(screen.queryByRole("toolbar")).toBeNull()
    })

    it("copies the selection wrapped in a prompt", async () => {
        const { user } = await setup()
        await waitForRows()
        const writeText = vi.spyOn(navigator.clipboard, "writeText")
        await user.click(check("queue-snapshots"))
        await user.click(within(screen.getByRole("toolbar")).getByRole("button", { name: "Copy as" }))
        await pick(user, "Review")
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Review the work[^\n]*\n\nqueue-snapshots: Queue snapshots$/)))
    })

    it("selects a range with Shift-click", async () => {
        const { user } = await setup()
        await waitForRows()
        await user.click(check("one-device"))
        await user.keyboard("{Shift>}")
        await user.click(check("smart-playlists"))
        await user.keyboard("{/Shift}")
        expect(within(screen.getByRole("toolbar")).getByText("4 selected")).toBeInTheDocument()
    })

    it("copies one item from its menu", async () => {
        const { user } = await setup()
        await waitForRows()
        const writeText = vi.spyOn(navigator.clipboard, "writeText")
        await openMenu(user, "Queue snapshots")
        await pick(user, "Copy for agent")
        await waitFor(() => expect(writeText).toHaveBeenCalledWith("queue-snapshots: Queue snapshots"))
    })
})
