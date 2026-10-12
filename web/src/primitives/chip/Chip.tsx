import "./chip.css"
import type { ReactNode } from "react"

export type ChipTone = "neutral" | "accent" | "success" | "warning" | "muted"

export default function Chip({ tone = "neutral", mono = false, title, children }: { tone?: ChipTone; mono?: boolean; title?: string; children: ReactNode }) {
    return (
        <span className={`chip chip--${tone} ${mono ? "Inconsolata" : ""}`} title={title}>
            {children}
        </span>
    )
}
