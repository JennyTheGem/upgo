import type { GoalsFile, Item, Section, Status, Suggestion, Trap } from "./schema.ts"
import { didYouMean, resolveId } from "./similar.ts"
import { slugify, uniqueSlug, UpgoError } from "./util.ts"

// Pure edits on a GoalsFile. Each returns a new file; the store validates and writes it.

type Optional = "body" | "size" | "scope" | "pointers" | "detail" | "related" | "note"
export type ItemInput = Omit<Item, "id" | "status" | "created" | "updated"> & { id?: string; status?: Status; created?: string }
export type ItemPatch = Partial<Pick<Item, "section" | "title" | "phase" | "status">> & { [K in Optional]?: Item[K] | null }
export type Position = { section?: number; before?: string; after?: string }

const clone = (f: GoalsFile): GoalsFile => structuredClone(f)

function indexOf(f: GoalsFile, id: string): number {
    const i = f.items.findIndex((it) => it.id === id)
    if (i < 0) throw new UpgoError(`no item \`${id}\` in ${f.project}${didYouMean(id, f.items.map((it) => it.id))}`)
    return i
}

// The item id `id` names: itself or a unique prefix of one.
export const resolveItem = (f: GoalsFile, id: string) => resolveId(id, f.items.map((i) => i.id), `no item \`${id}\` in ${f.project}`)

export function requireSection(f: GoalsFile, n: number): void {
    if (!f.sections.some((s) => s.n === n)) throw new UpgoError(`no section ${n} in ${f.project} (add it with \`upgo section add\`)`)
}

// Position just after the last item of section `n`, so array order keeps sections together.
// An empty section goes before the first item of a later one, so an undo puts it back where it was.
function endOfSection(f: GoalsFile, n: number): number {
    for (let i = f.items.length - 1; i >= 0; i--) if (f.items[i].section === n) return i + 1
    const later = new Set(f.sections.slice(f.sections.findIndex((s) => s.n === n) + 1).map((s) => s.n))
    const next = f.items.findIndex((i) => later.has(i.section))
    return next < 0 ? f.items.length : next
}

function applyPatch<T extends object>(target: T, patch: Record<string, unknown>): T {
    const out = { ...target } as Record<string, unknown>
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue
        if (v === null) delete out[k]
        else out[k] = v
    }
    return out as T
}

export function addItem(file: GoalsFile, input: ItemInput, day: string): { file: GoalsFile; id: string } {
    const f = clone(file)
    requireSection(f, input.section)
    const taken = new Set(f.items.map((i) => i.id))
    if (input.id && taken.has(input.id)) throw new UpgoError(`item id \`${input.id}\` already exists`)
    const id = input.id ?? uniqueSlug(slugify(input.title), taken)
    const item = { ...input, id, status: input.status ?? "planned", created: input.created ?? day, updated: day } as Item
    f.items.splice(endOfSection(f, item.section), 0, item)
    return { file: f, id }
}

// A suggestion's section hint, if that section still exists.
export const hintedSection = (f: GoalsFile, s: Suggestion) => (f.sections.some((x) => x.n === s.section) ? s.section : undefined)

// A suggestion as a new goal, carrying its body, size and related refs.
export function fromSuggestion(s: Suggestion, rest: Pick<ItemInput, "section" | "phase"> & Partial<Pick<ItemInput, "status" | "note" | "size">>): ItemInput {
    const { size = s.size, note, ...base } = rest
    return { title: s.title, ...(s.body ? { body: s.body } : {}), ...(s.related && { related: s.related }), ...base, ...(size && { size }), ...(note && { note }) }
}

export function editItem(file: GoalsFile, id: string, patch: ItemPatch, day: string): GoalsFile {
    const f = clone(file)
    const i = indexOf(f, id)
    if (patch.section !== undefined && patch.section !== f.items[i].section) {
        requireSection(f, patch.section)
        const [item] = f.items.splice(i, 1)
        const moved = applyPatch(item, { ...patch, updated: day })
        f.items.splice(endOfSection(f, moved.section), 0, moved)
        return f
    }
    f.items[i] = applyPatch(f.items[i], { ...patch, updated: day })
    return f
}

export function setStatus(file: GoalsFile, id: string, status: Status, note: string | undefined, day: string): GoalsFile {
    if (status === "dropped" && !note?.trim()) throw new UpgoError("dropping an item needs a reason")
    const patch: ItemPatch = { status }
    if (note?.trim()) patch.note = note.trim()
    else if (status === "planned" || status === "partial") patch.note = null
    return editItem(file, id, patch, day)
}

