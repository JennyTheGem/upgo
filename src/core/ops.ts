import { z } from "zod"
import { itemSchema, pointersSchema, sectionSchema, slug, STATUSES, type GoalsFile } from "./schema.ts"
import * as m from "./mutate.ts"

// The one write vocabulary the dashboard speaks. The server validates a request body against `opSchema`
// and runs it through `applyOp`; the CLI calls the same mutate functions.

const s = itemSchema.shape
const clearable = <T extends z.ZodType>(t: T) => t.nullable().optional()

export const itemInputSchema = itemSchema.omit({ id: true, status: true, created: true, updated: true }).extend({
    id: slug.optional(),
    status: z.enum(STATUSES).optional(),
})

export const itemPatchSchema = z.strictObject({
    section: s.section.optional(),
    title: s.title.optional(),
    phase: s.phase.optional(),
    status: s.status.optional(),
    body: clearable(z.string()),
    size: clearable(s.size.unwrap()),
    scope: clearable(s.scope.unwrap()),
    pointers: clearable(pointersSchema),
    detail: clearable(s.detail.unwrap()),
    related: clearable(s.related.unwrap()),
    note: clearable(z.string()),
})

const n = sectionSchema.shape.n
const title = sectionSchema.shape.title

export const opSchema = z.discriminatedUnion("op", [
    z.strictObject({ op: z.literal("add"), item: itemInputSchema }),
    z.strictObject({ op: z.literal("edit"), id: slug, patch: itemPatchSchema }),
    z.strictObject({ op: z.literal("done"), id: slug, note: z.string().optional() }),
    z.strictObject({ op: z.literal("drop"), id: slug, reason: z.string().trim().min(1) }),
    z.strictObject({ op: z.literal("reopen"), id: slug }),
    z.strictObject({ op: z.literal("delete"), id: slug }),
    z.strictObject({ op: z.literal("move"), id: slug, section: n.optional(), before: slug.optional(), after: slug.optional() }),
    z.strictObject({ op: z.literal("addSection"), title, n: n.optional() }),
    z.strictObject({ op: z.literal("renameSection"), n, title }),
    z.strictObject({ op: z.literal("moveSection"), n, before: n.nullable() }),
    z.strictObject({ op: z.literal("deleteSection"), n }),
])

export type Op = z.infer<typeof opSchema>

export function applyOp(file: GoalsFile, op: Op, day: string): GoalsFile {
    switch (op.op) {
        case "add":
            return m.addItem(file, op.item, day).file
        case "edit":
            return m.editItem(file, op.id, op.patch, day)
        case "done":
            return m.setStatus(file, op.id, "done", op.note, day)
        case "drop":
            return m.setStatus(file, op.id, "dropped", op.reason, day)
        case "reopen":
            return m.setStatus(file, op.id, "planned", undefined, day)
        case "delete":
            return m.deleteItem(file, op.id)
        case "move":
            return m.moveItem(file, op.id, { section: op.section, before: op.before, after: op.after }, day)
        case "addSection":
            return m.addSection(file, op.title, op.n).file
        case "renameSection":
            return m.renameSection(file, op.n, op.title)
        case "moveSection":
            return m.moveSection(file, op.n, op.before)
        case "deleteSection":
            return m.deleteSection(file, op.n)
        default:
            throw new Error(`unknown op ${JSON.stringify(op satisfies never)}`)
    }
}
