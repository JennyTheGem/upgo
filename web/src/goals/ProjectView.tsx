import "./projectView.css"
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { summarize } from "../../../src/core/summary.ts"
import type { Item, Section, Suggestion } from "../../../src/core/schema.ts"
import { isOpenStatus } from "../../../src/core/vocab.ts"
import { api, errorText } from "../api.ts"
import Button from "../primitives/button/Button.tsx"
import { confirmAction } from "../primitives/confirmDialog/confirm.ts"
import Dropdown from "../primitives/dropdown/dropdown.tsx"
import { useDropdownTrigger } from "../primitives/dropdown/useDropdownTrigger.ts"
import EmptyState from "../primitives/emptyState/EmptyState.tsx"
import ErrorState from "../primitives/errorState/ErrorState.tsx"
import { promptText } from "../primitives/promptDialog/prompt.ts"
import SelectionBar from "../primitives/selectionBar/SelectionBar.tsx"
import { toast } from "../primitives/toast/toast.ts"
import FilterBar from "./FilterBar.tsx"
import { NO_FILTERS, groupItems, type Filters, type Group } from "./filters.ts"
import { copyForAgent } from "./format.ts"
import ItemModal from "./ItemModal.tsx"
import { itemMenu, sectionMenu, type ItemActions, type SectionActions } from "./itemMenu.ts"
import ItemRow, { type RowApi } from "./ItemRow.tsx"
import ProjectTabs, { type Tab } from "./ProjectTabs.tsx"
import SectionBlock from "./SectionBlock.tsx"
import Stage from "./Stage.tsx"
import SuggestionsPanel from "./SuggestionsPanel.tsx"
import TrapsPanel from "./TrapsPanel.tsx"
import { useProject } from "./useProject.ts"

type Editing = { item?: Item; section?: number }

const neighbor = (groups: Group[], item: Item, dir: "up" | "down") => {
    const peers = groups.find((g) => g.section.n === item.section)?.items ?? []
    return peers[peers.findIndex((p) => p.id === item.id) + (dir === "up" ? -1 : 1)]
}

const toggled = (set: Set<string>, ids: string[], on: boolean) => {
    const next = new Set(set)
    for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
    }
    return next
}

// Brings a row on screen and focuses it. Rows mount only near the viewport (and only after a scroll renders),
// so until the row exists it scrolls to its section, then down past the last mounted row, a frame at a time.
function scrollToItem(item: Item, step = 0) {
    requestAnimationFrame(() => {
        const row = document.querySelector(`[data-item-id="${item.id}"]`)
        if (row) {
            row.scrollIntoView({ block: "center" })
            row.querySelector<HTMLElement>(".itemRowToggle")?.focus({ preventScroll: true })
            return
        }
        const section = document.querySelector(`[data-section="${item.section}"]`)
        const anchor = step ? section?.querySelector(".itemList > :last-child") : section
        anchor?.scrollIntoView({ block: "start" })
        if (step < 40) scrollToItem(item, step + 1)
    })
}

