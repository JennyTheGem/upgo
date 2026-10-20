import "./chip.css"
import type { ReactNode } from "react"

export type ChipTone = "neutral" | "muted" | "accent" | "blue" | "sky" | "teal" | "periwinkle" | "green" | "amber" | "orange" | "rose"

export default function Chip({ tone = "neutral", mono = false, stamp = false, title, children }: { tone?: ChipTone; mono?: boolean; stamp?: boolean; title?: string; children: ReactNode }) {
    return (
        <span className={`chip chip--${tone} ${mono ? "Inconsolata" : ""} ${stamp ? "chip--stamp" : ""}`} title={title}>
            {children}
        </span>
    )
}
