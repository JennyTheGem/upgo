import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import App from "../../web/src/App.tsx"
import { applyOp, opSchema } from "../../src/core/ops.ts"
import { formatIssues, type GoalsFile, type Item, type Suggestion } from "../../src/core/schema.ts"
import { summarize } from "../../src/core/summary.ts"
import { localIssues } from "../../src/core/rules.ts"

export type FakeProject = { path: string; file?: GoalsFile; suggestions?: Suggestion[]; suggestionsError?: string; error?: string; details?: Record<string, string> }

export const DAY = "2026-10-12"

export function item(id: string, section: number, title: string, rest: Partial<Item> = {}): Item {
    return { id, section, title, phase: "next", status: "planned", created: DAY, updated: DAY, ...rest }
}

export function alpha(): GoalsFile {
    return {
        version: 1,
        project: "alpha",
        purpose: "Alpha keeps the music playing.",
        sections: [
            { n: 1, title: "Playback" },
            { n: 2, title: "Library" },
            { n: 3, title: "Old stuff" },
            { n: 4, title: "Empty" },
        ],
        traps: [{ id: "backdrop-root", title: "Backdrop root", body: "Never fade a wrapper around a surface." }],
        items: [
            item("one-device", 1, "One playing device", {
                phase: "later",
                size: "M",
                scope: ["all"],
                body: "Only one device plays at a time.",
                pointers: { files: ["audioEngine.ts", "controller.ts"], seam: ["playbackService"] },
                detail: "docs/goalsDetails/one-device.md",
                related: ["velora-backend:devices"],
            }),
            item("audio-profiles", 1, "Audio profiles", { phase: "now", status: "partial", size: "S", scope: ["desktop"] }),
            item("queue-snapshots", 1, "Queue snapshots", { phase: "wayLater" }),
            item("smart-playlists", 2, "Smart playlists", { phase: "next", size: "L", scope: ["all"], body: "Variety caps.\nTemplates." }),
            item("folder-browse", 2, "Folder browse", { phase: "later", status: "done", note: "shipped" }),
            item("old-thing", 3, "Old thing", { phase: "later", status: "dropped", note: "not needed" }),
        ],
    }
}

export function beta(): GoalsFile {
    return {
        version: 1,
        project: "beta",
        sections: [{ n: 1, title: "Core" }],
        traps: [],
        items: [item("beta-thing", 1, "Beta thing", { phase: "now" })],
    }
}

export function projects(): Record<string, FakeProject> {
    return {
        alpha: { path: "E:/work/alpha", file: alpha(), details: { "one-device": "# One device\n\nThe long plan." } },
        beta: { path: "E:/work/beta", file: beta() },
        broken: { path: "E:/work/broken", error: "goals.json: items.0.phase is invalid" },
    }
}

type Reply = { ok: boolean; status: number; statusText: string; json: () => Promise<unknown> }
const reply = (status: number, body: unknown): Reply => ({ ok: status < 400, status, statusText: "", json: async () => structuredClone(body) })

