import fsp from "node:fs/promises"
import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { render } from "../src/core/render.ts"
import { findProjectDir, GOALS, MD, readGoals, saveGoals, serialize, updateGoals, withLock, writeAtomic } from "../src/core/store.ts"
import { SCHEMA_URL } from "../src/core/schema.ts"
import { UpgoError } from "../src/core/util.ts"
import { fixture, makeProject, tempDir } from "./helpers.ts"

afterEach(() => vi.restoreAllMocks())

describe("store", () => {
    it("finds the project walking up from a nested folder", async () => {
        const dir = await makeProject()
        const nested = join(dir, "a", "b", "c")
        mkdirSync(nested, { recursive: true })
        expect(findProjectDir(nested)).toBe(dir)
        expect(findProjectDir(dir)).toBe(dir)
        expect(findProjectDir(tempDir())).toBeNull()
    })

    it("reads what it saved, with $schema first and a rendered goals.md", async () => {
        const dir = await makeProject()
        const raw = readFileSync(join(dir, GOALS), "utf8")
        expect(Object.keys(JSON.parse(raw))[0]).toBe("$schema")
        expect(JSON.parse(raw).$schema).toBe(SCHEMA_URL)
        expect(readGoals(dir).items.map((i) => i.id)).toEqual(fixture().items.map((i) => i.id))
        expect(readFileSync(join(dir, MD), "utf8")).toBe(render(readGoals(dir)))
    })

    it("writes keys in schema order whatever order they came in", () => {
        const f = fixture()
        const shuffled = { ...f, items: f.items.map((i) => Object.fromEntries(Object.entries(i).reverse())) } as typeof f
        expect(serialize(shuffled)).toBe(serialize(f))
    })

    it("explains missing, broken and invalid files", () => {
        const dir = tempDir()
        expect(() => readGoals(dir)).toThrow(/no goals.json/)
        writeFileSync(join(dir, GOALS), "{ nope")
        expect(() => readGoals(dir)).toThrow(/not valid JSON/)
        writeFileSync(join(dir, GOALS), JSON.stringify({ ...fixture(), version: 9 }))
        expect(() => readGoals(dir)).toThrow(UpgoError)
    })

    it("refuses to save an invalid file and leaves the old one untouched", async () => {
        const dir = await makeProject()
        const before = readFileSync(join(dir, GOALS), "utf8")
        const bad = fixture()
        bad.items.push({ ...bad.items[0] })
        await expect(saveGoals(dir, bad)).rejects.toThrow(/duplicate item id `alpha`/)
        await expect(saveGoals(dir, { ...fixture(), project: "Bad Id" })).rejects.toThrow(/project/)
        expect(readFileSync(join(dir, GOALS), "utf8")).toBe(before)
    })

    it("leaves no partial file or temp file when a write throws", async () => {
        const dir = tempDir()
        const target = join(dir, "x.json")
        writeFileSync(target, "old")
        vi.spyOn(fsp, "rename").mockRejectedValue(Object.assign(new Error("disk gone"), { code: "EIO" }))
        await expect(writeAtomic(target, "new")).rejects.toThrow("disk gone")
        expect(readFileSync(target, "utf8")).toBe("old")
        expect(readdirSync(dir)).toEqual(["x.json"])
    })

    it("retries a rename Windows briefly refuses", async () => {
        const dir = tempDir()
        const target = join(dir, "x.json")
        const real = fsp.rename.bind(fsp)
        let calls = 0
        vi.spyOn(fsp, "rename").mockImplementation(async (a, b) => {
            if (++calls < 3) throw Object.assign(new Error("busy"), { code: "EPERM" })
            return real(a, b)
        })
        await writeAtomic(target, "new")
        expect(readFileSync(target, "utf8")).toBe("new")
        expect(calls).toBe(3)
    })

    it("says goals.json was saved when only goals.md fails, so nobody retries the change", async () => {
        const dir = await makeProject()
        const real = fsp.rename.bind(fsp)
        vi.spyOn(fsp, "rename").mockImplementation(async (a, b) => {
            if (String(b).endsWith(MD)) throw Object.assign(new Error("disk gone"), { code: "EIO" })
            return real(a, b)
        })
        await expect(updateGoals(dir, (f) => ({ ...f, purpose: "Saved" }))).rejects.toThrow(/goals.json was saved.*upgo render/s)
        expect(readGoals(dir).purpose).toBe("Saved")
    })

    it("a held lock blocks a second writer until released", async () => {
        const target = join(tempDir(), "f")
        const order: string[] = []
        let release!: () => void
        const first = withLock(target, async () => {
            order.push("first in")
            await new Promise<void>((r) => (release = r))
            order.push("first out")
        })
        await vi.waitFor(() => expect(order).toEqual(["first in"]))
        const second = withLock(target, async () => {
            order.push("second")
        })
        await new Promise((r) => setTimeout(r, 150))
        expect(order).toEqual(["first in"])
        release()
        await Promise.all([first, second])
        expect(order).toEqual(["first in", "first out", "second"])
        expect(existsSync(`${target}.lock`)).toBe(false)
    })

    it("gives up on a live lock after waiting and takes over a stale one", async () => {
        const target = join(tempDir(), "f")
        writeFileSync(`${target}.lock`, "someone")
        await expect(withLock(target, async () => "never")).rejects.toThrow(/locked by another writer/)
        const old = new Date(Date.now() - 60_000)
        utimesSync(`${target}.lock`, old, old)
        await expect(withLock(target, async () => "ran")).resolves.toBe("ran")
    }, 10_000)

    it("releases the lock when the mutation throws", async () => {
        const dir = await makeProject()
        await expect(
            updateGoals(dir, () => {
                throw new UpgoError("boom")
            }),
        ).rejects.toThrow("boom")
        expect(existsSync(join(dir, `${GOALS}.lock`))).toBe(false)
    })

    it("a lockfile Windows will not delete yet does not turn a saved change into a failure", async () => {
        const target = join(tempDir(), "f")
        vi.spyOn(fsp, "rm").mockRejectedValue(Object.assign(new Error("busy"), { code: "EPERM" }))
        await expect(withLock(target, async () => "saved")).resolves.toBe("saved")
    })

    it("every update re-renders goals.md", async () => {
        const dir = await makeProject()
        await updateGoals(dir, (f) => ({ ...f, items: f.items.map((i) => (i.id === "alpha" ? { ...i, title: "Renamed" } : i)) }))
        expect(readFileSync(join(dir, MD), "utf8")).toContain("`alpha` Renamed (now)")
    })

    it("serializes concurrent updates without losing one", async () => {
        const dir = await makeProject()
        await Promise.all(
            ["one", "two", "three", "four"].map((id) =>
                updateGoals(dir, (f) => ({ ...f, items: [...f.items, { ...f.items[0], id, title: id }] })),
            ),
        )
        expect(readGoals(dir).items.map((i) => i.id)).toEqual(expect.arrayContaining(["one", "two", "three", "four"]))
    })
})
