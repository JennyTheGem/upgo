import "./tour.css"
import type { ProjectSummary } from "../api.ts"
import CountBar from "./CountBar.tsx"
import { percentDone, plural } from "./counts.ts"
import { Setlist } from "./Stage.tsx"

// Every project's setlist on one screen. Projects with something in now come first, under the light.
export default function Tour({ projects, onOpen }: { projects: ProjectSummary[]; onOpen: (id: string, item?: string) => void }) {
    const sum = (pick: (p: ProjectSummary) => number) => projects.reduce((n, p) => n + pick(p), 0)
    const order = [...projects].sort((a, b) => Number(!!b.now.length) - Number(!!a.now.length))
    return (
        <section className="tourPage outfit" aria-label="Tour">
            <header className="tourHeader">
                <h1 className="stageHeading">Tour</h1>
                <span className="caption tabular op-70">
                    {plural(projects.length, "project")} · {sum((p) => p.now.length)} now · {sum((p) => p.open)} open · {sum((p) => p.done)} done
                </span>
            </header>
            <ul className="tourGrid">
                {order.map((p) => (
                    <li key={p.id} className={`uiContentContainer tourProject ${p.now.length ? "stage--lit" : ""}`}>
                        <h2 className="tourHeading">
                            <button type="button" className="tourName" onClick={() => onOpen(p.id)}>
                                <span className="size-1_2 font-bold truncate">{p.id}</span>
                                {!p.error && <span className="caption-small tabular op-70 no-wrap">{percentDone(p.done, p.open)}% done</span>}
                            </button>
                        </h2>
                        {p.purpose && <span className="caption op-70 tourPurpose">{p.purpose}</span>}
                        {p.error ? (
                            <span className="projectError caption-small break-words">{p.error}</span>
                        ) : (
                            <>
                                <CountBar counts={p} />
                                <span className="caption-small tabular op-70">
                                    {p.open} open{p.phases.next ? ` · ${p.phases.next} next` : ""}
                                    {p.phases.later ? ` · ${p.phases.later} later` : ""}
                                </span>
                                <Setlist now={p.now} limit={5} onPick={(item) => onOpen(p.id, item)} />
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    )
}
