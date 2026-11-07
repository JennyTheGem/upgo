import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { formatIssues, itemSchema, type GoalsFile, type Item } from "./schema.ts"
import { GOALS, readGoals, saveGoals, withLock, writeAtomic } from "./store.ts"
import { oneLine, UpgoError } from "./util.ts"

export const ARCHIVE = "goals-archive.json"
export const DEFAULT_ARCHIVE_MONTHS = 6

// Ids may repeat: a new item can reuse the id of one archived long ago.
const archiveSchema = z.strictObject({ version: z.literal(1), project: z.string(), items: z.array(itemSchema) })

// No file means nothing archived.
export function readArchive(dir: string): Item[] {
    const path = join(dir, ARCHIVE)
    if (!existsSync(path)) return []
    let raw: unknown
    try {
        raw = JSON.parse(readFileSync(path, "utf8"))
    } catch (e) {
        throw new UpgoError(`${ARCHIVE} is not valid JSON: ${(e as Error).message}`)
    }
    const parsed = archiveSchema.safeParse(raw)
    if (!parsed.success) throw new UpgoError(`${ARCHIVE} does not match the schema:`, formatIssues(parsed.error))
    return parsed.data.items
}

// Callers hold the goals.json lock.
export async function writeArchive(dir: string, project: string, items: Item[]): Promise<void> {
    await writeAtomic(join(dir, ARCHIVE), JSON.stringify({ version: 1, project, items }, null, 2) + "\n")
}

// For readers that carry on past a broken archive: the items, or what is wrong with it.
export function tryArchive(dir: string): { archived: Item[]; archiveError?: string } {
    try {
        return { archived: readArchive(dir) }
    } catch (e) {
        if (!(e instanceof UpgoError)) throw e
        return { archived: [], archiveError: oneLine(e) }
    }
}

// The day `months` before `day`, both YYYY-MM-DD. A missing day clamps to the month's last (Aug 31 to Feb 28).
export function monthsBefore(day: string, months: number): string {
    const [y, m, d] = day.split("-").map(Number)
    const at = new Date(Date.UTC(y, m - 1 - months, d))
    if (at.getUTCDate() !== d) at.setUTCDate(0)
    // Before year 0 (or out of Date range) nothing is older.
    return at.getUTCFullYear() >= 0 ? at.toISOString().slice(0, 10) : "0000-01-01"
}

// Done items last updated before `cutoff` move out; everything else stays.
export function splitOld(file: GoalsFile, cutoff: string): { keep: GoalsFile; old: Item[] } {
    const isOld = (i: Item) => i.status === "done" && i.updated < cutoff
    return { keep: { ...file, items: file.items.filter((i) => !isOld(i)) }, old: file.items.filter(isOld) }
}

// Archive first: if goals.json then fails, a rerun finds the same items and skips the copies already there.
export async function archiveDone(dir: string, cutoff: string): Promise<Item[]> {
    return withLock(join(dir, GOALS), async () => {
        const file = readGoals(dir)
        const { keep, old } = splitOld(file, cutoff)
        if (!old.length) return old
        const had = readArchive(dir)
        const seen = new Set(had.map((i) => JSON.stringify(i)))
        const items = [...had, ...old.filter((i) => !seen.has(JSON.stringify(i)))]
        await writeArchive(dir, file.project, items)
        await saveGoals(dir, keep)
        return old
    })
}