// `focus` opens one item once the project loads (a pick on the tour's setlist).
export default function ProjectView({ id, focus, onChanged }: { id: string; focus?: string | null; onChanged: () => void }) {
    const { data, error, reload, run, dismiss } = useProject(id, onChanged)
    const [filters, setFilters] = useState<Filters>(NO_FILTERS)
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(focus ? [focus] : []))
    const [picked, setPicked] = useState<Set<string>>(new Set())
    const [editing, setEditing] = useState<Editing | null>(null)
    const [tab, setTab] = useState<Tab>("goals")
    // Suggestions being added to goals, one modal at a time.
    const [adopting, setAdopting] = useState<Suggestion[]>([])
    const adopted = useRef(false)
    const [over, setOver] = useState<string | null>(null)
    const [dragging, setDragging] = useState<string | null>(null)
    const menu = useDropdownTrigger()
    const dragId = useRef<string | null>(null)
    const lastPick = useRef<string | null>(null)
    const refocus = useRef<string | null>(null)

    const file = data?.file
    const groups = useMemo(() => (file ? groupItems(file, filters) : []), [file, filters])
    const visible = groups.flatMap((g) => g.items)

    const loaded = !!file
    useEffect(() => {
        const item = loaded && focus ? file?.items.find((i) => i.id === focus) : undefined
        if (!item) return
        // A done item (from the tour's recently done) only shows with closed items on. Runs once, so no cascade.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!isOpenStatus(item.status)) setFilters({ ...NO_FILTERS, showClosed: true })
        scrollToItem(item)
        // Once, when the project first loads.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded])

    // A keyboard move re-inserts the row, which drops focus: put it back.
    useEffect(() => {
        const moved = refocus.current
        if (!moved) return
        refocus.current = null
        document.querySelector<HTMLElement>(`[data-item-id="${moved}"] .itemRowToggle`)?.focus()
    }, [file])

    const forget = async () => {
        const ok = await confirmAction({
            message: `Remove "${id}" from upgo?`,
            description: "Only unregisters it. The folder and its goals.json stay, run upgo init there to add it back.",
            confirmLabel: "Remove",
            variant: "destructive",
        })
        if (!ok) return
        try {
            await api.forget(id)
            toast.success(`Removed ${id}`)
            onChanged()
        } catch (e) {
            toast.error(errorText(e))
        }
    }
    const removeButton = (
        <Button variant="secondary" imgProps={{ img: "iconify:delete" }} onClick={forget}>
            Remove
        </Button>
    )

    if (!data || !file) {
        if (error) return <ErrorState className="uiContentContainer" message={error} onRetry={reload} action={removeButton} />
        return <ProjectSkeleton />
    }

    const pickedItems = file.items.filter((i) => picked.has(i.id))

    // A pick from the setlist: drop filters that hide it, expand it, scroll to it.
    const jump = (itemId: string) => {
        const item = file.items.find((i) => i.id === itemId)
        if (!item) return
        setTab("goals")
        if (!visible.includes(item)) setFilters(NO_FILTERS)
        setExpanded((s) => toggled(s, [itemId], true))
        scrollToItem(item)
    }

    const items: ItemActions = {
        edit: (item) => setEditing({ item }),
        phase: (item, phase) => run({ op: "edit", id: item.id, patch: { phase } }),
        status: (item, status) => run({ op: "edit", id: item.id, patch: { status } }),
        done: async (item) => {
            const note = await promptText({ title: `Mark "${item.title}" done`, placeholder: "Note (optional)", confirmLabel: "Mark done", required: false })
            if (note !== null) run(note ? { op: "done", id: item.id, note } : { op: "done", id: item.id })
        },
        drop: async (item) => {
            const reason = await promptText({
                title: `Drop "${item.title}"`,
                description: "Dropped items stay in the file with their reason, so nobody proposes them again.",
                placeholder: "Reason",
                confirmLabel: "Drop",
            })
            if (reason) run({ op: "drop", id: item.id, reason })
        },
        reopen: (item) => run({ op: "reopen", id: item.id }),
        move: (item, dir) => {
            const other = neighbor(groups, item, dir)
            if (!other) return
            refocus.current = item.id
            run(dir === "up" ? { op: "move", id: item.id, before: other.id } : { op: "move", id: item.id, after: other.id })
        },
        copy: copyForAgent,
        remove: async (item) => {
            const ok = await confirmAction({
                message: `Delete "${item.title}"?`,
                description: "Delete removes it for good. Drop keeps it with a reason.",
                confirmLabel: "Delete",
                variant: "destructive",
            })
            if (ok) run({ op: "delete", id: item.id })
        },
    }

    const sectionAt = (s: Section, step: number) => file.sections[file.sections.indexOf(s) + step]
    const sections: SectionActions = {
        addItem: (s) => setEditing({ section: s.n }),
        rename: async (s) => {
            const title = await promptText({ title: `Rename §${s.n}`, initialValue: s.title, placeholder: "Section title", confirmLabel: "Rename" })
            if (title && title !== s.title) run({ op: "renameSection", n: s.n, title })
        },
        move: (s, dir) => {
            if (!sectionAt(s, dir === "up" ? -1 : 1)) return
            run({ op: "moveSection", n: s.n, before: dir === "up" ? sectionAt(s, -1).n : (sectionAt(s, 2)?.n ?? null) })
        },
        remove: async (s) => {
            const ok = await confirmAction({ message: `Delete section "${s.title}"?`, confirmLabel: "Delete", variant: "destructive" })
            if (ok) run({ op: "deleteSection", n: s.n })
        },
    }

    const addSection = async () => {
        const title = await promptText({ title: "New section", placeholder: "Section title", confirmLabel: "Add section" })
        if (title) run({ op: "addSection", title })
    }

    const entriesFor = (item: Item) => itemMenu(item, items, { up: !!neighbor(groups, item, "up"), down: !!neighbor(groups, item, "down") })
    const sectionEntries = (s: Section) =>
        sectionMenu(s, sections, { up: !!sectionAt(s, -1), down: !!sectionAt(s, 1), delete: !file.items.some((i) => i.section === s.n) })

    const endDrag = () => {
        dragId.current = null
        setDragging(null)
        setOver(null)
    }

    const rowApi: RowApi = {
        projectId: id,
        toggle: (itemId) => setExpanded((s) => toggled(s, [itemId], !s.has(itemId))),
        select: (itemId, shift) => {
            const order = visible.map((i) => i.id)
            const from = shift && lastPick.current ? order.indexOf(lastPick.current) : -1
            const to = order.indexOf(itemId)
            const ids = from >= 0 && to >= 0 ? order.slice(Math.min(from, to), Math.max(from, to) + 1) : [itemId]
            const on = !picked.has(itemId)
            lastPick.current = itemId
            setPicked((s) => toggled(s, ids, on))
        },
        menuAt: (item, e) => menu.openFromEvent(e, entriesFor(item)),
        menuFrom: (item, el) => menu.openFromElement(el, entriesFor(item)),
        nudge: (item, dir) => items.move(item, dir),
        dragStart: (item, e: DragEvent) => {
            dragId.current = item.id
            setDragging(item.id)
            e.dataTransfer?.setData("text/plain", item.id)
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"
            const row = (e.currentTarget as Element).closest("li")
            if (row) e.dataTransfer?.setDragImage?.(row, 16, 16)
        },
        dragEnd: endDrag,
        dragOver: (key, e) => {
            if (!dragId.current) return
            e.preventDefault()
            e.stopPropagation()
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
            if (over !== key) setOver(key)
        },
        dropOn: (target, e) => {
            const moving = dragId.current
            if (!moving) return
            e.preventDefault()
            e.stopPropagation()
            endDrag()
            if ("before" in target && target.before === moving) return
            run({ op: "move", id: moving, ...target })
        },
    }

    return (
        <section className="projectPageContainer outfit">
            <Stage
                summary={summarize(file)}
                onPick={jump}
                onPromote={(itemId) => run({ op: "edit", id: itemId, patch: { phase: "now" } })}
                title={<h1 className="stageHeading truncate">{data.id}</h1>}
                meta={
                    <>
                        {file.purpose && <span className="caption op-80">{file.purpose}</span>}
                        <span className="Inconsolata caption-small op-50 truncate" title={data.path}>
                            {data.path}
                        </span>
                    </>
                }
                actions={
                    <>
                        {removeButton}
                        <Button variant="secondary" imgProps={{ img: "iconify:add" }} onClick={addSection}>
                            Add section
                        </Button>
                        <Button variant="primary" imgProps={{ img: "iconify:add" }} disabled={!file.sections.length} onClick={() => setEditing({})}>
                            Add item
                        </Button>
                    </>
                }
            />

            <ProjectTabs tab={tab} suggestions={data.suggestions.length} onChange={setTab} />

            <div className="projectTabPanel" id="project-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
                {tab === "suggestions" ? (
                    <SuggestionsPanel suggestions={data.suggestions} canAdopt={file.sections.length > 0} onAdopt={setAdopting} onDismiss={dismiss} />
                ) : (
                    <>
                        {file.traps.length > 0 && <TrapsPanel traps={file.traps} />}

                        <FilterBar file={file} filters={filters} onChange={setFilters} />

                        {groups.map((g) => (
                            <SectionBlock
                                key={g.section.n}
                                group={g}
                                over={over === `section:${g.section.n}`}
                                pinned={dragging}
                                api={rowApi}
                                onMenuAt={(e) => menu.openFromEvent(e, sectionEntries(g.section))}
                                onMenuFrom={(el) => menu.openFromElement(el, sectionEntries(g.section))}
                                renderRow={(item, measure, hidden) => (
                                    <ItemRow
                                        key={item.id}
                                        ref={measure}
                                        hidden={hidden}
                                        item={item}
                                        expanded={expanded.has(item.id)}
                                        selected={picked.has(item.id)}
                                        dropBefore={over === item.id}
                                        api={rowApi}
                                    />
                                )}
                            />
                        ))}

                        {!file.sections.length && <EmptyState className="uiContentContainer" message="No sections yet. Add one to start." />}
                        {file.sections.length > 0 && !groups.length && (
                            <EmptyState
                                className="uiContentContainer"
                                message="Nothing matches these filters."
                                action={
                                    <Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                                        Clear filters
                                    </Button>
                                }
                            />
                        )}

                        {pickedItems.length > 0 && (
                            <SelectionBar count={pickedItems.length} onExit={() => setPicked(new Set())}>
                                <Button variant="primary" imgProps={{ img: "iconify:content-copy" }} onClick={() => copyForAgent(pickedItems)}>
                                    Copy
                                </Button>
                            </SelectionBar>
                        )}
                    </>
                )}
            </div>

            <Dropdown open={menu.open} anchor={menu.anchor} items={menu.items} onClose={menu.close} />
            {editing && <ItemModal file={file} item={editing.item} section={editing.section} onClose={() => setEditing(null)} onSubmit={run} />}
            {adopting[0] && (
                <ItemModal
                    key={adopting[0].id}
                    file={file}
                    draft={adopting[0]}
                    // Saved: on to the next one. Cancelled: stop.
                    onClose={() => {
                        const next = adopted.current
                        adopted.current = false
                        setAdopting((q) => (next ? q.slice(1) : []))
                    }}
                    onSubmit={async (op) => {
                        const ok = await run(op)
                        if (ok) {
                            adopted.current = true
                            dismiss([adopting[0].id])
                        }
                        return ok
                    }}
                />
            )}
        </section>
    )
}

function ProjectSkeleton() {
    return (
        <section className="projectPageContainer" aria-busy="true" aria-label="Loading project">
            <div className="uiContentContainer stage">
                <span className="skeletonPulse skeletonBar" style={{ width: "40%", height: "2rem" }} />
                <span className="skeletonPulse skeletonBar" style={{ width: "70%" }} />
                {[60, 45, 52].map((w) => (
                    <span key={w} className="skeletonPulse skeletonBar" style={{ width: `${w}%`, height: "1.3rem" }} />
                ))}
            </div>
            <div className="uiContentContainer sectionBlock">
                {[80, 65, 72].map((w) => (
                    <span key={w} className="skeletonPulse skeletonBar" style={{ width: `${w}%` }} />
                ))}
            </div>
        </section>
    )
}
