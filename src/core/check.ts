import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { tryArchive } from "./archive.ts"
import { readRegistry, type Entry } from "./registry.ts"
import { render } from "./render.ts"
import { localIssues } from "./rules.ts"
import { GOALS, MD, parseGoals, readGoals, saveGoals, withLock } from "./store.ts"
import { trySuggestions } from "./suggestions.ts"
import type { GoalsFile } from "./schema.ts"
import { UpgoError } from "./util.ts"

const normalize = (s: string) => s.replace(/\r\n/g, "\n")
const mdStale = (dir: string, file: GoalsFile) => {
    const path = join(dir, MD)
    return !existsSync(path) || normalize(readFileSync(path, "utf8")) !== render(file)
}

// Gives items without `created` or `updated` the other date, else `day`. Returns how many it touched.
function fillDates(raw: unknown, day: string): number {
    const items = (raw as { items?: unknown } | null)?.items
    if (!Array.isArray(items)) return 0
    let n = 0
    for (const item of items as Record<string, unknown>[]) {
        if (!item || typeof item !== "object" || (item.created != null && item.updated != null)) continue
        item.created ??= item.updated ?? day
        item.updated ??= item.created
        n++
    }
    return n
}

// The safe repairs behind `upgo check --fix`. Anything else wrong blocks the save, and `checkProject` reports it.
export async function fixProject(dir: string, day: string): Promise<string[]> {
    const path = join(dir, GOALS)
    if (!existsSync(path)) return []
    return withLock(path, async () => {
        let file: GoalsFile
        let dated: number
        try {
            const raw: unknown = JSON.parse(readFileSync(path, "utf8"))
            dated = fillDates(raw, day)
            file = parseGoals(raw)
        } catch (e) {
            if (e instanceof SyntaxError || e instanceof UpgoError) return []
            throw e
        }
        const stale = mdStale(dir, file)
        if ((!dated && !stale) || localIssues(file).length) return []
        await saveGoals(dir, file)
        return [...(dated ? [`filled missing dates on ${dated} item${dated === 1 ? "" : "s"}`] : []), ...(stale ? [`regenerated ${MD}`] : [])]
    })
}

// What is wrong with a `project:item` ref seen from `file` (in `dir`), or null. Each project's ids load once.
// Archived items still count, so archiving never breaks a ref.
export function refChecker(file: GoalsFile, dir: string, registry: Entry[] = readRegistry()): (ref: string) => string | null {
    const ids = (f: GoalsFile, path: string) => new Set([...f.items, ...tryArchive(path).archived].map((i) => i.id))
    const other = (project: string) => {
        const entry = registry.find((e) => e.id === project)
        try {
            return entry ? ids(readGoals(entry.path), entry.path) : null
        } catch {
            return null
        }
    }
    const known = new Map<string, Set<string> | null>()
    return (ref) => {
        const [project, id] = ref.split(":")
        if (!known.has(project)) known.set(project, project === file.project ? ids(file, dir) : other(project))
        const target = known.get(project)
        if (!target) return `\`${ref}\` points at a project that is not registered or not readable`
        return target.has(id) ? null : `\`${ref}\` does not exist`
    }
}

// Everything `upgo check` verifies for one project dir. Empty array = clean.
export function checkProject(dir: string, registry: Entry[] = readRegistry()): string[] {
    let file: GoalsFile
    try {
        file = readGoals(dir)
    } catch (e) {
        if (e instanceof UpgoError) return e.details.length ? e.details : [e.message]
        throw e
    }
    const issues = localIssues(file)

    const problem = refChecker(file, dir, registry)
    for (const item of file.items) {
        for (const ref of item.related ?? []) {
            const p = problem(ref)
            if (p) issues.push(`item \`${item.id}\`: related ${p}`)
        }
        if (item.detail && !existsSync(resolve(dir, item.detail))) issues.push(`item \`${item.id}\`: detail file ${item.detail} does not exist`)
    }

    const { archiveError } = tryArchive(dir)
    if (archiveError) issues.push(archiveError)

    const { suggestionsError } = trySuggestions(dir)
    if (suggestionsError) issues.push(suggestionsError)

    if (!existsSync(join(dir, MD))) issues.push(`${MD} is missing, run \`upgo render\``)
    else if (mdStale(dir, file)) issues.push(`${MD} is out of date with ${GOALS}, run \`upgo render\``)
    return issues
}
