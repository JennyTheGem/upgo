import type { GoalsFile, Item } from "./schema.ts"
import { today } from "./util.ts"
import { PHASES, isOpenStatus, type Phase, type Size } from "./vocab.ts"

// Done items per project the dashboard gets, newest first.
export const RECENT = 5

// Weeks in the done sparkline.
export const WEEKS = 8

// Done items per 7-day window, oldest first; the last one ends today. A done item's date is its `updated`.
export function weeklyDone(items: Item[], now = new Date()) {
    const weeks = Array<number>(WEEKS).fill(0)
    const end = Date.parse(today(now))
    for (const i of items) {
        if (i.status !== "done") continue
        const w = Math.floor((end - Date.parse(i.updated)) / (7 * 86_400_000))
        if (w >= 0 && w < WEEKS) weeks[WEEKS - 1 - w]++
    }
    return weeks
}

// How much an item counts toward progress. Unsized counts as M.
export const SIZE_WEIGHT: Record<Size, number> = { S: 1, M: 2, L: 4 }

// Done share of everything not dropped, weighted by size. Open maybes are not committed work, so they don't count.
export function percentDone(items: Item[]) {
    const weigh = (pick: (i: Item) => boolean) => items.filter(pick).reduce((n, i) => n + SIZE_WEIGHT[i.size ?? "M"], 0)
    const done = weigh((i) => i.status === "done")
    const total = done + weigh((i) => isOpenStatus(i.status) && i.phase !== "maybe")
    return total ? Math.round((done / total) * 100) : 0
}

// Live plus archived items, minus exact copies an interrupted `upgo archive` left in both files.
export function withArchived(items: Item[], archived: Item[]) {
    const live = new Set(items.map((i) => JSON.stringify(i)))
    return [...items, ...archived.filter((i) => !live.has(JSON.stringify(i)))]
}

// What the dashboard shows per project: counts, open items per phase, the open `now` and `next` items, the last
// change, the latest done items and done per week. `archived` items count toward done and percent. Zod-free for the web bundle.
export function summarize(file: GoalsFile, archived: Item[] = [], now = new Date()) {
    const all = withArchived(file.items, archived)
    const open = file.items.filter((i) => isOpenStatus(i.status))
    const count = (s: string) => all.filter((i) => i.status === s).length
    const phases = Object.fromEntries(PHASES.map((p) => [p, open.filter((i) => i.phase === p).length])) as Record<Phase, number>
    const inPhase = (p: Phase) => open.filter((i) => i.phase === p).map(({ id, title, status, size }) => ({ id, title, status, size }))
    const updated = file.items.reduce((d, i) => (i.updated > d ? i.updated : d), "") || undefined
    const recent = file.items
        .filter((i) => i.status === "done")
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .slice(0, RECENT)
        .map(({ id, title, note, updated }) => ({ id, title, note, updated }))
    return { purpose: file.purpose, open: open.length, done: count("done"), dropped: count("dropped"), percent: percentDone(all), phases, now: inPhase("now"), next: inPhase("next"), updated, recent, weekly: weeklyDone(all, now) }
}
