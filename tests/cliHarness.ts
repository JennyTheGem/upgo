import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { UPGO_DIR } from "../src/core/registry.ts"

export type Run = { code: number; out: string; err: string }

// Runs the real CLI in a child process, against the test's own registry.
export function cli(args: string[], opts: { cwd: string; input?: string }): Run {
    const r = spawnSync(process.execPath, [join(UPGO_DIR, "cli.ts"), ...args], {
        cwd: opts.cwd,
        input: opts.input ?? "",
        encoding: "utf8",
        env: { ...process.env, UPGO_REGISTRY: process.env.UPGO_REGISTRY },
    })
    return { code: r.status ?? -1, out: r.stdout, err: r.stderr }
}
