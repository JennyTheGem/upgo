import type { GoalsFile } from "./schema.ts"
import { PHASES, isOpenStatus, type Phase } from "./vocab.ts"

// What the dashboard shows per project: counts, open items per phase, and the open `now` items. Zod-free for the web bundle.
export function summarize(file: GoalsFile) {
    const open = file.items.filter((i) => isOpenStatus(i.status))
    const count = (s: string) => file.items.filter((i) => i.status === s).length
    const phases = Object.fromEntries(PHASES.map((p) => [p, open.filter((i) => i.phase === p).length])) as Record<Phase, number>
    const now = open.filter((i) => i.phase === "now").map(({ id, title, status }) => ({ id, title, status }))
    return { purpose: file.purpose, open: open.length, done: count("done"), dropped: count("dropped"), phases, now }
}
