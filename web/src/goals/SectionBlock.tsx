import type { MouseEvent, ReactNode, RefCallback } from "react"
import type { Item } from "../../../src/core/schema.ts"
import Button from "../primitives/button/Button.tsx"
import { useVirtualRows } from "../utils/useVirtualRows.ts"
import type { Group } from "./filters.ts"
import type { RowApi } from "./ItemRow.tsx"

// A collapsed row: 44px head + its 1px borders + the list gap.
const ROW_ESTIMATE = 48

type RenderRow = (item: Item, measure?: RefCallback<HTMLElement>, hidden?: boolean) => ReactNode

// A drop on the header or the empty space moves an item to the end of the section.
export default function SectionBlock({ group, over, pinned, api, onMenuAt, onMenuFrom, renderRow }: {
    group: Group
    over: boolean
    pinned: string | null
    api: RowApi
    onMenuAt: (e: MouseEvent) => void
    onMenuFrom: (el: Element) => void
    renderRow: RenderRow
}) {
    const { section, closed, open, done, percent, items } = group
    const progress = `${done} of ${open + done} done, ${percent}% by size`
    return (
        <section
            className={`uiContentContainer sectionBlock ${closed ? "sectionBlock--closed" : ""} ${over ? "dropTargetOver" : ""}`}
            aria-label={`Section ${section.n}: ${section.title}`}
            data-section={section.n}
            onDragOver={(e) => api.dragOver(`section:${section.n}`, e)}
            onDrop={(e) => api.dropOn({ section: section.n }, e)}
        >
            <header className="sectionHeader" onContextMenu={onMenuAt}>
                <span className="sectionTape">
                    <span className="sectionNumber tabular">§{section.n}</span>
                    <h2 className="sectionTitle truncate">{section.title}</h2>
                </span>
                {closed ? <span className="microLabel">Closed</span> : <span className="caption tabular op-70 no-wrap">{open} open</span>}
                {open + done > 0 && (
                    <span className="sectionProgress" role="img" aria-label={progress} title={progress}>
                        <span style={{ width: `${percent}%` }} />
                    </span>
                )}
                <Button
                    variant="icon"
                    className="sectionMore"
                    imgProps={{ img: "iconify:more-vert" }}
                    aria-label={`Actions for section ${section.title}`}
                    title="Section actions"
                    onClick={(e) => onMenuFrom(e.currentTarget)}
                />
            </header>
            {items.length > 0 && <ItemList items={items} pinned={pinned} renderRow={renderRow} />}
        </section>
    )
}

// The pinned row (a drag source) stays in the DOM, hidden, when it scrolls out: removing it would lose its dragend.
// One keyed list, so React moves that node rather than remounting it.
function ItemList({ items, pinned, renderRow }: { items: Item[]; pinned: string | null; renderRow: RenderRow }) {
    const { listRef, measure, start, end, padTop, padBottom } = useVirtualRows(
        items.map((i) => i.id),
        ROW_ESTIMATE,
    )
    const p = pinned ? items.findIndex((i) => i.id === pinned) : -1
    const rows = items.slice(start, end)
    const away = p >= 0 && (p < start || p >= end) ? items[p] : undefined
    const all = !away ? rows : p < start ? [away, ...rows] : [...rows, away]
    return (
        <ul ref={listRef} className="itemList" style={{ paddingTop: padTop, paddingBottom: padBottom }}>
            {all.map((item) => (item === away ? renderRow(item, undefined, true) : renderRow(item, measure)))}
        </ul>
    )
}
