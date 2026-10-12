import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { readRegistry, type Entry } from "./registry.ts"
import { render } from "./render.ts"
import { localIssues } from "./rules.ts"
import { GOALS, MD, readGoals } from "./store.ts"
import type { GoalsFile } from "./schema.ts"
import { UpgoError } from "./util.ts"

const normalize = (s: string) => s.replace(/\r\n/g, "\n")

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
    for (const item of file.items) {
        for (const ref of item.related ?? []) {
            const [project, id] = ref.split(":")
            const target = project === file.project ? file : load(project)
            if (target === undefined || target === null) issues.push(`item \`${item.id}\`: related \`${ref}\` points at a project that is not registered or not readable`)
            else if (!target.items.some((i) => i.id === id)) issues.push(`item \`${item.id}\`: related \`${ref}\` does not exist`)
        }
        if (item.detail && !existsSync(resolve(dir, item.detail))) issues.push(`item \`${item.id}\`: detail file ${item.detail} does not exist`)
    }

    const mdPath = join(dir, MD)
    if (!existsSync(mdPath)) issues.push(`${MD} is missing, run \`upgo render\``)
    else if (normalize(readFileSync(mdPath, "utf8")) !== render(file)) issues.push(`${MD} is out of date with ${GOALS}, run \`upgo render\``)
    return issues
}
