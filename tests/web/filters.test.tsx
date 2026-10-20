// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react"
import type userEvent from "@testing-library/user-event"
import { rowIds, setup, toggleOf, waitForRows } from "./helpers.tsx"

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

type User = ReturnType<typeof userEvent.setup>

async function filter(user: User, menu: RegExp, ...options: string[]) {
    await user.click(screen.getByRole("button", { name: menu }))
    const list = await screen.findByRole("menu", { name: menu })
    for (const option of options) await user.click(within(list).getByRole("menuitemcheckbox", { name: option }))
    await user.keyboard("{Escape}")
}

const OPEN = ["one-device", "audio-profiles", "queue-snapshots", "smart-playlists"]

describe("filters", () => {
    it("shows open items only by default", async () => {
        await setup()
        await waitForRows()
        expect(rowIds()).toEqual(OPEN)
    })

    it("filters by phase", async () => {
        const { user } = await setup()
        await waitForRows()
        await filter(user, /^Phase/, "now")
        expect(rowIds()).toEqual(["audio-profiles"])
        await filter(user, /^Phase/, "way later")
        expect(rowIds()).toEqual(["audio-profiles", "queue-snapshots"])
        expect(screen.getByRole("button", { name: "Phase (2)" })).toBeInTheDocument()
    })

    it("filters by status and shows done and dropped on request", async () => {
        const { user } = await setup()
        await waitForRows()
        await filter(user, /^Status/, "partial")
        expect(rowIds()).toEqual(["audio-profiles"])

        await user.click(screen.getByRole("button", { name: "Show done/dropped" }))
        await filter(user, /^Status/, "partial", "done")
        expect(rowIds()).toEqual(["folder-browse"])

        await filter(user, /^Status/, "done")
        expect(rowIds()).toEqual([...OPEN.slice(0, 4), "folder-browse", "old-thing"])

        // Turning the toggle off drops the closed statuses again.
        await filter(user, /^Status/, "dropped")
        await user.click(screen.getByRole("button", { name: "Show done/dropped" }))
        expect(rowIds()).toEqual(OPEN)
    })

    it("filters by section", async () => {
        const { user } = await setup()
        await waitForRows()
        await filter(user, /^Section/, "§2 Library")
        expect(rowIds()).toEqual(["smart-playlists"])
        expect(screen.queryByRole("heading", { name: "Playback" })).toBeNull()
    })

    it("filters by size", async () => {
        const { user } = await setup()
        await waitForRows()
        await filter(user, /^Size/, "L", "S")
        expect(rowIds()).toEqual(["audio-profiles", "smart-playlists"])
    })

    it("filters by the scopes present in the file", async () => {
        const { user } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: /^Scope/ }))
        const options = within(await screen.findByRole("menu", { name: "Scope" })).getAllByRole("menuitemcheckbox")
        expect(options.map((o) => o.textContent)).toEqual(["all", "desktop"])
        await user.click(options[1])
        await user.keyboard("{Escape}")
        expect(rowIds()).toEqual(["audio-profiles"])
    })

    it("searches id, title, body and pointers", async () => {
        const { user } = await setup()
        await waitForRows()
        const search = screen.getByRole("textbox", { name: "Search items" })
        await user.type(search, "variety")
        expect(rowIds()).toEqual(["smart-playlists"])
        await user.clear(search)
        await user.type(search, "playbackservice")
        expect(rowIds()).toEqual(["one-device"])
        await user.clear(search)
        await user.type(search, "queue-snap")
        expect(rowIds()).toEqual(["queue-snapshots"])
        await user.clear(search)
        await user.type(search, "nothing like this")
        expect(rowIds()).toEqual([])
        expect(screen.getByText("Nothing matches these filters.")).toBeInTheDocument()
        await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0])
        expect(rowIds()).toEqual(OPEN)
    })

    it("hides closed sections while a narrowing filter finds nothing in them", async () => {
        const { user } = await setup()
        await waitForRows()
        expect(screen.getByRole("heading", { name: "Old stuff" })).toBeInTheDocument()
        await user.type(screen.getByRole("textbox", { name: "Search items" }), "audio")
        expect(screen.queryByRole("heading", { name: "Old stuff" })).toBeNull()
    })

    it("a setlist pick clears filters that hide the item, then opens and focuses it", async () => {
        const { user } = await setup()
        await waitForRows()
        await filter(user, /^Phase/, "next")
        expect(rowIds()).toEqual(["smart-playlists"])
        await user.click(within(screen.getByRole("region", { name: "Now" })).getByRole("button", { name: /Audio profiles/ }))
        expect(rowIds()).toEqual(OPEN)
        expect(toggleOf("audio-profiles")).toHaveAttribute("aria-expanded", "true")
        await waitFor(() => expect(toggleOf("audio-profiles")).toHaveFocus())
    })
})
