import { existsSync } from "node:fs"
import { join } from "node:path"
import { ARCHIVE, readArchive, writeArchive } from "./archive.ts"
import { readRegistry, registryPath, writeRegistry } from "./registry.ts"
import { formatIssues, slug } from "./schema.ts"
import { GOALS, readGoals, saveGoals, withLock } from "./store.ts"
import { readSuggestions, updateSuggestions } from "./suggestions.ts"
import { oneLine, UpgoError } from "./util.ts"

type Refs = { related?: string[] }

// Same object back when nothing points at `from`, so callers can spot a change by identity.
function repoint<T extends Refs>(x: T, from: string, to: string): T {
    const p = `${from}:`
    if (!x.related?.some((r) => r.startsWith(p))) return x
    return { ...x, related: x.related.map((r) => (r.startsWith(p) ? `${to}:${r.slice(p.length)}` : r)) }
}

const changed = <T>(next: T[], prev: T[]) => next.some((x, i) => x !== prev[i])

// Repoints one project's `from:` refs, and its own id when `own`. Everything is read (and so validated) before
// the first write. True when a file changed.
async function rewrite(dir: string, from: string, to: string, own: boolean): Promise<boolean> {
    return withLock(join(dir, GOALS), async () => {
        const file = readGoals(dir)
        const archived = readArchive(dir)
        const ideas = readSuggestions(dir)
        const items = file.items.map((i) => repoint(i, from, to))
        const arch = archived.map((i) => repoint(i, from, to))
        const goals = own || changed(items, file.items)
        const archive = (own && existsSync(join(dir, ARCHIVE))) || changed(arch, archived)
        const suggestions = changed(ideas.map((s) => repoint(s, from, to)), ideas)
        if (goals) await saveGoals(dir, { ...file, ...(own && { project: to }), items })
        if (archive) await writeArchive(dir, own ? to : file.project, arch)
        if (suggestions) await updateSuggestions(dir, (list) => list.map((s) => repoint(s, from, to)))
        return goals || archive || suggestions
    })
}

export type Renamed = { updated: string[]; failed: string[] }

// The project's own files and the registry move together; another project that cannot be rewritten lands in `failed`.
export async function renameProject(from: string, to: string): Promise<Renamed> {
    const id = slug.safeParse(to)
    if (!id.success) throw new UpgoError(`bad new id \`${to}\`:`, formatIssues(id.error))
    return withLock(registryPath(), async () => {
        const entries = readRegistry()
        const entry = entries.find((e) => e.id === from)
        if (!entry) throw new UpgoError(`no registered project \`${from}\` (see \`upgo projects\`)`)
        if (from === to) throw new UpgoError(`the project is already called \`${to}\``)
        const taken = entries.find((e) => e.id === to)
        if (taken) throw new UpgoError(`project id \`${to}\` is already registered for ${taken.path}`)
        try {
            await rewrite(entry.path, from, to, true)
            await writeRegistry(entries.map((e) => (e === entry ? { ...e, id: to } : e)))
        } catch (e) {
            // Its files may be half renamed, but the registry still says `from`, so a rerun finishes the job.
            throw new UpgoError(`rename stopped (${(e as Error).message.split("\n")[0]}): fix that and run \`upgo rename ${from} ${to}\` again`, e instanceof UpgoError ? e.details : [])
        }
        const updated: string[] = []
        const failed: string[] = []
        for (const e of entries) {
            // A vanished folder holds no refs.
            if (e === entry || !existsSync(join(e.path, GOALS))) continue
            try {
                if (await rewrite(e.path, from, to, false)) updated.push(e.id)
            } catch (err) {
                // The rename is in, so one bad project must not hide what happened to the rest.
                failed.push(`${e.id}: ${err instanceof UpgoError ? oneLine(err) : (err as Error).message}`)
            }
        }
        return { updated, failed }
    })
}
