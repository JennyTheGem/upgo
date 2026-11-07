import "./tour.css"
import { useEffect, useRef, type MouseEvent } from "react"
import { RECENT } from "../../../src/core/summary.ts"
import { api, errorText, type ProjectSummary } from "../api.ts"
import CountBar from "./CountBar.tsx"
import { ago, daysSince, isFinished, plural } from "./counts.ts"
import { copyNow } from "./projectMenu.ts"
import { Setlist } from "./Stage.tsx"
import Button from "../primitives/button/Button.tsx"
import Icon from "../primitives/icon/Icon.tsx"
import { toast } from "../primitives/toast/toast.ts"

// Untouched this long reads as stale.
const STALE_DAYS = 14

// Every project on one screen, in three tiers: full cards for favorites (first) and projects with something in now,
// one row each for the rest, one strip for finished ones. Inside each tier the most recently changed come first.
export default function Tour({ projects, favorites = [], onOpen, onChanged, onMenu }: {
    projects: ProjectSummary[]
    favorites?: string[]
    onOpen: (id: string, item?: string) => void
    onChanged: () => void
    onMenu?: (e: MouseEvent, p: ProjectSummary) => void
}) {
    const sum = (pick: (p: ProjectSummary) => number) => projects.reduce((n, p) => n + pick(p), 0)
    const fav = (p: ProjectSummary) => favorites.includes(p.id)
    const order = [...projects].sort((a, b) => Number(fav(b)) - Number(fav(a)) || (b.updated ?? "").localeCompare(a.updated ?? ""))
    const cards = order.filter((p) => fav(p) || p.now.length)
    const rest = order.filter((p) => !cards.includes(p))
    const finished = rest.filter(isFinished)
    const idle = rest.filter((p) => !isFinished(p))
    const recent = projects
        .flatMap((p) => p.recent.map((r) => ({ ...r, project: p.id })))
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .slice(0, RECENT)

    // A promoted item jumps from its idle row into a lit card: focus its song there.
    const moved = useRef<{ project: string; id: string } | null>(null)
    const page = useRef<HTMLElement>(null)
    useEffect(() => {
        const m = moved.current
        const i = m ? (projects.find((p) => p.id === m.project)?.now.findIndex((n) => n.id === m.id) ?? -1) : -1
        if (!m || i < 0) return
        moved.current = null
        const card = [...(page.current?.querySelectorAll<HTMLElement>("[data-project]") ?? [])].find((c) => c.dataset.project === m.project)
        if (document.activeElement === document.body) card?.querySelectorAll<HTMLElement>(".setlistSong")[i]?.focus()
    }, [projects])

    const promote = async (project: string, id: string) => {
        moved.current = { project, id }
        try {
            await api.op(project, { op: "edit", id, patch: { phase: "now" } })
            onChanged()
        } catch (e) {
            moved.current = null
            toast.error(errorText(e))
        }
    }

    return (
        <section ref={page} className="tourPage outfit" aria-label="Tour">
            <header className="tourHeader">
                <h1 className="stageHeading">Tour</h1>
                <span className="caption tabular op-70">
                    {sum((p) => p.now.length)} now · {sum((p) => p.open)} open · {plural(projects.length, "project")}
                </span>
            </header>
            {cards.length > 0 && (
                <ul className="tourGrid">
                    {cards.map((p) => (
                        <li key={p.id} data-project={p.id} className={`uiContentContainer tourProject ${p.now.length ? "stage--lit" : ""}`} onContextMenu={(e) => onMenu?.(e, p)}>
                            <div className="tourLead">
                                <div className="tourTop">
                                    <h2 className="tourHeading">
                                        <button type="button" className="tourName" title={p.purpose} onClick={() => onOpen(p.id)}>
                                            <span className="size-1_2 font-bold truncate">{p.id}</span>
                                            {fav(p) && <Icon name="iconify:star" color="var(--color-accent-solid)" className="tourFavorite" alt="favorite" />}
                                        </button>
                                    </h2>
                                    {p.now.length > 0 && (
                                        <Button variant="icon" imgProps={{ img: "iconify:content-copy" }} title="Copy now items for an agent" aria-label={`Copy ${p.id} now items`} onClick={() => copyNow(p.id)} />
                                    )}
                                </div>
                                {!p.error && (
                                    <>
                                        <CountBar counts={p} />
                                        <div className="tourStats">
                                            <span className="caption tabular op-70">
                                                {isFinished(p) ? "all done" : `${p.open} open`}
                                                {!isFinished(p) && <Changed day={p.updated} />}
                                            </span>
                                            {p.weekly && <Sparkline weeks={p.weekly} />}
                                        </div>
                                    </>
                                )}
                            </div>
                            {p.error ? (
                                <span className="projectError caption break-words">{p.error}</span>
                            ) : (
                                <Setlist now={p.now} next={p.next} limit={5} onPick={(item) => onOpen(p.id, item)} onPromote={(item) => promote(p.id, item)} />
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {idle.length > 0 && (
                <section className="uiContentContainer tourIdle" aria-label="Nothing in now">
                    <span className="microLabel">Nothing in now</span>
                    <ul className="tourIdleList">
                        {idle.map((p) => {
                            const up = p.next[0]
                            return (
                                <li key={p.id} className="tourIdleRow" onContextMenu={(e) => onMenu?.(e, p)}>
                                    <button type="button" className="tourIdleName font-bold truncate" title={p.purpose} onClick={() => onOpen(p.id)}>
                                        {p.id}
                                    </button>
                                    {p.error ? (
                                        <span className="projectError caption break-words">{p.error}</span>
                                    ) : up ? (
                                        <span className="tourIdleNext">
                                            <span className="caption op-70 no-wrap">Up next</span>
                                            <button type="button" className="tourIdleItem caption" onClick={() => onOpen(p.id, up.id)}>
                                                {up.title}
                                            </button>
                                            <Button variant="icon" imgProps={{ img: "iconify:arrow-upward" }} title="Move to now" aria-label={`Move ${up.title} to now`} onClick={() => promote(p.id, up.id)} />
                                        </span>
                                    ) : (
                                        <span className="caption op-70">Nothing up next</span>
                                    )}
                                    {!p.error && (
                                        <span className="caption tabular op-70 no-wrap">
                                            {p.open} open
                                            <Changed day={p.updated} />
                                        </span>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )}
            {finished.length > 0 && (
                <section className="tourFinished" aria-label="Finished">
                    <Icon name="iconify:check-circle-rounded" color="var(--tone-green)" className="tourRecentIcon" />
                    <span className="microLabel">Finished</span>
                    {finished.map((p) => (
                        <button key={p.id} type="button" className="tourFinishedName caption" title={p.purpose} onClick={() => onOpen(p.id)} onContextMenu={(e) => onMenu?.(e, p)}>
                            {p.id}
                        </button>
                    ))}
                </section>
            )}
            {recent.length > 0 && (
                <section className="uiContentContainer tourRecent" aria-label="Recently done">
                    <span className="microLabel">Recently done</span>
                    <ul className="tourRecentList">
                        {recent.map((r) => (
                            <li key={`${r.project}:${r.id}`}>
                                <button type="button" className="tourRecentItem" onClick={() => onOpen(r.project, r.id)}>
                                    <Icon name="iconify:check-circle-rounded" color="var(--tone-green)" className="tourRecentIcon" />
                                    <span className="tourRecentText">
                                        <span className="font-bold">{r.title}</span>
                                        {r.note && <span className="caption op-70">{r.note}</span>}
                                    </span>
                                    <span className="caption tabular op-70 no-wrap" title={r.updated}>
                                        {r.project} · {ago(r.updated)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </section>
    )
}

// " · changed 3 days ago", amber once it goes stale.
function Changed({ day }: { day?: string }) {
    if (!day) return null
    return (
        <span className={daysSince(day) >= STALE_DAYS ? "tourStale" : undefined} title={day}>
            {` · changed ${ago(day)}`}
        </span>
    )
}

// Done per week, oldest first, scaled to the busiest week.
function Sparkline({ weeks }: { weeks: number[] }) {
    const max = Math.max(1, ...weeks)
    const total = weeks.reduce((n, w) => n + w, 0)
    const label = `${total} done in the last ${weeks.length} weeks`
    return (
        <span className="tourSpark" role="img" aria-label={label} title={`${label}: ${weeks.join(", ")}`}>
            {weeks.map((w, n) => (
                <span key={n} className={w ? undefined : "tourSparkEmpty"} style={w ? { height: `${Math.max(20, (w / max) * 100)}%` } : undefined} />
            ))}
        </span>
    )
}
