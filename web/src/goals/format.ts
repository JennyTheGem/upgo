import type { Item } from "../../../src/core/schema.ts"
import { toast } from "../primitives/toast/toast.ts"

type Copyable = Pick<Item, "id" | "title" | "body">

export function formatForAgent(items: Copyable[]): string {
    return items.map((i) => (i.body ? `${i.id}: ${i.title}\n${i.body}` : `${i.id}: ${i.title}`)).join("\n\n")
}

export async function copyText(text: string, done: string) {
    try {
        await navigator.clipboard.writeText(text)
        toast.success(done)
    } catch {
        toast.error("Could not copy: the clipboard is not available")
    }
}

export const copyForAgent = (items: Copyable[]) => copyText(formatForAgent(items), items.length === 1 ? `Copied ${items[0].id}` : `Copied ${items.length} items`)
