import http from "node:http"
import { existsSync, readFileSync, statSync, watch, type FSWatcher } from "node:fs"
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { z } from "zod"
import { applyOp, opSchema } from "./src/core/ops.ts"
import { forget, readRegistry, registryPath, UPGO_DIR, type Entry } from "./src/core/registry.ts"
import { formatIssues, PHASES, slug, suggestionSchema } from "./src/core/schema.ts"
import { summarize } from "./src/core/summary.ts"
import { GOALS, readGoals, updateGoals } from "./src/core/store.ts"
import { removeSuggestions, restoreSuggestions, SUGGESTIONS, trySuggestions, updateSuggestions } from "./src/core/suggestions.ts"
import { today, UpgoError } from "./src/core/util.ts"

export type ServerOptions = { port?: number; staticDir?: string; dev?: boolean }
export type RunningServer = { url: string; port: number; close: () => Promise<void> }

const HOST = "127.0.0.1"
const EMPTY_PHASES = Object.fromEntries(PHASES.map((p) => [p, 0]))
const DEV_PORT = 5173
const MAX_BODY = 1_000_000
const WATCHED = [GOALS, SUGGESTIONS]
const suggestionsBody = z.union([
    z.strictObject({ dismiss: z.array(slug).min(1) }),
    z.strictObject({ restore: z.array(z.strictObject({ at: z.number().int().nonnegative(), suggestion: suggestionSchema })).min(1) }),
])
const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".json": "application/json",
    ".txt": "text/plain; charset=utf-8",
    ".png": "image/png",
    ".ico": "image/x-icon",
}
const SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
}

const inside = (root: string, path: string) => {
    const rel = relative(root, path)
    return rel !== "" && !isAbsolute(rel) && rel.split(sep)[0] !== ".."
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS })
    res.end(JSON.stringify(body))
}

const fail = (res: http.ServerResponse, status: number, error: string, details?: string[]) => send(res, status, details?.length ? { error, details } : { error })

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((ok, no) => {
        let size = 0
        const chunks: Buffer[] = []
        // Past the limit the rest is drained, not stored, so the 413 still reaches the client.
        req.on("data", (c: Buffer) => {
            size += c.length
            if (size <= MAX_BODY) chunks.push(c)
        })
        req.on("end", () => (size > MAX_BODY ? no(new UpgoError("request body too large")) : ok(Buffer.concat(chunks).toString("utf8"))))
        req.on("error", no)
    })
}

