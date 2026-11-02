import type { GoalsFile, Item } from "./schema.ts"
import { PHASES, isOpenStatus, type Phase, type Size } from "./vocab.ts"

// Done items per project the dashboard gets, newest first.
export const RECENT = 5

// How much an item counts toward progress. Unsized counts as M.
export const SIZE_WEIGHT: Record<Size, number> = { S: 1, M: 2, L: 4 }

// Done share of everything not dropped, weighted by size. Open maybes are not committed work, so they don't count.
export function percentDone(items: Item[]) {
    const weigh = (pick: (i: Item) => boolean) => items.filter(pick).reduce((n, i) => n + SIZE_WEIGHT[i.size ?? "M"], 0)
    const done = weigh((i) => i.status === "done")
    const total = done + weigh((i) => isOpenStatus(i.status) && i.phase !== "maybe")
    return total ? Math.round((done / total) * 100) : 0
}

// What the dashboard shows per project: counts, open items per phase, the open `now` and `next` items, the last
// change and the latest done items. Zod-free for the web bundle.
export function summarize(file: GoalsFile) {
    const open = file.items.filter((i) => isOpenStatus(i.status))
    const count = (s: string) => file.items.filter((i) => i.status === s).length
    const phases = Object.fromEntries(PHASES.map((p) => [p, open.filter((i) => i.phase === p).length])) as Record<Phase, number>
    const inPhase = (p: Phase) => open.filter((i) => i.phase === p).map(({ id, title, status, size }) => ({ id, title, status, size }))
    const updated = file.items.reduce((d, i) => (i.updated > d ? i.updated : d), "") || undefined
    const recent = file.items
        .filter((i) => i.status === "done")
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .slice(0, RECENT)
        .map(({ id, title, note, updated }) => ({ id, title, note, updated }))
    return { purpose: file.purpose, open: open.length, done: count("done"), dropped: count("dropped"), percent: percentDone(file.items), phases, now: inPhase("now"), next: inPhase("next"), updated, recent }
}
