// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { openMenu, pick, row, rowIds, setup, toggleOf, waitForRows } from "./helpers.tsx"

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

const chips = (id: string) => Array.from(row(id).querySelectorAll(".chip")).map((c) => c.textContent)

describe("add and edit", () => {
    it("adds an item through the modal", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: "Add item" }))
        const dialog = await screen.findByRole("dialog", { name: "Add item" })
        const d = within(dialog)
        await user.type(d.getByLabelText("Title"), "  Lyrics offset ")
        await user.selectOptions(d.getByLabelText("Section"), "2")
        await user.selectOptions(d.getByLabelText("Phase"), "now")
        await user.selectOptions(d.getByLabelText("Size"), "S")
        await user.type(d.getByLabelText("Scope"), "all, web")
        await user.type(d.getByLabelText("Related"), "beta:beta-thing")
        await user.type(d.getByLabelText("Body"), "Nudge lyrics.")
        await user.type(d.getByLabelText("files"), "a.ts{Enter}b.ts{Enter}")
        await user.click(d.getByRole("button", { name: "Add item" }))

        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        expect(server.ops).toEqual([
            {
                op: "add",
                item: {
                    title: "Lyrics offset",
                    section: 2,
                    phase: "now",
                    status: "planned",
                    size: "S",
                    scope: ["all", "web"],
                    body: "Nudge lyrics.",
                    related: ["beta:beta-thing"],
                    pointers: { files: ["a.ts", "b.ts"] },
                },
            },
        ])
        expect(server.headers[0]).toMatchObject({ "Content-Type": "application/json", "X-Upgo": "1" })
        expect(rowIds()).toContain("lyrics-offset")
    })

    it("edits by sending only the changed fields, null for cleared ones", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "One playing device")
        await pick(user, "Edit")
        const d = within(await screen.findByRole("dialog", { name: "Edit one-device" }))
        expect(d.getByLabelText("Title")).toHaveValue("One playing device")
        await user.clear(d.getByLabelText("Title"))
        await user.type(d.getByLabelText("Title"), "One active device")
        await user.selectOptions(d.getByLabelText("Size"), "")
        await user.clear(d.getByLabelText("Scope"))
        await user.clear(d.getByLabelText("seam"))
        await user.click(d.getByRole("button", { name: "Save" }))

        await waitFor(() => expect(server.ops).toHaveLength(1))
        expect(server.ops[0]).toEqual({
            op: "edit",
            id: "one-device",
            patch: { title: "One active device", size: null, scope: null, pointers: { files: ["audioEngine.ts", "controller.ts"] } },
        })
        expect(await screen.findByText("One active device")).toBeInTheDocument()
    })

    it("closes without a request when nothing changed", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "Smart playlists")
        await pick(user, "Edit")
        await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save" }))
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        expect(server.ops).toEqual([])
    })
})

