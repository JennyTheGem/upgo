import { OPEN_STATUSES, PHASES, PHASE_LABEL, isOpenStatus, type Phase, type Status } from "../../../src/core/vocab.ts"
import type { Item, Section } from "../../../src/core/schema.ts"
import type { DropdownEntry } from "../primitives/dropdown/dropdown.tsx"
import { PROMPTS, type Prompt } from "./format.ts"

export type ItemActions = {
    edit: (item: Item) => void
    phase: (item: Item, phase: Phase) => void
    status: (item: Item, status: Status) => void
    done: (item: Item) => void
    drop: (item: Item) => void
    reopen: (item: Item) => void
    move: (item: Item, dir: "up" | "down") => void
    copy: (items: Item[], prompt?: Prompt) => void
    remove: (item: Item) => void
}

export function itemMenu(item: Item, a: ItemActions, can: { up: boolean; down: boolean }): DropdownEntry[] {
    const open = isOpenStatus(item.status)
    const entries: DropdownEntry[] = [
        { type: "item", id: "edit", label: "Edit", icon: "iconify:edit", onSelect: () => a.edit(item) },
        {
            type: "item",
            id: "phase",
            label: "Phase",
            icon: "iconify:schedule",
            items: PHASES.map((p) => ({ type: "item", id: p, label: PHASE_LABEL[p], active: item.phase === p, onSelect: () => a.phase(item, p) })),
        },
    ]
    if (open) {
        entries.push(
            {
                type: "item",
                id: "status",
                label: "Status",
                icon: "iconify:label-outline",
                items: OPEN_STATUSES.map((s) => ({ type: "item", id: s, label: s, active: item.status === s, onSelect: () => a.status(item, s) })),
            },
            { type: "item", id: "done", label: "Mark done", icon: "iconify:check-circle-rounded", onSelect: () => a.done(item) },
            { type: "item", id: "drop", label: "Drop", icon: "iconify:block", onSelect: () => a.drop(item) },
        )
    } else {
        entries.push({ type: "item", id: "reopen", label: "Reopen", icon: "iconify:restart-alt", onSelect: () => a.reopen(item) })
    }
    entries.push(
        { type: "divider", id: "d1" },
        { type: "item", id: "up", label: "Move up", icon: "iconify:arrow-upward", disabled: !can.up, onSelect: () => a.move(item, "up") },
        { type: "item", id: "down", label: "Move down", icon: "iconify:arrow-downward", disabled: !can.down, onSelect: () => a.move(item, "down") },
        { type: "item", id: "copy", label: "Copy for agent", icon: "iconify:content-copy", onSelect: () => a.copy([item]) },
        { type: "item", id: "copyAs", label: "Copy as prompt", icon: "iconify:content-copy", items: promptMenu((p) => a.copy([item], p)) },
        { type: "divider", id: "d2" },
        { type: "item", id: "delete", label: "Delete", icon: "iconify:delete", variant: "danger", onSelect: () => a.remove(item) },
    )
    return entries
}

export type SectionActions = {
    addItem: (section: Section) => void
    rename: (section: Section) => void
    move: (section: Section, dir: "up" | "down") => void
    remove: (section: Section) => void
}

export function sectionMenu(section: Section, a: SectionActions, can: { up: boolean; down: boolean; delete: boolean }): DropdownEntry[] {
    const entries: DropdownEntry[] = [
        { type: "item", id: "add", label: "Add item here", icon: "iconify:add", onSelect: () => a.addItem(section) },
        { type: "item", id: "rename", label: "Rename", icon: "iconify:edit", onSelect: () => a.rename(section) },
        { type: "item", id: "up", label: "Move section up", icon: "iconify:arrow-upward", disabled: !can.up, onSelect: () => a.move(section, "up") },
        { type: "item", id: "down", label: "Move section down", icon: "iconify:arrow-downward", disabled: !can.down, onSelect: () => a.move(section, "down") },
    ]
    if (can.delete) {
        entries.push({ type: "divider", id: "d1" }, { type: "item", id: "delete", label: "Delete section", icon: "iconify:delete", variant: "danger", onSelect: () => a.remove(section) })
    }
    return entries
}

// One entry per prompt wrapper, for the item menu and the selection bar.
export const promptMenu = (copy: (prompt: Prompt) => void): DropdownEntry[] =>
    (Object.keys(PROMPTS) as Prompt[]).map((p) => ({ type: "item", id: p, label: PROMPTS[p].label, onSelect: () => copy(p) }))
