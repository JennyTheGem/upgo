import { isOpenStatus } from "../../../src/core/vocab.ts"
import { api, errorText, type ProjectSummary } from "../api.ts"
import { confirmAction } from "../primitives/confirmDialog/confirm.ts"
import type { DropdownEntry } from "../primitives/dropdown/dropdown.tsx"
import { toast } from "../primitives/toast/toast.ts"
import { copyForAgent, copyText } from "./format.ts"

export async function copyNow(id: string) {
    try {
        const { file } = await api.project(id)
        await copyForAgent(file.items.filter((i) => i.phase === "now" && isOpenStatus(i.status)))
    } catch (e) {
        toast.error(errorText(e))
    }
}

export async function removeProject(id: string, onRemoved: () => void) {
    const ok = await confirmAction({
        message: `Remove "${id}" from upgo?`,
        description: "Only unregisters it. The folder and its goals.json stay, run upgo init there to add it back.",
        confirmLabel: "Remove",
        variant: "destructive",
    })
    if (!ok) return
    try {
        await api.forget(id)
        toast.success(`Removed ${id}`)
        onRemoved()
    } catch (e) {
        toast.error(errorText(e))
    }
}

export function projectMenu(p: ProjectSummary, a: { favorite: boolean; open: () => void; toggleFavorite: () => void; removed: () => void }): DropdownEntry[] {
    return [
        { type: "item", id: "open", label: "Open", icon: "iconify:chevron-right", onSelect: a.open },
        { type: "item", id: "favorite", label: a.favorite ? "Unfavorite" : "Favorite", icon: a.favorite ? "iconify:star" : "iconify:star-outline", onSelect: a.toggleFavorite },
        { type: "item", id: "copy", label: "Copy now items", icon: "iconify:content-copy", disabled: !p.now.length, onSelect: () => copyNow(p.id) },
        { type: "item", id: "path", label: "Copy path", icon: "iconify:content-copy", onSelect: () => copyText(p.path, "Copied path") },
        { type: "divider", id: "d1" },
        { type: "item", id: "remove", label: "Remove", icon: "iconify:delete", variant: "danger", onSelect: () => removeProject(p.id, a.removed) },
    ]
}
