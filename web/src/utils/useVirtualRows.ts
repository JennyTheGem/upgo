import { useCallback, useLayoutEffect, useRef, useState, type RefCallback } from "react"

const OVERSCAN = 800 // px mounted past each edge of the viewport
const STEP = 200 // the window moves in steps, so scrolling re-renders a list every STEP px, not every frame

function scrollParent(el: HTMLElement): HTMLElement | null {
    for (let p = el.parentElement; p; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p
    return null
}

// Mounts only the rows of a list near the viewport. Rows carry `data-item-id` and get `measure` as their ref;
// unmeasured rows count as `estimate`.
export function useVirtualRows(keys: string[], estimate: number) {
    const listRef = useRef<HTMLUListElement>(null)
    const rowObserver = useRef<ResizeObserver | null>(null)
    const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map())
    const [top, setTop] = useState(0)
    const [viewport, setViewport] = useState(() => window.innerHeight)

    useLayoutEffect(() => {
        const list = listRef.current
        if (!list) return
        const scroller = scrollParent(list)
        const update = () => {
            const vh = scroller ? scroller.clientHeight : window.innerHeight
            const raw = (scroller ? scroller.getBoundingClientRect().top : 0) - list.getBoundingClientRect().top
            // A list far off screen keeps one value, so it does not re-render while others scroll.
            const clamped = Math.min(Math.max(raw, -vh - OVERSCAN - STEP), list.offsetHeight + OVERSCAN)
            setTop(Math.floor(clamped / STEP) * STEP)
            setViewport(vh)
        }
        update()
        // Capture sees every container's scroll; the observer catches content above the list changing height.
        window.addEventListener("scroll", update, { capture: true, passive: true })
        window.addEventListener("resize", update)
        const content = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
        content?.observe(scroller?.firstElementChild ?? document.body)
        return () => {
            window.removeEventListener("scroll", update, { capture: true })
            window.removeEventListener("resize", update)
            content?.disconnect()
        }
    }, [])

    const measure = useCallback<RefCallback<HTMLElement>>((el) => {
        if (!el || typeof ResizeObserver === "undefined") return
        rowObserver.current ??= new ResizeObserver((entries) => {
            const gap = listRef.current ? parseFloat(getComputedStyle(listRef.current).rowGap) || 0 : 0
            setHeights((prev) => {
                let next: Map<string, number> | null = null
                for (const e of entries) {
                    const key = (e.target as HTMLElement).dataset.itemId
                    const h = (e.borderBoxSize?.[0]?.blockSize ?? e.target.getBoundingClientRect().height) + gap
                    if (key && Math.abs((prev.get(key) ?? -1) - h) > 0.5) (next ??= new Map(prev)).set(key, h)
                }
                return next ?? prev
            })
        })
        const ro = rowObserver.current
        ro.observe(el)
        return () => ro.unobserve(el)
    }, [])

    const offsets = [0]
    for (const k of keys) offsets.push(offsets[offsets.length - 1] + (heights.get(k) ?? estimate))
    const lo = top - OVERSCAN
    const hi = top + STEP + viewport + OVERSCAN
    let start = 0
    while (start < keys.length && offsets[start + 1] <= lo) start++
    let end = start
    while (end < keys.length && offsets[end] < hi) end++

    return { listRef, measure, start, end, padTop: offsets[start], padBottom: offsets[keys.length] - offsets[end] }
}
