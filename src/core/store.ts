import fsp from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { formatIssues, goalsFileSchema, SCHEMA_URL, type GoalsFile } from "./schema.ts"
import { localIssues } from "./rules.ts"
import { render } from "./render.ts"
import { UpgoError } from "./util.ts"

export const GOALS = "goals.json"
export const MD = "goals.md"
const LOCK_STALE_MS = 10_000
const LOCK_WAIT_MS = 3_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Nearest folder at or above `start` holding a goals.json.
export function findProjectDir(start: string): string | null {
    for (let dir = resolve(start); ; dir = dirname(dir)) {
        if (existsSync(join(dir, GOALS))) return dir
        if (dirname(dir) === dir) return null
    }
}

export function parseGoals(raw: unknown): GoalsFile {
    const parsed = goalsFileSchema.safeParse(raw)
    if (!parsed.success) throw new UpgoError("goals.json does not match the schema:", formatIssues(parsed.error))
    return parsed.data
}

export function readGoals(dir: string): GoalsFile {
    const path = join(dir, GOALS)
    if (!existsSync(path)) throw new UpgoError(`no goals.json in ${dir} (run \`upgo init\` there first)`)
    let raw: unknown
    try {
        raw = JSON.parse(readFileSync(path, "utf8"))
    } catch (e) {
        throw new UpgoError(`goals.json is not valid JSON: ${(e as Error).message}`)
    }
    return parseGoals(raw)
}

export function serialize(file: GoalsFile): string {
    // Parsing again puts every key in schema order, so diffs stay stable whoever wrote the file.
    const { $schema: _drop, ...rest } = parseGoals(file)
    return JSON.stringify({ $schema: SCHEMA_URL, ...rest }, null, 2) + "\n"
}

// Write a temp file and rename it over the target, so a reader never sees half a file.
export async function writeAtomic(path: string, content: string): Promise<void> {
    const tmp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`
    try {
        await fsp.writeFile(tmp, content, "utf8")
        for (let attempt = 0; ; attempt++) {
            try {
                await fsp.rename(tmp, path)
                return
            } catch (e) {
                // Windows refuses a rename while a watcher or editor briefly holds the target.
                const code = (e as NodeJS.ErrnoException).code
                if (attempt >= 5 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw e
                await sleep(30)
            }
        }
    } catch (e) {
        await fsp.rm(tmp, { force: true })
        throw e
    }
}

// Exclusive lockfile next to `target`; a lock older than 10s is a crashed writer and gets taken over.
export async function withLock<T>(target: string, fn: () => Promise<T>): Promise<T> {
    const lock = `${target}.lock`
    const deadline = Date.now() + LOCK_WAIT_MS
    for (;;) {
        try {
            const handle = await fsp.open(lock, "wx")
            await handle.writeFile(`${process.pid} ${new Date().toISOString()}`)
            await handle.close()
            break
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e
            const stat = await fsp.stat(lock).catch(() => null)
            if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
                await fsp.rm(lock, { force: true })
                continue
            }
            if (Date.now() > deadline) throw new UpgoError(`${target} is locked by another writer (${lock})`)
            await sleep(50)
        }
    }
    try {
        return await fn()
    } finally {
        await fsp.rm(lock, { force: true })
    }
}

// Validates, then writes goals.json and the generated goals.md. Nothing is written if validation fails.
export async function saveGoals(dir: string, file: GoalsFile): Promise<GoalsFile> {
    const json = serialize(file)
    const clean = parseGoals(JSON.parse(json))
    const issues = localIssues(clean)
    if (issues.length) throw new UpgoError("refusing to save an invalid goals.json:", issues)
    await writeAtomic(join(dir, GOALS), json)
    await writeAtomic(join(dir, MD), render(clean))
    return clean
}

export async function updateGoals(dir: string, mutate: (file: GoalsFile) => GoalsFile): Promise<GoalsFile> {
    return withLock(join(dir, GOALS), async () => saveGoals(dir, mutate(readGoals(dir))))
}
