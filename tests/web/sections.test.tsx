// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react"
import type userEvent from "@testing-library/user-event"
import { pick, setup, waitForRows } from "./helpers.tsx"

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

type User = ReturnType<typeof userEvent.setup>

async function sectionMenu(user: User, title: string) {
    await user.click(screen.getByRole("button", { name: `Actions for section ${title}` }))
    return screen.findByRole("menu")
}

const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)

describe("sections", () => {
    it("adds a section", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await user.click(screen.getByRole("button", { name: "Add section" }))
        const prompt = within(await screen.findByRole("dialog", { name: "New section" }))
        await user.type(prompt.getByRole("textbox"), "Stats{Enter}")
        await waitFor(() => expect(server.ops).toEqual([{ op: "addSection", title: "Stats" }]))
        expect(await screen.findByRole("heading", { name: "Stats" })).toBeInTheDocument()
    })

    it("renames a section", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await sectionMenu(user, "Library")
        await pick(user, "Rename")
        const input = within(await screen.findByRole("dialog", { name: "Rename §2" })).getByRole("textbox")
        expect(input).toHaveValue("Library")
        await user.clear(input)
        await user.type(input, "Library & Content{Enter}")
        await waitFor(() => expect(server.ops).toEqual([{ op: "renameSection", n: 2, title: "Library & Content" }]))
        expect(await screen.findByRole("heading", { name: "Library & Content" })).toBeInTheDocument()
    })

    it("moves a section up and down", async () => {
        const { user, server } = await setup()
        await waitForRows()
        const menu = await sectionMenu(user, "Playback")
        expect(within(menu).getByRole("menuitem", { name: "Move section up" })).toBeDisabled()
        await pick(user, "Move section down")
        await waitFor(() => expect(server.ops).toEqual([{ op: "moveSection", n: 1, before: 3 }]))
        await waitFor(() => expect(headings()).toEqual(["Library", "Playback", "Old stuff", "Empty"]))

        await sectionMenu(user, "Empty")
        await pick(user, "Move section up")
        await waitFor(() => expect(server.ops[1]).toEqual({ op: "moveSection", n: 4, before: 3 }))

        await sectionMenu(user, "Playback")
        await pick(user, "Move section down")
        await waitFor(() => expect(server.ops[2]).toEqual({ op: "moveSection", n: 1, before: 3 }))
        await waitFor(() => expect(headings()).toEqual(["Library", "Empty", "Playback", "Old stuff"]))
    })

    it("moves the second-last section to the end with before null", async () => {
        const { user, server } = await setup()
        await waitForRows()
        await sectionMenu(user, "Old stuff")
        await pick(user, "Move section down")
        await waitFor(() => expect(server.ops).toEqual([{ op: "moveSection", n: 3, before: null }]))
    })

    it("only offers delete for a section without items, and confirms it", async () => {
        const { user, server } = await setup()
        await waitForRows()
        const menu = await sectionMenu(user, "Old stuff")
        expect(within(menu).queryByRole("menuitem", { name: "Delete section" })).toBeNull()
        await user.keyboard("{Escape}")

        await sectionMenu(user, "Empty")
        await pick(user, "Delete section")
        const confirm = within(await screen.findByRole("alertdialog", { name: 'Delete section "Empty"?' }))
        await user.click(confirm.getByRole("button", { name: "Delete" }))
        await waitFor(() => expect(server.ops).toEqual([{ op: "deleteSection", n: 4 }]))
        await waitFor(() => expect(screen.queryByRole("heading", { name: "Empty" })).toBeNull())
    })

    it("adds an item straight into a section", async () => {
        const { user } = await setup()
        await waitForRows()
        await sectionMenu(user, "Library")
        await pick(user, "Add item here")
        const dialog = await screen.findByRole("dialog", { name: "Add item" })
        expect(within(dialog).getByLabelText("Section")).toHaveValue("2")
    })
})
