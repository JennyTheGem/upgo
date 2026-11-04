import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { importMarkdown } from "../src/core/import.ts"
import { localIssues } from "../src/core/rules.ts"
import type { GoalsFile, Item } from "../src/core/schema.ts"
import { parseGoals } from "../src/core/store.ts"

const TODAY = "2026-10-12"
const EM = String.fromCharCode(0x2014)
const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url))
// Real roadmaps stay local (gitignored); their tests skip when the folder is missing.
const PRIVATE = fileURLToPath(new URL("./fixtures-private/", import.meta.url))

const run = (md: string, completedMd?: string) => importMarkdown(md, { project: "demo", today: TODAY, completedMd })
const md = (...lines: string[]) => lines.join("\n")
const find = (file: GoalsFile, title: string): Item => {
    const hit = file.items.find((i) => i.title === title)
    if (!hit) throw new Error(`no item titled "${title}" in: ${file.items.map((i) => i.title).join(" | ")}`)
    return hit
}

describe("importMarkdown: sections", () => {
    it("parses numbered, § and unnumbered sections, merges the completed file and drops empty ones", () => {
        const { file, report } = run(
            md("# Demo", "", "Purpose: a demo project", "that wraps.", "", "## 1. Alpha", "- [ ] One", "", "## §2 Beta", "- 📋 Two", "", "## Gamma", "- 🚧 Three", "", "## 4. Empty", "Just prose."),
            md("# Done", "", "## 1. Alpha (old name)", "- Shipped thing", "", "## 5. Only done", "- Old thing"),
        )
        expect(file.sections).toEqual([
            { n: 1, title: "Alpha" },
            { n: 2, title: "Beta" },
            { n: 5, title: "Only done" },
            { n: 6, title: "Gamma" },
        ])
        expect(file.purpose).toBe("a demo project that wraps.")
        expect(find(file, "Shipped thing").section).toBe(1)
        expect(find(file, "Three").section).toBe(6)
        expect(report).toMatchObject({ open: 3, done: 2, dropped: 0, sections: 4, skipped: ["Just prose."] })
    })

    it("ignores the preamble and everything after a rule until the next heading", () => {
        const { file } = run(md("# T", "", "Legend: ✅ · 🚧", "", "- ✅ preamble bullet", "", "## 1. A", "- [ ] Kept", "", "---", "", "- [ ] After the rule"))
        expect(file.items.map((i) => i.title)).toEqual(["Kept"])
    })

    it("reports what it ignores after a rule and under a trap heading", () => {
        const { file, report } = run(md("### Traps", "", "Read these first.", "", "- **Real trap** body", "", "## 1. A", "- [ ] Kept", "", "---", "", "- [ ] After the rule"))
        expect(file.traps.map((t) => t.title)).toEqual(["Real trap"])
        expect(report.skipped).toEqual(["Read these first.", "- [ ] After the rule"])
    })
})

describe("importMarkdown: traps", () => {
    it("turns the bullets of a trap heading into traps and nothing else", () => {
        const { file } = run(
            md(
                "# X",
                "",
                "### Live traps (read first)",
                "",
                "- **Backdrop root**, so a fading wrapper flattens the blur.",
                "  More on a second line.",
                "- Plain trap sentence here. With more after it.",
                "",
                "### How to read this",
                "",
                "- not a trap",
                "",
                "## 1. A",
                "- [ ] Item",
            ),
        )
        expect(file.traps).toEqual([
            { id: "backdrop-root", title: "Backdrop root", body: "so a fading wrapper flattens the blur. More on a second line." },
            { id: "plain-trap-sentence-here", title: "Plain trap sentence here", body: "With more after it." },
        ])
        expect(file.items).toHaveLength(1)
    })
})

