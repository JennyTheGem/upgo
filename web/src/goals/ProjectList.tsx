import "./projectList.css"
import type { ProjectSummary } from "../api.ts"

export default function ProjectList({ projects, selected, onSelect }: { projects: ProjectSummary[]; selected: string | null; onSelect: (id: string) => void }) {
    return (
        <nav className="projectList" aria-label="Projects">
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
                                {!p.error && (
                                    <span className="projectCount caption-small" title={`${p.open} open`} aria-label={`${p.open} open`}>
                                        {p.open}
                                    </span>
                                )}
                            </span>
                            {p.error && <span className="projectError caption-small break-words">{p.error}</span>}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
