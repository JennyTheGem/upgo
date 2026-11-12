// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { render } from "@testing-library/react"
import App from "../../web/src/App.tsx"
import { emit, item, projects, rowIds, setup, toggleOf, waitForRows } from "./helpers.tsx"

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

describe("project list", () => {
    it("lists projects with open counts and shows the first one", async () => {
        await setup()
        const nav = screen.getByRole("navigation", { name: "Projects" })
        expect(within(nav).getByRole("button", { name: /alpha/ })).toHaveAttribute("aria-current", "page")
        expect(within(nav).getByLabelText("4 open")).toBeInTheDocument()
        expect(within(nav).getByLabelText("1 open")).toBeInTheDocument()

        await waitForRows()
        expect(screen.getByText("E:/work/alpha")).toBeInTheDocument()
        expect(screen.getByText("Alpha keeps the music playing.")).toBeInTheDocument()
    })

    it("switches project and remembers the choice", async () => {
        const { user } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: /beta/ }))
        expect(await screen.findByRole("heading", { name: "Core" })).toBeInTheDocument()
        expect(rowIds()).toEqual(["beta-thing"])
        expect(localStorage.getItem("upgo:project")).toBe("beta")

        cleanup()
        render(<App />)
        expect(await screen.findByRole("heading", { name: "Core" })).toBeInTheDocument()
    })

    it("shows an unreadable project's error inline and in the view", async () => {
        const { user } = await setup()
        const broken = screen.getByRole("button", { name: /broken/ })
        expect(within(broken).getByText("goals.json: items.0.phase is invalid")).toBeInTheDocument()
        await user.click(broken)
        expect(await screen.findByRole("alert")).toHaveTextContent("goals.json: items.0.phase is invalid")
    })

    it("tells Jenny to run upgo init when nothing is registered", async () => {
        await setup({})
        expect(await screen.findByText("upgo init")).toBeInTheDocument()
        expect(screen.getByText("None registered yet.")).toBeInTheDocument()
    })

    it("related chips jump to the item, in this project or another", async () => {
        const initial = projects()
        initial.alpha.file!.items[0].related = ["alpha:folder-browse", "alpha:nope", "ghost:x", "beta:beta-thing"]
        initial.beta.file!.items[0].related = ["alpha:gone"]
        const { user } = await setup(initial)
        await waitForRows()
        await user.click(toggleOf("one-device"))
        await user.click(screen.getByRole("button", { name: "alpha:folder-browse" }))
        expect(toggleOf("folder-browse")).toHaveAttribute("aria-expanded", "true")
        await user.click(screen.getByRole("button", { name: "ghost:x" }))
        expect(await screen.findByRole("alert")).toHaveTextContent("Project ghost is not registered")
        await user.click(screen.getByRole("button", { name: "alpha:nope" }))
        expect(await screen.findByRole("alert")).toHaveTextContent("No item nope in alpha")
        await user.click(screen.getByRole("button", { name: "beta:beta-thing" }))
        expect(await screen.findByRole("heading", { name: "Core" })).toBeInTheDocument()
        expect(toggleOf("beta-thing")).toHaveAttribute("aria-expanded", "true")
        await user.click(screen.getByRole("button", { name: "alpha:gone" }))
        expect(await screen.findByText("No item gone in alpha")).toBeInTheDocument()
    })

    it("tour lists every project's now items and opens one in its project", async () => {
        const { user } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: /^Tour/ }))
        const tour = screen.getByRole("region", { name: "Tour" })
        expect(within(tour).getByRole("heading", { name: "Tour" })).toBeInTheDocument()
        expect(within(tour).getByRole("button", { name: /Beta thing/ })).toBeInTheDocument()
        expect(localStorage.getItem("upgo:project")).toBe("@tour")

        await user.click(within(tour).getByRole("button", { name: /Audio profiles/ }))
        await waitForRows()
        expect(toggleOf("audio-profiles")).toHaveAttribute("aria-expanded", "true")
        expect(within(screen.getByRole("region", { name: "Now" })).getAllByRole("listitem")).toHaveLength(1)
    })

    it("tour copies a project's now items, shows recently done and opens one", async () => {
        const { user } = await setup()
        await user.click(screen.getByRole("button", { name: /^Tour/ }))
        const tour = screen.getByRole("region", { name: "Tour" })
        await user.click(within(tour).getByRole("button", { name: "Copy alpha now items" }))
        expect(await screen.findByText("Copied audio-profiles")).toBeInTheDocument()
        expect(await navigator.clipboard.readText()).toBe("audio-profiles: Audio profiles")

        const recent = within(tour).getByRole("region", { name: "Recently done" })
        expect(within(recent).getByText("shipped")).toBeInTheDocument()
        await user.click(within(recent).getByRole("button", { name: /Folder browse/ }))
        await waitForRows()
        expect(toggleOf("folder-browse")).toHaveAttribute("aria-expanded", "true")
    })

    it("tour offers next items when nothing is in now and moves one up", async () => {
        const initial = projects()
        initial.beta.file!.items = [item("beta-thing", 1, "Beta thing", { size: "L" })]
        const { user, server } = await setup(initial)
        await user.click(screen.getByRole("button", { name: /^Tour/ }))
        const tour = screen.getByRole("region", { name: "Tour" })
        expect(within(within(tour).getByRole("region", { name: "Nothing in now" })).getByText("Beta thing")).toBeInTheDocument()
        expect(within(tour).queryByRole("button", { name: "Copy beta now items" })).toBeNull()
        await user.click(within(tour).getByRole("button", { name: "Move Beta thing to now" }))
        expect(server.ops.at(-1)).toEqual({ op: "edit", id: "beta-thing", patch: { phase: "now" } })
        expect(await within(tour).findByRole("button", { name: "Copy beta now items" })).toBeInTheDocument()
        expect(within(tour).getByRole("button", { name: /^Beta thing/ })).toHaveFocus()
    })

    it("finished projects move to their own Finished list", async () => {
        const initial = projects()
        initial.beta.file!.items = [item("beta-thing", 1, "Beta thing", { status: "done" })]
        await setup(initial)
        const nav = screen.getByRole("navigation", { name: "Projects" })
        const finished = within(nav).getByRole("list", { name: "Finished" })
        expect(within(finished).getAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringContaining("beta")])
        expect(within(within(nav).getAllByRole("list")[0]).queryByRole("button", { name: /beta/ })).toBeNull()
    })

    it("a favorite goes to the top of the list and stays a full card in the tour", async () => {
        const initial = projects()
        initial.beta.file!.items = [item("beta-thing", 1, "Beta thing")]
        const { user } = await setup(initial)
        await waitForRows()
        const nav = screen.getByRole("navigation", { name: "Projects" })
        await user.click(within(nav).getByRole("button", { name: /beta/ }))
        await user.click(await screen.findByRole("button", { name: "Favorite" }))
        expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute("aria-pressed", "true")
        expect(within(within(nav).getAllByRole("list")[0]).getAllByRole("button")[0]).toHaveTextContent("beta")
        expect(localStorage.getItem("upgo:favorites")).toBe('["beta"]')

        await user.click(within(nav).getByRole("button", { name: /^Tour/ }))
        const tour = screen.getByRole("region", { name: "Tour" })
        expect(within(tour).getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("beta")
        expect(within(tour).getByText("Nothing in now. Up next:")).toBeInTheDocument()
    })

    it("right-click on a project opens its menu: favorite, copy path, open", async () => {
        const { user } = await setup()
        await waitForRows()
        const nav = screen.getByRole("navigation", { name: "Projects" })
        fireEvent.contextMenu(within(nav).getByRole("button", { name: /beta/ }), { clientX: 40, clientY: 40 })
        await user.click(await screen.findByRole("menuitem", { name: "Favorite" }))
        expect(localStorage.getItem("upgo:favorites")).toBe('["beta"]')

        fireEvent.contextMenu(within(nav).getByRole("button", { name: /beta/ }), { clientX: 40, clientY: 40 })
        expect(await screen.findByRole("menuitem", { name: "Unfavorite" })).toBeInTheDocument()
        await user.click(screen.getByRole("menuitem", { name: "Copy path" }))
        expect(await navigator.clipboard.readText()).toBe("E:/work/beta")

        fireEvent.contextMenu(within(nav).getByRole("button", { name: /beta/ }), { clientX: 40, clientY: 40 })
        await user.click(await screen.findByRole("menuitem", { name: "Open" }))
        expect(await screen.findByRole("heading", { name: "Core" })).toBeInTheDocument()
    })

    it("removes a project after confirming, even an unreadable one", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: "Remove" }))
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }))
        expect(server.state.alpha).toBeDefined()

        await user.click(screen.getByRole("button", { name: "Remove" }))
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }))
        expect(await screen.findByRole("heading", { name: "Core" })).toBeInTheDocument()
        expect(server.state.alpha).toBeUndefined()
        expect(server.headers.at(-1)).toMatchObject({ "X-Upgo": "1" })

        await user.click(screen.getByRole("button", { name: /broken/ }))
        await user.click(await screen.findByRole("button", { name: "Remove" }))
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }))
        expect(await screen.findByRole("heading", { name: "Core" })).toBeInTheDocument()
        expect(Object.keys(server.state)).toEqual(["beta"])
    })

    it("refetches the list on a projects event", async () => {
        const { server } = await setup()
        await waitForRows()
        server.state.gamma = { path: "E:/work/gamma", file: { version: 1, project: "gamma", sections: [], traps: [], items: [] } }
        await emit("projects", {})
        expect(await screen.findByRole("button", { name: /gamma/ })).toBeInTheDocument()
    })
})