describe("importMarkdown: items", () => {
    it("maps every marker to a status", () => {
        const { file } = run(md("## 1. A", "- [ ] Open box", "- [x] Checked box", "- ✅ Check mark", "- 🚧 Partial one", "- 📋 Planned one", "- ❌ Crossed one"))
        expect(file.items.map((i) => i.status)).toEqual(["planned", "done", "done", "partial", "planned", "dropped"])
        expect(find(file, "Crossed one").note).toBe("dropped")
    })

    it("reads phase tags, bold or not, and defaults to later", () => {
        const { file } = run(
            md(
                "## 1. A",
                "- [ ] **(Now)** First",
                "- [ ] (next) Second",
                "- [ ] **(Later)** Third",
                "- [ ] **(Way later)** Fourth",
                "- [ ] **(Way later, maybe)** Fifth",
                "- [ ] (Maybe) Sixth",
                "- [ ] Seventh",
                "- ✅ Eighth",
            ),
        )
        expect(file.items.map((i) => [i.title, i.phase])).toEqual([
            ["First", "now"],
            ["Second", "next"],
            ["Third", "later"],
            ["Fourth", "wayLater"],
            ["Fifth", "maybe"],
            ["Sixth", "maybe"],
            ["Seventh", "later"],
            ["Eighth", "later"],
        ])
    })

    it("takes a bold run as the title and the first sentence or clause of plain text", () => {
        const long = "A very long plain item that goes on and on without any sentence end at all, listing things, more things and still more things until it passes"
        expect(long.length).toBeGreaterThan(120)
        const { file } = run(
            md(
                "## 1. A",
                "- [ ] **(Next)** **Bold title.** The body follows.",
                "  - a plain sub-bullet",
                "- [ ] Plain first sentence. Second sentence stays in the body.",
                `- [ ] ${long}`,
                "- [ ] Short plain item",
                "- [ ] Wrapped title",
                "  continues here. Rest.",
                "- [ ] Cut before the date (2026-07-05), not after.",
            ),
        )
        expect(find(file, "Bold title")).toMatchObject({ phase: "next", body: "The body follows.\n- a plain sub-bullet" })
        expect(find(file, "Plain first sentence").body).toBe("Plain first sentence. Second sentence stays in the body.")
        expect(find(file, "A very long plain item that goes on and on without any sentence end at all").body).toBe(long)
        expect(find(file, "Short plain item").body).toBeUndefined()
        expect(find(file, "Wrapped title continues here").body).toBe("Wrapped title continues here. Rest.")
        expect(find(file, "Cut before the date").created).toBe(TODAY)
        for (const i of file.items) expect(i.title).not.toMatch(/\n/)
    })

    it("reads size and scope right after the title", () => {
        const { file } = run(
            md("## 1. A", "- [ ] **Sized** (M, all platforms). Body.", "- [ ] **Scoped** (S, Velora + local, backend)", "- [ ] **Not a size** (Management UI). Body.", "- [ ] **Size only** (L)."),
        )
        expect(find(file, "Sized")).toMatchObject({ size: "M", scope: ["all platforms"], body: "Body." })
        expect(find(file, "Scoped")).toMatchObject({ size: "S", scope: ["velora + local", "backend"] })
        expect(find(file, "Scoped").body).toBeUndefined()
        expect(find(file, "Not a size")).toMatchObject({ body: "(Management UI). Body." })
        expect(find(file, "Not a size").size).toBeUndefined()
        expect(find(file, "Size only").size).toBe("L")
        expect(find(file, "Size only").scope).toBeUndefined()
    })

    it("dates done items from their title and leaves the rest on today", () => {
        const { file } = run(
            md("## 1. A", "- [ ] **Open thing** (S, all)"),
            md(
                "## 1. A",
                "- **Bold dated (2026-07-01).** Body one.",
                "- **Paren after** (2026-07-02): body two.",
                "- ✅ **2026-07-03 - Leading date.** Body three.",
                "- 2026-07-04 Leading plain date entry",
                "- Plain with date (2026-07-05), and more text.",
                "- **Closed 2026-07-06**: the real title. More.",
                "- Undated entry",
            ),
        )
        const dated = (title: string) => {
            const i = find(file, title)
            expect(i.created).toBe(i.updated)
            return i.created
        }
        expect(dated("Bold dated")).toBe("2026-07-01")
        expect(dated("Paren after")).toBe("2026-07-02")
        expect(find(file, "Paren after").body).toBe("body two.")
        expect(dated("Leading date")).toBe("2026-07-03")
        expect(dated("Leading plain date entry")).toBe("2026-07-04")
        expect(find(file, "Leading plain date entry").body).toBeUndefined()
        expect(dated("Plain with date")).toBe("2026-07-05")
        expect(find(file, "Plain with date").body).toBe("Plain with date (2026-07-05), and more text.")
        expect(dated("the real title")).toBe("2026-07-06")
        expect(dated("Undated entry")).toBe(TODAY)
        expect(dated("Open thing")).toBe(TODAY)
    })

    it("recognises every dropped form and keeps the reason in the note", () => {
        const { file } = run(
            "",
            md(
                "## 1. A",
                "- **Dropped: Night mode (2026-10-04).** Cut by decision; don't re-propose.",
                "- **Lyrics search, dropped 2026-07-19.** Belongs in a plugin.",
                "- Cover warming dropped (2026-07-18). The backend does it now.",
                "- **Tauri shell, then dropped (2026-08-06).** Not worth a second shell.",
                "- **Bare drop, dropped 2026-07-01.**",
                "- ❌ **The brand axis is DROPPED. Do not rebuild it.**",
                "  Jenny said so.",
                "- **Drop a song on the player (2026-10-01).** A dropped song plays now.",
                "- ✅ **Old dep dropped.** Replaced by the new one.",
            ),
        )
        const dropped = (title: string, note: string, created = TODAY) => expect(find(file, title)).toMatchObject({ status: "dropped", note, created })
        dropped("Night mode", "Cut by decision; don't re-propose.", "2026-10-04")
        dropped("Lyrics search", "Belongs in a plugin.", "2026-07-19")
        dropped("Cover warming", "The backend does it now.", "2026-07-18")
        dropped("Tauri shell", "Not worth a second shell.", "2026-08-06")
        dropped("Bare drop", "dropped", "2026-07-01")
        dropped("The brand axis", "Do not rebuild it. Jenny said so.")
        expect(find(file, "Drop a song on the player")).toMatchObject({ status: "done", body: "A dropped song plays now." })
        expect(find(file, "Old dep dropped").status).toBe("done")
        for (const i of file.items.filter((x) => x.status === "dropped")) expect(i.body).toBeUndefined()
    })

    it("splits pointer sub-bullets from the body and keeps continuation lines", () => {
        const { file } = run(
            md(
                "## 1. A",
                "- [ ] **Pointers.** Body text.",
                "  - ↳ files: `a.ts`, `b.ts`",
                "  - ↳ seam: `musicService`",
                "  - ↳ trap: first trap",
                "  - ↳ trap: second trap",
                "    continues here",
                "  - ↳ unknown: stays in body",
                "  - a plain sub-bullet",
                "",
                "  Paragraph after a blank line.",
                "",
                "- [ ] Next item",
            ),
        )
        const p = find(file, "Pointers")
        expect(p.pointers).toEqual({ files: ["`a.ts`, `b.ts`"], seam: ["`musicService`"], trap: ["first trap", "second trap continues here"] })
        expect(p.body).toBe("Body text.\n- ↳ unknown: stays in body\n- a plain sub-bullet\n\nParagraph after a blank line.")
        expect(find(file, "Next item").body).toBeUndefined()
    })

    it("treats completed paragraphs as items, attaches top-level pointers upward and skips placeholders", () => {
        const { file, report } = run(
            "",
            md(
                "## 1. A",
                "**Paragraph entry (2026-07-07).** Shipped as a paragraph",
                "that wraps.",
                "- ↳ files: `x.ts`",
                "- **Bullet entry (2026-07-08).** Body.",
                "- ↳ review passes: extra note",
                "",
                "_(open, see `goals.md`)_",
                "",
                "### No record above",
                "",
                "| a | b |",
                "|---|---|",
            ),
        )
        expect(find(file, "Paragraph entry")).toMatchObject({ created: "2026-07-07", body: "Shipped as a paragraph that wraps.", pointers: { files: ["`x.ts`"] } })
        expect(find(file, "Bullet entry").body).toBe("Body.\n- ↳ review passes: extra note")
        expect(file.items).toHaveLength(2)
        expect(report.skipped).toEqual(["| a | b |"])
    })

    it("folds a record's bullets, follow-on paragraphs and tables into it, keeps dated and dropped ones apart, skips noise", () => {
        const { file, report } = run(
            "",
            md(
                "## 1. A",
                "- Verified: tsc clean.",
                "",
                "**Record (2026-07-07).** It shipped.",
                "",
                "- **Part**: one detail",
                "  that wraps.",
                "  - a sub point",
                "- Verified: tsc clean.",
                "",
                "**Files** are two folders.",
                "",
                "More prose about the record.",
                "",
                "| a | b |",
                "|---|---|",
                "",
                "- **Later fix (2026-08-01).** Its own record.",
                "- **Closed 2026-07-10**: the X idea was dropped, not wanted.",
                "- No known gaps.",
                "",
                "**Next record.** Separate.",
                "",
                "### Sub area",
                "",
                "- Stands alone.",
            ),
        )
        expect(file.items.map((i) => [i.title, i.status])).toEqual([
            ["Record", "done"],
            ["Later fix", "done"],
            ["the X idea", "dropped"],
            ["Next record", "done"],
            ["Stands alone", "done"],
        ])
        expect(find(file, "Record").body).toBe(
            "It shipped.\n\n- **Part**: one detail that wraps.\n  - a sub point\n\n**Files** are two folders.\n\nMore prose about the record.\n\n| a | b |\n|---|---|",
        )
        expect(find(file, "the X idea").note).toBe("not wanted.")
        expect(report.skipped).toEqual(["Verified: tsc clean.", "Verified: tsc clean.", "No known gaps."])
    })

    it("links the first goalsDetails file as detail", () => {
        const { file } = run(
            md("## 1. A", "- [ ] **Detailed.** Plan: [`x`](./docs/goalsDetails/x.md), also [y](./docs/goalsDetails/y.md).", "- [ ] **No detail.** See [docs](./docs/other.md)."),
        )
        expect(find(file, "Detailed").detail).toBe("docs/goalsDetails/x.md")
        expect(find(file, "No detail").detail).toBeUndefined()
    })

    it("dedupes ids across open and completed items", () => {
        const { file } = run(md("## 1. A", "- [ ] Same title", "- [ ] Same title"), md("## 1. A", "- Same title"))
        expect(file.items.map((i) => i.id)).toEqual(["same-title", "same-title-2", "same-title-3"])
    })

    it("replaces every em dash", () => {
        const { file } = run(md(`# T ${EM} roadmap`, "", "### Traps", "", `- **Trap ${EM} one** body ${EM}x`, "", `## 1. A ${EM} B`, `- [ ] Title ${EM} with dash`, `  - ↳ files: a${EM}b`))
        expect(JSON.stringify(file)).not.toContain(EM)
        expect(file.sections[0].title).toBe("A, B")
        expect(file.traps[0]).toMatchObject({ title: "Trap, one", body: "body, x" })
        expect(find(file, "Title, with dash").pointers).toEqual({ files: ["a, b"] })
        expect(localIssues(file)).toEqual([])
    })

    it("skips plain bullets and prose in goals.md and reports them", () => {
        const long = `- Shipped note ${"x".repeat(80)}`
        const { file, report } = run(md("## 1. A", "", "Section intro prose.", "", "- [ ] Real item", long))
        expect(file.items.map((i) => i.title)).toEqual(["Real item"])
        expect(report.skipped).toEqual(["Section intro prose.", long.slice(0, 60)])
    })
})

