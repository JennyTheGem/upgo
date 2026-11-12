import "./itemModal.css"
import { useState, type FormEvent } from "react"
import type { Op } from "../../../src/core/ops.ts"
import type { Trap } from "../../../src/core/schema.ts"
import Button from "../primitives/button/Button.tsx"
import { confirmAction } from "../primitives/confirmDialog/confirm.ts"
import Field from "../primitives/field/Field.tsx"
import Icon from "../primitives/icon/Icon.tsx"
import Modal from "../primitives/modal/Modal.tsx"
import Markdown from "./Markdown.tsx"

type Run = (op: Op, undoable?: boolean) => Promise<boolean>

export default function TrapsPanel({ traps, run }: { traps: Trap[]; run: Run }) {
    const [open, setOpen] = useState(false)
    // `{}` adds a new trap.
    const [editing, setEditing] = useState<{ trap?: Trap } | null>(null)

    const remove = async (t: Trap) => {
        const ok = await confirmAction({ message: `Delete trap "${t.title}"?`, confirmLabel: "Delete", variant: "destructive" })
        if (ok) run({ op: "deleteTrap", id: t.id }, true)
    }

    return (
        <section className="uiContentContainer foldPanel" aria-label="Traps">
            <div className="foldHead">
                <button type="button" className="foldToggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                    <Icon name="iconify:warning-rounded" color="var(--color-warning)" className="foldIcon" />
                    <span className="font-bold">Traps</span>
                    <span className="caption op-50">{traps.length}</span>
                    <Icon name="iconify:expand-more-rounded" className={`foldChevron ${open ? "foldChevron--open" : ""}`} />
                </button>
                <Button
                    variant="icon"
                    imgProps={{ img: "iconify:add" }}
                    title="Add trap"
                    aria-label="Add trap"
                    onClick={() => {
                        setOpen(true)
                        setEditing({})
                    }}
                />
            </div>
            {open && (
                <ul className="foldList">
                    {!traps.length && <li className="caption op-60">No traps yet: gotchas every agent should know before touching this project.</li>}
                    {traps.map((t) => (
                        <li key={t.id} className="foldItem">
                            <div className="foldItemHead">
                                <span className="font-bold">{t.title}</span>
                                <Button variant="icon" imgProps={{ img: "iconify:edit" }} title="Edit trap" aria-label={`Edit trap ${t.title}`} onClick={() => setEditing({ trap: t })} />
                                <Button variant="icon" imgProps={{ img: "iconify:delete" }} title="Delete trap" aria-label={`Delete trap ${t.title}`} onClick={() => remove(t)} />
                            </div>
                            {t.body && <Markdown className="foldBody caption op-80" text={t.body} />}
                        </li>
                    ))}
                </ul>
            )}
            {editing && <TrapModal trap={editing.trap} run={run} onClose={() => setEditing(null)} />}
        </section>
    )
}

function TrapModal({ trap, run, onClose }: { trap?: Trap; run: Run; onClose: () => void }) {
    const [title, setTitle] = useState(trap?.title ?? "")
    const [body, setBody] = useState(trap?.body ?? "")
    const [busy, setBusy] = useState(false)

    const submit = async (e: FormEvent) => {
        e.preventDefault()
        const t = title.trim()
        const b = body.trim()
        if (!t) return
        let op: Op
        if (trap) {
            const patch = { ...(t !== trap.title ? { title: t } : {}), ...(b !== (trap.body ?? "").trim() ? { body: b || null } : {}) }
            if (!Object.keys(patch).length) return onClose()
            op = { op: "editTrap", id: trap.id, patch }
        } else op = { op: "addTrap", trap: { title: t, ...(b ? { body: b } : {}) } }
        setBusy(true)
        // Stays open on failure so nothing typed is lost.
        if (await run(op, !!trap)) onClose()
        else setBusy(false)
    }

    return (
        <Modal title={trap ? `Edit trap ${trap.id}` : "Add trap"} onClose={onClose} className="itemModal">
            <form className="itemForm" onSubmit={submit}>
                <div className="itemFormBody">
                    <Field label="Title">
                        <input className="fieldInput" value={title} required maxLength={200} onChange={(e) => setTitle(e.target.value)} />
                    </Field>
                    <Field label="Body">
                        <textarea className="fieldInput" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
                    </Field>
                </div>
                <div className="itemFormActions">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
                        {trap ? "Save" : "Add trap"}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
