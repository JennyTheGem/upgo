import "./chip.css"
import type { ReactNode } from "react"

export type ChipTone = "neutral" | "muted" | "accent" | "blue" | "sky" | "teal" | "periwinkle" | "green" | "amber" | "orange" | "rose"

export default function Chip({ tone = "neutral", mono = false, title, children }: { tone?: ChipTone; mono?: boolean; title?: string; children: ReactNode }) {
    return (
        <span className={`chip chip--${tone} ${mono ? "Inconsolata" : ""}`} title={title}>
            {children}
        </span>
    )
}
