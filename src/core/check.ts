import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { tryArchive } from "./archive.ts"
import { readRegistry, type Entry } from "./registry.ts"
import { render } from "./render.ts"
import { localIssues } from "./rules.ts"
import { GOALS, MD, readGoals } from "./store.ts"
import { trySuggestions } from "./suggestions.ts"
import type { GoalsFile } from "./schema.ts"
import { UpgoError } from "./util.ts"

const normalize = (s: string) => s.replace(/\r\n/g, "\n")

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

    const mdPath = join(dir, MD)
    if (!existsSync(mdPath)) issues.push(`${MD} is missing, run \`upgo render\``)
    else if (normalize(readFileSync(mdPath, "utf8")) !== render(file)) issues.push(`${MD} is out of date with ${GOALS}, run \`upgo render\``)
    return issues
}
