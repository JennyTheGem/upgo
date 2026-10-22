import "./errorState.css"
import type { ReactNode } from "react"
import Button from "../button/Button.tsx"

export default function ErrorState({ message, onRetry, action, className = "" }: { message: string; onRetry?: () => void; action?: ReactNode; className?: string }) {
    return (
        <div className={`errorState outfit ${className}`} role="alert">
            <span className="op-80 break-words">{message}</span>
            {onRetry && (
                <Button variant="secondary" className="font-normal" onClick={onRetry}>
                    Retry
                </Button>
            )}
            {action}
        </div>
    )
}