const PRIVATE_COUNTS: Record<string, [number, number]> = {
    velora: [15, 29],
    "velora-cross": [0, 4],
    upex: [0, 6],
    beyondui: [0, 8],
    uplift: [0, 10],
    portfolio: [0, 11],
    chat: [0, 4],
}
const COUNTS: Record<string, [number, number]> = { sample: [2, 5], ...(existsSync(PRIVATE) ? PRIVATE_COUNTS : {}) }
const REAL = Object.keys(COUNTS)
const dirOf = (name: string) => (name in PRIVATE_COUNTS ? PRIVATE : FIXTURES)
const read = (path: string) => {
    const full = dirOf(path.split("/")[0]) + path
    return existsSync(full) ? readFileSync(full, "utf8") : undefined
}
const lines = (text = "") => text.replace(/\r/g, "").split("\n")

// First lines of the top-level bullets (bar `- ↳` pointers) and paragraphs inside sections, placeholders aside.
function completedEntries(text?: string): string[] {
    let inSection = false
    let prev = ""
    const out: string[] = []
    for (const l of lines(text)) {
        if (/^## /.test(l)) inSection = true
        else if (/^-{3,}\s*$/.test(l)) inSection = false
        else if (inSection && /^- (?!↳)/.test(l)) out.push(l)
        else if (inSection && /^[^\s\-#|]/.test(l) && (prev === "" || /^[#|]/.test(prev)) && !/^[_*]*\(.*\)[_*]*$/.test(l.trim())) out.push(l)
        prev = l
    }
    return out
}

// Loose text for "is this still in there": no markup, dates, punctuation or case.
const loose = (s: string) =>
    ` ${s.replace(new RegExp(`,?[ \t]*${EM}[ \t]*`, "g"), ", ").replace(/\d{4}-\d{2}-\d{2}/g, " ").replace(/(?:[*_`()[\]{}.,:;!?"'|§↳-]|✅|🚧|📋|❌|\u{FE0F})+/gu, " ").replace(/\s+/g, " ").trim().toLowerCase()} `

const lastWords = (line: string, n = 4) => loose(line).trim().split(" ").slice(-n).join(" ")

const imported = new Map(
    REAL.map((name) => {
        const goals = read(`${name}/goals.md`)!
        return [name, { goals, ...importMarkdown(goals, { project: name, today: TODAY, completedMd: read(`${name}/goals-completed.md`) }) }]
    }),
)

describe("importMarkdown: real roadmaps", () => {
    it.each(REAL)("%s converts into a valid file with every item accounted for", (name) => {
        const { goals, file, report } = imported.get(name)!
        expect(() => parseGoals(JSON.parse(JSON.stringify(file)))).not.toThrow()
        expect(localIssues(file)).toEqual([])
        const open = lines(goals).filter((l) => /^- (\[ \]|🚧|📋)/.test(l)).length
        const entries = completedEntries(read(`${name}/goals-completed.md`))
        const closed = lines(goals).filter((l) => /^- (\[[xX]\]|✅|❌)/.test(l)).length + entries.length
        expect(file.items.filter((i) => i.status === "planned" || i.status === "partial")).toHaveLength(open)
        // Archive bullets and paragraphs fold into the record above them, so there are at most as many closed items.
        expect(file.items.filter((i) => i.status === "done" || i.status === "dropped").length).toBeLessThanOrEqual(closed)
        const kept = loose(
            [...file.items.flatMap((i) => [i.title, i.body ?? "", i.note ?? "", ...Object.values(i.pointers ?? {}).flat()]), ...report.skipped].join("\n"),
        )
        expect(entries.filter((l) => !kept.includes(` ${lastWords(l)} `) && !kept.includes(loose(l).slice(0, 30)))).toEqual([])
        expect(report.open + report.done + report.dropped).toBe(file.items.length)
        for (const i of file.items) expect(i.title).not.toMatch(/[\r\n]/)
    })

    it("keeps the expected trap and section counts", () => {
        const counts = Object.fromEntries(REAL.map((n) => [n, [imported.get(n)!.report.traps, imported.get(n)!.report.sections]]))
        expect(counts).toEqual(COUNTS)
    })

    // Minimum pointer sub-bullets, so the check cannot pass on an empty match.
    const POINTERS: Record<string, number> = { sample: 5, velora: 51 }
    it.each(REAL.filter((n) => n in POINTERS))("%s lands every pointer sub-bullet in some item's pointers", (name) => {
        const { goals, file } = imported.get(name)!
        const have = new Set(file.items.flatMap((i) => Object.entries(i.pointers ?? {}).flatMap(([k, vs]) => vs.map((v) => `${k}:${v}`))))
        const want = [...goals.replace(/\r/g, "").matchAll(/^[ \t]+- ↳ (files|seam|depends|trap|how|check|options|where):\s*(.+)$/gm)]
        expect(want.length).toBeGreaterThanOrEqual(POINTERS[name])
        for (const [, key, value] of want) expect(have).toContain(`${key}:${value.trim()}`)
    })

    it.skipIf(!imported.has("velora"))("converts known Velora items exactly", () => {
        const { file } = imported.get("velora")!
        const byId = (id: string) => file.items.find((i) => i.id === id)
        expect(byId("random-logouts")).toMatchObject({ section: 10, title: "Random logouts", phase: "next", status: "planned", created: TODAY })
        const profiles = byId("audio-profiles-per-output-device")!
        expect(profiles).toMatchObject({ section: 1, phase: "later", size: "M", scope: ["all platforms"] })
        expect(Object.keys(profiles.pointers ?? {}).sort()).toEqual(["depends", "files", "seam", "trap"])
        expect(profiles.body).toMatch(/^EQ, volume and crossfeed remembered per `sinkId`/)
        expect(byId("night-mode")).toMatchObject({ section: 1, status: "dropped", created: "2026-10-04" })
        expect(byId("night-mode")!.note).toMatch(/^A one-toggle compressor preset plus volume cap/)
        expect(byId("party-mode")).toMatchObject({ section: 27, phase: "maybe", detail: "docs/goalsDetails/party-mode.md" })
        expect(file.traps[0]).toMatchObject({ id: "an-ancestor-with-opacity-1-or-a-filter-is-a", title: "An ancestor with `opacity < 1` (or a `filter`) is a backdrop root" })
        expect(file.traps[0].body).toMatch(/^so anything under it renders its `backdrop-filter`/)
    })
})
