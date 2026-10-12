import { useEffect, type RefObject } from "react"

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(active: boolean, container: RefObject<HTMLElement | null>, initialFocusRef?: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        if (!active) return
        const restoreTo = document.activeElement as HTMLElement | null
        const focusables = () => Array.from(container.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        const frame = requestAnimationFrame(() => (initialFocusRef?.current ?? focusables()[0] ?? container.current)?.focus())

        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return
            const items = focusables()
            if (!items.length) return
            const first = items[0]
            const last = items[items.length - 1]
            const focused = document.activeElement
            const inside = container.current?.contains(focused)
            if (e.shiftKey && (focused === first || !inside)) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && focused === last) {
                e.preventDefault()
                first.focus()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener("keydown", onKey)
            restoreTo?.focus?.()
        }
    }, [active, container, initialFocusRef])
}

// Skips an Escape a menu above already took (it calls preventDefault).
export function useEscape(active: boolean, onEscape: () => void): void {
    useEffect(() => {
        if (!active) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape" || e.defaultPrevented) return
            e.preventDefault()
            onEscape()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [active, onEscape])
}