export function deleteItem(file: GoalsFile, id: string): GoalsFile {
    const f = clone(file)
    f.items.splice(indexOf(f, id), 1)
    return f
}

export function moveItem(file: GoalsFile, id: string, to: Position, day: string): GoalsFile {
    if (to.before && to.after) throw new UpgoError("give either `before` or `after`, not both")
    if (to.before === id || to.after === id) throw new UpgoError("an item cannot move next to itself")
    const f = clone(file)
    const [item] = f.items.splice(indexOf(f, id), 1)
    const anchorId = to.before ?? to.after
    const anchor = anchorId ? f.items[indexOf(f, anchorId)] : undefined
    const section = anchor?.section ?? to.section ?? item.section
    if (to.section !== undefined && anchor && anchor.section !== to.section) {
        throw new UpgoError(`\`${anchorId}\` is in section ${anchor.section}, not ${to.section}`)
    }
    requireSection(f, section)
    const moved = section === item.section ? item : { ...item, section, updated: day }
    const at = anchor ? f.items.indexOf(anchor) + (to.after ? 1 : 0) : endOfSection(f, section)
    f.items.splice(at, 0, moved)
    return f
}

// One step up or down among the items of its own section, optionally only counting `visible` ones.
export function nudgeItem(file: GoalsFile, id: string, dir: "up" | "down", visible?: Set<string>): GoalsFile {
    const item = file.items[indexOf(file, id)]
    const peers = file.items.filter((i) => i.section === item.section && (i.id === id || !visible || visible.has(i.id)))
    const at = peers.findIndex((i) => i.id === id)
    const neighbor = peers[dir === "up" ? at - 1 : at + 1]
    if (!neighbor) return file
    return moveItem(file, id, dir === "up" ? { before: neighbor.id } : { after: neighbor.id }, item.updated)
}

export function addSection(file: GoalsFile, title: string, n?: number): { file: GoalsFile; n: number } {
    const f = clone(file)
    const num = n ?? Math.max(0, ...f.sections.map((s) => s.n)) + 1
    if (f.sections.some((s) => s.n === num)) throw new UpgoError(`section ${num} already exists`)
    f.sections.push({ n: num, title })
    return { file: f, n: num }
}

export function renameSection(file: GoalsFile, n: number, title: string): GoalsFile {
    const f = clone(file)
    requireSection(f, n)
    f.sections = f.sections.map((s): Section => (s.n === n ? { ...s, title } : s))
    return f
}

export function moveSection(file: GoalsFile, n: number, before: number | null): GoalsFile {
    const f = clone(file)
    requireSection(f, n)
    if (before === n) throw new UpgoError("a section cannot move before itself")
    if (before !== null) requireSection(f, before)
    const section = f.sections.find((s) => s.n === n)!
    f.sections = f.sections.filter((s) => s.n !== n)
    f.sections.splice(before === null ? f.sections.length : f.sections.findIndex((s) => s.n === before), 0, section)
    return f
}

export function deleteSection(file: GoalsFile, n: number): GoalsFile {
    const f = clone(file)
    requireSection(f, n)
    const count = f.items.filter((i) => i.section === n).length
    if (count) throw new UpgoError(`section ${n} still holds ${count} item${count === 1 ? "" : "s"} (done and dropped ones count too)`)
    f.sections = f.sections.filter((s) => s.n !== n)
    return f
}

export function addTrap(file: GoalsFile, trap: Omit<Trap, "id"> & { id?: string }): { file: GoalsFile; id: string } {
    const f = clone(file)
    const taken = new Set(f.traps.map((t) => t.id))
    if (trap.id && taken.has(trap.id)) throw new UpgoError(`trap id \`${trap.id}\` already exists`)
    const id = trap.id ?? uniqueSlug(slugify(trap.title), taken)
    f.traps.push({ ...trap, id })
    return { file: f, id }
}

export function editTrap(file: GoalsFile, id: string, patch: { title?: string; body?: string | null }): GoalsFile {
    const f = clone(file)
    const i = f.traps.findIndex((t) => t.id === id)
    if (i < 0) throw new UpgoError(`no trap \`${id}\` in ${f.project}`)
    f.traps[i] = applyPatch(f.traps[i], patch)
    return f
}

export function deleteTrap(file: GoalsFile, id: string): GoalsFile {
    const f = clone(file)
    if (!f.traps.some((t) => t.id === id)) throw new UpgoError(`no trap \`${id}\` in ${f.project}`)
    f.traps = f.traps.filter((t) => t.id !== id)
    return f
}

export function setPurpose(file: GoalsFile, purpose: string | null): GoalsFile {
    return applyPatch(clone(file), { purpose: purpose?.trim() || null })
}
