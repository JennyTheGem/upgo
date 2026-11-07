// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react"
import type userEvent from "@testing-library/user-event"
import { today } from "../../src/core/util.ts"
import { DAY, projects, setup, waitForRows } from "./helpers.tsx"

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

type User = ReturnType<typeof userEvent.setup>

function withSuggestions() {
    const initial = projects()
    initial.alpha.suggestions = [
        { id: "dark-mode", title: "Dark mode", body: "Users asked twice.", created: DAY },
        { id: "offline", title: "Offline cache", section: 2, size: "M", related: ["alpha:one-device"], created: DAY },
    ]
    return initial
}

async function openTab(user: User) {
    await waitForRows()
    await user.click(screen.getByRole("tab", { name: /Suggestions/ }))
    return screen.findByRole("region", { name: "Suggestions" })
}

const tick = (title: string) => screen.getByRole("checkbox", { name: `Select ${title}` })
const bar = () => screen.getByRole("toolbar", { name: "Selection" })

describe("suggestions tab", () => {
    it("switches between goals and suggestions", async () => {
        const { user } = await setup(withSuggestions())
        await waitForRows()
        const tab = screen.getByRole("tab", { name: "Suggestions (2)" })
        expect(screen.getByRole("tab", { name: "Goals" })).toHaveAttribute("aria-selected", "true")
        await user.click(tab)
        expect(tab).toHaveAttribute("aria-selected", "true")
        expect(screen.queryByRole("heading", { name: "Playback" })).toBeNull()
        await user.keyboard("{ArrowLeft}")
        expect(screen.getByRole("tab", { name: "Goals" })).toHaveFocus()
        await waitForRows()
    })

    it("shows how to get suggestions when there are none", async () => {
        const { user } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("tab", { name: "Suggestions" }))
        expect(screen.getByText(/No suggestions/)).toBeInTheDocument()
    })

    it("shows a broken suggestions.json in the panel and keeps the goals", async () => {
        const initial = projects()
        initial.alpha.suggestionsError = "suggestions.json is not valid JSON: oops"
        const { user } = await setup(initial)
        await waitForRows()
        await user.click(screen.getByRole("tab", { name: "Suggestions" }))
        expect(screen.getByRole("alert")).toHaveTextContent("suggestions.json is not valid JSON: oops")
    })

    it("expands a row to show its body", async () => {
        const { user } = await setup(withSuggestions())
        const panel = await openTab(user)
        await user.click(within(panel).getByRole("button", { name: /Dark mode/, expanded: false }))
        expect(within(panel).getByText("Users asked twice.")).toBeInTheDocument()
    })

    it("copies ticked suggestions and keeps them", async () => {
        const { user } = await setup(withSuggestions())
        await openTab(user)
        const writeText = vi.spyOn(navigator.clipboard, "writeText")
        await user.click(tick("Dark mode"))
        await user.click(tick("Offline cache"))
        expect(within(bar()).getByText("2 selected")).toBeInTheDocument()
        await user.click(within(bar()).getByRole("button", { name: "Copy" }))
        expect(writeText).toHaveBeenCalledWith("dark-mode: Dark mode\nUsers asked twice.\n\noffline: Offline cache")
        expect(tick("Dark mode")).toBeInTheDocument()
    })

    it("deletes from the row button and from the bar", async () => {
        const { user, server } = await setup(withSuggestions())
        const panel = await openTab(user)
        await user.click(within(panel).getByRole("button", { name: "Delete: Offline cache" }))
        await waitFor(() => expect(within(panel).queryByText("Offline cache")).toBeNull())
        await user.click(tick("Dark mode"))
        await user.click(within(bar()).getByRole("button", { name: "Delete" }))
        expect(await screen.findByText(/No suggestions/)).toBeInTheDocument()
        expect(server.ops).toEqual([{ dismiss: ["offline"] }, { dismiss: ["dark-mode"] }])
    })

    it("drops ticked suggestions as dropped goals with a reason", async () => {
        const { user, server } = await setup(withSuggestions())
        await openTab(user)
        await user.click(tick("Dark mode"))
        await user.click(tick("Offline cache"))
        await user.click(within(bar()).getByRole("button", { name: "Drop" }))
        const dialog = await screen.findByRole("dialog", { name: "Drop 2 suggestions" })
        await user.type(within(dialog).getByRole("textbox"), "Out of scope")
        await user.click(within(dialog).getByRole("button", { name: "Drop" }))
        expect(await screen.findByText(/No suggestions/)).toBeInTheDocument()
        const dropped = server.state.alpha.file!.items.filter((i) => i.title === "Dark mode" || i.title === "Offline cache")
        expect(dropped.map((i) => [i.title, i.section, i.status, i.note])).toEqual([
            ["Dark mode", 1, "dropped", "Out of scope"],
            ["Offline cache", 2, "dropped", "Out of scope"],
        ])
        expect(dropped[0].body).toBe("Users asked twice.")
    })

    it("shows related refs as chips that open the goal", async () => {
        const { user } = await setup(withSuggestions())
        const panel = await openTab(user)
        await user.click(within(panel).getByRole("button", { name: /Offline cache/, expanded: false }))
        await user.click(within(panel).getByRole("button", { name: "alpha:one-device" }))
        expect(screen.getByRole("tab", { name: "Goals", selected: true })).toBeInTheDocument()
    })

    it("adds one suggestion to goals from its row button", async () => {
        const { user, server } = await setup(withSuggestions())
        const panel = await openTab(user)
        expect(within(panel).getByRole("region", { name: "Section 2: Library" })).toHaveTextContent("Offline cache")
        expect(within(panel).getByRole("region", { name: "No section" })).toHaveTextContent("Dark mode")
        await user.click(within(panel).getByRole("button", { name: "Add to goals: Offline cache" }))
        const dialog = await screen.findByRole("dialog", { name: "Add item" })
        expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue("Offline cache")
        await user.click(within(dialog).getByRole("button", { name: "Add item" }))
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        expect(server.state.alpha.file!.items.find((i) => i.title === "Offline cache")).toMatchObject({ section: 2, size: "M", related: ["alpha:one-device"] })
        await waitFor(() => expect(server.state.alpha.suggestions!.map((s) => s.id)).toEqual(["dark-mode"]))
    })

    it("adds ticked suggestions one by one, cancel stops", async () => {
        const { user, server } = await setup(withSuggestions())
        await openTab(user)
        await user.click(tick("Dark mode"))
        await user.click(tick("Offline cache"))
        await user.click(within(bar()).getByRole("button", { name: "Add to goals" }))

        let dialog = await screen.findByRole("dialog", { name: "Add item" })
        expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue("Dark mode")
        expect(within(dialog).getByRole("textbox", { name: "Body" })).toHaveValue("Users asked twice.")
        await user.click(within(dialog).getByRole("button", { name: "Add item" }))

        dialog = await screen.findByRole("dialog", { name: "Add item" })
        await waitFor(() => expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue("Offline cache"))
        await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        expect(server.state.alpha.file!.items.some((i) => i.title === "Dark mode")).toBe(true)
        expect(server.state.alpha.suggestions!.map((s) => s.id)).toEqual(["offline"])
    })
    it("undoes a delete, back in its old spot", async () => {
        const initial = withSuggestions()
        initial.alpha.suggestions!.push({ id: "third", title: "Third idea", section: 2, created: DAY })
        const { user, server } = await setup(initial)
        const panel = await openTab(user)
        await user.click(within(panel).getByRole("button", { name: "Delete: Offline cache" }))
        await waitFor(() => expect(within(panel).queryByText("Offline cache")).toBeNull())
        await user.click(await screen.findByRole("button", { name: "Undo" }))
        await waitFor(() => expect(server.state.alpha.suggestions!.map((s) => s.id)).toEqual(["dark-mode", "offline", "third"]))
        expect(within(panel).getByText("Offline cache")).toBeInTheDocument()
    })

    it("drops with a preset reason and undoes it", async () => {
        const { user, server } = await setup(withSuggestions())
        const panel = await openTab(user)
        await user.click(within(panel).getByRole("button", { name: "Drop: Dark mode" }))
        const dialog = await screen.findByRole("dialog", { name: 'Drop "Dark mode"' })
        await user.click(within(dialog).getByRole("button", { name: "Not worth it" }))
        expect(within(dialog).getByRole("textbox")).toHaveValue("Not worth it")
        await user.type(within(dialog).getByRole("textbox"), " yet{Enter}")
        await waitFor(() => expect(server.state.alpha.file!.items.find((i) => i.title === "Dark mode")?.note).toBe("Not worth it yet"))
        await user.click(await screen.findByRole("button", { name: "Undo" }))
        await waitFor(() => expect(server.state.alpha.suggestions!.map((s) => s.id)).toEqual(["dark-mode", "offline"]))
        expect(server.state.alpha.file!.items.some((i) => i.title === "Dark mode")).toBe(false)
    })

    it("an undo whose goal delete fails still brings the suggestion back", async () => {
        const { user, server } = await setup(withSuggestions())
        const panel = await openTab(user)
        await user.click(within(panel).getByRole("button", { name: "Drop: Dark mode" }))
        await user.type(within(await screen.findByRole("dialog")).getByRole("textbox"), "Nope{Enter}")
        await waitFor(() => expect(server.state.alpha.suggestions!.map((s) => s.id)).toEqual(["offline"]))
        server.rejectNext("server down")
        await user.click(await screen.findByRole("button", { name: "Undo" }))
        await waitFor(() => expect(server.state.alpha.suggestions!.map((s) => s.id)).toEqual(["dark-mode", "offline"]))
        expect(server.state.alpha.file!.items.some((i) => i.title === "Dark mode")).toBe(true)
    })

    it("shift+click adds straight to Later in the hinted section, no hint gets the form", async () => {
        const { user, server } = await setup(withSuggestions())
        const panel = await openTab(user)
        await user.keyboard("{Shift>}")
        await user.click(within(panel).getByRole("button", { name: "Add to goals: Offline cache" }))
        await waitFor(() => expect(server.state.alpha.file!.items.find((i) => i.title === "Offline cache")).toMatchObject({ section: 2, phase: "later", size: "M" }))
        expect(screen.queryByRole("dialog")).toBeNull()
        await user.click(within(panel).getByRole("button", { name: "Add to goals: Dark mode" }))
        await user.keyboard("{/Shift}")
        expect(await screen.findByRole("dialog", { name: "Add item" })).toBeInTheDocument()
        expect(server.state.alpha.suggestions!.map((s) => s.id)).toEqual(["dark-mode"])
    })

    it("shows the dropped goal a suggestion repeats, with its reason", async () => {
        const initial = withSuggestions()
        initial.alpha.suggestions!.push({ id: "the-old-thing", title: "The old thing", created: DAY })
        const { user } = await setup(initial)
        const panel = await openTab(user)
        const row = panel.querySelector('[data-suggestion-id="the-old-thing"]') as HTMLElement
        expect(row).toHaveTextContent("Dropped before")
        expect(row).toHaveTextContent("not needed")
        expect(panel.querySelector('[data-suggestion-id="offline"]')).not.toHaveTextContent("Dropped before")
        await user.click(within(row).getByRole("button", { name: "Old thing" }))
        expect(screen.getByRole("tab", { name: "Goals", selected: true })).toBeInTheDocument()
    })

    it("sorts newest first across sections and remembers it", async () => {
        const initial = withSuggestions()
        initial.alpha.suggestions!.push({ id: "older", title: "Older", created: "2000-01-01" }, { id: "fresh", title: "Fresh", created: today() })
        const { user } = await setup(initial)
        const panel = await openTab(user)
        const ids = () => [...panel.querySelectorAll("[data-suggestion-id]")].map((r) => r.getAttribute("data-suggestion-id"))
        await user.click(screen.getByRole("button", { name: "Newest" }))
        expect(ids()).toEqual(["fresh", "offline", "dark-mode", "older"])
        expect(within(panel).getByRole("region", { name: "Today" })).toHaveTextContent("Fresh")
        expect(within(panel).getByRole("region", { name: "Older" })).toHaveTextContent("Older")
        expect(localStorage.getItem("upgo:suggestionSort")).toBe("newest")
        await user.click(screen.getByRole("button", { name: "By section" }))
        expect(screen.getByRole("button", { name: "By section" })).toHaveAttribute("aria-pressed", "true")
    })
})
