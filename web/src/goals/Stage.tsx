import "./stage.css"
import type { ReactNode } from "react"
import type { NowItem } from "../api.ts"
import CountBar from "./CountBar.tsx"
import { segments, type Counts } from "./counts.ts"

// The setlist: the open `now` items, numbered and big, beside the counts per phase.
export function Setlist({ now, onPick, limit }: { now: NowItem[]; onPick: (id: string) => void; limit?: number }) {
    if (!now.length) return <p className="setlistEmpty caption">Nothing in now. Move an item here from its menu.</p>
    const shown = limit ? now.slice(0, limit) : now
    return (
        <ol className="setlist">
            {shown.map((n, i) => (
                <li key={n.id}>
                    <button type="button" className="setlistSong" onClick={() => onPick(n.id)}>
                        <span className="setlistNum tabular" aria-hidden="true">
                            {i + 1}
                        </span>
                        <span className="setlistTitle">{n.title}</span>
                        {n.status === "partial" && <span className="setlistPartial caption-small">partial</span>}
                    </button>
                </li>
            ))}
            {shown.length < now.length && <li className="setlistMore caption-small">+{now.length - shown.length} more</li>}
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
export default function Stage({ title, meta, actions, summary, onPick }: {
    title: ReactNode
    meta?: ReactNode
    actions?: ReactNode
    summary: Counts & { now: NowItem[]; open: number; dropped: number; percent: number }
    onPick: (id: string) => void
}) {
    const { now, open, dropped } = summary
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
                <Setlist now={now} onPick={onPick} />
            </section>
            <div className="stageProgress">
                <CountBar counts={summary} />
                <span className="caption-small tabular stageProgressText">
                    {summary.percent}% done · {open} open
                </span>
            </div>
            <CountTable counts={summary} dropped={dropped} />
        </header>
    )
}
