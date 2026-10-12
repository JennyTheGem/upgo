import "./emptyState.css"
import type { ReactNode } from "react"

export default function EmptyState({ message, action, className = "" }: { message: ReactNode; action?: ReactNode; className?: string }) {
    return (
        <div className={`emptyState outfit ${className}`}>
            <span className="caption op-50">{message}</span>
            {action}
        </div>
    )
}
