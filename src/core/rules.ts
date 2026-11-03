import type { GoalsFile } from "./schema.ts"

export const EM_DASH = "\u2014"

function dupes(values: (string | number)[]): (string | number)[] {
    const seen = new Set<string | number>()
    return [...new Set(values.filter((v) => seen.size === seen.add(v).size))]
}

// Rules a single file must satisfy on its own; every save runs them.
export function localIssues(file: GoalsFile): string[] {
    const issues: string[] = []
    for (const id of dupes(file.items.map((i) => i.id))) issues.push(`duplicate item id \`${id}\``)
    for (const id of dupes(file.traps.map((t) => t.id))) issues.push(`duplicate trap id \`${id}\``)
    for (const n of dupes(file.sections.map((s) => s.n))) issues.push(`duplicate section number ${n}`)
    const sections = new Set(file.sections.map((s) => s.n))
    for (const item of file.items) {
        if (!sections.has(item.section)) issues.push(`item \`${item.id}\` is in section ${item.section}, which does not exist`)
        if (item.status === "dropped" && !item.note?.trim()) issues.push(`dropped item \`${item.id}\` needs a reason in \`note\``)
        for (const ref of item.related ?? []) {
            if (ref === `${file.project}:${item.id}`) issues.push(`item \`${item.id}\` relates to itself`)
        }
    }
    const where = [
        ...file.items.filter((i) => JSON.stringify(i).includes(EM_DASH)).map((i) => `item \`${i.id}\``),
        ...file.traps.filter((t) => JSON.stringify(t).includes(EM_DASH)).map((t) => `trap \`${t.id}\``),
        ...file.sections.filter((s) => s.title.includes(EM_DASH)).map((s) => `section ${s.n}`),
        ...(file.purpose?.includes(EM_DASH) ? ["purpose"] : []),
    ]
    for (const w of where) issues.push(`${w} contains an em dash (U+2014); use a comma, colon or hyphen`)
    return issues
}
