import "./modal.css"
import { useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useEscape, useFocusTrap } from "../../utils/useFocusTrap.ts"
import Button from "../button/Button.tsx"

export default function Modal({ title, onClose, className = "", children }: { title: string; onClose: () => void; className?: string; children: ReactNode }) {
    const card = useRef<HTMLDivElement>(null)
    useFocusTrap(true, card)
    useEscape(true, onClose)

    return createPortal(
        <div className="modalBackdrop z-modal" onMouseDown={onClose} role="presentation">
            <div
                ref={card}
                className={`uiContentContainer modalCard outfit ${className}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="modalHeader">
                    <h2 className="modalTitle size-1_5 font-bold">{title}</h2>
                    <Button variant="icon" className="modalClose" imgProps={{ img: "iconify:close" }} onClick={onClose} aria-label="Close" title="Close" />
                </div>
                {children}
            </div>
        </div>,
        document.body,
    )
}
