import { Fragment, type HTMLAttributes, type ReactNode } from "react"
import "./markdown.css"

// Builds React elements only, never HTML strings, so raw HTML in the text stays text.
// A backtick fence's info string can't contain backticks, so "```x``` y" stays inline.
const FENCE = /^\s*(`{3,}(?=[^`]*$)|~{3,})/
const HEADING = /^\s*(#{1,6})\s+(.*?)(\s+#+)?\s*$/
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/
const QUOTE = /^\s*> ?/
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const INLINE =
    /`([^`]+)`|\*\*(.+?)\*\*|(?<!\w)__(.+?)__(?!\w)|(?<![\w*])\*(?![\s*])(.+?)(?<!\s)\*(?![\w*])|(?<!\w)_(?![\s_])(.+?)(?<!\s)_(?!\w)|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?'")\]])/g
const SAFE_URL = /^(https?:|mailto:)/i

const indent = (l: string) => l.length - l.trimStart().length
const startsBlock = (l: string) => [FENCE, HEADING, HR, QUOTE, LIST].some((r) => r.test(l))

const link = (href: string, children: ReactNode, key: number) =>
    SAFE_URL.test(href) ? (
        <a key={key} href={href} target="_blank" rel="noreferrer">
            {children}
        </a>
    ) : (
        <Fragment key={key}>{children}</Fragment>
    )

// links=false inside a link label, so a URL label can't nest an <a> in an <a>.
function inline(text: string, links = true): ReactNode[] {
    const out: ReactNode[] = []
    let last = 0
    for (const m of text.matchAll(INLINE)) {
        const [all, code, b1, b2, e1, e2, label, href, bare] = m
        const k = m.index
        if (k > last) out.push(text.slice(last, k))
        if (code !== undefined) out.push(<code key={k}>{code}</code>)
        else if (b1 ?? b2) out.push(<strong key={k}>{inline(b1 ?? b2, links)}</strong>)
        else if (e1 ?? e2) out.push(<em key={k}>{inline(e1 ?? e2, links)}</em>)
        else if (!links) out.push(all)
        else if (label !== undefined) out.push(link(href, inline(label, false), k))
        else out.push(link(bare, bare, k))
        last = k + all.length
    }
    if (last < text.length) out.push(text.slice(last))
    return out
}

function blocks(lines: string[]): ReactNode[] {
    const out: ReactNode[] = []
    let i = 0
    while (i < lines.length) {
        const line = lines[i]
        const k = out.length
        let m: RegExpMatchArray | null
        if (!line.trim()) i++
        else if ((m = line.match(FENCE))) {
            const pad = indent(line)
            let j = i + 1
            while (j < lines.length && !lines[j].trimStart().startsWith(m[1])) j++
            out.push(
                <pre key={k}>
                    <code>
                        {lines
                            .slice(i + 1, j)
                            .map((l) => l.slice(Math.min(indent(l), pad)))
                            .join("\n")}
                    </code>
                </pre>,
            )
            i = j + 1
        } else if ((m = line.match(HEADING))) {
            const Tag = `h${Math.min(m[1].length + 2, 6)}` as "h3"
            out.push(<Tag key={k}>{inline(m[2])}</Tag>)
            i++
        } else if (HR.test(line)) {
            out.push(<hr key={k} />)
            i++
        } else if (QUOTE.test(line)) {
            let j = i
            while (j < lines.length && QUOTE.test(lines[j])) j++
            out.push(<blockquote key={k}>{blocks(lines.slice(i, j).map((l) => l.replace(QUOTE, "")))}</blockquote>)
            i = j
        } else if ((m = line.match(LIST))) {
            // Items start at the first marker's indent; deeper lines (nested lists, wrapped text) belong to the item.
            const base = m[1].length
            const ordered = /\d/.test(m[2])
            const items: string[][] = []
            let j = i
            for (; j < lines.length; j++) {
                const l = lines[j]
                const lm = l.match(LIST)
                if (lm && !HR.test(l) && lm[1].length === base && /\d/.test(lm[2]) === ordered) items.push([lm[3]])
                else if (l.trim() && indent(l) > base) items[items.length - 1].push(l)
                else if (l.trim()) break
                else {
                    const next = lines.slice(j).find((x) => x.trim())
                    if (!next || indent(next) < base || (indent(next) === base && !LIST.test(next))) break
                    items[items.length - 1].push("")
                }
            }
            const kids = items.map((it, n) => <li key={n}>{blocks(it)}</li>)
            out.push(
                ordered ? (
                    <ol key={k} start={parseInt(m[2])}>
                        {kids}
                    </ol>
                ) : (
                    <ul key={k}>{kids}</ul>
                ),
            )
            i = j
        } else {
            let j = i + 1
            while (j < lines.length && lines[j].trim() && !startsBlock(lines[j])) j++
            out.push(
                <p key={k}>
                    {lines.slice(i, j).map((l, n) => (
                        <Fragment key={n}>
                            {n > 0 && <br />}
                            {inline(l.trim())}
                        </Fragment>
                    ))}
                </p>,
            )
            i = j
        }
    }
    return out
}

export default function Markdown({ text, className = "", ...rest }: { text: string } & HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={`markdown ${className}`} {...rest}>
            {blocks(text.replace(/\r\n?/g, "\n").split("\n"))}
        </div>
    )
}
