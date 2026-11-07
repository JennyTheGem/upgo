import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { z } from "zod"
import { registryPath } from "./registry.ts"
import { formatIssues } from "./schema.ts"
import { writeAtomic } from "./store.ts"
import { UpgoError } from "./util.ts"

const settingsSchema = z.strictObject({ tray: z.boolean().optional() })
export type Settings = z.infer<typeof settingsSchema>

// Next to the registry, so tests with UPGO_REGISTRY get their own.
export const settingsPath = () => join(dirname(registryPath()), "settings.json")

export function readSettings(): Settings {
    const path = settingsPath()
    if (!existsSync(path)) return {}
    let raw: unknown
    try {
        raw = JSON.parse(readFileSync(path, "utf8"))
    } catch (e) {
        throw new UpgoError(`settings ${path} is not valid JSON: ${(e as Error).message}`)
    }
    const parsed = settingsSchema.safeParse(raw)
    if (!parsed.success) throw new UpgoError(`settings ${path} is invalid:`, formatIssues(parsed.error))
    return parsed.data
}

export async function writeSettings(patch: Settings): Promise<Settings> {
    const next = { ...readSettings(), ...patch }
    await writeAtomic(settingsPath(), JSON.stringify(next, null, 2) + "\n")
    return next
}
