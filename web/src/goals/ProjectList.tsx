import "./projectList.css"
import type { ProjectSummary } from "../api.ts"
import CountBar from "./CountBar.tsx"
import { plural } from "./counts.ts"

// The overview's id in the selection; never a valid project slug.
export const TOUR = "@tour"

export default function ProjectList({ projects, selected, onSelect }: { projects: ProjectSummary[]; selected: string | null; onSelect: (id: string) => void }) {
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
                        <span className="projectCount caption-small tabular" title={`${open} open`} aria-label={`${open} open`}>
                            {open}
                        </span>
                    </span>
                    <span className="caption-small projectMeta">{`${now ? `${now} now across ` : ""}${plural(projects.length, "project")}`}</span>
                </button>
            )}
            <span className="microLabel projectListLabel">Projects</span>
            {!projects.length && <span className="caption op-50 projectListEmpty">None registered yet.</span>}
            <ul className="projectListItems">
                {projects.map((p) => (
                    <li key={p.id}>
                        <button
                            type="button"
                            className={`projectButton ${p.id === selected ? "projectButton--active" : ""}`}
                            aria-current={p.id === selected ? "page" : undefined}
                            title={p.path}
                            onClick={() => onSelect(p.id)}
                        >
                            <span className="projectButtonRow">
                                <span className="projectName font-bold truncate">{p.id}</span>
                                {p.now.length > 0 && <span className="projectNow caption-small tabular">{p.now.length} now</span>}
                                {!p.error && (
                                    <span className="projectCount caption-small tabular" title={`${p.open} open`} aria-label={`${p.open} open`}>
                                        {p.open}
                                    </span>
                                )}
                            </span>
                            {p.error ? <span className="projectError caption-small break-words">{p.error}</span> : <CountBar thin counts={p} />}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
