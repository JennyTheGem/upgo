import { createStore } from "../../utils/store.ts"

export interface ConfirmOptions {
    message: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: "default" | "destructive"
}

type State = { open: boolean; options: ConfirmOptions; resolve: ((ok: boolean) => void) | null }

export const confirmStore = createStore<State>({ open: false, options: { message: "" }, resolve: null })

function settle(ok: boolean) {
    confirmStore.get().resolve?.(ok)
    confirmStore.set({ open: false, resolve: null })
}

export const confirmYes = () => settle(true)
export const confirmNo = () => settle(false)

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
    confirmStore.get().resolve?.(false)
    return new Promise((resolve) => confirmStore.set({ open: true, options, resolve }))
}
