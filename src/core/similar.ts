import { slugify, UpgoError } from "./util.ts"

const STOP = new Set(["a", "an", "the", "and", "or", "for", "to", "of", "on", "in", "with", "by", "from", "is"])
const words = (t: string) => new Set(slugify(t, 200).split("-").filter((w) => !STOP.has(w)))

// Same slug, or at least two thirds of the longer title's words shared.
export function similarTitle(a: string, b: string): boolean {
    if (slugify(a) === slugify(b)) return true
    const x = words(a)
    const y = words(b)
    const shared = [...x].filter((w) => y.has(w)).length
    return shared > 0 && shared / Math.max(x.size, y.size) >= 2 / 3
}

// Would a new idea titled `title` repeat this goal or suggestion?
export const repeats = (title: string, x: { id: string; title: string }) => x.id === slugify(title) || similarTitle(title, x.title)

function distance(a: string, b: string): number {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
    for (let i = 1; i <= a.length; i++) {
        const row = [i]
        for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        prev = row
    }
    return prev[b.length]
}

// " (did you mean `x`?)" for the id a typo most likely meant, else "".
export function didYouMean(id: string, ids: string[]): string {
    let best: string | undefined
    let min = Math.max(2, Math.floor(id.length / 4)) + 1
    for (const x of ids) {
        const d = distance(id, x)
        if (d < min) [best, min] = [x, d]
    }
    return best ? ` (did you mean \`${best}\`?)` : ""
}

// `id` itself, else the one id it is a prefix of. `missing` is the error for no match.
export function resolveId(id: string, ids: string[], missing: string): string {
    if (ids.includes(id)) return id
    const starts = [...new Set(ids.filter((x) => x.startsWith(id)))]
    if (starts.length === 1) return starts[0]
    if (starts.length) throw new UpgoError(`\`${id}\` matches several: ${starts.map((x) => `\`${x}\``).join(", ")}`)
    throw new UpgoError(missing + didYouMean(id, ids))
}
