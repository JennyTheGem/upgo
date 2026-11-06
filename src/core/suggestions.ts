import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { EM_DASH } from "./rules.ts"
import { formatIssues, isOpenStatus, suggestionsFileSchema, type GoalsFile, type Status, type Suggestion } from "./schema.ts"
import { repeats } from "./similar.ts"
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

type Hints = { body?: string; section?: number; size?: Suggestion["size"]; related?: string[] }
export type SuggestionPatch = { title?: string } & { [K in keyof Hints]?: Hints[K] | null }

function noEmDash(x: unknown) {
    if (JSON.stringify(x).includes(EM_DASH)) throw new UpgoError("a suggestion contains an em dash (U+2014); use a comma, colon or hyphen")
}

export function addSuggestion(list: Suggestion[], input: { title: string } & Hints, day: string): { list: Suggestion[]; id: string } {
    noEmDash(input)
    const id = uniqueSlug(slugify(input.title), new Set(list.map((s) => s.id)))
    const { title, body, section, size, related } = input
    const s: Suggestion = {
        id,
        title,
        ...(body?.trim() ? { body } : {}),
        ...(section !== undefined && { section }),
        ...(size && { size }),
        ...(related?.length && { related }),
        created: day,
    }
    return { list: [...list, s], id }
}

// null, a blank body or no refs clears a field; the id stays.
export function editSuggestion(list: Suggestion[], id: string, patch: SuggestionPatch): Suggestion[] {
    noEmDash(patch)
    if (!list.some((s) => s.id === id)) throw new UpgoError(`no suggestion \`${id}\``)
    return list.map((s) => {
        if (s.id !== id) return s
        const out: Record<string, unknown> = { ...s }
        for (const [k, v] of Object.entries(patch)) {
            if (v === null || (k === "body" && !String(v).trim()) || (Array.isArray(v) && !v.length)) delete out[k]
            else if (v !== undefined) out[k] = v
        }
        return out as Suggestion
    })
}

// Goals (any status) and suggestions a new suggestion would repeat, one line each.
export function duplicatesOf(title: string, file: GoalsFile, list: Suggestion[]): string[] {
    return [
        ...file.items.filter((i) => repeats(title, i)).map((i) => `goal \`${i.id}\` ${i.title} (${i.status}${i.status === "dropped" && i.note ? `: ${i.note}` : ""})`),
        ...list.filter((s) => repeats(title, s)).map((s) => `suggestion \`${s.id}\` ${s.title}`),
    ]
}

// Everything an agent should skim before suggesting, in a few lines.
export function contextText(file: GoalsFile, list: Suggestion[]): string {
    const titles = (st: (s: Status) => boolean) => file.items.filter((i) => st(i.status)).map((i) => i.title)
    const row = (label: string, xs: string[]) => `${label} (${xs.length})${xs.length ? `: ${xs.join("; ")}` : ""}`
    const dropped = file.items.filter((i) => i.status === "dropped")
    const lines = [
        `${file.project}${file.purpose ? `: ${file.purpose}` : ""}`,
        `sections: ${file.sections.map((s) => `${s.n}. ${s.title}`).join("; ") || "none"}`,
        row("open", titles(isOpenStatus)),
        row("done", titles((s) => s === "done")),
        `dropped (${dropped.length})${dropped.length ? ", never suggest again:" : ""}`,
        ...dropped.map((i) => `- ${i.title} (${i.note?.trim() || "no reason"})`),
        row("pending suggestions", list.map((s) => s.title)),
    ]
    return lines.join("\n") + "\n"
}

export function removeSuggestions(list: Suggestion[], ids: string[]): Suggestion[] {
    const missing = ids.filter((id) => !list.some((s) => s.id === id))
    if (missing.length) throw new UpgoError(`no suggestion ${missing.map((id) => `\`${id}\``).join(", ")}`)
    return list.filter((s) => !ids.includes(s.id))
}

// Undo of a dismiss: each back at its old index. One already there again is skipped.
export function restoreSuggestions(list: Suggestion[], back: { at: number; suggestion: Suggestion }[]): Suggestion[] {
    noEmDash(back)
    const out = [...list]
    for (const { at, suggestion } of [...back].sort((a, b) => a.at - b.at)) {
        if (!out.some((s) => s.id === suggestion.id)) out.splice(Math.min(at, out.length), 0, suggestion)
    }
    return out
}
