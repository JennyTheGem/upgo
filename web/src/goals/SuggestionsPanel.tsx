import { useState } from "react"
import type { Section, Suggestion } from "../../../src/core/schema.ts"
import Button from "../primitives/button/Button.tsx"
import Chip from "../primitives/chip/Chip.tsx"
import EmptyState from "../primitives/emptyState/EmptyState.tsx"
import ErrorState from "../primitives/errorState/ErrorState.tsx"
import SelectionBar from "../primitives/selectionBar/SelectionBar.tsx"
import { copyForAgent } from "./format.ts"
import Markdown from "./Markdown.tsx"

type Props = {
    suggestions: Suggestion[]
    error?: string
    canAdopt: boolean
    onAdopt: (list: Suggestion[]) => void
    onDismiss: (ids: string[]) => Promise<boolean>
    onDrop: (list: Suggestion[]) => Promise<boolean>
    sections: Section[]
}

type Action = { label: string; hint: string; icon: string; color?: string; needsSection?: boolean; run: () => void }

const toggled = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (!next.delete(id)) next.add(id)
    return next
}

// Agents add these with `upgo suggestion add`. Rows look and act like goal rows.
export default function SuggestionsPanel({ suggestions, error, canAdopt, onAdopt, onDismiss, onDrop, sections }: Props) {
    const [ticked, setTicked] = useState<Set<string>>(new Set())
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const chosen = suggestions.filter((s) => ticked.has(s.id))
    const adoptTitle = canAdopt ? undefined : "Add a section first"

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
            { label: "Add to goals", hint: "Add to goals", icon: "iconify:add", needsSection: true, run: () => onAdopt([s]) },
            { label: "Copy", hint: "Copy for agent", icon: "iconify:content-copy", run: () => copyForAgent([s]) },
        ],
        [
            { label: "Drop", hint: "Drop: never suggest again", icon: "iconify:block", color: "var(--tone-orange)", needsSection: true, run: () => onDrop([s]) },
            { label: "Delete", hint: "Delete: remove, may come back", icon: "iconify:delete", color: "var(--color-danger)", run: () => onDismiss([s.id]) },
        ],
    ]

    const row = (s: Suggestion) => {
        const open = expanded.has(s.id)
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
                        <span className="itemId Inconsolata caption-small truncate">{s.id}</span>
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
                {open && (
                    <div className="itemDetail">
                        {s.body ? <Markdown className="itemBody" text={s.body} /> : <span className="caption op-50">No details.</span>}
                        <span className="itemMeta caption-small op-50">suggested {s.created}</span>
                    </div>
                )}
            </li>
        )
    }

    // Grouped like the goals screen, in section order; no or unknown section goes last.
    const groups: { section?: Section; list: Suggestion[] }[] = sections.map((section) => ({ section, list: suggestions.filter((s) => s.section === section.n) }))
    groups.push({ list: suggestions.filter((s) => !sections.some((x) => x.n === s.section)) })

    return (
        <>
            <div className="suggestionGroups" role="region" aria-label="Suggestions">
                <p className="suggestionHint caption-small op-70">Drop keeps it as a dropped goal so agents never suggest it again. Delete just removes it.</p>
                {groups
                    .filter((g) => g.list.length)
                    .map(({ section, list }) => (
                        <section
                            key={section?.n ?? "none"}
                            className="uiContentContainer sectionBlock"
                            aria-label={section ? `Section ${section.n}: ${section.title}` : "No section"}
                        >
                            <header className="sectionHeader">
                                <span className="sectionTape">
                                    {section && <span className="sectionNumber tabular">§{section.n}</span>}
                                    <h2 className="sectionTitle truncate">{section?.title ?? "No section"}</h2>
                                </span>
                                <span className="caption-small tabular op-70 no-wrap">{list.length} open</span>
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
                        title={adoptTitle}
                        onClick={() => {
                            onAdopt(chosen)
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
                            if (await onDismiss(chosen.map((s) => s.id))) setTicked(new Set())
                        }}
                    >
                        Delete
                    </Button>
                </SelectionBar>
            )}
        </>
    )
}
