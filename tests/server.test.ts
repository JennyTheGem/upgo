import http from "node:http"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { register } from "../src/core/registry.ts"
import { GOALS, MD, readGoals, updateGoals } from "../src/core/store.ts"
import { startServer, type RunningServer } from "../server.ts"
import { fixture, isolateRegistry, makeProject, tempDir } from "./helpers.ts"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Res = { status: number; headers: http.IncomingHttpHeaders; body: string; json: () => any }

let server: RunningServer
let project: string
let staticDir: string

function req(path: string, opts: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Res> {
    return new Promise((ok, no) => {
        const r = http.request(
            { host: "127.0.0.1", port: server.port, path, method: opts.method ?? "GET", headers: { Host: `127.0.0.1:${server.port}`, ...opts.headers } },
            (res) => {
                let body = ""
                res.setEncoding("utf8")
                res.on("data", (c) => (body += c))
                res.on("end", () => ok({ status: res.statusCode ?? 0, headers: res.headers, body, json: () => JSON.parse(body) }))
            },
        )
        r.on("error", no)
        r.end(opts.body)
    })
}

const post = (op: unknown, headers: Record<string, string> = {}) =>
    req("/api/projects/demo/ops", { method: "POST", body: typeof op === "string" ? op : JSON.stringify(op), headers: { "Content-Type": "application/json", "X-Upgo": "1", ...headers } })

beforeEach(async () => {
    isolateRegistry()
    const f = fixture()
    f.items[0].detail = "docs/alpha.md"
    f.items[1].detail = "../outside.md"
    f.items[3].detail = "docs/notes.txt"
    project = await makeProject(f)
    mkdirSync(join(project, "docs"))
    writeFileSync(join(project, "docs", "alpha.md"), "# Alpha detail")
    writeFileSync(join(project, "docs", "notes.txt"), "secret")
    await register("demo", project)
    staticDir = tempDir()
    writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>upgo</title>")
    mkdirSync(join(staticDir, "assets"))
    writeFileSync(join(staticDir, "assets", "app.js"), "console.log(1)")
    server = await startServer({ port: 0, staticDir })
})

afterEach(() => server.close())

describe("server basics", () => {
    it("binds to 127.0.0.1 and sends security headers", async () => {
        expect(server.url).toBe(`http://127.0.0.1:${server.port}`)
        const r = await req("/api/projects")
        expect(r.headers["x-content-type-options"]).toBe("nosniff")
        expect(r.headers["content-security-policy"]).toMatch(/default-src 'self'/)
    })

    it("refuses foreign Host headers (DNS rebinding)", async () => {
        expect((await req("/api/projects", { headers: { Host: "evil.example:4141" } })).status).toBe(403)
        expect((await req("/", { headers: { Host: "evil.example" } })).status).toBe(403)
        expect((await req("/api/projects", { headers: { Host: `localhost:${server.port}` } })).status).toBe(200)
    })
})

describe("reading", () => {
    it("lists projects with counts and flags unreadable ones", async () => {
        const other = await makeProject({ ...fixture(), project: "other" })
        await register("other", other)
        writeFileSync(join(other, GOALS), "{")
        const { projects } = (await req("/api/projects")).json()
        expect(projects[0]).toMatchObject({ id: "demo", path: project, purpose: "Demo project", open: 5, done: 1, dropped: 1 })
        expect(projects[0].phases).toEqual({ now: 1, next: 1, later: 1, wayLater: 1, maybe: 1 })
        expect(projects[0].now).toEqual([{ id: "alpha", title: expect.any(String), status: "planned", size: "S" }])
        expect(projects[1]).toMatchObject({ id: "other", open: 0, error: expect.stringMatching(/not valid JSON/) })
    })

    it("returns one project and 404s unknown ids and routes", async () => {
        const r = (await req("/api/projects/demo")).json()
        expect(r.id).toBe("demo")
        expect(r.file.items).toHaveLength(7)
        expect((await req("/api/projects/ghost")).status).toBe(404)
        expect((await req("/api/projects/..%2F..%2Fetc")).status).toBe(404)
        expect((await req("/api/nothing")).status).toBe(404)
        expect((await req("/api/projects/demo", { method: "PUT" })).status).toBe(405)
    })

    it("serves an item's detail file only when it is an .md inside the project", async () => {
        expect((await req("/api/projects/demo/detail/alpha")).json()).toEqual({ path: "docs/alpha.md", text: "# Alpha detail" })
        expect((await req("/api/projects/demo/detail/beta")).status).toBe(403)
        expect((await req("/api/projects/demo/detail/delta")).status).toBe(403)
        expect((await req("/api/projects/demo/detail/gamma")).status).toBe(404)
        expect((await req("/api/projects/demo/detail/nope")).status).toBe(404)
    })
})

describe("writing", () => {
    it("applies ops, returns the new file and regenerates goals.md", async () => {
        const r = await post({ op: "add", item: { section: 1, title: "From the UI", phase: "now" } })
        expect(r.status).toBe(200)
        expect(r.json().file.items.map((i: { id: string }) => i.id)).toContain("from-the-ui")
        expect(readFileSync(join(project, MD), "utf8")).toContain("`from-the-ui` From the UI (now)")
        await post({ op: "edit", id: "alpha", patch: { phase: "later", size: null } })
        expect(readGoals(project).items[0]).toMatchObject({ phase: "later" })
        expect(readGoals(project).items[0].size).toBeUndefined()
        await post({ op: "drop", id: "beta", reason: "nah" })
        await post({ op: "move", id: "gamma", before: "alpha" })
        await post({ op: "renameSection", n: 2, title: "Interface" })
        const f = readGoals(project)
        expect(f.items.find((i) => i.id === "beta")).toMatchObject({ status: "dropped", note: "nah" })
        expect(f.items[0].id).toBe("gamma")
        expect(f.sections[1].title).toBe("Interface")
    })

    it("requires the custom header, JSON and a local origin", async () => {
        const op = { op: "done", id: "alpha" }
        expect((await req("/api/projects/demo/ops", { method: "POST", body: JSON.stringify(op), headers: { "Content-Type": "application/json" } })).status).toBe(403)
        expect((await post(op, { "Content-Type": "text/plain" })).status).toBe(415)
        expect((await post(op, { Origin: "https://evil.example" })).status).toBe(403)
        expect((await post(op, { Origin: `http://127.0.0.1:${server.port}` })).status).toBe(200)
        expect((await post({ op: "reopen", id: "alpha" }, { Origin: "http://localhost:5173" })).status).toBe(403)
        expect(readGoals(project).items[0].status).toBe("done")
    })

    it("trusts the Vite dev port only in dev mode", async () => {
        expect((await req("/api/projects", { headers: { Host: "localhost:5173" } })).status).toBe(403)
        await server.close()
        server = await startServer({ port: 0, staticDir, dev: true })
        expect((await req("/api/projects", { headers: { Host: "localhost:5173" } })).status).toBe(200)
        expect((await post({ op: "done", id: "alpha" }, { Origin: "http://localhost:5173" })).status).toBe(200)
    })

    it("rejects bad bodies with readable errors and leaves the file alone", async () => {
        const before = readFileSync(join(project, GOALS), "utf8")
        let r = await post("{ nope")
        expect([r.status, r.json().error]).toEqual([400, "body is not valid JSON"])
        r = await post({ op: "edit", id: "alpha", patch: { phase: "soon" } })
        expect(r.status).toBe(400)
        expect(r.json().details[0]).toMatch(/^patch\.phase:/)
        r = await post({ op: "done", id: "alpha", path: "C:/Windows" })
        expect(r.status).toBe(400)
        r = await post({ op: "delete", id: "nope" })
        expect([r.status, r.json().error]).toEqual([400, "no item `nope` in demo"])
        r = await post({ op: "deleteSection", n: 1 })
        expect(r.json().error).toMatch(/still holds/)
        r = await post({ op: "add", item: { section: 1, title: "dash \u2014 here", phase: "now" } })
        expect(r.json().details[0]).toMatch(/em dash/)
        r = await post(JSON.stringify({ op: "done", id: "alpha", note: "x".repeat(1_100_000) }))
        expect(r.status).toBe(413)
        expect(readFileSync(join(project, GOALS), "utf8")).toBe(before)
    })
})

describe("removing a project", () => {
    it("unregisters it with the header and a local origin, leaving its files", async () => {
        const del = (headers: Record<string, string>) => req("/api/projects/demo", { method: "DELETE", headers })
        expect((await del({})).status).toBe(403)
        expect((await del({ "X-Upgo": "1", Origin: "https://evil.example" })).status).toBe(403)
        expect((await del({ "X-Upgo": "1", Origin: `http://127.0.0.1:${server.port}` })).json()).toEqual({ id: "demo" })
        expect((await req("/api/projects")).json().projects).toEqual([])
        expect((await del({ "X-Upgo": "1" })).status).toBe(404)
        expect(readGoals(project).project).toBe("demo")
    })
})

describe("static files", () => {
    it("serves assets and falls back to index.html, never outside the folder", async () => {
        const js = await req("/assets/app.js")
        expect([js.status, js.headers["content-type"], js.body]).toEqual([200, "text/javascript; charset=utf-8", "console.log(1)"])
        expect((await req("/")).body).toMatch(/<title>upgo/)
        expect((await req("/some/client/route")).body).toMatch(/<title>upgo/)
        writeFileSync(join(staticDir, "..", "secret.txt"), "nope")
        expect((await req("/..%2fsecret.txt")).body).toMatch(/<title>upgo/)
        expect((await req("/", { method: "POST" })).status).toBe(405)
    })

    it("says so when the dashboard is not built", async () => {
        await server.close()
        server = await startServer({ port: 0, staticDir: tempDir() })
        const r = await req("/")
        expect([r.status, r.body]).toEqual([503, expect.stringMatching(/npm run build/)])
    })
})

describe("live events", () => {
    function listen(): Promise<{ events: string[]; close: () => void }> {
        return new Promise((ok) => {
            const events: string[] = []
            const r = http.get({ host: "127.0.0.1", port: server.port, path: "/api/events", headers: { Host: `127.0.0.1:${server.port}` } }, (res) => {
                expect(res.headers["content-type"]).toBe("text/event-stream")
                res.setEncoding("utf8")
                res.on("data", (c: string) => events.push(c))
                ok({ events, close: () => r.destroy() })
            })
        })
    }

    it("pushes a project event when goals.json changes on disk", async () => {
        const sse = await listen()
        await updateGoals(project, (f) => ({ ...f, purpose: "changed by an agent" }))
        await vi.waitFor(() => expect(sse.events.join("")).toContain('event: project\ndata: {"id":"demo"}'), { timeout: 5000 })
        sse.close()
    })

    it("pushes a projects event when the registry changes", async () => {
        const sse = await listen()
        await register("other", await makeProject({ ...fixture(), project: "other" }))
        await vi.waitFor(() => expect(sse.events.join("")).toContain("event: projects\ndata: {}"), { timeout: 5000 })
        await updateGoals(project, (f) => f)
        sse.close()
    })
})
