import type { GoalsFile, Item, Suggestion } from "../../src/core/schema.ts"
import type { Op } from "../../src/core/ops.ts"

// Every request the dashboard makes, so tests can stub `fetch` and `EventSource` in one place.

export type NowItem = { id: string; title: string; status: Item["status"]; size?: Item["size"] }
export type DoneItem = { id: string; title: string; note?: string; updated: string }
export type ProjectSummary = {
    id: string
    path: string
    purpose?: string
    open: number
    done: number
    dropped: number
    percent: number
    phases: Partial<Record<Item["phase"], number>>
    now: NowItem[]
    next: NowItem[]
    // Newest item date, YYYY-MM-DD.
    updated?: string
    recent: DoneItem[]
    error?: string
}
// `suggestionsError`: suggestions.json is broken, the goals still load.
export type ProjectData = { id: string; path: string; file: GoalsFile; suggestions: Suggestion[]; suggestionsError?: string }
export type ServerEvent = { type: "project"; id: string } | { type: "projects" }

export class ApiError extends Error {
    readonly status: number
    readonly details: string[]
    constructor(message: string, status: number, details: string[] = []) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.details = details
    }
}

export const errorText = (e: unknown) =>
    e instanceof ApiError ? [e.message, ...e.details].join(" · ") : e instanceof Error ? e.message : String(e)

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(body?.error ?? `${res.status} ${res.statusText}`.trim(), res.status, body?.details ?? [])
    return body as T
}

const at = (id: string) => `/api/projects/${encodeURIComponent(id)}`

export const api = {
    projects: () => request<{ projects: ProjectSummary[] }>("/api/projects").then((r) => r.projects),
    project: (id: string) => request<ProjectData>(at(id)),
    detail: (id: string, itemId: string) => request<{ path: string; text: string }>(`${at(id)}/detail/${encodeURIComponent(itemId)}`),
    op: (id: string, op: Op) =>
        request<{ file: GoalsFile }>(`${at(id)}/ops`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Upgo": "1" },
            body: JSON.stringify(op),
        }).then((r) => r.file),
    dismiss: (id: string, ids: string[]) =>
        request<{ suggestions: Suggestion[] }>(`${at(id)}/suggestions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Upgo": "1" },
            body: JSON.stringify({ dismiss: ids }),
        }).then((r) => r.suggestions),
    // Unregisters only: the folder and its goals.json stay.
    forget: (id: string) => request<{ id: string }>(at(id), { method: "DELETE", headers: { "X-Upgo": "1" } }),
}

// One shared EventSource for every subscriber, opened with the first and closed with the last.
const listeners = new Set<(e: ServerEvent) => void>()
let source: EventSource | null = null

export function onServerEvent(listener: (e: ServerEvent) => void): () => void {
    listeners.add(listener)
    if (!source) {
        source = new EventSource("/api/events")
        const emit = (e: ServerEvent) => listeners.forEach((l) => l(e))
        source.addEventListener("projects", () => emit({ type: "projects" }))
        source.addEventListener("project", (e) => {
            try {
                const id = JSON.parse((e as MessageEvent).data)?.id
                if (typeof id === "string") emit({ type: "project", id })
            } catch {
                // a malformed event is not worth a crash
            }
        })
    }
    return () => {
        listeners.delete(listener)
        if (listeners.size || !source) return
        source.close()
        source = null
    }
}
