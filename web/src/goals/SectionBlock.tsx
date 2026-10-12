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
    const { section, closed, open, items } = group
    return (
        <section
            className={`uiContentContainer sectionBlock ${closed ? "sectionBlock--closed" : ""} ${over ? "dropTargetOver" : ""}`}
            aria-label={`Section ${section.n}: ${section.title}`}
            data-section={section.n}
            onDragOver={(e) => api.dragOver(`section:${section.n}`, e)}
            onDrop={(e) => api.dropOn({ section: section.n }, e)}
        >
            <header className="sectionHeader" onContextMenu={onMenuAt}>
                <span className="sectionNumber Inconsolata caption op-50">§{section.n}</span>
                <h2 className="sectionTitle size-1 font-bold truncate">{section.title}</h2>
                {closed ? <span className="microLabel">Closed</span> : <span className="caption-small op-50 no-wrap">{open} open</span>}
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
function ItemList({ items, pinned, renderRow }: { items: Item[]; pinned: string | null; renderRow: RenderRow }) {
    const { listRef, measure, start, end, padTop, padBottom } = useVirtualRows(
        items.map((i) => i.id),
        ROW_ESTIMATE,
    )
    const p = pinned ? items.findIndex((i) => i.id === pinned) : -1
    return (
        <ul ref={listRef} className="itemList" style={{ paddingTop: padTop, paddingBottom: padBottom }}>
            {p >= 0 && p < start && renderRow(items[p], undefined, true)}
            {items.slice(start, end).map((item) => renderRow(item, measure))}
            {p >= end && renderRow(items[p], undefined, true)}
        </ul>
    )
}