// An in-memory upgo server: the real core applies and validates every op.
export function fakeServer(initial: Record<string, FakeProject>) {
    const state = structuredClone(initial)
    const ops: unknown[] = []
    const headers: Record<string, string>[] = []
    let rejection: string | null = null

    const summary = (id: string, p: FakeProject) =>
        p.file ? { id, path: p.path, ...summarize(p.file) } : { id, path: p.path, open: 0, done: 0, dropped: 0, percent: 0, phases: {}, now: [], next: [], recent: [], error: p.error }

    const handle = async (url: string, init?: RequestInit): Promise<Reply> => {
        if (url === "/api/projects") return reply(200, { projects: Object.entries(state).map(([id, p]) => summary(id, p)) })
        const m = url.match(/^\/api\/projects\/([^/]+)(?:\/(ops)|\/detail\/(.+)|\/(suggestions))?$/)
        const id = m && decodeURIComponent(m[1])
        const p = id ? state[id] : undefined
        if (!m || !id || !p) return reply(404, { error: "not found" })
        if (init?.method === "DELETE") {
            headers.push(init.headers as Record<string, string>)
            delete state[id]
            return reply(200, { id })
        }
        if (m[4]) {
            const { dismiss } = JSON.parse(String(init?.body))
            ops.push({ dismiss })
            p.suggestions = (p.suggestions ?? []).filter((s) => !dismiss.includes(s.id))
            return reply(200, { suggestions: p.suggestions })
        }
        if (m[2]) {
            const op = JSON.parse(String(init?.body))
            ops.push(op)
            headers.push(init?.headers as Record<string, string>)
            if (rejection) {
                const error = rejection
                rejection = null
                return reply(400, { error })
            }
            const parsed = opSchema.safeParse(op)
            if (!parsed.success) return reply(400, { error: "invalid op", details: formatIssues(parsed.error) })
            try {
                const next = applyOp(p.file!, parsed.data, DAY)
                const issues = localIssues(next)
                if (issues.length) return reply(400, { error: "invalid file", details: issues })
                p.file = next
                return reply(200, { file: next })
            } catch (e) {
                return reply(400, { error: (e as Error).message })
            }
        }
        if (m[3]) {
            const text = p.details?.[decodeURIComponent(m[3])]
            return text === undefined ? reply(404, { error: "no detail file" }) : reply(200, { path: `${p.path}/detail.md`, text })
        }
        if (p.error) return reply(500, { error: p.error })
        return reply(200, { id, path: p.path, file: p.file, suggestions: p.suggestions ?? [], suggestionsError: p.suggestionsError })
    }

    const fetch = vi.fn(handle)
    vi.stubGlobal("fetch", fetch)
    return {
        state,
        ops,
        headers,
        fetch,
        rejectNext: (error: string) => {
            rejection = error
        },
        calls: (url: string) => fetch.mock.calls.filter(([u]) => u === url).length,
    }
}

type Listener = (e: { data: string }) => void

export class FakeEventSource {
    static instances: FakeEventSource[] = []
    readonly url: string
    closed = false
    private listeners = new Map<string, Set<Listener>>()

    constructor(url: string) {
        this.url = url
        FakeEventSource.instances.push(this)
    }

    addEventListener(type: string, listener: Listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set())
        this.listeners.get(type)!.add(listener)
    }

    close() {
        this.closed = true
    }

    static emit(type: string, data: unknown) {
        for (const s of FakeEventSource.instances) {
            if (!s.closed) s.listeners.get(type)?.forEach((l) => l({ data: JSON.stringify(data) }))
        }
    }
}

export async function setup(initial = projects()) {
    const server = fakeServer(initial)
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
    const user = userEvent.setup()
    const view = render(<App />)
    await screen.findByRole("navigation", { name: "Projects" })
    return { server, user, ...view }
}

// Ids of the rows on screen, in order.
export const rowIds = () => Array.from(document.querySelectorAll("[data-item-id]")).map((el) => el.getAttribute("data-item-id"))

export const row = (id: string) => document.querySelector<HTMLElement>(`[data-item-id="${id}"]`)!

export const toggleOf = (id: string) => row(id).querySelector<HTMLElement>(".itemRowToggle")!

export async function waitForRows() {
    await screen.findByRole("heading", { name: "Playback" })
}

// Opens a row's menu from its "more" button.
export async function openMenu(user: ReturnType<typeof userEvent.setup>, title: string) {
    await user.click(screen.getByRole("button", { name: `Actions for ${title}` }))
    return screen.findByRole("menu")
}

export async function pick(user: ReturnType<typeof userEvent.setup>, ...labels: string[]) {
    for (const label of labels) await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: label }))
}

export const emit = (type: string, data: unknown) => act(() => FakeEventSource.emit(type, data))
