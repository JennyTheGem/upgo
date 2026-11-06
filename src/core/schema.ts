import { z } from "zod"

import { PHASES, POINTER_KEYS, SIZES, STATUSES, isOpenStatus, type PointerKey } from "./vocab.ts"

export * from "./vocab.ts"

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const DATE = /^\d{4}-\d{2}-\d{2}$/

export const slug = z.string().max(60).regex(SLUG, "must be a lowercase slug like `random-logouts`")
const date = z.string().regex(DATE, "must be YYYY-MM-DD")
const text = z.string().trim().min(1)
const list = z.array(text).min(1)
const line = (max: number) => text.max(max).regex(/^[^\r\n]*$/, "must be one line")

// `projectId:itemId`, the only way one project points at another.
export const ref = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be `projectId:itemId`")

export const pointersSchema = z.strictObject(
    Object.fromEntries(POINTER_KEYS.map((k) => [k, list.optional()])) as Record<PointerKey, z.ZodOptional<typeof list>>,
)

export const itemSchema = z.strictObject({
    id: slug,
    section: z.number().int().nonnegative(),
    title: line(200),
    body: z.string().optional(),
    phase: z.enum(PHASES),
    status: z.enum(STATUSES),
    size: z.enum(SIZES).optional(),
    scope: list.optional(),
    pointers: pointersSchema.optional(),
    detail: text.optional(),
    related: z.array(ref).min(1).optional(),
    created: date,
    updated: date,
    note: z.string().optional(),
})

export const sectionSchema = z.strictObject({
    n: z.number().int().nonnegative(),
    title: line(120),
})

export const trapSchema = z.strictObject({
    id: slug,
    title: line(200),
    body: z.string().optional(),
})

// Ideas an agent left for the user, kept in suggestions.json beside goals.json.
export const suggestionSchema = z.strictObject({
    id: slug,
    title: line(200),
    body: z.string().optional(),
    // Hints for when it becomes a goal; the section may be gone by then.
    section: z.number().int().nonnegative().optional(),
    size: z.enum(SIZES).optional(),
    created: date,
})

export const suggestionsFileSchema = z.strictObject({
    version: z.literal(1),
    suggestions: z.array(suggestionSchema),
})

export const goalsFileSchema = z.strictObject({
    $schema: z.string().optional(),
    version: z.literal(1),
    project: slug,
    purpose: z.string().optional(),
    sections: z.array(sectionSchema),
    traps: z.array(trapSchema),
    items: z.array(itemSchema),
})

export type Pointers = z.infer<typeof pointersSchema>
export type Item = z.infer<typeof itemSchema>
export type Section = z.infer<typeof sectionSchema>
export type Trap = z.infer<typeof trapSchema>
export type GoalsFile = z.infer<typeof goalsFileSchema>
export type Suggestion = z.infer<typeof suggestionSchema>

export const isOpen = (item: Item) => isOpenStatus(item.status)

export const SCHEMA_URL = "https://raw.githubusercontent.com/JennyTheGem/upgo/main/goals.schema.json"
// Also matches files written before the URL moved to GitHub.
export const isManaged = (goalsJson: string) => /"\$schema"\s*:\s*"[^"]*\/upgo\/(?:main\/)?goals\.schema\.json"/.test(goalsJson)

export function jsonSchema() {
    return z.toJSONSchema(goalsFileSchema, { target: "draft-2020-12" })
}

export function formatIssues(error: z.ZodError): string[] {
    return error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
}
