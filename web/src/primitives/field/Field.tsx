import "./field.css"
import type { ReactNode } from "react"

// The control inside takes className="fieldInput".
export default function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
    return (
        <label className={`field ${className}`}>
            <span className="fieldLabel microLabel">{label}</span>
            <span className="fieldControl">{children}</span>
        </label>
    )
}
