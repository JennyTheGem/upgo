// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react"
import { render } from "@testing-library/react"
import App from "../../web/src/App.tsx"
import { emit, rowIds, setup, toggleOf, waitForRows } from "./helpers.tsx"

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
