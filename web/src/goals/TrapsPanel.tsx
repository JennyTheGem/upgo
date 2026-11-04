import { useState } from "react"
import type { Trap } from "../../../src/core/schema.ts"
import Icon from "../primitives/icon/Icon.tsx"
import Markdown from "./Markdown.tsx"

// Read-only: traps are edited through the CLI.
export default function TrapsPanel({ traps }: { traps: Trap[] }) {
    const [open, setOpen] = useState(false)
    return (
        <section className="uiContentContainer foldPanel" aria-label="Traps">
            <button type="button" className="foldToggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <Icon name="iconify:warning-rounded" color="var(--color-warning)" className="foldIcon" />
                <span className="font-bold">Traps</span>
                <span className="caption-small op-50">{traps.length}</span>
                <Icon name="iconify:expand-more-rounded" className={`foldChevron ${open ? "foldChevron--open" : ""}`} />
            </button>
            {open && (
                <ul className="foldList">
                    {traps.map((t) => (
                        <li key={t.id} className="foldItem">
                            <span className="font-bold">{t.title}</span>
                            {t.body && <Markdown className="foldBody caption op-80" text={t.body} />}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
