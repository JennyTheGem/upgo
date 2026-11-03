import "./chip.css"
import type { ReactNode } from "react"

export type ChipTone = "neutral" | "muted" | "accent" | "blue" | "sky" | "teal" | "periwinkle" | "green" | "amber" | "orange" | "rose"

type Props = { tone?: ChipTone; mono?: boolean; stamp?: boolean; title?: string; onClick?: () => void; children: ReactNode }

export default function Chip({ tone = "neutral", mono = false, stamp = false, title, onClick, children }: Props) {
    const className = `chip chip--${tone} ${mono ? "Inconsolata" : ""} ${stamp ? "chip--stamp" : ""}`
    return onClick ? (
        <button type="button" className={`${className} chip--button`} title={title} onClick={onClick}>
            {children}
        </button>
    ) : (
        <span className={className} title={title}>
            {children}
        </span>
    )
}
