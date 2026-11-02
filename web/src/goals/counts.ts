import { PHASES, PHASE_LABEL, type Phase } from "../../../src/core/vocab.ts"

export type Counts = { done: number; phases: Partial<Record<Phase, number>> }

// Done first, then the open items per phase.
export function segments({ done, phases }: Counts) {
    return [{ key: "done", label: "done", value: done }, ...PHASES.map((p) => ({ key: p, label: PHASE_LABEL[p], value: phases[p] ?? 0 }))]
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// Something shipped and nothing committed left. Open maybes don't block it.
export const isFinished = ({ done, open, phases, error }: Counts & { open: number; error?: string }) => !error && done > 0 && open === (phases.maybe ?? 0)

// Whole days from a YYYY-MM-DD day to today, local time. Never negative.
export function daysSince(day: string, now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Math.max(0, Math.round((today.getTime() - new Date(`${day}T00:00`).getTime()) / 86_400_000))
}

export function ago(day: string, now = new Date()) {
    const d = daysSince(day, now)
    if (d === 0) return "today"
    if (d === 1) return "yesterday"
    if (d < 14) return `${d}d ago`
    return d < 60 ? `${Math.floor(d / 7)}w ago` : `${Math.floor(d / 30)}mo ago`
}
