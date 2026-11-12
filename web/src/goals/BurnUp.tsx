import "./burnUp.css"
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import type { Item } from "../../../src/core/schema.ts"
import { burnUp } from "../../../src/core/summary.ts"
import EmptyState from "../primitives/emptyState/EmptyState.tsx"

const H = 260
const PAD = { l: 36, r: 12, t: 12, b: 26 }
const TICKS = 4

// Done versus total over time: the gap between the lines is the open work.
export default function BurnUp({ items }: { items: Item[] }) {
    const points = useMemo(() => burnUp(items), [items])
    const box = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(720)
    const [hover, setHover] = useState<number | null>(null)

    const ready = points.length >= 2

    // Drawn at its real width, so the text never scales.
    useLayoutEffect(() => {
        const el = box.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))))
        ro.observe(el)
        return () => ro.disconnect()
    }, [ready])

    if (!ready) return <EmptyState className="uiContentContainer" message="Not enough history yet: the chart starts once goals span more than one day." />

    const last = points[points.length - 1]
    const t0 = Date.parse(points[0].day)
    const span = Date.parse(last.day) - t0
    const step = Math.max(1, Math.ceil(Math.max(...points.map((p) => p.total)) / TICKS))
    const yMax = step * TICKS
    const x = (day: string) => PAD.l + ((Date.parse(day) - t0) / span) * (width - PAD.l - PAD.r)
    const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b)
    const steps = (key: "done" | "total") => points.map((p, i) => (i ? `H${x(p.day)}V${y(p[key])}` : `M${x(p.day)} ${y(p[key])}`)).join("")
    const base = y(0)

    const pick = (e: PointerEvent<SVGSVGElement>) => {
        const px = e.clientX - e.currentTarget.getBoundingClientRect().left
        let i = 0
        while (i + 1 < points.length && x(points[i + 1].day) <= px) i++
        setHover(i)
    }
    const nudge = (e: KeyboardEvent) => {
        const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0
        if (!d) return
        e.preventDefault()
        setHover((h) => Math.min(points.length - 1, Math.max(0, (h ?? points.length - 1) + d)))
    }
    const h = hover === null ? null : points[hover]
    const label = `Burn-up from ${points[0].day} to ${last.day}: ${last.done} of ${last.total} done, ${last.total - last.done} open.`

    return (
        <section className="uiContentContainer burnUp" aria-label="Burn-up">
            <div className="burnUpHead">
                <span className="microLabel">Burn-up</span>
                <span className="burnUpLegend caption">
                    <span>
                        <span className="burnUpSwatch burnUpSwatch--done" />
                        Done <span className="tabular font-bold">{last.done}</span>
                    </span>
                    <span>
                        <span className="burnUpSwatch burnUpSwatch--total" />
                        Total <span className="tabular font-bold">{last.total}</span>
                    </span>
                    <span className="op-60 tabular">{last.total - last.done} open</span>
                </span>
            </div>
            <div ref={box} className="burnUpPlot">
                <svg
                    width={width}
                    height={H}
                    role="img"
                    aria-label={label}
                    tabIndex={0}
                    onPointerMove={pick}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(points.length - 1)}
                    onBlur={() => setHover(null)}
                    onKeyDown={nudge}
                >
                    {Array.from({ length: TICKS + 1 }, (_, n) => (
                        <g key={n} className="burnUpGrid">
                            <line x1={PAD.l} x2={width - PAD.r} y1={y(n * step)} y2={y(n * step)} />
                            <text x={PAD.l - 8} y={y(n * step)} textAnchor="end" dominantBaseline="middle">
                                {n * step}
                            </text>
                        </g>
                    ))}
                    <g className="burnUpAxis">
                        <text x={PAD.l} y={H - 6}>
                            {points[0].day}
                        </text>
                        <text x={width - PAD.r} y={H - 6} textAnchor="end">
                            {last.day}
                        </text>
                    </g>
                    <path className="burnUpArea" d={`${steps("done")}V${base}H${PAD.l}Z`} />
                    <path className="burnUpLine burnUpLine--total" d={steps("total")} />
                    <path className="burnUpLine burnUpLine--done" d={steps("done")} />
                    {h && (
                        <g className="burnUpCursor">
                            <line x1={x(h.day)} x2={x(h.day)} y1={PAD.t} y2={base} />
                            <circle className="burnUpDot--total" cx={x(h.day)} cy={y(h.total)} r={4} />
                            <circle className="burnUpDot--done" cx={x(h.day)} cy={y(h.done)} r={4} />
                        </g>
                    )}
                </svg>
                {h && (
                    <div className={`burnUpTip caption ${x(h.day) > width / 2 ? "burnUpTip--left" : ""}`} style={{ left: x(h.day) }} role="status">
                        <span className="font-bold tabular">{h.day}</span>
                        <span className="tabular">
                            {h.done} done of {h.total} · {h.total - h.done} open
                        </span>
                    </div>
                )}
            </div>
            <p className="caption op-60 burnUpNote">From item dates: added on created, done or dropped on their last update. Maybes only count once done.</p>
        </section>
    )
}
