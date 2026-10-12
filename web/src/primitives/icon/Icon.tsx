import type { CSSProperties } from "react"
import { resolveIconSrc } from "../../utils/iconify.ts"

export default function Icon({ name, color, className = "", alt = "" }: { name: string; color?: string; className?: string; alt?: string }) {
    const src = resolveIconSrc(name)
    if (color) {
        return (
            <span
                className={`iconMask ${className}`}
                style={{ "--icon-mask": `url("${src}")`, backgroundColor: color } as CSSProperties}
                role={alt ? "img" : undefined}
                aria-label={alt || undefined}
                aria-hidden={alt ? undefined : true}
            />
        )
    }
    return <img src={src} className={`iconImg ${className}`} alt={alt} />
}
