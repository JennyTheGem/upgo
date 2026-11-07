// Terminal look shared with upex: "upgo   Title" over a dim rule, 2-space indent, aligned columns.
// Only used when stdout is a terminal; piped output (agents) stays plain.
import { stripVTControlCharacters as plain, styleText } from "node:util"

type Format = Parameters<typeof styleText>[0]
type Style = (s: string) => string
export type Seg = [text: string, style?: Style]

// styleText drops colors itself for NO_COLOR, pipes and dumb terminals.
const paint = (format: Format, stream: NodeJS.WriteStream = process.stdout): Style => (s) => styleText(format, s, { stream })
export const bold = paint("bold")
export const dim = paint("dim")
export const green = paint("green")
export const yellow = paint("yellow")
export const red = paint("red")
export const errRed = paint("red", process.stderr)
const brand = paint(["bold", "magenta"])

export const tag = { ok: green("[ OK ]"), warn: yellow("[WARN]"), fail: red("[FAIL]"), skip: dim("[SKIP]") }

export const width = (s: string) => plain(s).length
// Row width after the 2-space indent, at most 100 wide.
export const cols = () => Math.min(Math.max((process.stdout.columns || 80) - 1, 20), 100) - 2
export const rule = () => dim("  " + "─".repeat(cols())) + "\n"

/** Cut a styled string to n visible columns, ending in an ellipsis. */
export function clip(s: string, n: number): string {
    if (width(s) <= n) return s
    let out = ""
    let left = Math.max(n - 1, 0)
    // eslint-disable-next-line no-control-regex
    for (const part of s.split(/(\x1b\[[0-9;]*m)/)) {
        if (part.startsWith("\x1b")) out += part
        else if (left) {
            out += part.slice(0, left)
            left -= Math.min(part.length, left)
        }
    }
    // eslint-disable-next-line no-control-regex
    return out.replace(/(\x1b\[[0-9;]*m)*$/, "") + "…" + (out === plain(out) ? "" : "\x1b[0m")
}

export const heading = (title: string, note = "") => {
    const head = `${brand("upgo")}   ${bold(title)}${note ? `   ${dim(note)}` : ""}`
    return `\n  ${clip(head, cols())}\n${rule()}`
}

export const line = (s = "") => (s ? `  ${s}\n` : "\n")
export const empty = (msg: string) => `\n  ${msg}\n\n`
export const footer = (msg: string) => `${rule()}  ${dim(msg)}\n\n`

// Folder part dim, last part as is.
export function dimParent(p: string): string {
    const cut = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\")) + 1
    return dim(p.slice(0, cut)) + p.slice(cut)
}

/** Aligned columns; the `flex` column is clipped so each row fits the terminal. */
export function table(rows: string[][], { indent = 2, gap = 2, flex = -1 } = {}): string[] {
    if (!rows.length) return []
    const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => width(r[i] ?? ""))))
    if (flex >= 0) {
        const rest = widths.reduce((a, w, i) => (i === flex ? a : a + w), 0) + gap * (widths.length - 1)
        widths[flex] = Math.min(widths[flex], Math.max(12, cols() + 2 - indent - rest))
    }
    return rows.map((r) => {
        const cells = r.map((c, i) => (i === flex ? clip(c, widths[i]) : c))
        const last = cells.length - 1
        const text = cells.map((c, i) => (i < last ? c + " ".repeat(widths[i] - width(c) + gap) : c)).join("")
        return " ".repeat(indent) + text.trimEnd()
    })
}

/** Word-wrap styled segments into lines of at most n columns. */
export function wrap(segs: Seg[], n: number): string[] {
    const lines: string[] = []
    let cur: string[] = []
    let used = 0
    const flush = () => {
        lines.push(cur.join(" "))
        cur = []
        used = 0
    }
    for (const [text, style = (s: string) => s] of segs)
        for (const word of text.split(/\s+/).filter(Boolean)) {
            if (cur.length && used + 1 + word.length > n) flush()
            used += (cur.length ? 1 : 0) + word.length
            cur.push(style(word))
        }
    if (cur.length) flush()
    return lines
}

