// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react"
import type userEvent from "@testing-library/user-event"
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
        { id: "offline", title: "Offline cache", section: 2, size: "M", created: DAY },
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
        expect(server.state.alpha.file!.items.find((i) => i.title === "Offline cache")).toMatchObject({ section: 2, size: "M" })
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
})
