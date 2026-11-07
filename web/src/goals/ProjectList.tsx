import "./projectList.css"
import type { MouseEvent } from "react"
import type { ProjectSummary } from "../api.ts"
import { isFinished, plural } from "./counts.ts"
import Icon from "../primitives/icon/Icon.tsx"

// The overview's id in the selection; never a valid project slug.
export const TOUR = "@tour"

export default function ProjectList({ projects, favorites = [], selected, onSelect, onMenu }: {
    projects: ProjectSummary[]
    favorites?: string[]
    selected: string | null
    onSelect: (id: string) => void
    onMenu?: (e: MouseEvent, p: ProjectSummary) => void
}) {
    const fav = (id: string) => favorites.includes(id)
    const sorted = [...projects].sort((a, b) => Number(fav(b.id)) - Number(fav(a.id)))
    const active = sorted.filter((p) => !isFinished(p))
    const finished = sorted.filter(isFinished)
    const row = (p: ProjectSummary) => (
        <li key={p.id}>
            <button
                type="button"
                className={`projectButton ${p.id === selected ? "projectButton--active" : ""}`}
                aria-current={p.id === selected ? "page" : undefined}
                title={p.path}
                onClick={() => onSelect(p.id)}
                onContextMenu={(e) => onMenu?.(e, p)}
            >
                <span className="projectButtonRow">
                    <span className="projectName font-bold truncate">{p.id}</span>
                    {fav(p.id) && <Icon name="iconify:star" color="var(--color-accent-solid)" className="projectFavorite" alt="favorite" />}
                    {p.now.length > 0 && (
                        <span className="projectNow caption tabular" title={`${p.now.length} now`} aria-label={`${p.now.length} now`}>
                            {p.now.length}
                        </span>
                    )}
                    {isFinished(p) ? (
                        <Icon name="iconify:check-circle-rounded" color="currentColor" className="projectFinished" alt="finished" />
                    ) : !p.error && (
                        <span className="projectCount caption tabular" title={`${p.open} open`} aria-label={`${p.open} open`}>
                            {p.open}
                        </span>
                    )}
                </span>
                {p.error ? <span className="projectError caption break-words">{p.error}</span> : <Progress done={p.done} open={p.open} />}
            </button>
        </li>
    )
    const open = projects.reduce((n, p) => n + p.open, 0)
    const now = projects.reduce((n, p) => n + p.now.length, 0)
    return (
        <nav className="projectList" aria-label="Projects">
            {projects.length > 0 && (
                <button
                    type="button"
                    className={`projectButton projectTour ${selected === TOUR ? "projectButton--active" : ""}`}
                    aria-current={selected === TOUR ? "page" : undefined}
                    onClick={() => onSelect(TOUR)}
                >
                    <span className="projectButtonRow">
                        <span className="projectName font-bold">Tour</span>
                        <span className="projectCount caption tabular" title={`${open} open`} aria-label={`${open} open`}>
                            {open}
                        </span>
                    </span>
                    <span className="caption projectMeta">{`${now ? `${now} now across ` : ""}${plural(projects.length, "project")}`}</span>
                </button>
            )}
            <div className="projectListScroll">
                <span className="microLabel projectListLabel">Projects</span>
                {!projects.length && <span className="caption op-50 projectListEmpty">None registered yet.</span>}
                <ul className="projectListItems">{active.map(row)}</ul>
                {finished.length > 0 && (
                    <>
                        <span className="microLabel projectListLabel">Finished</span>
                        <ul className="projectListItems" aria-label="Finished">
                            {finished.map(row)}
                        </ul>
                    </>
                )}
            </div>
        </nav>
    )
}

// Played over total, one tone. The phase breakdown lives in the project view.
function Progress({ done, open }: { done: number; open: number }) {
    const total = done + open
    return (
        <span className="projectProgress" aria-hidden title={`${done} of ${total} done`}>
            <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </span>
    )
}