describe("row actions", () => {
    it("changes the phase", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "Queue snapshots")
        await pick(user, "Phase", "now")
        expect(server.ops).toEqual([{ op: "edit", id: "queue-snapshots", patch: { phase: "now" } }])
        await waitFor(() => expect(chips("queue-snapshots")).toEqual(["now"]))
    })

    it("changes the status", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "Queue snapshots")
        await pick(user, "Status", "partial")
        expect(server.ops).toEqual([{ op: "edit", id: "queue-snapshots", patch: { status: "partial" } }])
        await waitFor(() => expect(chips("queue-snapshots")).toContain("partial"))
    })

    it("marks done with an optional note", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "Queue snapshots")
        await pick(user, "Mark done")
        const prompt = within(await screen.findByRole("dialog", { name: 'Mark "Queue snapshots" done' }))
        await user.type(prompt.getByRole("textbox"), "shipped in 2.1")
        await user.click(prompt.getByRole("button", { name: "Mark done" }))
        await waitFor(() => expect(server.ops).toEqual([{ op: "done", id: "queue-snapshots", note: "shipped in 2.1" }]))
        await waitFor(() => expect(rowIds()).not.toContain("queue-snapshots"))

        await openMenu(user, "Audio profiles")
        await pick(user, "Mark done")
        await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Mark done" }))
        await waitFor(() => expect(server.ops[1]).toEqual({ op: "done", id: "audio-profiles" }))
    })

    it("asks for a reason before dropping, and cancel sends nothing", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "Queue snapshots")
        await pick(user, "Drop")
        let prompt = within(await screen.findByRole("dialog", { name: 'Drop "Queue snapshots"' }))
        expect(prompt.getByRole("button", { name: "Drop" })).toBeDisabled()
        await user.click(prompt.getByRole("button", { name: "Cancel" }))
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        expect(server.ops).toEqual([])

        await openMenu(user, "Queue snapshots")
        await pick(user, "Drop")
        prompt = within(await screen.findByRole("dialog"))
        await user.type(prompt.getByRole("textbox"), "a playlist does this{Enter}")
        await waitFor(() => expect(server.ops).toEqual([{ op: "drop", id: "queue-snapshots", reason: "a playlist does this" }]))
    })

    it("asks for confirmation before deleting", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "Queue snapshots")
        await pick(user, "Delete")
        let confirm = within(await screen.findByRole("alertdialog", { name: 'Delete "Queue snapshots"?' }))
        await user.click(confirm.getByRole("button", { name: "Cancel" }))
        expect(server.ops).toEqual([])
        expect(rowIds()).toContain("queue-snapshots")

        await openMenu(user, "Queue snapshots")
        await pick(user, "Delete")
        confirm = within(await screen.findByRole("alertdialog"))
        await user.click(confirm.getByRole("button", { name: "Delete" }))
        await waitFor(() => expect(server.ops).toEqual([{ op: "delete", id: "queue-snapshots" }]))
        await waitFor(() => expect(rowIds()).not.toContain("queue-snapshots"))
    })

    it("reopens a done item", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: "Show done/dropped" }))
        await openMenu(user, "Folder browse")
        expect(screen.queryByRole("menuitem", { name: "Mark done" })).toBeNull()
        await pick(user, "Reopen")
        expect(server.ops).toEqual([{ op: "reopen", id: "folder-browse" }])
        await waitFor(() => expect(chips("folder-browse")).not.toContain("done"))
    })

    it("opens the same menu on right-click", async () => {
        await setup()
        await waitForRows()
        fireEvent.contextMenu(row("smart-playlists"), { clientX: 40, clientY: 40 })
        expect(await screen.findByRole("menuitem", { name: "Copy for agent" })).toBeInTheDocument()
    })

    it("navigates the menu with the keyboard", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await openMenu(user, "Queue snapshots")
        expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus()
        await user.keyboard("{ArrowDown}")
        expect(screen.getByRole("menuitem", { name: "Phase" })).toHaveFocus()
        await user.keyboard("{ArrowRight}")
        expect(screen.getByRole("menuitem", { name: "now" })).toHaveFocus()
        await user.keyboard("{ArrowDown}{Enter}")
        expect(server.ops).toEqual([{ op: "edit", id: "queue-snapshots", patch: { phase: "next" } }])
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
    })

    it("hands focus back to the opener when the menu closes", async () => {
        const { user } = await setup()
        await waitForRows()
        await openMenu(user, "Queue snapshots")
        await user.keyboard("{Escape}")
        expect(screen.queryByRole("menu")).toBeNull()
        expect(screen.getByRole("button", { name: "Actions for Queue snapshots" })).toHaveFocus()
    })

    it("reverts an optimistic change and shows the error when the server refuses", async () => {
        const { user, server } = await setup()
        await waitForRows()
        server.rejectNext("goals.json is locked by another writer")
        await openMenu(user, "Queue snapshots")
        await pick(user, "Phase", "now")
        expect(await screen.findByRole("alert")).toHaveTextContent("goals.json is locked by another writer")
        await waitFor(() => expect(chips("queue-snapshots")).toEqual(["way later"]))
    })

    it("a late failure does not undo a later change that already landed", async () => {
        const { user, server } = await setup()
        await waitForRows()
        let fail!: () => void
        server.fetch.mockImplementationOnce(
            () => new Promise((r) => (fail = () => r({ ok: false, status: 400, statusText: "", json: async () => ({ error: "locked" }) }))),
        )
        await openMenu(user, "Queue snapshots")
        await pick(user, "Phase", "now")
        await openMenu(user, "Smart playlists")
        await pick(user, "Phase", "maybe")
        await waitFor(() => expect(chips("smart-playlists")[0]).toBe("maybe"))
        await act(async () => fail())
        expect(await screen.findByRole("alert")).toHaveTextContent("locked")
        await waitFor(() => expect(chips("queue-snapshots")).toEqual(["way later"]))
        expect(chips("smart-playlists")[0]).toBe("maybe")
    })
})

describe("expanded row", () => {
    it("shows body, pointers, related, dates and the detail file", async () => {
        const { user } = await setup()
        await waitForRows()
        await user.click(toggleOf("one-device"))
        expect(toggleOf("one-device")).toHaveAttribute("aria-expanded", "true")
        const r = within(row("one-device"))
        expect(r.getByText("Only one device plays at a time.")).toBeInTheDocument()
        expect(r.getByText("audioEngine.ts")).toBeInTheDocument()
        expect(r.getByText("playbackService")).toBeInTheDocument()
        expect(r.getByText("velora-backend:devices")).toBeInTheDocument()
        expect(r.getByText(/Created 2026-10-12/)).toBeInTheDocument()

        await user.click(r.getByRole("button", { name: "Show detail file" }))
        expect(await r.findByRole("region", { name: /Detail file/ })).toHaveTextContent("The long plan.")
    })

    it("reports a missing detail file", async () => {
        const { user, server } = await setup()
        await waitForRows()
        delete server.state.alpha.details
        await user.click(toggleOf("one-device"))
        await user.click(screen.getByRole("button", { name: "Show detail file" }))
        expect(await screen.findByRole("alert")).toHaveTextContent("no detail file")
    })
})
