import { useState } from "react"
import type { Suggestion } from "../../../src/core/schema.ts"
import Button from "../primitives/button/Button.tsx"
import Dropdown, { type DropdownEntry } from "../primitives/dropdown/dropdown.tsx"
import { useDropdownTrigger } from "../primitives/dropdown/useDropdownTrigger.ts"
import EmptyState from "../primitives/emptyState/EmptyState.tsx"
import ErrorState from "../primitives/errorState/ErrorState.tsx"
import SelectionBar from "../primitives/selectionBar/SelectionBar.tsx"
import { copyForAgent } from "./format.ts"

type Props = {
    suggestions: Suggestion[]
    error?: string
    canAdopt: boolean
    onAdopt: (list: Suggestion[]) => void
    onDismiss: (ids: string[]) => Promise<boolean>
}

const toggled = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (!next.delete(id)) next.add(id)
    return next
}

// Agents add these with `upgo suggestion add`. Rows look and act like goal rows.
export default function SuggestionsPanel({ suggestions, error, canAdopt, onAdopt, onDismiss }: Props) {
    const [ticked, setTicked] = useState<Set<string>>(new Set())
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const menu = useDropdownTrigger()
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

    const entries = (s: Suggestion): DropdownEntry[] => [
        { type: "item", id: "adopt", label: "Add to goals", icon: "iconify:add", disabled: !canAdopt, onSelect: () => onAdopt([s]) },
        { type: "item", id: "copy", label: "Copy for agent", icon: "iconify:content-copy", onSelect: () => copyForAgent([s]) },
        { type: "divider", id: "d" },
        { type: "item", id: "dismiss", label: "Dismiss", icon: "iconify:delete", variant: "danger", onSelect: () => onDismiss([s.id]) },
    ]

    return (
        <>
            <section className="uiContentContainer sectionBlock" aria-label="Suggestions">
                <header className="sectionHeader">
                    <span className="sectionTape">
                        <h2 className="sectionTitle truncate">Suggestions</h2>
                    </span>
                    <span className="caption-small tabular op-70 no-wrap">{suggestions.length} open</span>
                </header>
                <ul className="itemList">
                    {suggestions.map((s) => {
                        const open = expanded.has(s.id)
                        return (
                            <li
                                key={s.id}
                                className={`itemRow suggestionRow ${open ? "itemRow--open" : ""} ${ticked.has(s.id) ? "itemRow--selected" : ""}`}
                                data-suggestion-id={s.id}
                                onContextMenu={(e) => menu.openFromEvent(e, entries(s))}
                            >
                                <div className="itemRowHead">
                                    <input type="checkbox" className="itemCheck" checked={ticked.has(s.id)} aria-label={`Select ${s.title}`} onChange={() => setTicked((t) => toggled(t, s.id))} />
                                    <button type="button" className="itemRowToggle" aria-expanded={open} onClick={() => setExpanded((x) => toggled(x, s.id))}>
                                        <span className="itemTitle font-bold truncate">{s.title}</span>
                                        <span className="itemId Inconsolata caption-small truncate">{s.id}</span>
                                    </button>
                                    <Button
                                        variant="secondary"
                                        className="suggestionAdopt"
                                        imgProps={{ img: "iconify:add" }}
                                        aria-label={`Add to goals: ${s.title}`}
                                        title={adoptTitle}
                                        disabled={!canAdopt}
                                        onClick={() => onAdopt([s])}
                                    >
                                        <span className="suggestionAdoptLabel">Add to goals</span>
                                    </Button>
                                    <Button
                                        variant="icon"
                                        className="itemMore"
                                        imgProps={{ img: "iconify:more-vert" }}
                                        aria-label={`Actions for ${s.title}`}
                                        title="Actions"
                                        onClick={(e) => menu.openFromElement(e.currentTarget, entries(s))}
                                    />
                                </div>
                                {open && (
                                    <div className="itemDetail">
                                        {s.body ? <p className="itemBody">{s.body}</p> : <span className="caption op-50">No details.</span>}
                                        <span className="itemMeta caption-small op-50">suggested {s.created}</span>
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </section>

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
                        imgProps={{ img: "iconify:delete" }}
                        onClick={async () => {
                            if (await onDismiss(chosen.map((s) => s.id))) setTicked(new Set())
                        }}
                    >
                        Dismiss
                    </Button>
                </SelectionBar>
            )}

            <Dropdown open={menu.open} anchor={menu.anchor} items={menu.items} onClose={menu.close} />
        </>
    )
}
