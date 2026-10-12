import "./errorState.css"
import Button from "../button/Button.tsx"

export default function ErrorState({ message, onRetry, className = "" }: { message: string; onRetry?: () => void; className?: string }) {
    return (
        <div className={`errorState outfit ${className}`} role="alert">
            <span className="op-80 break-words">{message}</span>
            {onRetry && (
                <Button variant="secondary" className="font-normal" onClick={onRetry}>
                    Retry
                </Button>
            )}
        </div>
    )
}
