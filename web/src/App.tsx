import "./app.css"
import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { api, errorText, onServerEvent, type ProjectSummary } from "./api.ts"
import ProjectList, { TOUR } from "./goals/ProjectList.tsx"
import { projectMenu } from "./goals/projectMenu.ts"
import ProjectView from "./goals/ProjectView.tsx"
import Tour from "./goals/Tour.tsx"
import ConfirmDialog from "./primitives/confirmDialog/ConfirmDialog.tsx"
import Dropdown from "./primitives/dropdown/dropdown.tsx"
import { useDropdownTrigger } from "./primitives/dropdown/useDropdownTrigger.ts"
import EmptyState from "./primitives/emptyState/EmptyState.tsx"
import ErrorState from "./primitives/errorState/ErrorState.tsx"
import PromptDialog from "./primitives/promptDialog/PromptDialog.tsx"
import { toast } from "./primitives/toast/toast.ts"
import ToastViewport from "./primitives/toast/ToastViewport.tsx"
import { readList, readPref, writePref } from "./utils/storage.ts"

const PICKED = "upgo:project"
const FAVORITES = "upgo:favorites"

export default function App() {
    const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [picked, setPicked] = useState(() => readPref(PICKED))
    // An item to open once its project loads (a click on the tour's setlist).
    const [focus, setFocus] = useState<{ project: string; item: string } | null>(null)
    const [favorites, setFavorites] = useState(() => readList(FAVORITES))
    useEffect(() => writePref(FAVORITES, JSON.stringify(favorites)), [favorites])
    const toggleFavorite = (id: string) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
    const menu = useDropdownTrigger()

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
    // A related chip may point at a project that is not registered here.
    const open = (id: string, item: string) => (projects?.some((p) => p.id === id) ? select(id, item) : toast.error(`Project ${id} is not registered`))
    const openMenu = (e: MouseEvent, p: ProjectSummary) =>
        menu.openFromEvent(e, projectMenu(p, { favorite: favorites.includes(p.id), open: () => select(p.id), toggleFavorite: () => toggleFavorite(p.id), removed: load }))

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
    else if (selected === TOUR) main = <Tour projects={projects} favorites={favorites} onOpen={select} onChanged={load} onMenu={openMenu} />
    // A fallback project (the picked one vanished) must not inherit the picked one's focus.
    else
        main = (
            <ProjectView
                key={selected}
                id={selected}
                focus={focus?.project === selected ? focus.item : null}
                favorite={favorites.includes(selected)}
                onFavorite={() => toggleFavorite(selected)}
                onChanged={load}
                onOpen={open}
            />
        )

    return (
        <div className="appShell outfit">
            <aside className="uiContainer appSidebar z-card">
                <div className="uiContentContainer appSidebarContent">
                    <span className="appBrand size-1_2 font-bold">upgo</span>
                    {projects && <ProjectList projects={projects} favorites={favorites} selected={selected} onSelect={select} onMenu={openMenu} />}
                </div>
            </aside>
            <main className="appMain">{main}</main>
            <Dropdown open={menu.open} anchor={menu.anchor} items={menu.items} onClose={menu.close} label="Project actions" />
            <ToastViewport />
            <ConfirmDialog />
            <PromptDialog />
        </div>
    )
}
