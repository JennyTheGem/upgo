import type { Item } from "../../../src/core/schema.ts"
import { toast } from "../primitives/toast/toast.ts"

export function formatForAgent(items: Item[]): string {
    return items.map((i) => (i.body ? `${i.id}: ${i.title}\n${i.body}` : `${i.id}: ${i.title}`)).join("\n\n")
}

export async function copyForAgent(items: Item[]) {
    try {
        await navigator.clipboard.writeText(formatForAgent(items))
        toast.success(items.length === 1 ? `Copied ${items[0].id}` : `Copied ${items.length} items`)
    } catch {
        toast.error("Could not copy: the clipboard is not available")
    }
}
