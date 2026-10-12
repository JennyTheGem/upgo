import "./toast.css"
import { useEffect, type CSSProperties, type KeyboardEvent } from "react"
import { resolveIconSrc } from "../../utils/iconify.ts"
import { clearToasts, dismissToast, toastStore, type ToastVariant } from "./toast.ts"

const VARIANT_META: Record<ToastVariant, { icon: string; color: string; role: "alert" | "status" }> = {
    success: { icon: "iconify:check-circle-rounded", color: "var(--color-success)", role: "status" },
    info: { icon: "iconify:info-rounded", color: "var(--color-accent-solid)", role: "status" },
    warning: { icon: "iconify:warning-rounded", color: "var(--color-warning)", role: "status" },
    error: { icon: "iconify:error-rounded", color: "var(--color-danger)", role: "alert" },
}

export default function ToastViewport() {
    const { toasts } = toastStore.use()
    useEffect(() => clearToasts, [])

    const active = toasts[0]
    if (!active) return <div className="toastViewport z-overlay" />
    const meta = VARIANT_META[active.variant]
    const src = resolveIconSrc(meta.icon)
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            dismissToast(active.id)
        }
    }

    return (
        <div className="toastViewport z-overlay">
            <div
                key={active.id}
                className="uiContentContainer toastPill outfit"
                role={meta.role}
                tabIndex={0}
                title={active.message}
                onClick={() => dismissToast(active.id)}
                onKeyDown={onKeyDown}
                style={{ "--toast-variant-color": meta.color } as CSSProperties}
            >
                <span className="toastContent">
                    <span className="toastIconWrap" aria-hidden="true">
                        <span className="toastIcon" style={{ backgroundColor: meta.color, WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")` }} />
                    </span>
                    <span className="toastMessage">{active.message}</span>
                    {toasts.length > 1 && <span className="toastBadge">+{toasts.length - 1}</span>}
                </span>
            </div>
        </div>
    )
}
