import "./itemModal.css"
import { useState, type FormEvent } from "react"
import { OPEN_STATUSES, PHASES, PHASE_LABEL, POINTER_KEYS, SIZES, isOpenStatus, type PointerKey } from "../../../src/core/vocab.ts"
import type { GoalsFile, Item } from "../../../src/core/schema.ts"
import type { Op } from "../../../src/core/ops.ts"
import Button from "../primitives/button/Button.tsx"
import Field from "../primitives/field/Field.tsx"
import Modal from "../primitives/modal/Modal.tsx"
import { diffPatch, fromForm, toForm, type ItemForm } from "./itemForm.ts"

type Props = {
    file: GoalsFile
    item?: Item
    section?: number
    onClose: () => void
    // Resolves true when the server took it; the modal stays open otherwise so nothing typed is lost.
    onSubmit: (op: Op) => Promise<boolean>
}

export default function ItemModal({ file, item, section, onClose, onSubmit }: Props) {
    const [form, setForm] = useState(() => toForm(item, section ?? file.sections[0]?.n ?? 0))
    const [busy, setBusy] = useState(false)
    const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => setForm((f) => ({ ...f, [key]: value }))
    const setPointer = (key: PointerKey, value: string) => setForm((f) => ({ ...f, pointers: { ...f.pointers, [key]: value } }))
    // Done and dropped have their own actions, which take a note.
    const statuses = item && !isOpenStatus(item.status) ? [...OPEN_STATUSES, item.status] : OPEN_STATUSES

    const submit = async (e: FormEvent) => {
        e.preventDefault()
        const next = fromForm(form)
        if (!next.title) return
        let op: Op
        if (item) {
            const patch = diffPatch(item, form)
            if (!Object.keys(patch).length) return onClose()
            op = { op: "edit", id: item.id, patch }
        } else {
            op = { op: "add", item: next }
        }
        setBusy(true)
        if (await onSubmit(op)) onClose()
        else setBusy(false)
    }

    return (
        <Modal title={item ? `Edit ${item.id}` : "Add item"} onClose={onClose} className="itemModal">
            <form className="itemForm" onSubmit={submit}>
                <div className="itemFormBody">
                    <Field label="Title">
                        <input className="fieldInput" value={form.title} required maxLength={200} onChange={(e) => set("title", e.target.value)} />
                    </Field>
                    <div className="itemFormRow">
                        <Field label="Section">
                            <select className="fieldInput" value={form.section} onChange={(e) => set("section", e.target.value)}>
                                {file.sections.map((s) => (
                                    <option key={s.n} value={s.n}>
                                        §{s.n} {s.title}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Phase">
                            <select className="fieldInput" value={form.phase} onChange={(e) => set("phase", e.target.value as ItemForm["phase"])}>
                                {PHASES.map((p) => (
                                    <option key={p} value={p}>
                                        {PHASE_LABEL[p]}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Status">
                            <select className="fieldInput" value={form.status} onChange={(e) => set("status", e.target.value as ItemForm["status"])}>
                                {statuses.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Size">
                            <select className="fieldInput" value={form.size} onChange={(e) => set("size", e.target.value as ItemForm["size"])}>
                                <option value="">none</option>
                                {SIZES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <div className="itemFormRow itemFormRow--two">
                        <Field label="Scope">
                            <input className="fieldInput" value={form.scope} placeholder="all, desktop" onChange={(e) => set("scope", e.target.value)} />
                        </Field>
                        <Field label="Related">
                            <input className="fieldInput Inconsolata" value={form.related} placeholder="project:item, other:item" onChange={(e) => set("related", e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Body">
                        <textarea className="fieldInput" rows={6} value={form.body} onChange={(e) => set("body", e.target.value)} />
                    </Field>
                    <Field label="Detail file">
                        <input className="fieldInput Inconsolata" value={form.detail} placeholder="docs/goalsDetails/x.md" onChange={(e) => set("detail", e.target.value)} />
                    </Field>
                    <span className="microLabel">Pointers, one per line</span>
                    <div className="itemFormRow itemFormRow--two">
                        {POINTER_KEYS.map((k) => (
                            <Field key={k} label={k}>
                                <textarea className="fieldInput Inconsolata" rows={2} value={form.pointers[k]} onChange={(e) => setPointer(k, e.target.value)} />
                            </Field>
                        ))}
                    </div>
                </div>
                <div className="itemFormActions">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={busy || !form.title.trim()}>
                        {item ? "Save" : "Add item"}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
