import { createStore } from "../../utils/store.ts"

export interface PromptOptions {
    title: string
    description?: string
    placeholder?: string
    confirmLabel?: string
    initialValue?: string
    // false lets an empty answer through (an optional note); cancel still resolves null.
    required?: boolean
    // Chips that fill in the field; free text still works.
    presets?: string[]
}

type State = { open: boolean; options: PromptOptions; resolve: ((value: string | null) => void) | null }

export const promptStore = createStore<State>({ open: false, options: { title: "" }, resolve: null })

function settle(value: string | null) {
    promptStore.get().resolve?.(value)
    promptStore.set({ open: false, resolve: null })
}

export const promptSubmit = (value: string) => settle(value)
export const promptCancel = () => settle(null)

export function promptText(options: PromptOptions): Promise<string | null> {
    promptStore.get().resolve?.(null)
    return new Promise((resolve) => promptStore.set({ open: true, options, resolve }))
}
