import type { KeyboardEvent } from "react"
import Button from "../primitives/button/Button.tsx"

export type Tab = "goals" | "suggestions" | "progress"

export default function ProjectTabs({ tab, suggestions, onChange }: { tab: Tab; suggestions: number; onChange: (tab: Tab) => void }) {
    const tabs: [Tab, string][] = [
        ["goals", "Goals"],
        ["suggestions", suggestions ? `Suggestions (${suggestions})` : "Suggestions"],
        ["progress", "Progress"],
    ]
    // Arrow keys move between tabs (WAI-ARIA tabs pattern).
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        const next = tabs[(tabs.findIndex(([t]) => t === tab) + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length][0]
        onChange(next)
        e.currentTarget.querySelector<HTMLElement>(`#tab-${next}`)?.focus()
    }
    return (
        <div className="projectTabs" role="tablist" aria-label="Project view" onKeyDown={onKeyDown}>
            {tabs.map(([t, label]) => (
                <Button
                    key={t}
                    id={`tab-${t}`}
                    role="tab"
                    variant="switcherOption"
                    className={t === tab ? "buttonSwitcherOption--active" : ""}
                    aria-selected={t === tab}
                    aria-controls="project-tabpanel"
                    tabIndex={t === tab ? 0 : -1}
                    onClick={() => onChange(t)}
                >
                    {label}
                </Button>
            ))}
        </div>
    )
}
