import "./stage.css"
import { useEffect, useRef, type ReactNode } from "react"
import type { NowItem } from "../api.ts"
import CountBar from "./CountBar.tsx"
import { segments, type Counts } from "./counts.ts"
import Button from "../primitives/button/Button.tsx"
import Chip from "../primitives/chip/Chip.tsx"

// How many `next` items stand in when nothing is in now.
const UP_NEXT = 2

function Song({ item, num, onPick }: { item: NowItem; num?: number; onPick: (id: string) => void }) {
    return (
        <button type="button" className="setlistSong" onClick={() => onPick(item.id)}>
            <span className="setlistNum tabular" aria-hidden="true">
                {num}
            </span>
            <span className="setlistTitle">{item.title}</span>
            <span className="setlistTags">
                {item.status === "partial" && <span className="setlistPartial caption">partial</span>}
                {item.size && (
                    <Chip mono tone="orange" title="Size">
                        {item.size}
                    </Chip>
                )}
            </span>
        </button>
    )
}

// The setlist: the open `now` items, numbered and big. With nothing in now, the first `next` items and a way to move them up.
export function Setlist({ now, next = [], onPick, onPromote, limit }: {
    now: NowItem[]
    next?: NowItem[]
    onPick: (id: string) => void
    onPromote?: (id: string) => void
    limit?: number
}) {
    // A move to now removes the clicked button: once the item shows in now, focus its song instead.
    const moved = useRef<string | null>(null)
    const list = useRef<HTMLOListElement>(null)
    useEffect(() => {
        const i = moved.current ? now.findIndex((n) => n.id === moved.current) : -1
        if (i < 0) return
        moved.current = null
        if (document.activeElement === document.body) list.current?.querySelectorAll<HTMLElement>(".setlistSong")[i]?.focus()
    }, [now])

    if (!now.length && next.length && onPromote)
        return (
            <div className="setlistUpNext">
                <span className="setlistEmpty caption">Nothing in now. Up next:</span>
                <ul className="setlist">
                    {next.slice(0, UP_NEXT).map((n) => (
                        <li key={n.id} className="setlistNextRow">
                            <Song item={n} onPick={onPick} />
                            <Button
                                variant="icon"
                                imgProps={{ img: "iconify:arrow-upward" }}
                                title="Move to now"
                                aria-label={`Move ${n.title} to now`}
                                onClick={() => {
                                    moved.current = n.id
                                    onPromote(n.id)
                                }}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        )
    if (!now.length) return <p className="setlistEmpty caption">Nothing in now. Move an item here from its menu.</p>
    const shown = limit ? now.slice(0, limit) : now
    return (
        <ol ref={list} className="setlist">
            {shown.map((n, i) => (
                <li key={n.id}>
                    <Song item={n} num={i + 1} onPick={onPick} />
                </li>
            ))}
            {shown.length < now.length && <li className="setlistMore caption">+{now.length - shown.length} more</li>}
        </ol>
    )
}

// One line under the bar: a swatch and count per non-empty phase.
function CountTable({ counts, dropped }: { counts: Counts; dropped: number }) {
    const rows = [...segments(counts), { key: "dropped", label: "dropped", value: dropped }].filter((s) => s.value > 0)
    return (
        <dl className="countTable">
            {rows.map((s) => (
                <div key={s.key} className="countRow">
                    <dt>
                        <span className={`phaseSwatch phaseSwatch--${s.key}`} style={{ backgroundColor: `var(--phase-${s.key})` }} />
                        <span className="tabular countValue">{s.value}</span>
                    </dt>
                    <dd>{s.label}</dd>
                </div>
            ))}
        </dl>
    )
}

// A project under the stage light: the header, its setlist and its counts.
export default function Stage({ title, meta, actions, summary, onPick, onPromote }: {
    title: ReactNode
    meta?: ReactNode
    actions?: ReactNode
    summary: Counts & { now: NowItem[]; next: NowItem[]; open: number; dropped: number; percent: number }
    onPick: (id: string) => void
    onPromote: (id: string) => void
}) {
    const { now, next, open, dropped } = summary
    return (
        <header className={`uiContentContainer stage ${now.length ? "stage--lit" : ""}`}>
            <div className="stageTop">
                <div className="stageTitle">
                    {title}
                    {meta}
                </div>
                {actions && <div className="stageActions">{actions}</div>}
            </div>
            <section className="stageNow" aria-label="Now">
                <span className="stageLabel">
                    Now <span className="tabular">{now.length}</span>
                </span>
                <Setlist now={now} next={next} onPick={onPick} onPromote={onPromote} />
            </section>
            <div className="stageProgress">
                <CountBar counts={summary} />
                <span className="caption tabular stageProgressText">
                    {summary.percent}% done · {open} open
                </span>
            </div>
            <CountTable counts={summary} dropped={dropped} />
        </header>
    )
}