/** Text paragraphs wrapped to the terminal, line breaks and leading indents kept. */
export const prose = (text: string, style?: Style, indent = 2) =>
    text
        .split("\n")
        .map((l) => {
            const pad = " ".repeat(indent + l.length - l.trimStart().length)
            return l.trim() ? wrap([[l, style]], cols() + 2 - pad.length).map((w) => pad + w).join("\n") : ""
        })
        .join("\n") + "\n"

/** Term + wrapped text rows; a term wider than its column gets its own line, text lines up under the column. */
export function defList(rows: { term: Seg[]; text: Seg[] }[], indent = 2): string[] {
    const inner = cols() + 2 - indent
    // 2 narrower, as term lines after the first are indented 2 more.
    const terms = rows.map((r) => wrap(r.term, inner - 2))
    const termW = Math.min(Math.max(0, ...terms.map((t) => width(t[0] ?? ""))), Math.floor(inner * 0.4))
    const pad = " ".repeat(indent + termW + 2)
    const out: string[] = []
    for (const [k, r] of rows.entries()) {
        const term = terms[k]
        if (!term.length) term.push("")
        const text = wrap(r.text, inner - termW - 2)
        const lead = " ".repeat(indent)
        out.push(lead + term[0], ...term.slice(1).map((t) => lead + "  " + t))
        if (text.length && term.length === 1 && width(term[0]) <= termW) out[out.length - 1] += " ".repeat(termW - width(term[0]) + 2) + text.shift()
        out.push(...text.map((t) => pad + t))
    }
    return out
}

/**
 * Help screen from the plain help text: unindented lines followed by indented ones are section titles,
 * indented lines split into usage and description at the first run of 3+ spaces.
 */
export function helpView(help: string): string {
    const [tagline, ...lines] = help.trimEnd().split("\n")
    const about = tagline.replace(/^upgo: /, "")
    const para = (t: string, style: Style) => wrap([[t, style]], cols()).map((w) => line(w))
    const out = [heading("Help"), ...para(about[0].toUpperCase() + about.slice(1), dim), "\n"]
    // Optional [flags] dim, so the command names stand out.
    const args = (s: string): Seg[] => s.split(/(\[[^\]]*\])/).filter((p) => p.trim()).map((p): Seg => (p.startsWith("[") ? [p, dim] : [p]))
    const usage = (u: string): Seg[] => {
        const [, cmd = "", rest = ""] = /^upgo (\S+)(.*)$/.exec(u) ?? []
        return cmd ? [["upgo", dim], [cmd, bold], ...args(rest)] : args(u)
    }
    let rows: { term: Seg[]; text: Seg[] }[] = []
    const flush = () => {
        if (rows.length) out.push(defList(rows, 4).join("\n") + "\n\n")
        rows = []
    }
    lines.forEach((l, i) => {
        const indent = l.length - l.trimStart().length
        const t = l.trim()
        if (!t) return
        if (!indent) {
            flush()
            out.push(...para(t, /^\s/.test(lines[i + 1] ?? "") ? bold : dim))
            return
        }
        const last = rows.at(-1)
        if (indent > 2 && last) {
            // Continuation: more usage while the row has no description yet.
            if (!last.text.length && /^[[-]/.test(t)) last.term.push(...args(t))
            else last.text.push([t])
            return
        }
        const parts = t.split(/\s{3,}/)
        // Two commands on one line: "upgo done ...   upgo drop ...".
        if (parts.every((p) => p.startsWith("upgo "))) parts.forEach((p) => rows.push({ term: usage(p), text: [] }))
        else rows.push({ term: usage(parts[0]), text: parts.slice(1).map((p): Seg => [p]) })
    })
    flush()
    return out.join("") + "\n"
}