describe("project view", () => {
    it("shows traps collapsed, then their title and body", async () => {
        const { user } = await setup()
        await waitForRows()
        const toggle = screen.getByRole("button", { name: /Traps/ })
        expect(toggle).toHaveAttribute("aria-expanded", "false")
        expect(screen.queryByText("Backdrop root")).toBeNull()
        await user.click(toggle)
        expect(screen.getByText("Backdrop root")).toBeInTheDocument()
        expect(screen.getByText("Never fade a wrapper around a surface.")).toBeInTheDocument()
    })

    it("adds, edits and deletes traps, with an undo for the delete", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: "Add trap" }))
        let dialog = within(await screen.findByRole("dialog", { name: "Add trap" }))
        await user.type(dialog.getByRole("textbox", { name: "Title" }), "Hot reload lies")
        await user.click(dialog.getByRole("button", { name: "Add trap" }))
        await waitFor(() => expect(server.state.alpha.file!.traps.map((t) => t.id)).toEqual(["backdrop-root", "hot-reload-lies"]))

        await user.click(screen.getByRole("button", { name: "Edit trap Backdrop root" }))
        dialog = within(await screen.findByRole("dialog", { name: "Edit trap backdrop-root" }))
        await user.clear(dialog.getByRole("textbox", { name: "Body" }))
        await user.click(dialog.getByRole("button", { name: "Save" }))
        await waitFor(() => expect(server.state.alpha.file!.traps[0]).toEqual({ id: "backdrop-root", title: "Backdrop root" }))

        await user.click(screen.getByRole("button", { name: "Delete trap Backdrop root" }))
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }))
        await waitFor(() => expect(server.state.alpha.file!.traps.map((t) => t.id)).toEqual(["hot-reload-lies"]))
        await user.click(await screen.findByRole("button", { name: "Undo" }))
        await waitFor(() => expect(server.state.alpha.file!.traps.map((t) => t.id)).toEqual(["backdrop-root", "hot-reload-lies"]))
    })

    it("draws the burn-up on the Progress tab", async () => {
        const { user } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("tab", { name: "Progress" }))
        // alpha's items all date from DAY, so the chart runs from DAY to today; the dropped one never counts.
        expect(await screen.findByRole("img", { name: /^Burn-up from 2026-10-12 to .*: 1 of 5 done, 4 open\.$/ })).toBeInTheDocument()
    })

    it("renders sections in file order with closed ones collapsed", async () => {
        await setup()
        await waitForRows()
        const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
        expect(titles).toEqual(["Playback", "Library", "Old stuff", "Empty"])
        const old = screen.getByRole("region", { name: "Section 3: Old stuff" })
        expect(old).toHaveClass("sectionBlock--closed")
        expect(within(old).getByText("Closed")).toBeInTheDocument()
        expect(rowIds()).toEqual(["one-device", "audio-profiles", "queue-snapshots", "smart-playlists"])
    })

    it("refetches the open project on a project event and keeps expanded rows", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await user.click(toggleOf("one-device"))
        expect(screen.getByText("Only one device plays at a time.")).toBeInTheDocument()

        const file = server.state.alpha.file!
        file.items.push({ ...file.items[2], id: "from-agent", title: "Added by an agent" })
        await emit("project", { id: "beta" })
        expect(screen.queryByText("Added by an agent")).toBeNull()
        await emit("project", { id: "alpha" })
        expect(await screen.findByText("Added by an agent")).toBeInTheDocument()
        expect(screen.getByText("Only one device plays at a time.")).toBeInTheDocument()
    })
})
