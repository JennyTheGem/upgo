import { PHASES, PHASE_LABEL, type Phase } from "../../../src/core/vocab.ts"

export type Counts = { done: number; phases: Partial<Record<Phase, number>> }

// Done first, then the open items per phase.
export function segments({ done, phases }: Counts) {
    return [{ key: "done", label: "done", value: done }, ...PHASES.map((p) => ({ key: p, label: PHASE_LABEL[p], value: phases[p] ?? 0 }))]
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
