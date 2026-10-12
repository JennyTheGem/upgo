import { createStore } from "../../utils/store.ts"

export type ToastVariant = "success" | "error" | "info" | "warning"
export type ToastEntry = { id: number; variant: ToastVariant; message: string; duration: number }

const DURATIONS: Record<ToastVariant, number> = { success: 4000, info: 4000, warning: 5000, error: 6000 }

export const toastStore = createStore<{ toasts: ToastEntry[] }>({ toasts: [] })

let nextId = 1
let timer: ReturnType<typeof setTimeout> | null = null

// Only the visible (newest) toast counts down; the rest wait their turn.
function schedule() {
    if (timer) clearTimeout(timer)
    timer = null
    const active = toastStore.get().toasts[0]
    if (active?.duration) timer = setTimeout(() => dismissToast(active.id), active.duration)
}

function push(variant: ToastVariant, message: string): number {
    const id = nextId++
    toastStore.set({ toasts: [{ id, variant, message, duration: DURATIONS[variant] }, ...toastStore.get().toasts] })
    schedule()
    return id
}

export function dismissToast(id: number): void {
    toastStore.set({ toasts: toastStore.get().toasts.filter((t) => t.id !== id) })
    schedule()
}

export function clearToasts(): void {
    if (timer) clearTimeout(timer)
    timer = null
    toastStore.set({ toasts: [] })
}

export const toast = {
    success: (message: string) => push("success", message),
    error: (message: string) => push("error", message),
    info: (message: string) => push("info", message),
    warning: (message: string) => push("warning", message),
}
