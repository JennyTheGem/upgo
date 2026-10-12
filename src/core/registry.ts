import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { formatIssues, slug } from "./schema.ts"
import { withLock, writeAtomic } from "./store.ts"
import { UpgoError } from "./util.ts"

export const UPGO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const entrySchema = z.strictObject({ id: slug, path: z.string().min(1) })
const registrySchema = z.array(entrySchema)
export type Entry = z.infer<typeof entrySchema>

// Tests point this at a temp file so they never touch the real registry.
export const registryPath = () => process.env.UPGO_REGISTRY ?? join(UPGO_DIR, "registry.json")

const samePath = (a: string, b: string) =>
    process.platform === "win32" ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b)

export function readRegistry(): Entry[] {
    const path = registryPath()
    if (!existsSync(path)) return []
    let raw: unknown
    try {
        raw = JSON.parse(readFileSync(path, "utf8"))
    } catch (e) {
        throw new UpgoError(`registry ${path} is not valid JSON: ${(e as Error).message}`)
    }
    const parsed = registrySchema.safeParse(raw)
    if (!parsed.success) throw new UpgoError(`registry ${path} is invalid:`, formatIssues(parsed.error))
    return parsed.data
}

async function writeRegistry(entries: Entry[]): Promise<void> {
    await writeAtomic(registryPath(), JSON.stringify(entries, null, 2) + "\n")
}

export function findEntry(id: string): Entry | undefined {
    return readRegistry().find((e) => e.id === id)
}

export function findEntryByPath(path: string): Entry | undefined {
    return readRegistry().find((e) => samePath(e.path, path))
}

// Throws if `id` at `path` clashes with another registration; returns the entry when it is this one already.
export function checkRegistrable(id: string, path: string, entries = readRegistry()): Entry | undefined {
    const byId = entries.find((e) => e.id === id)
    if (byId && !samePath(byId.path, path)) throw new UpgoError(`project id \`${id}\` is already registered for ${byId.path}`)
    const byPath = entries.find((e) => samePath(e.path, path))
    if (byPath && byPath.id !== id) throw new UpgoError(`${path} is already registered as \`${byPath.id}\``)
    return byId
}

export async function register(id: string, path: string): Promise<Entry> {
    return withLock(registryPath(), async () => {
        const entries = readRegistry()
        const byId = checkRegistrable(id, path, entries)
        if (byId) return byId
        const entry = { id, path: resolve(path) }
        await writeRegistry([...entries, entry])
        return entry
    })
}

export async function forget(id: string): Promise<void> {
    await withLock(registryPath(), async () => {
        const entries = readRegistry()
        if (!entries.some((e) => e.id === id)) throw new UpgoError(`no registered project \`${id}\``)
        await writeRegistry(entries.filter((e) => e.id !== id))
    })
}
