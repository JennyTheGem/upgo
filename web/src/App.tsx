import "./app.css"
import { useCallback, useEffect, useState } from "react"
import { api, errorText, onServerEvent, type ProjectSummary } from "./api.ts"
import ProjectList, { TOUR } from "./goals/ProjectList.tsx"
import ProjectView from "./goals/ProjectView.tsx"
import Tour from "./goals/Tour.tsx"
import ConfirmDialog from "./primitives/confirmDialog/ConfirmDialog.tsx"
import EmptyState from "./primitives/emptyState/EmptyState.tsx"
import ErrorState from "./primitives/errorState/ErrorState.tsx"
import PromptDialog from "./primitives/promptDialog/PromptDialog.tsx"
import ToastViewport from "./primitives/toast/ToastViewport.tsx"
import { readPref, writePref } from "./utils/storage.ts"

const PICKED = "upgo:project"

export default function App() {
    const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [picked, setPicked] = useState(() => readPref(PICKED))
    // An item to open once its project loads (a click on the tour's setlist).
    const [focus, setFocus] = useState<{ project: string; item: string } | null>(null)

    const load = useCallback(
        () =>
            api.projects().then(
                (list) => {
                    setProjects(list)
                    setError(null)
                },
                (e) => setError(errorText(e)),
            ),
        [],
    )

    useEffect(() => {
        load()
    }, [load])

    // Any change can move an open count, so every event refreshes the list.
    useEffect(() => onServerEvent(() => load()), [load])

    const known = picked === TOUR ? !!projects?.length : !!projects?.some((p) => p.id === picked)
    const selected = known ? picked : (projects?.[0]?.id ?? null)
    const select = (id: string, item?: string) => {
        setPicked(id)
        setFocus(item ? { project: id, item } : null)
        writePref(PICKED, id)
    }

    let main
    if (!projects) main = error ? <ErrorState className="uiContentContainer" message={error} onRetry={load} /> : null
    else if (!selected)
        main = (
            <EmptyState
                className="uiContentContainer appEmpty"
                message={
                    <>
                        No projects yet. Run <code className="Inconsolata">upgo init</code> in a project folder to add one.
                    </>
                }
            />
        )
    else if (selected === TOUR) main = <Tour projects={projects} onOpen={select} />
    // A fallback project (the picked one vanished) must not inherit the picked one's focus.
    else main = <ProjectView key={selected} id={selected} focus={focus?.project === selected ? focus.item : null} onChanged={load} />

    return (
        <div className="appShell outfit">
            <aside className="uiContainer appSidebar z-card">
                <div className="uiContentContainer appSidebarContent">
                    <span className="appBrand size-1_2 font-bold">upgo</span>
                    {projects && <ProjectList projects={projects} selected={selected} onSelect={select} />}
                </div>
            </aside>
            <main className="appMain">{main}</main>
            <ToastViewport />
            <ConfirmDialog />
            <PromptDialog />
        </div>
    )
}
