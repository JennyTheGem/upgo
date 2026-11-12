import type { Item } from "../../../src/core/schema.ts"
import { toast } from "../primitives/toast/toast.ts"

type Copyable = Pick<Item, "id" | "title" | "body">

// Wrappers that tell the pasting agent what to do with the items.
export const PROMPTS = {
    implement: {
        label: "Implement",
        text: "Implement these goals. Run `upgo show <id>` for each first, and `upgo done <id> --note \"...\"` when one is finished.",
    },
    review: {
        label: "Review",
        text: "Review the work done for these goals. Check the code against each one and list what is missing, broken or could be simpler. Don't change files yet.",
    },
    plan: {
        label: "Plan",
        text: "Plan these goals before writing code. Trace the code they touch, then propose the steps and any open questions. Don't change files yet.",
    },
} as const
export type Prompt = keyof typeof PROMPTS

export function formatForAgent(items: Copyable[], prompt?: Prompt): string {
    const list = items.map((i) => (i.body ? `${i.id}: ${i.title}\n${i.body}` : `${i.id}: ${i.title}`)).join("\n\n")
    return prompt ? `${PROMPTS[prompt].text}\n\n${list}` : list
}

export async function copyText(text: string, done: string) {
    try {
        await navigator.clipboard.writeText(text)
        toast.success(done)
    } catch {
        toast.error("Could not copy: the clipboard is not available")
    }
}

export const copyForAgent = (items: Copyable[], prompt?: Prompt) =>
    copyText(formatForAgent(items, prompt), `Copied ${items.length === 1 ? items[0].id : `${items.length} items`}${prompt ? ` to ${PROMPTS[prompt].label.toLowerCase()}` : ""}`)
