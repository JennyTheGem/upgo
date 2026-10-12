import { useState } from "react"
import type { Trap } from "../../../src/core/schema.ts"
import Icon from "../primitives/icon/Icon.tsx"

// Read-only: traps are edited through the CLI.
export default function TrapsPanel({ traps }: { traps: Trap[] }) {
    const [open, setOpen] = useState(false)
    return (
        <section className="uiContentContainer trapsPanel" aria-label="Traps">
            <button type="button" className="trapsToggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <Icon name="iconify:warning-rounded" color="var(--color-warning)" className="trapsIcon" />
                <span className="font-bold">Traps</span>
                <span className="caption-small op-50">{traps.length}</span>
                <Icon name="iconify:expand-more-rounded" className={`trapsChevron ${open ? "trapsChevron--open" : ""}`} />
            </button>
            {open && (
                <ul className="trapsList">
                    {traps.map((t) => (
                        <li key={t.id} className="trapItem">
                            <span className="font-bold">{t.title}</span>
                            {t.body && <p className="trapBody caption op-80">{t.body}</p>}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
