import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { readRegistry, type Entry } from "./registry.ts"
import { render } from "./render.ts"
import { localIssues } from "./rules.ts"
import { GOALS, MD, readGoals } from "./store.ts"
import { trySuggestions } from "./suggestions.ts"
import type { GoalsFile } from "./schema.ts"
import { UpgoError } from "./util.ts"

const normalize = (s: string) => s.replace(/\r\n/g, "\n")

// What is wrong with a `project:item` ref seen from `file`, or null. Other projects load once each.
export function refChecker(file: GoalsFile, registry: Entry[] = readRegistry()): (ref: string) => string | null {
    const others = new Map<string, GoalsFile | null>()
    const load = (id: string) => {
        if (!others.has(id)) {
            const entry = registry.find((e) => e.id === id)
            let loaded: GoalsFile | null = null
            if (entry) {
                try {
                    loaded = readGoals(entry.path)
                } catch {
                    loaded = null
                }
            }
            others.set(id, loaded)
        }
        return others.get(id)
    }
    return (ref) => {
        const [project, id] = ref.split(":")
        const target = project === file.project ? file : load(project)
        if (!target) return `\`${ref}\` points at a project that is not registered or not readable`
        return target.items.some((i) => i.id === id) ? null : `\`${ref}\` does not exist`
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

    const problem = refChecker(file, registry)
    for (const item of file.items) {
        for (const ref of item.related ?? []) {
            const p = problem(ref)
            if (p) issues.push(`item \`${item.id}\`: related ${p}`)
        }
        if (item.detail && !existsSync(resolve(dir, item.detail))) issues.push(`item \`${item.id}\`: detail file ${item.detail} does not exist`)
    }

    const { suggestionsError } = trySuggestions(dir)
    if (suggestionsError) issues.push(suggestionsError)

    const mdPath = join(dir, MD)
    if (!existsSync(mdPath)) issues.push(`${MD} is missing, run \`upgo render\``)
    else if (normalize(readFileSync(mdPath, "utf8")) !== render(file)) issues.push(`${MD} is out of date with ${GOALS}, run \`upgo render\``)
    return issues
}
