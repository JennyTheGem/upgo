import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { EM_DASH } from "./rules.ts"
import { formatIssues, suggestionsFileSchema, type Suggestion } from "./schema.ts"
import { withLock, writeAtomic } from "./store.ts"
import { slugify, uniqueSlug, UpgoError } from "./util.ts"

export const SUGGESTIONS = "suggestions.json"

function parse(raw: unknown, problem = `${SUGGESTIONS} does not match the schema:`): Suggestion[] {
    const parsed = suggestionsFileSchema.safeParse(raw)
    if (!parsed.success) throw new UpgoError(problem, formatIssues(parsed.error))
    return parsed.data.suggestions
}

// No file means no suggestions.
export function readSuggestions(dir: string): Suggestion[] {
    const path = join(dir, SUGGESTIONS)
    if (!existsSync(path)) return []
    let raw: unknown
    try {
        raw = JSON.parse(readFileSync(path, "utf8"))
    } catch (e) {
        throw new UpgoError(`${SUGGESTIONS} is not valid JSON: ${(e as Error).message}`)
    }
    return parse(raw)
}

// For readers that carry on past a broken file: the list, or what is wrong with it.
export function trySuggestions(dir: string): { suggestions: Suggestion[]; suggestionsError?: string } {
    try {
        return { suggestions: readSuggestions(dir) }
    } catch (e) {
        if (!(e instanceof UpgoError)) throw e
        // One line: the message carries the details as a list too.
        return { suggestions: [], suggestionsError: [e.message.split("\n")[0], e.details.join("; ")].filter(Boolean).join(" ") }
    }
}

export async function updateSuggestions(dir: string, mutate: (list: Suggestion[]) => Suggestion[]): Promise<Suggestion[]> {
    const path = join(dir, SUGGESTIONS)
    return withLock(path, async () => {
        // Bad input, not a broken file, so the agent does not go looking for one.
        const list = parse({ version: 1, suggestions: mutate(readSuggestions(dir)) }, `refusing to save an invalid ${SUGGESTIONS}:`)
        await writeAtomic(path, JSON.stringify({ version: 1, suggestions: list }, null, 2) + "\n")
        return list
    })
}

export function addSuggestion(
    list: Suggestion[],
    input: { title: string; body?: string; section?: number; size?: Suggestion["size"] },
    day: string,
): { list: Suggestion[]; id: string } {
    if (JSON.stringify(input).includes(EM_DASH)) throw new UpgoError("a suggestion contains an em dash (U+2014); use a comma, colon or hyphen")
    const id = uniqueSlug(slugify(input.title), new Set(list.map((s) => s.id)))
    const { title, body, section, size } = input
    const s: Suggestion = { id, title, ...(body?.trim() ? { body } : {}), ...(section !== undefined && { section }), ...(size && { size }), created: day }
    return { list: [...list, s], id }
}

export function removeSuggestions(list: Suggestion[], ids: string[]): Suggestion[] {
    const missing = ids.filter((id) => !list.some((s) => s.id === id))
    if (missing.length) throw new UpgoError(`no suggestion ${missing.map((id) => `\`${id}\``).join(", ")}`)
    return list.filter((s) => !ids.includes(s.id))
}
