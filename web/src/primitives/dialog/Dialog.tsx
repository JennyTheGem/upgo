import "./dialog.css"
import { useId, useRef, type CSSProperties, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { resolveIconSrc } from "../../utils/iconify.ts"
import { useEscape, useFocusTrap } from "../../utils/useFocusTrap.ts"

type Props = {
    open: boolean
    onClose: () => void
    title: string
    description?: string
    icon?: { name: string; color: string }
    role?: "dialog" | "alertdialog"
    initialFocusRef?: RefObject<HTMLElement | null>
    className?: string
    children: ReactNode
}

export default function Dialog({ open, onClose, title, description, icon, role = "dialog", initialFocusRef, className = "", children }: Props) {
    const card = useRef<HTMLDivElement>(null)
    const titleId = useId()
    const descId = useId()

    useFocusTrap(open, card, initialFocusRef)
    useEscape(open, onClose)

    if (!open) return null
    const iconSrc = icon && resolveIconSrc(icon.name)
    return createPortal(
        <>
            <div className="dialogCatcher z-overlay" onMouseDown={onClose} role="presentation" />
            <div className="dialogPosition z-overlay">
                <div
                    ref={card}
                    className={`uiContentContainer dialogPill outfit${icon ? " dialogPill--alert" : ""} ${className}`.trim()}
                    role={role}
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={description ? descId : undefined}
                    tabIndex={-1}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={icon ? ({ "--dialog-accent": icon.color } as CSSProperties) : undefined}
                >
                    <div className="dialogHead">
                        {icon && (
                            <span className="dialogIconWrap" aria-hidden="true">
                                <span className="dialogIcon" style={{ backgroundColor: icon.color, WebkitMaskImage: `url("${iconSrc}")`, maskImage: `url("${iconSrc}")` }} />
                            </span>
                        )}
                        <div className="dialogHeadText">
                            <span id={titleId} className="dialogTitle size-0_8 font-bold">{title}</span>
                            {description && <span id={descId} className="dialogDescription caption-small op-50">{description}</span>}
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </>,
        document.body,
    )
}
