import { useState, type MouseEvent } from "react"
import type { Item, Section, Suggestion } from "../../../src/core/schema.ts"
import { repeats } from "../../../src/core/similar.ts"
import Button from "../primitives/button/Button.tsx"
import Chip from "../primitives/chip/Chip.tsx"
import EmptyState from "../primitives/emptyState/EmptyState.tsx"
import ErrorState from "../primitives/errorState/ErrorState.tsx"
import SelectionBar from "../primitives/selectionBar/SelectionBar.tsx"
import { readPref, writePref } from "../utils/storage.ts"
import { daysSince } from "./counts.ts"
import { copyForAgent } from "./format.ts"
import { RelatedChips } from "./ItemDetail.tsx"
import Markdown from "./Markdown.tsx"

type Props = {
    suggestions: Suggestion[]
    error?: string
    canAdopt: boolean
    // `quick`: Shift+click, add without the form.
    onAdopt: (list: Suggestion[], quick: boolean) => void
    onDismiss: (list: Suggestion[]) => Promise<boolean>
    onDrop: (list: Suggestion[]) => Promise<boolean>
    // A related ref, `project:item`.
    onOpenRelated: (ref: string) => void
    sections: Section[]
    // Dropped goals, to flag a suggestion that repeats one.
    dropped: Item[]
    onOpenGoal: (id: string) => void
}

type Action = { label: string; hint: string; icon: string; color?: string; needsSection?: boolean; run: (e: MouseEvent) => void }

const toggled = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (!next.delete(id)) next.add(id)
    return next
}

const SORT = "upgo:suggestionSort"

// Newest day first; same day, the later added first.
const newestFirst = (list: Suggestion[]) => [...list].reverse().sort((a, b) => b.created.localeCompare(a.created))

// Recency batches: the first whose max days fits.
const BATCHES: [number, string][] = [
    [0, "Today"],
    [1, "Yesterday"],
    [6, "This week"],
    [30, "This month"],
    [Infinity, "Older"],
]
const byRecency = (list: Suggestion[]) => {
    const sorted = newestFirst(list)
    const batch = (s: Suggestion) => BATCHES.find(([max]) => daysSince(s.created) <= max)![1]
    return BATCHES.map(([, title]) => ({ title, list: sorted.filter((s) => batch(s) === title) }))
}

