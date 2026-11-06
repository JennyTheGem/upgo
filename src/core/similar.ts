import { slugify } from "./util.ts"

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
