// Zod-free vocabulary, so the dashboard can import it without bundling the schema.

export const PHASES = ["now", "next", "later", "wayLater", "maybe"] as const
export const STATUSES = ["planned", "partial", "done", "dropped"] as const
export const OPEN_STATUSES = ["planned", "partial"] as const
export const SIZES = ["S", "M", "L"] as const
export const POINTER_KEYS = ["files", "seam", "depends", "trap", "how", "check", "options", "where"] as const

export type Phase = (typeof PHASES)[number]
export type Status = (typeof STATUSES)[number]
export type Size = (typeof SIZES)[number]
export type PointerKey = (typeof POINTER_KEYS)[number]

export const PHASE_LABEL: Record<Phase, string> = {
    now: "now",
    next: "next",
    later: "later",
    wayLater: "way later",
    maybe: "maybe",
}

export const isOpenStatus = (status: Status) => (OPEN_STATUSES as readonly string[]).includes(status)
