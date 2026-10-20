import "./countBar.css"
import { segments, type Counts } from "./counts.ts"

// Widths come straight from the counts. A thin bar sits beside its numbers, so screen readers skip it.
export default function CountBar({ counts, thin = false }: { counts: Counts; thin?: boolean }) {
    const parts = segments(counts).filter((s) => s.value > 0)
    const label = parts.length ? parts.map((s) => `${s.value} ${s.label}`).join(", ") : "No items"
    return (
        <span
            className={`countBar ${thin ? "countBar--thin" : ""}`}
            role={thin ? undefined : "img"}
            aria-label={thin ? undefined : label}
            aria-hidden={thin || undefined}
            title={label}
        >
            {parts.map((s) => (
                <span key={s.key} className="countBarPart" style={{ flexGrow: s.value, backgroundColor: `var(--phase-${s.key})` }} />
            ))}
        </span>
    )
}
