import "./dropdown.css"
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { resolveIconSrc } from "../../utils/iconify.ts"
import { positionAtPoint, type PopoverPoint } from "../../utils/popoverPosition.ts"

export type DropdownActionEntry = {
    type: "item"
    id: string
    label: string
    icon?: string
    variant?: "danger"
    active?: boolean
    disabled?: boolean
    // Toggle rows (filters): stays open and reads as a checkbox.
    keepOpen?: boolean
    onSelect?: () => void
    items?: DropdownEntry[]
}
export type DropdownLabelEntry = { type: "label"; id: string; label: string }
export type DropdownDividerEntry = { type: "divider"; id: string }
export type DropdownEntry = DropdownActionEntry | DropdownLabelEntry | DropdownDividerEntry
export type DropdownAnchor = PopoverPoint

type Props = {
    open: boolean
    anchor: DropdownAnchor | null
    items: DropdownEntry[]
    onClose: () => void
    label?: string
}

const ITEMS = '[role^="menuitem"]:not(:disabled)'
const items = (panel: HTMLElement | null) => Array.from(panel?.querySelectorAll<HTMLElement>(ITEMS) ?? [])
const hasSubmenu = (e: DropdownActionEntry) => !e.disabled && !!e.items?.length

// Submenus drill in within the panel, so the keyboard has one focus list.
export default function Dropdown({ open, anchor, items: rootItems, onClose, label = "Actions" }: Props) {
    const panelRef = useRef<HTMLDivElement>(null)
    const [stack, setStack] = useState<DropdownActionEntry[]>([])
    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) setStack([])
    }
    const current = stack.at(-1)
    const entries = current?.items ?? rootItems

    // Runs before the focus move below; gives focus back unless a click already moved it.
    useLayoutEffect(() => {
        if (!open) return
        const restoreTo = document.activeElement as HTMLElement | null
        return () => {
            if (document.activeElement === document.body || !document.activeElement) restoreTo?.focus?.()
        }
    }, [open])

    useLayoutEffect(() => {
        const panel = panelRef.current
        if (!open || !anchor || !panel) return
        const { left, top } = positionAtPoint(anchor, { width: panel.offsetWidth, height: panel.offsetHeight }, window.innerWidth, window.innerHeight)
        panel.style.left = `${left}px`
        panel.style.top = `${top}px`
        panel.style.visibility = "visible"
    }, [open, anchor, entries])

    // Focus follows opening and drilling, not a live re-render of toggle rows.
    useLayoutEffect(() => {
        if (open) items(panelRef.current).find((el) => !el.classList.contains("dropdownBackRow"))?.focus()
    }, [open, stack])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key !== "Escape") return
            e.preventDefault()
            onClose()
        }
        const onPointerDown = (e: PointerEvent) => {
            if (!(e.target as Element | null)?.closest?.(".dropdownPanel")) onClose()
        }
        document.addEventListener("keydown", onKeyDown)
        document.addEventListener("pointerdown", onPointerDown)
        return () => {
            document.removeEventListener("keydown", onKeyDown)
            document.removeEventListener("pointerdown", onPointerDown)
        }
    }, [open, onClose])

    if (!open || !anchor) return null

    const select = (entry: DropdownActionEntry) => {
        if (entry.disabled) return
        if (hasSubmenu(entry)) return setStack((s) => [...s, entry])
        entry.onSelect?.()
        if (!entry.keepOpen) onClose()
    }

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const list = items(panelRef.current)
        const at = list.indexOf(document.activeElement as HTMLElement)
        const go = (i: number) => list[(i + list.length) % list.length]?.focus()
        const keys: Record<string, () => void> = {
            ArrowDown: () => go(at + 1),
            ArrowUp: () => go(at < 0 ? -1 : at - 1),
            Home: () => go(0),
            End: () => go(-1),
            ArrowLeft: () => current && setStack((s) => s.slice(0, -1)),
            ArrowRight: () => {
                const el = document.activeElement as HTMLElement | null
                if (el?.getAttribute("aria-haspopup")) el.click()
            },
            Tab: onClose,
        }
        const run = keys[e.key]
        if (!run) return
        e.preventDefault()
        run()
    }

    return createPortal(
        <div className="dropdownBackdrop z-overlay">
            <div
                ref={panelRef}
                className="uiContentContainer dropdownPanel outfit"
                style={{ left: anchor.x, top: anchor.y, visibility: "hidden" }}
                onKeyDown={onKeyDown}
            >
                <div className="dropdownList" role="menu" aria-label={current?.label ?? label}>
                    {current && (
                        <button type="button" role="menuitem" className="dropdownItem dropdownBackRow" onClick={() => setStack((s) => s.slice(0, -1))}>
                            <img className="iconImg dropdownItemIcon" src={resolveIconSrc("iconify:chevron-left")} alt="" />
                            <span className="dropdownItemLabel truncate size-0_8 font-bold">{current.label}</span>
                        </button>
                    )}
                    {entries.map((entry) => {
                        if (entry.type === "divider") return <figure key={entry.id} className="divider dropdownDivider" />
                        if (entry.type === "label") return <div key={entry.id} className="dropdownLabel caption-small op-50 uppercase">{entry.label}</div>
                        const sub = hasSubmenu(entry)
                        return (
                            <button
                                key={entry.id}
                                type="button"
                                role={entry.keepOpen ? "menuitemcheckbox" : "menuitem"}
                                className={`dropdownItem ${entry.variant === "danger" ? "dropdownItemDanger" : ""} ${entry.active ? "dropdownItemActive" : ""} ${entry.disabled ? "deactive" : ""}`}
                                disabled={entry.disabled}
                                aria-checked={entry.keepOpen ? !!entry.active : undefined}
                                aria-current={!entry.keepOpen && entry.active ? "true" : undefined}
                                aria-haspopup={sub ? "menu" : undefined}
                                onClick={() => select(entry)}
                            >
                                {entry.icon && <img className="iconImg dropdownItemIcon" src={resolveIconSrc(entry.icon)} alt="" />}
                                <span className="dropdownItemLabel truncate size-0_8 font-bold">{entry.label}</span>
                                {sub && <img className="iconImg dropdownItemChevron" src={resolveIconSrc("iconify:chevron-right")} alt="" />}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>,
        document.body,
    )
}