export async function startServer(opts: ServerOptions = {}): Promise<RunningServer> {
    const staticDir = resolve(opts.staticDir ?? join(UPGO_DIR, "web", "dist"))
    const clients = new Set<http.ServerResponse>()
    const watchers = new Map<string, FSWatcher>()
    const timers = new Map<string, NodeJS.Timeout>()
    let port = opts.port ?? 4141

    // Only our own host names, so a DNS-rebinding page cannot reach the API. The Vite dev proxy (5173, also
    // every other Vite app's default) only with UPGO_DEV=1.
    const dev = opts.dev ?? process.env.UPGO_DEV === "1"
    const authorities = () => (dev ? [port, DEV_PORT] : [port]).flatMap((p) => [`127.0.0.1:${p}`, `localhost:${p}`])

    const broadcast = (event: string, data: unknown) => {
        for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
    const debounce = (key: string, fn: () => void) => {
        clearTimeout(timers.get(key))
        timers.set(key, setTimeout(fn, 100))
    }

    const syncWatchers = () => {
        let entries: Entry[]
        try {
            entries = readRegistry()
        } catch {
            entries = []
        }
        const wanted = new Map(entries.map((e) => [e.id, e.path]))
        for (const [id, w] of watchers) {
            if (!wanted.has(id)) {
                w.close()
                watchers.delete(id)
            }
        }
        for (const [id, path] of wanted) {
            if (watchers.has(id) || !existsSync(path)) continue
            try {
                const w = watch(path, (_event, filename) => {
                    if (filename && WATCHED.includes(basename(filename.toString()))) debounce(`p:${id}`, () => broadcast("project", { id }))
                })
                w.on("error", () => watchers.delete(id))
                watchers.set(id, w)
            } catch {
                // An unwatchable folder still works, it just is not live.
            }
        }
    }

    const regFile = registryPath()
    const regWatcher = existsSync(dirname(regFile))
        ? watch(dirname(regFile), (_event, filename) => {
              if (filename && basename(filename.toString()) === basename(regFile)) {
                  debounce("registry", () => {
                      syncWatchers()
                      broadcast("projects", {})
                  })
              }
          })
        : null
    syncWatchers()

    const entryFor = (id: string) => readRegistry().find((e) => e.id === id)
    // Writes need our header and, when the browser sends one, our own origin.
    const refusal = (req: http.IncomingMessage) => {
        if (req.headers["x-upgo"] !== "1") return "missing X-Upgo header"
        const origin = req.headers.origin
        if (origin && !authorities().some((a) => origin === `http://${a}`)) return "foreign origin"
    }

    async function api(req: http.IncomingMessage, res: http.ServerResponse, parts: string[]): Promise<void> {
        const method = req.method ?? "GET"

        if (method === "GET" && parts.length === 1 && parts[0] === "events") {
            res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", ...SECURITY_HEADERS })
            res.write(": connected\n\n")
            clients.add(res)
            req.on("close", () => clients.delete(res))
            return
        }

        if (method === "GET" && parts.length === 1 && parts[0] === "projects") {
            const projects = readRegistry().map((e) => {
                try {
                    return { id: e.id, path: e.path, ...summarize(readGoals(e.path)) }
                } catch (err) {
                    return { id: e.id, path: e.path, open: 0, done: 0, dropped: 0, percent: 0, phases: EMPTY_PHASES, now: [], next: [], recent: [], error: (err as Error).message }
                }
            })
            return send(res, 200, { projects })
        }

        if (parts[0] !== "projects" || !parts[1]) return fail(res, 404, "not found")
        const entry = entryFor(parts[1])
        if (!entry) return fail(res, 404, `no registered project \`${parts[1]}\``)

        if (method === "GET" && parts.length === 2) return send(res, 200, { id: entry.id, path: entry.path, file: readGoals(entry.path), ...trySuggestions(entry.path) })

        if (method === "GET" && parts.length === 4 && parts[2] === "detail") {
            const item = readGoals(entry.path).items.find((i) => i.id === parts[3])
            if (!item?.detail) return fail(res, 404, "this item has no detail file")
            const path = resolve(entry.path, item.detail)
            if (!inside(entry.path, path) || extname(path).toLowerCase() !== ".md") return fail(res, 403, "detail files must be .md files inside the project")
            if (!existsSync(path)) return fail(res, 404, `${item.detail} does not exist`)
            return send(res, 200, { path: item.detail, text: readFileSync(path, "utf8") })
        }

        if (method === "DELETE" && parts.length === 2) {
            const refused = refusal(req)
            if (refused) return fail(res, 403, refused)
            await forget(entry.id)
            return send(res, 200, { id: entry.id })
        }

        if (method === "POST" && parts.length === 3 && (parts[2] === "ops" || parts[2] === "suggestions")) {
            const refused = refusal(req)
            if (refused) return fail(res, 403, refused)
            if (!req.headers["content-type"]?.startsWith("application/json")) return fail(res, 415, "expected application/json")
            let body: unknown
            try {
                body = JSON.parse(await readBody(req))
            } catch (e) {
                return fail(res, e instanceof UpgoError ? 413 : 400, e instanceof UpgoError ? e.message : "body is not valid JSON")
            }
            if (parts[2] === "suggestions") {
                const asked = suggestionsBody.safeParse(body)
                if (!asked.success) return fail(res, 400, "invalid request", formatIssues(asked.error))
                const a = asked.data
                const suggestions = await updateSuggestions(entry.path, (list) => ("dismiss" in a ? removeSuggestions(list, a.dismiss) : restoreSuggestions(list, a.restore)))
                return send(res, 200, { suggestions })
            }
            const op = opSchema.safeParse(body)
            if (!op.success) return fail(res, 400, "invalid operation", formatIssues(op.error))
            const file = await updateGoals(entry.path, (f) => applyOp(f, op.data, today()))
            return send(res, 200, { file })
        }

        return fail(res, ["GET", "POST", "DELETE"].includes(method) ? 404 : 405, "not found")
    }

    function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
        if (req.method !== "GET" && req.method !== "HEAD") return fail(res, 405, "method not allowed")
        const index = join(staticDir, "index.html")
        if (!existsSync(index)) {
            res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS })
            res.end("upgo dashboard is not built yet: run `npm run build` in the upgo folder.\n")
            return
        }
        const candidate = resolve(staticDir, `.${decodeURIComponent(pathname)}`)
        const file = inside(staticDir, candidate) && existsSync(candidate) && statSync(candidate).isFile() ? candidate : index
        res.writeHead(200, {
            "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
            "Cache-Control": file === index ? "no-store" : "public, max-age=31536000, immutable",
            ...SECURITY_HEADERS,
        })
        res.end(req.method === "HEAD" ? undefined : readFileSync(file))
    }

    const server = http.createServer(async (req, res) => {
        try {
            if (!authorities().includes(req.headers.host ?? "")) return fail(res, 403, "unknown host")
            const { pathname } = new URL(req.url ?? "/", "http://upgo")
            if (pathname === "/api" || pathname.startsWith("/api/")) {
                await api(req, res, pathname.split("/").slice(2).filter(Boolean).map(decodeURIComponent))
            } else serveStatic(req, res, pathname)
        } catch (e) {
            if (res.headersSent) return void res.end()
            if (e instanceof UpgoError) return fail(res, 400, e.message.split("\n")[0], e.details)
            fail(res, 500, (e as Error).message)
        }
    })

    await new Promise<void>((ok, no) => {
        server.once("error", no)
        server.listen(port, HOST, () => ok())
    })
    port = (server.address() as { port: number }).port
    const heartbeat = setInterval(() => {
        for (const res of clients) res.write(": ping\n\n")
    }, 25_000)

    return {
        url: `http://${HOST}:${port}`,
        port,
        close: async () => {
            clearInterval(heartbeat)
            for (const t of timers.values()) clearTimeout(t)
            for (const w of watchers.values()) w.close()
            regWatcher?.close()
            for (const res of clients) res.end()
            clients.clear()
            server.closeAllConnections()
            await new Promise<void>((ok) => server.close(() => ok()))
        },
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { url } = await startServer({ port: Number(process.env.UPGO_PORT) || 4141 })
    process.stdout.write(`upgo dashboard on ${url}\n`)
}
