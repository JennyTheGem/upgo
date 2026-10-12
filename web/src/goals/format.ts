import type { Item } from "../../../src/core/schema.ts"

export function formatForAgent(items: Item[]): string {
    return items.map((i) => (i.body ? `${i.id}: ${i.title}\n${i.body}` : `${i.id}: ${i.title}`)).join("\n\n")
}
