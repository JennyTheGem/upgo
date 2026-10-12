import { useCallback, useState } from "react"
import type { DropdownAnchor, DropdownEntry } from "./dropdown.tsx"

type TriggerState = { open: boolean; anchor: DropdownAnchor | null; items: DropdownEntry[] }

const anchorOf = (el: Element): DropdownAnchor => {
    const rect = el.getBoundingClientRect()
    return { x: rect.left, y: rect.bottom, flipX: rect.right, flipY: rect.top }
}

export function useDropdownTrigger() {
    const [state, setState] = useState<TriggerState>({ open: false, anchor: null, items: [] })

    // A keyboard context menu (Menu key, Shift+F10) reports 0,0: anchor to the element instead.
    const openFromEvent = useCallback((e: { clientX: number; clientY: number; currentTarget: EventTarget | null; preventDefault: () => void }, items: DropdownEntry[]) => {
        e.preventDefault()
        const fromKeyboard = !e.clientX && !e.clientY && e.currentTarget instanceof Element
        setState({ open: true, anchor: fromKeyboard ? anchorOf(e.currentTarget as Element) : { x: e.clientX, y: e.clientY }, items })
    }, [])

    const openFromElement = useCallback((el: Element, items: DropdownEntry[]) => {
        setState({ open: true, anchor: anchorOf(el), items })
    }, [])

    const close = useCallback(() => setState((s) => (s.open ? { ...s, open: false } : s)), [])

    return { open: state.open, anchor: state.anchor, items: state.items, openFromEvent, openFromElement, close }
}
