import { POINTER_KEYS, type Phase, type PointerKey, type Size, type Status } from "../../../src/core/vocab.ts"
import type { Item, Pointers } from "../../../src/core/schema.ts"
import type { Op } from "../../../src/core/ops.ts"

export type ItemInput = Extract<Op, { op: "add" }>["item"]
export type ItemPatch = Extract<Op, { op: "edit" }>["patch"]

export type ItemForm = {
    title: string
    section: string
    phase: Phase
    status: Status
    size: Size | ""
    scope: string
    body: string
    detail: string
    related: string
    pointers: Record<PointerKey, string>
}

export function toForm(item: Item | undefined, section: number): ItemForm {
    return {
        title: item?.title ?? "",
        section: String(item?.section ?? section),
        phase: item?.phase ?? "next",
        status: item?.status ?? "planned",
        size: item?.size ?? "",
        scope: item?.scope?.join(", ") ?? "",
        body: item?.body ?? "",
        detail: item?.detail ?? "",
        related: item?.related?.join(", ") ?? "",
        pointers: Object.fromEntries(POINTER_KEYS.map((k) => [k, item?.pointers?.[k]?.join("\n") ?? ""])) as Record<PointerKey, string>,
    }
}

const split = (text: string, sep: RegExp) => {
    const values = text.split(sep).map((v) => v.trim()).filter(Boolean)
    return values.length ? values : undefined
}

export function fromForm(f: ItemForm): ItemInput & { status: Status } {
    const pointers = Object.fromEntries(POINTER_KEYS.flatMap((k) => {
        const values = split(f.pointers[k], /\r?\n/)
        return values ? [[k, values]] : []
    })) as Pointers
    return {
        title: f.title.trim(),
        section: Number(f.section),
        phase: f.phase,
        status: f.status,
        size: f.size || undefined,
        scope: split(f.scope, /,/),
        body: f.body.trim() ? f.body : undefined,
        detail: f.detail.trim() || undefined,
        related: split(f.related, /,/),
        pointers: Object.keys(pointers).length ? pointers : undefined,
    }
}

const FIELDS = ["title", "section", "phase", "status", "size", "scope", "body", "detail", "related", "pointers"] as const
const OPTIONAL = new Set<string>(["size", "scope", "body", "detail", "related", "pointers"])

// Both sides go through the form, so formatting never counts as a change.
export function diffPatch(item: Item, form: ItemForm): ItemPatch {
    const before = fromForm(toForm(item, item.section))
    const after = fromForm(form)
    const patch: Record<string, unknown> = {}
    for (const k of FIELDS) {
        if (JSON.stringify(before[k]) === JSON.stringify(after[k])) continue
        patch[k] = after[k] === undefined && OPTIONAL.has(k) ? null : after[k]
    }
    return patch as ItemPatch
}
