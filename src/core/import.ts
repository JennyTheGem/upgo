import type { GoalsFile, Item, Phase, PointerKey, Pointers, Section, Size, Status, Trap } from "./schema.ts"
import { isOpenStatus, POINTER_KEYS } from "./vocab.ts"
import { localIssues } from "./rules.ts"
import { parseGoals } from "./store.ts"
import { slugify, uniqueSlug, UpgoError } from "./util.ts"

export type ImportReport = { open: number; done: number; dropped: number; traps: number; sections: number; skipped: string[] }

type Block = { kind: "bullet" | "para" | "table"; lines: string[] }
type Entry = { kind: "heading"; level: number; text: string } | { kind: "hr" } | Block
type Draft = {
    key: string
    title: string
    status: Status
    phase: Phase
    size?: Size
    scope?: string[]
    body?: string
    note?: string
    pointers: Pointers
    detail?: string
    date?: string
}

const EM_DASH = new RegExp(`,?[ \\t]*${String.fromCharCode(0x2014)}[ \\t]*`, "g")
const DATE = /\d{4}-\d{2}-\d{2}/
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/
const BULLET = /^[-*+]\s+/
const LIST = /^\s*(?:[-*+]|\d+[.)])\s/
const BOLD = /^\*\*(.+?)\*\*/
const MARKER = /^(\[ \]|\[[xX]\]|✅|🚧|📋|❌)️?\s*/
const PHASE_TAG = /^\*{0,2}\(\s*(now|next|later|way later(?:,\s*maybe)?|maybe)\s*\)\*{0,2}\s*/i
const SIZE = /^([SML])\s*(?:,\s*(.*))?$/
const POINTER = /^(\s*)[-*+]\s+↳\s*([a-z]+)\s*:\s*(.*)$/i
const DETAIL = /\]\((?:\.\/)?(docs\/goalsDetails\/[^)\s#]+\.md)/
const DROPPED_TAIL = /^(.+?)[,:;]?\s+(?:(?:was|were|is|are|been|then|and)\s+)?dropped\b(?=\s*(?:[,.;:(]|\d{4}-|$))(.*)$/i
const PLACEHOLDER = /^[_*]*\(.*\)[_*]*$/s
const NOISE = /^(?:verified\b|no known gaps\b)/i
const STATUS: Record<string, Status> = { "[ ]": "planned", "📋": "planned", "🚧": "partial", "[x]": "done", "✅": "done", "❌": "dropped" }

const trimEnd = (s: string) => s.replace(/[\s.,:;]+$/, "").trim()
const trimStart = (s: string) => s.replace(/^[\s.,:;]+/, "")
const tidy = (lines: string[]) => lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() || undefined
const indentOf = (l: string) => l.length - l.trimStart().length
const short = (s: string) => Array.from(s.trim()).slice(0, 60).join("")
const shown = (b: Block) => short(b.kind === "bullet" ? `- ${b.lines[0].trim()}` : b.lines[0])
const words = (s: string) => s.trim().split(/\s+/).length

function scan(md: string): Entry[] {
    const lines = md.replace(/\r\n?/g, "\n").replace(EM_DASH, ", ").split("\n")
    const blank = (i: number) => !lines[i].trim()
    const indented = (i: number) => /^\s+\S/.test(lines[i])
    // Indented lines, plus blank runs that are followed by more indented lines.
    const takeIndented = (i: number, into: string[]) => {
        while (i < lines.length) {
            if (indented(i)) into.push(lines[i++])
            else if (blank(i)) {
                let j = i
                while (j < lines.length && blank(j)) j++
                if (j >= lines.length || !indented(j)) break
                while (i < j) into.push(lines[i++])
            } else break
        }
        return i
    }
    const out: Entry[] = []
    for (let i = 0; i < lines.length; ) {
        const line = lines[i]
        const h = HEADING.exec(line)
        if (blank(i)) i++
        else if (h) {
            out.push({ kind: "heading", level: h[1].length, text: h[2] })
            i++
        } else if (HR.test(line)) {
            out.push({ kind: "hr" })
            i++
        } else if (line.startsWith("|")) {
            const t: string[] = []
            while (i < lines.length && lines[i].startsWith("|")) t.push(lines[i++])
            out.push({ kind: "table", lines: t })
        } else if (BULLET.test(line)) {
            const b = [line.replace(BULLET, "")]
            i = takeIndented(i + 1, b)
            out.push({ kind: "bullet", lines: b })
        } else {
            const p = [line]
            i++
            while (i < lines.length && !blank(i) && !indented(i) && !HEADING.test(lines[i]) && !HR.test(lines[i]) && !BULLET.test(lines[i]) && !lines[i].startsWith("|")) p.push(lines[i++])
            i = takeIndented(i, p)
            out.push({ kind: "para", lines: p })
        }
    }
    return out
}

function dedent(lines: string[]): string[] {
    const n = Math.min(...lines.filter((l) => l.trim()).map(indentOf))
    return lines.map((l) => (l.trim() ? l.slice(n) : ""))
}

// The first paragraph as one line, and the dedented lines after it.
function split(b: Block): { first: string; after: string[] } {
    let k = 1
    if (b.kind === "para") while (k < b.lines.length && !/^\s/.test(b.lines[k])) k++
    const after = dedent(b.lines.slice(k))
    let j = 0
    if (b.kind === "bullet") while (j < after.length && after[j].trim() && !LIST.test(after[j])) j++
    return { first: [...b.lines.slice(0, k), ...after.slice(0, j)].map((l) => l.trim()).join(" "), after: after.slice(j) }
}

function balanced(s: string): boolean {
    if ((s.split("`").length - 1) % 2 || (s.split("**").length - 1) % 2) return false
    let depth = 0
    for (const c of s.replace(/`[^`]*`/g, "")) {
        if (c === "(" || c === "[") depth++
        else if (c === ")" || c === "]") depth = Math.max(0, depth - 1)
    }
    return depth === 0
}

function sentenceEnd(s: string): number {
    for (const m of s.matchAll(/[.!?](?=\s|$)/g)) {
        const head = s.slice(0, m.index)
        if (balanced(head) && !/\b(?:e\.g|i\.e|vs|etc|cf|approx)$/i.test(head)) return m.index
    }
    return -1
}

function clauseCut(s: string): string | undefined {
    for (const m of s.matchAll(/[,;:](?=\s)/g)) {
        if (m.index > 120) break
        if (m.index >= 20 && balanced(s.slice(0, m.index))) return s.slice(0, m.index)
    }
}

function wordCut(s: string, max: number): string {
    const head = s.slice(0, max)
    const t = head.lastIndexOf(" ") > 0 ? head.slice(0, head.lastIndexOf(" ")) : head
    let u = t
    while (!balanced(u)) {
        const k = Math.max(u.lastIndexOf("("), u.lastIndexOf("["), u.lastIndexOf("`"), u.lastIndexOf("**"))
        if (k < 10) return t
        u = u.slice(0, k).trimEnd()
    }
    return u
}

// First sentence or clause, cut before a trailing `(...date...)`. A cut title keeps the full text as `rest`; `after` is what follows the title.
function plainTitle(text: string): { title: string; rest: string; after: string; date?: string } {
    let end = text.length
    let next = text.length
    let date: string | undefined
    const dp = /\s*\(([^()]*\d{4}-\d{2}-\d{2}[^()]*)\)(?=\s*(?:[,.;:]|$))/.exec(text)
    if (dp && dp.index > 0) {
        end = dp.index
        next = dp.index + dp[0].length
        date = DATE.exec(dp[1])?.[0]
    }
    const se = sentenceEnd(text)
    if (se !== -1 && se < end) {
        end = se
        next = se + 1
        date = undefined
    }
    const title = text.slice(0, end)
    if (title.length <= 120) {
        const rest = trimStart(text.slice(next))
        return { title: trimEnd(title), rest, after: rest, date }
    }
    const cut = clauseCut(title) ?? wordCut(title, 100)
    return { title: trimEnd(cut), rest: text, after: trimStart(text.slice(cut.length)), date }
}

// Leading/trailing dates and short `(closed 2026-07-19)` parens come off a done title.
function undate(title: string): { title: string; date?: string } {
    let date: string | undefined
    const take = (d: string) => {
        date ??= d
        return ""
    }
    let t = title.replace(/^(\d{4}-\d{2}-\d{2})\s*(?:[-:,]\s*)?/, (_, d: string) => take(d))
    t = t.replace(/\s*\(([^()]*)\)/g, (m, inner: string) => {
        const d = DATE.exec(inner)
        return d && words(inner) <= 3 ? take(d[0]) : m
    })
    t = trimEnd(t).replace(/[\s,;:]+(\d{4}-\d{2}-\d{2})$/, (_, d: string) => take(d))
    date ??= DATE.exec(t)?.[0]
    return { title: trimEnd(t), date }
}

function extractPointers(lines: string[], into: Pointers): string[] {
    const rest: string[] = []
    for (let i = 0; i < lines.length; i++) {
        const m = POINTER.exec(lines[i])
        const key = m?.[2].toLowerCase() as PointerKey
        if (!m || !(POINTER_KEYS as readonly string[]).includes(key)) {
            rest.push(lines[i])
            continue
        }
        let value = m[3].trim()
        while (i + 1 < lines.length && lines[i + 1].trim() && indentOf(lines[i + 1]) > m[1].length && !LIST.test(lines[i + 1])) value += ` ${lines[++i].trim()}`
        if (value) (into[key] ??= []).push(value)
    }
    return rest
}

function toPhase(tag: string): Phase {
    const t = tag.toLowerCase()
    if (t.includes("maybe")) return "maybe"
    if (t.startsWith("way")) return "wayLater"
    return t as Phase
}

function buildDraft(b: Block, completed: boolean, key: string): Draft | null {
    const { first, after } = split(b)
    let head = first.trim()
    let status: Status | undefined
    const mk = b.kind === "bullet" ? MARKER.exec(head) : null
    if (mk) {
        status = STATUS[mk[1].toLowerCase()]
        head = head.slice(mk[0].length)
    } else if (completed) status = "done"
    else return null
    let phase: Phase = "later"
    const pt = PHASE_TAG.exec(head)
    if (pt) {
        phase = toPhase(pt[1])
        head = head.slice(pt[0].length)
    }
    const closed = status === "done" || status === "dropped"
    const sniffDrop = closed && (!mk || status === "dropped")
    const d: Draft = { key, title: "", status, phase, pointers: {} }

    let text = head
    let rest = ""
    let plain = true
    const bold = BOLD.exec(text)
    if (bold && bold[1].trim().length <= 200) {
        d.title = bold[1].trim()
        rest = text.slice(bold[0].length)
        plain = false
        if (closed) {
            const u = undate(d.title)
            d.title = u.title
            d.date = u.date
            // `**Closed 2026-07-19**: the real title...`
            if (!d.title || /^[a-z]+ed$/i.test(d.title)) {
                if (/^dropped$/i.test(d.title)) d.status = "dropped"
                text = trimStart(rest)
                plain = true
            }
        }
        for (let k = 0; !plain && k < 2; k++) {
            const p = /^\s*\(([^()]*)\)/.exec(rest)
            const sz = p && SIZE.exec(p[1].trim())
            if (sz && !d.size) {
                d.size = sz[1] as Size
                const scope = sz[2]?.split(/,\s*/).map((s) => s.trim().toLowerCase()).filter(Boolean)
                if (scope?.length) d.scope = scope
            } else if (p && closed && !d.date && DATE.test(p[1]) && words(p[1]) <= 3) d.date = DATE.exec(p[1])?.[0]
            else break
            rest = rest.slice(p[0].length)
        }
        rest = trimStart(rest)
    }
    for (let tries = 0; plain && tries < 2; tries++) {
        const p = plainTitle(text)
        d.title = p.title
        rest = p.rest
        d.date ??= p.date
        if (!closed) break
        const u = undate(d.title)
        d.title = u.title
        d.date ??= u.date
        if (d.title && !/^[a-z]+ed$/i.test(d.title)) break
        text = p.after
    }

    let noteHead = ""
    if (closed && /^dropped:\s*/i.test(d.title)) {
        d.status = "dropped"
        d.title = d.title.replace(/^dropped:\s*/i, "")
    } else if (sniffDrop) {
        const m = DROPPED_TAIL.exec(d.title)
        if (m) {
            d.status = "dropped"
            d.title = m[1]
            noteHead = m[2].replace(DATE, "").replace(/^[\s,.;:()]+|[\s,.;:()]+$/g, "")
            if (noteHead && !/[.!?]$/.test(noteHead)) noteHead += "."
        }
    }
    d.title = trimEnd(d.title)
    if (!d.title) return null
    if (!closed) delete d.date

    const tail = extractPointers(after, d.pointers)
    d.detail = DETAIL.exec([head, ...after].join("\n"))?.[1]
    if (d.status === "dropped") d.note = tidy([[noteHead, rest].filter(Boolean).join(" "), ...tail])
    else {
        const bare = closed ? undate(head).title : trimEnd(head)
        d.body = tidy([plain ? (bare === d.title ? "" : head) : rest, ...tail])
    }
    return d
}

function buildTrap(b: Block): Omit<Trap, "id"> | null {
    const { first, after } = split(b)
    const bold = BOLD.exec(first)
    let title: string
    let rest: string
    if (bold && bold[1].trim().length <= 200) {
        title = trimEnd(bold[1])
        rest = trimStart(first.slice(bold[0].length))
    } else ({ title, rest } = plainTitle(first))
    if (!title) return null
    const body = tidy([rest, ...after])
    return body ? { title, body } : { title }
}

// In an archive, what follows a paragraph record belongs to it, unless it opens a record of its own:
// a bullet with a dated bold lead, or a paragraph with a dated or full-sentence one (`**Title.**`).
function continues(b: Block): boolean {
    const lead = b.lines[0].trim()
    const bold = BOLD.exec(lead)
    if (!bold) return true
    if (b.kind === "bullet") return !DATE.test(bold[1])
    return !(DATE.test(bold[1]) || /[.!?:]$/.test(bold[1].trim()) || /^[.:]/.test(lead.slice(bold[0].length)))
}

// The block as markdown for a record's body: wrapped lines joined, sub-lists kept.
function asMarkdown(b: Block): string {
    const { first, after } = split(b)
    if (b.kind === "para") return [first, ...after].join("\n")
    return [`- ${first}`, ...after.map((l) => (l ? `  ${l}` : l))].join("\n")
}

// Consecutive bullets stay one list; anything else gets a blank line before it.
function attach(d: Draft, b: Block): void {
    const field = d.status === "dropped" ? "note" : "body"
    const prev = d[field]
    const inList = b.kind === "bullet" && /^- /.test(prev?.split("\n").findLast((l) => !/^\s/.test(l)) ?? "")
    d[field] = prev ? `${prev}${inList ? "\n" : "\n\n"}${asMarkdown(b)}` : asMarkdown(b)
}

// Converts a hand-written goals.md (+ goals-completed.md) into a goals.json.
export function importMarkdown(goalsMd: string, opts: { project: string; today: string; completedMd?: string }): { file: GoalsFile; report: ImportReport } {
    const skipped: string[] = []
    const traps: Omit<Trap, "id">[] = []
    const drafts: Draft[] = []
    const numbered = new Map<number, string>()
    const named = new Map<string, string>()
    let purpose: string | undefined

    const sectionKey = (text: string) => {
        const m = /^(?:§\s*)?(\d{1,3})\s*[.:)]?\s+(.+)$/.exec(text)
        if (m) {
            const n = Number(m[1])
            if (!numbered.has(n)) numbered.set(n, m[2].trim())
            return `n${n}`
        }
        const k = text.trim().toLowerCase()
        if (!named.has(k)) named.set(k, text.trim())
        return `t${k}`
    }

    const sources = [{ md: goalsMd, completed: false }, ...(opts.completedMd ? [{ md: opts.completedMd, completed: true }] : [])]
    for (const { md, completed } of sources) {
        let zone = "pre"
        let base = "pre"
        let key = ""
        let last: Draft | undefined
        // Archive only: the paragraph record that following bullets and paragraphs belong to.
        let parent: Draft | undefined
        for (const e of scan(md)) {
            if (e.kind === "heading" || e.kind === "hr") parent = undefined
            if (e.kind === "heading") {
                if (e.level === 1) zone = base = "pre"
                else if (e.level <= 3 && /\btraps?\b/i.test(e.text)) zone = "traps"
                else if (e.level === 2) {
                    key = sectionKey(e.text)
                    zone = base = "sec"
                    last = undefined
                } else zone = base
                continue
            }
            if (e.kind === "hr") {
                zone = base = "none"
                continue
            }
            // Only traps are kept here; anything else is reported, never dropped silently.
            if (zone === "traps" || zone === "none") {
                const t = zone === "traps" && e.kind === "bullet" ? buildTrap(e) : null
                if (t) traps.push(t)
                else skipped.push(shown(e))
                continue
            }
            if (zone === "pre" && !completed && e.kind === "para" && !purpose) {
                const m = /^\*{0,2}Purpose\*{0,2}:\*{0,2}\s*/i.exec(e.lines[0])
                if (m) purpose = e.lines.map((l) => l.trim()).join(" ").slice(m[0].length).trim() || undefined
            }
            if (zone !== "sec") continue

            const lead = e.lines[0].trim()
            if (e.kind === "table") skipped.push(short(lead))
            else if (e.kind === "bullet" && lead.startsWith("↳")) {
                // A top-level `- ↳ files:` belongs to the item above it.
                if (!last) skipped.push(short(`- ${lead}`))
                else {
                    const rest = extractPointers([`- ${e.lines[0]}`, ...e.lines.slice(1)], last.pointers)
                    if (last.status === "dropped") last.note = tidy([last.note ?? "", ...rest])
                    else last.body = tidy([last.body ?? "", ...rest])
                }
            } else if (completed && e.kind === "para" && PLACEHOLDER.test(e.lines.join(" ").trim())) continue
            else {
                const d = buildDraft(e, completed, key)
                if (completed && NOISE.test(lead)) skipped.push(short(lead))
                else if (parent && d?.status !== "dropped" && continues(e)) attach(parent, e)
                else if (d) {
                    drafts.push((last = d))
                    if (completed && e.kind === "para") parent = d
                } else skipped.push(shown(e))
            }
        }
    }

    // Unnumbered sections that kept an item take the next free numbers, in order of appearance.
    const numOf = new Map<string, number>()
    const titleOf = new Map<number, string>(numbered)
    for (const n of numbered.keys()) numOf.set(`n${n}`, n)
    let next = Math.max(0, ...numbered.keys()) + 1
    for (const [k, title] of named) {
        if (!drafts.some((d) => d.key === `t${k}`)) continue
        const same = [...numbered].find(([, t]) => t.toLowerCase() === k)
        const n = same ? same[0] : next++
        numOf.set(`t${k}`, n)
        if (!titleOf.has(n)) titleOf.set(n, title)
    }
    const sections: Section[] = [...new Set(drafts.map((d) => numOf.get(d.key)!))]
        .sort((a, b) => a - b)
        .map((n) => ({ n, title: titleOf.get(n)!.slice(0, 120).trim() }))

    const taken = new Set<string>()
    const id = (title: string) => {
        const s = uniqueSlug(slugify(title), taken)
        taken.add(s)
        return s
    }
    const trapList: Trap[] = traps.map((t) => ({ id: id(t.title), ...t }))
    const items: Item[] = drafts.map((d) => ({
        id: id(d.title),
        section: numOf.get(d.key)!,
        title: d.title,
        ...(d.body ? { body: d.body } : {}),
        phase: d.phase,
        status: d.status,
        ...(d.size ? { size: d.size } : {}),
        ...(d.scope ? { scope: d.scope } : {}),
        ...(Object.keys(d.pointers).length ? { pointers: d.pointers } : {}),
        ...(d.detail ? { detail: d.detail } : {}),
        created: d.date ?? opts.today,
        updated: d.date ?? opts.today,
        ...(d.status === "dropped" ? { note: d.note?.trim() || "dropped" } : {}),
    }))

    const file = parseGoals({ version: 1, project: opts.project, ...(purpose ? { purpose } : {}), sections, traps: trapList, items })
    const issues = localIssues(file)
    if (issues.length) throw new UpgoError("import produced an invalid goals.json:", issues)
    const count = (s: Status) => items.filter((i) => i.status === s).length
    return {
        file,
        report: {
            open: items.filter((i) => isOpenStatus(i.status)).length,
            done: count("done"),
            dropped: count("dropped"),
            traps: trapList.length,
            sections: sections.length,
            skipped,
        },
    }
}