// Agents add these with `upgo suggestion add`. Rows look and act like goal rows.
export default function SuggestionsPanel({ suggestions, error, canAdopt, onAdopt, onDismiss, onDrop, onOpenRelated, sections, dropped, onOpenGoal }: Props) {
    const [ticked, setTicked] = useState<Set<string>>(new Set())
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [newest, setNewest] = useState(() => readPref(SORT) === "newest")
    const chosen = suggestions.filter((s) => ticked.has(s.id))
    const adoptTitle = canAdopt ? undefined : "Add a section first"
    const adoptHint = "Add to goals (Shift+click: straight to Later)"

    if (error) return <ErrorState className="uiContentContainer" message={error} />
    if (!suggestions.length) {
        return (
            <EmptyState
                className="uiContentContainer"
                message={
                    <>
                        No suggestions. Ask an agent for ideas, it adds them with <code className="Inconsolata">upgo suggestion add</code>.
                    </>
                }
            />
        )
    }

    // Two groups: keep it, then get rid of it.
    const actions = (s: Suggestion): Action[][] => [
        [
            { label: "Add to goals", hint: adoptHint, icon: "iconify:add", needsSection: true, run: (e) => onAdopt([s], e.shiftKey) },
            { label: "Copy", hint: "Copy for agent", icon: "iconify:content-copy", run: () => copyForAgent([s]) },
        ],
        [
            { label: "Drop", hint: "Drop: never suggest again", icon: "iconify:block", color: "var(--tone-orange)", needsSection: true, run: () => onDrop([s]) },
            { label: "Delete", hint: "Delete: remove, may come back", icon: "iconify:delete", color: "var(--color-danger)", run: () => onDismiss([s]) },
        ],
    ]

    const row = (s: Suggestion) => {
        const open = expanded.has(s.id)
        const twin = dropped.find((i) => repeats(s.title, i))
        return (
            <li
                key={s.id}
                className={`itemRow suggestionRow ${open ? "itemRow--open" : ""} ${ticked.has(s.id) ? "itemRow--selected" : ""}`}
                data-suggestion-id={s.id}
            >
                <div className="itemRowHead">
                    <input type="checkbox" className="itemCheck" checked={ticked.has(s.id)} aria-label={`Select ${s.title}`} onChange={() => setTicked((t) => toggled(t, s.id))} />
                    <button type="button" className="itemRowToggle" aria-expanded={open} onClick={() => setExpanded((x) => toggled(x, s.id))}>
                        <span className="itemTitle font-bold truncate">{s.title}</span>
                        <span className="itemId Inconsolata caption truncate">{s.id}</span>
                    </button>
                    {s.size && (
                        <span className="itemChips">
                            <Chip mono tone="orange" title="Size">
                                {s.size}
                            </Chip>
                        </span>
                    )}
                    {actions(s).map((group, i) => (
                        <span key={i} className="suggestionActions">
                            {group.map((a) => (
                                <Button
                                    key={a.label}
                                    variant="icon"
                                    className="itemMore"
                                    imgProps={{ img: a.icon, color: a.color }}
                                    aria-label={`${a.label}: ${s.title}`}
                                    title={a.needsSection && !canAdopt ? adoptTitle : a.hint}
                                    disabled={a.needsSection && !canAdopt}
                                    onClick={a.run}
                                />
                            ))}
                        </span>
                    ))}
                </div>
                {twin && (
                    <div className="itemDetail suggestionTwin">
                        <div className="itemMeta">
                            <span className="microLabel">Dropped before</span>
                            <Chip tone="rose" title="Open the dropped goal" onClick={() => onOpenGoal(twin.id)}>
                                {twin.title}
                            </Chip>
                            <span className="caption op-80 break-words">{twin.note?.trim() || "No reason given"}</span>
                        </div>
                    </div>
                )}
                {open && (
                    <div className="itemDetail">
                        {s.body ? <Markdown className="itemBody" text={s.body} /> : <span className="caption op-50">No details.</span>}
                        {s.related && <RelatedChips refs={s.related} onOpen={onOpenRelated} />}
                        <span className="itemMeta caption op-50">suggested {s.created}</span>
                    </div>
                )}
            </li>
        )
    }

    // Grouped like the goals screen, in section order; no or unknown section goes last.
    // Newest: across sections, in recency batches.
    const groups: { section?: Section; title?: string; list: Suggestion[] }[] = newest
        ? byRecency(suggestions)
        : sections.map((section) => ({ section, list: suggestions.filter((s) => s.section === section.n) }))
    if (!newest) groups.push({ list: suggestions.filter((s) => !sections.some((x) => x.n === s.section)) })
    const sortBy = (next: boolean) => {
        setNewest(next)
        writePref(SORT, next ? "newest" : "section")
    }

    return (
        <>
            <div className="suggestionGroups" role="region" aria-label="Suggestions">
                <div className="suggestionHint">
                    <p className="caption op-70">Drop keeps it as a dropped goal so agents never suggest it again. Delete just removes it.</p>
                    <span className="suggestionSort" role="group" aria-label="Sort suggestions">
                        {[false, true].map((n) => (
                            <Button
                                key={String(n)}
                                variant="switcherOption"
                                className={newest === n ? "buttonSwitcherOption--active" : ""}
                                aria-pressed={newest === n}
                                onClick={() => sortBy(n)}
                            >
                                {n ? "Newest" : "By section"}
                            </Button>
                        ))}
                    </span>
                </div>
                {groups
                    .filter((g) => g.list.length)
                    .map(({ section, title, list }) => (
                        <section
                            key={section?.n ?? title ?? "none"}
                            className="uiContentContainer sectionBlock"
                            aria-label={section ? `Section ${section.n}: ${section.title}` : (title ?? "No section")}
                        >
                            <header className="sectionHeader">
                                <span className="sectionTape">
                                    {section && <span className="sectionNumber tabular">§{section.n}</span>}
                                    <h2 className="sectionTitle truncate">{section?.title ?? title ?? "No section"}</h2>
                                </span>
                                <span className="caption tabular op-70 no-wrap">{list.length} open</span>
                            </header>
                            <ul className="itemList">{list.map(row)}</ul>
                        </section>
                    ))}
            </div>

            {chosen.length > 0 && (
                <SelectionBar count={chosen.length} onExit={() => setTicked(new Set())}>
                    <Button variant="primary" imgProps={{ img: "iconify:content-copy" }} onClick={() => copyForAgent(chosen)}>
                        Copy
                    </Button>
                    <Button
                        variant="secondary"
                        imgProps={{ img: "iconify:add" }}
                        disabled={!canAdopt}
                        title={adoptTitle ?? adoptHint}
                        onClick={(e) => {
                            onAdopt(chosen, e.shiftKey)
                            setTicked(new Set())
                        }}
                    >
                        Add to goals
                    </Button>
                    <Button
                        variant="secondary"
                        imgProps={{ img: "iconify:block" }}
                        disabled={!canAdopt}
                        title={adoptTitle}
                        onClick={async () => {
                            if (await onDrop(chosen)) setTicked(new Set())
                        }}
                    >
                        Drop
                    </Button>
                    <Button
                        variant="secondary"
                        imgProps={{ img: "iconify:delete" }}
                        onClick={async () => {
                            if (await onDismiss(chosen)) setTicked(new Set())
                        }}
                    >
                        Delete
                    </Button>
                </SelectionBar>
            )}
        </>
    )
}
