import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { GoalsFile } from "../src/core/schema.ts"
import { saveGoals } from "../src/core/store.ts"

export const D = "2026-10-01"

export const tempDir = () => mkdtempSync(join(tmpdir(), "upgo-"))

// A fresh registry per test, so nothing ever touches the real one.
export function isolateRegistry(): string {
    const path = join(tempDir(), "registry.json")
    process.env.UPGO_REGISTRY = path
    return path
}

export function fixture(over: Partial<GoalsFile> = {}): GoalsFile {
    const item = (id: string, section: number, phase: GoalsFile["items"][number]["phase"], status: GoalsFile["items"][number]["status"], extra = {}) => ({
        id,
        section,
        title: id[0].toUpperCase() + id.slice(1),
        phase,
        status,
        created: D,
        updated: D,
        ...extra,
    })
    return {
        version: 1,
        project: "demo",
        purpose: "Demo project",
        sections: [
            { n: 1, title: "Core" },
            { n: 2, title: "UI" },
            { n: 3, title: "Empty" },
        ],
        traps: [{ id: "lock-trap", title: "Locks are per file", body: "Never hold two." }],
        items: [
            item("alpha", 1, "now", "planned", { body: "Alpha body", size: "S", scope: ["all"], pointers: { files: ["src/a.ts"] } }),
            item("beta", 1, "next", "partial"),
            item("gamma", 1, "wayLater", "planned"),
            item("delta", 2, "later", "planned"),
            item("epsilon", 2, "maybe", "planned"),
            item("zeta", 2, "later", "done", { note: "shipped" }),
            item("eta", 3, "later", "dropped", { note: "not needed" }),
        ],
        ...over,
    }
}

export async function makeProject(file: GoalsFile = fixture(), dir = tempDir()): Promise<string> {
    await saveGoals(dir, file)
    return dir
}
