import type { GoalsFile, Item } from "./schema.ts"
import { PHASES, isOpenStatus, type Phase, type Size } from "./vocab.ts"

// How much an item counts toward progress. Unsized counts as M.
export const SIZE_WEIGHT: Record<Size, number> = { S: 1, M: 2, L: 4 }

// Done share of everything not dropped, weighted by size. Open maybes are not committed work, so they don't count.
export function percentDone(items: Item[]) {
    const weigh = (pick: (i: Item) => boolean) => items.filter(pick).reduce((n, i) => n + SIZE_WEIGHT[i.size ?? "M"], 0)
    const done = weigh((i) => i.status === "done")
    const total = done + weigh((i) => isOpenStatus(i.status) && i.phase !== "maybe")
    return total ? Math.round((done / total) * 100) : 0
}

// What the dashboard shows per project: counts, open items per phase, and the open `now` items. Zod-free for the web bundle.
export function summarize(file: GoalsFile) {
    const open = file.items.filter((i) => isOpenStatus(i.status))
    const count = (s: string) => file.items.filter((i) => i.status === s).length
    const phases = Object.fromEntries(PHASES.map((p) => [p, open.filter((i) => i.phase === p).length])) as Record<Phase, number>
    const now = open.filter((i) => i.phase === "now").map(({ id, title, status }) => ({ id, title, status }))
    return { purpose: file.purpose, open: open.length, done: count("done"), dropped: count("dropped"), percent: percentDone(file.items), phases, now }
}
