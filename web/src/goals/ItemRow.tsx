import "./itemRow.css"
import type { DragEvent, MouseEvent, Ref } from "react"
import { PHASE_LABEL, isOpenStatus, type Phase, type Status } from "../../../src/core/vocab.ts"
import type { Item } from "../../../src/core/schema.ts"
import Button from "../primitives/button/Button.tsx"
import Chip, { type ChipTone } from "../primitives/chip/Chip.tsx"
import Icon from "../primitives/icon/Icon.tsx"
import ItemDetail from "./ItemDetail.tsx"

export type DropTarget = { before: string } | { section: number }

export type RowApi = {
    projectId: string
    toggle: (id: string) => void
    select: (id: string, shift: boolean) => void
    menuAt: (item: Item, e: MouseEvent) => void
    menuFrom: (item: Item, el: Element) => void
    nudge: (item: Item, dir: "up" | "down") => void
    dragStart: (item: Item, e: DragEvent) => void
    dragEnd: () => void
    dragOver: (key: string, e: DragEvent) => void
    dropOn: (target: DropTarget, e: DragEvent) => void
}

const PHASE_TONE: Record<Phase, ChipTone> = { now: "accent", next: "blue", later: "teal", wayLater: "periwinkle", maybe: "neutral" }
const STATUS_TONE: Record<Status, ChipTone> = { planned: "neutral", partial: "amber", done: "green", dropped: "rose" }

export default function ItemRow({ item, expanded, selected, dropBefore, api, ref, hidden }: {
    item: Item
    expanded: boolean
    selected: boolean
    dropBefore: boolean
    api: RowApi
    ref?: Ref<HTMLLIElement>
    hidden?: boolean
}) {
    const closed = !isOpenStatus(item.status)
    return (
        <li
            ref={ref}
            hidden={hidden}
            className={`itemRow ${expanded ? "itemRow--open" : ""} ${closed ? `itemRow--${item.status}` : ""} ${selected ? "itemRow--selected" : ""} ${dropBefore ? "itemRow--dropBefore" : ""}`}
            data-item-id={item.id}
            onContextMenu={(e) => api.menuAt(item, e)}
            onKeyDown={(e) => {
                if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return
                e.preventDefault()
                api.nudge(item, e.key === "ArrowUp" ? "up" : "down")
            }}
            onDragOver={(e) => api.dragOver(item.id, e)}
            onDrop={(e) => api.dropOn({ before: item.id }, e)}
        >
            <div className="itemRowHead">
                <span className="itemDrag" draggable title="Drag to reorder" aria-hidden="true" onDragStart={(e) => api.dragStart(item, e)} onDragEnd={api.dragEnd}>
                    <Icon name="iconify:drag-indicator" />
                </span>
                <input
                    type="checkbox"
                    className="itemCheck"
                    checked={selected}
                    aria-label={`Select ${item.title}`}
                    onChange={(e) => api.select(item.id, (e.nativeEvent as globalThis.MouseEvent).shiftKey === true)}
                />
                <button type="button" className="itemRowToggle" aria-expanded={expanded} onClick={() => api.toggle(item.id)}>
                    <span className="itemTitle font-bold truncate">{item.title}</span>
                    <span className="itemId Inconsolata caption-small truncate">{item.id}</span>
                </button>
                <span className="itemChips">
                    <Chip tone={PHASE_TONE[item.phase]} title="Phase">
                        {PHASE_LABEL[item.phase]}
                    </Chip>
                    {item.status !== "planned" && (
                        <Chip tone={STATUS_TONE[item.status]} title="Status">
                            {item.status}
                        </Chip>
                    )}
                    {item.size && (
                        <Chip mono tone="orange" title="Size">
                            {item.size}
                        </Chip>
                    )}
                    {item.scope?.map((s) => (
                        <Chip key={s} tone="sky" title="Scope">
                            {s}
                        </Chip>
                    ))}
                </span>
                <Button
                    variant="icon"
                    className="itemMore"
                    imgProps={{ img: "iconify:more-vert" }}
                    aria-label={`Actions for ${item.title}`}
                    title="Actions"
                    onClick={(e) => api.menuFrom(item, e.currentTarget)}
                />
            </div>
            {expanded && <ItemDetail item={item} projectId={api.projectId} />}
        </li>
    )
}
