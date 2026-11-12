import type { ItemPatch } from "../../../src/core/mutate.ts"
import type { Op } from "../../../src/core/ops.ts"
import type { GoalsFile, Item } from "../../../src/core/schema.ts"
import { PHASE_LABEL } from "../../../src/core/vocab.ts"

export type Undo = { message: string; ops: Op[] }

// Back next to its old neighbor in the file as it was.
function placeBack(file: GoalsFile, item: Item): Op {
    const peers = file.items.filter((i) => i.section === item.section)
    const at = peers.indexOf(item)
    const prev = peers[at - 1]
    const next = peers[at + 1]
    if (prev) return { op: "move", id: item.id, after: prev.id }
    if (next) return { op: "move", id: item.id, before: next.id }
    return { op: "move", id: item.id, section: item.section }
}

// The ops that turn the file after `op` back into `file`, the file before it.
export function undoFor(file: GoalsFile, op: Op): Undo | null {
    if (op.op === "editTrap" || op.op === "deleteTrap") {
        const at = file.traps.findIndex((t) => t.id === op.id)
        const trap = file.traps[at]
        if (!trap) return null
        if (op.op === "deleteTrap") return { message: `Deleted trap "${trap.title}"`, ops: [{ op: "addTrap", trap, at }] }
        const p = op.patch
        const patch = { ...(p.title !== undefined ? { title: trap.title } : {}), ...(p.body !== undefined ? { body: trap.body ?? null } : {}) }
        return { message: `Edited trap "${trap.title}"`, ops: [{ op: "editTrap", id: trap.id, patch }] }
    }
    if (!("id" in op)) return null
    const item = file.items.find((i) => i.id === op.id)
    if (!item) return null
    const t = `"${item.title}"`
    switch (op.op) {
        case "done":
        case "drop":
        case "reopen":
            return {
                message: op.op === "done" ? `Marked ${t} done` : op.op === "drop" ? `Dropped ${t}` : `Reopened ${t}`,
                ops: [{ op: "edit", id: item.id, patch: { status: item.status, note: item.note ?? null } }],
            }
        case "edit": {
            const patch = Object.fromEntries(Object.keys(op.patch).map((k) => [k, item[k as keyof Item] ?? null])) as ItemPatch
            const moved = op.patch.section !== undefined && op.patch.section !== item.section
            const p = op.patch
            return {
                message: p.phase ? `Moved ${t} to ${PHASE_LABEL[p.phase]}` : p.status ? `${t} is now ${p.status}` : `Edited ${t}`,
                ops: [{ op: "edit", id: item.id, patch }, ...(moved ? [placeBack(file, item)] : [])],
            }
        }
        case "move":
            return { message: `Moved ${t}`, ops: [placeBack(file, item)] }
        case "delete": {
            const { updated: _, ...rest } = item
            return { message: `Deleted ${t}`, ops: [{ op: "add", item: rest }, placeBack(file, item)] }
        }
    }
}
