import { isOpenStatus, type Phase, type Size, type Status } from "../../../src/core/vocab.ts"
import type { GoalsFile, Item, Section } from "../../../src/core/schema.ts"

export type Filters = {
    phases: Phase[]
    statuses: Status[]
    showClosed: boolean
    sections: number[]
    sizes: Size[]
    scopes: string[]
    search: string
}

export const NO_FILTERS: Filters = { phases: [], statuses: [], showClosed: false, sections: [], sizes: [], scopes: [], search: "" }

export type Group = { section: Section; items: Item[]; closed: boolean; open: number }

const hit = <T>(picked: T[], value: T | undefined) => !picked.length || (value !== undefined && picked.includes(value))

function haystack(item: Item): string {
    return [item.id, item.title, item.body ?? "", ...Object.values(item.pointers ?? {}).flat()].join("\n").toLowerCase()
}

export function matches(item: Item, f: Filters): boolean {
    const q = f.search.trim().toLowerCase()
    return (
        (f.showClosed || isOpenStatus(item.status)) &&
        hit(f.statuses, item.status) &&
        hit(f.phases, item.phase) &&
        hit(f.sizes, item.size) &&
        hit(f.sections, item.section) &&
        (!f.scopes.length || !!item.scope?.some((s) => f.scopes.includes(s))) &&
        (!q || haystack(item).includes(q))
    )
}

// Anything that hides open items. The section filter and the done/dropped toggle do not count.
export function isNarrowed(f: Filters): boolean {
    return !!(f.phases.length || f.statuses.length || f.sizes.length || f.scopes.length || f.search.trim())
}

export function scopesIn(file: GoalsFile): string[] {
    return [...new Set(file.items.flatMap((i) => i.scope ?? []))].sort()
}

// A closed section (no open items) still shows, collapsed, unless a narrowing filter finds nothing in it.
export function groupItems(file: GoalsFile, f: Filters): Group[] {
    const narrowed = isNarrowed(f)
    return file.sections
        .filter((s) => hit(f.sections, s.n))
        .map((section) => {
            const mine = file.items.filter((i) => i.section === section.n)
            const open = mine.filter((i) => isOpenStatus(i.status)).length
            return { section, items: mine.filter((i) => matches(i, f)), closed: open === 0, open }
        })
        .filter((g) => g.items.length || (g.closed && !narrowed))
}
