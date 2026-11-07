import "./tour.css"
import { RECENT } from "../../../src/core/summary.ts"
import { isOpenStatus } from "../../../src/core/vocab.ts"
import { api, errorText, type ProjectSummary } from "../api.ts"
import CountBar from "./CountBar.tsx"
import { ago, daysSince, isFinished, plural } from "./counts.ts"
import { copyForAgent } from "./format.ts"
import { Setlist } from "./Stage.tsx"
import Button from "../primitives/button/Button.tsx"
import Icon from "../primitives/icon/Icon.tsx"
import { toast } from "../primitives/toast/toast.ts"

// Untouched this long reads as stale.
const STALE_DAYS = 14

// Every project's setlist on one screen. Projects with something in now come first, under the light; finished ones go last.
// Inside each group the most recently changed come first.
export default function Tour({ projects, onOpen, onChanged }: { projects: ProjectSummary[]; onOpen: (id: string, item?: string) => void; onChanged: () => void }) {
    const sum = (pick: (p: ProjectSummary) => number) => projects.reduce((n, p) => n + pick(p), 0)
    const rank = (p: ProjectSummary) => (p.now.length ? 0 : isFinished(p) ? 2 : 1)
    const order = [...projects].sort((a, b) => rank(a) - rank(b) || (b.updated ?? "").localeCompare(a.updated ?? ""))
    const recent = projects
        .flatMap((p) => p.recent.map((r) => ({ ...r, project: p.id })))
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .slice(0, RECENT)

    const copyNow = async (p: ProjectSummary) => {
        try {
            const { file } = await api.project(p.id)
            await copyForAgent(file.items.filter((i) => i.phase === "now" && isOpenStatus(i.status)))
        } catch (e) {
            toast.error(errorText(e))
        }
    }
    const promote = async (project: string, id: string) => {
        try {
            await api.op(project, { op: "edit", id, patch: { phase: "now" } })
            onChanged()
        } catch (e) {
            toast.error(errorText(e))
        }
    }

    return (
        <section className="tourPage outfit" aria-label="Tour">
            <header className="tourHeader">
                <h1 className="stageHeading">Tour</h1>
                <span className="caption tabular op-70">
                    {plural(projects.length, "project")} · {sum((p) => p.now.length)} now · {sum((p) => p.open)} open · {sum((p) => p.done)} done
                </span>
            </header>
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
                                        {r.note && <span className="caption-small op-70">{r.note}</span>}
                                    </span>
                                    <span className="caption-small tabular op-70 no-wrap" title={r.updated}>
                                        {r.project} · {ago(r.updated)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <ul className="tourGrid">
                {order.map((p) => (
                    <li key={p.id} className={`uiContentContainer tourProject ${p.now.length ? "stage--lit" : ""}`}>
                        <div className="tourTop">
                            <h2 className="tourHeading">
                                <button type="button" className="tourName" onClick={() => onOpen(p.id)}>
                                    <span className="size-1_2 font-bold truncate">{p.id}</span>
                                    {isFinished(p) ? (
                                        <span className="caption-small tabular no-wrap tourDone">
                                            <Icon name="iconify:check-circle-rounded" color="currentColor" />
                                            100% done
                                        </span>
                                    ) : (
                                        !p.error && <span className="caption-small tabular op-70 no-wrap">{p.percent}% done</span>
                                    )}
                                </button>
                            </h2>
                            {p.now.length > 0 && (
                                <Button variant="icon" imgProps={{ img: "iconify:content-copy" }} title="Copy now items for an agent" aria-label={`Copy ${p.id} now items`} onClick={() => copyNow(p)} />
                            )}
                        </div>
                        {p.purpose && <span className="caption op-70 tourPurpose">{p.purpose}</span>}
                        {p.error ? (
                            <span className="projectError caption-small break-words">{p.error}</span>
                        ) : (
                            <>
                                <CountBar counts={p} />
                                <div className="tourStats">
                                    <span className="caption-small tabular op-70">
                                        {p.open} open{p.phases.next ? ` · ${p.phases.next} next` : ""}
                                        {p.phases.later ? ` · ${p.phases.later} later` : ""}
                                        {p.updated && (
                                            <span className={!isFinished(p) && daysSince(p.updated) >= STALE_DAYS ? "tourStale" : undefined} title={p.updated}>
                                                {` · changed ${ago(p.updated)}`}
                                            </span>
                                        )}
                                    </span>
                                    {p.weekly && <Sparkline weeks={p.weekly} />}
                                </div>
                                <Setlist now={p.now} next={p.next} limit={5} onPick={(item) => onOpen(p.id, item)} onPromote={(item) => promote(p.id, item)} />
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </section>
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
